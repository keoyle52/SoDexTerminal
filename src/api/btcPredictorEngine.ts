/**
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ BTC Predictor Engine                                                │
 * │ Cycle orchestration: signals → rule ensemble → Gemini → trade.      │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * The Predictor is the headline feature in the SoDEX Terminal Wave 2
 * roadmap. This module is the brain that, every N minutes:
 *
 *   1. Pulls a multi-source signal vector (technical + microstructure +
 *      flow + sentiment + macro).
 *   2. Computes a deterministic rule-based ensemble score.
 *   3. Hands the signal vector to Gemini 2.0-flash via `aiStrategist`
 *      so the LLM can act as a consensus-overlay second opinion.
 *   4. Combines the two into a final decision (direction, confidence,
 *      sizing).
 *   5. Optionally places a perps order on SoDEX through the existing
 *      EIP-712 signed-order pipeline.
 *
 * Design choices (keep these in mind when extending):
 *  - Pure functions only: this module never mutates React state. The
 *    page hooks call `runCycle` from a single `useEffect` interval.
 *  - Demo-mode safe: every data dependency already short-circuits to
 *    deterministic fakes via `isDemo()` in services.ts / sosoExtra.
 *  - Failure-tolerant: every external fetch is wrapped in try/catch so
 *    a SoSoValue rate-limit or Gemini outage degrades gracefully to a
 *    NEUTRAL/skipped cycle instead of crashing the bot.
 *  - The Strategist NEVER overrides the rule-based direction. It can
 *    only attenuate sizing or skip a trade. This keeps the system
 *    auditable and backtestable.
 */

import type {
  SignalSnapshot,
  PredictionDirection,
} from '../store/predictorStore';
import { DEFAULT_TAKER_FEE_RATE } from '../store/predictorStore';
import type { StrategistVerdict } from './aiStrategist';
import { callAiStrategist } from './aiStrategist';
import {
  fetchKlines,
  fetchOrderbook,
  fetchFundingRates,
  fetchTickers,
  placeOrder,
  updatePerpsLeverage,
  fetchSymbolTradingRules,
  type PlaceOrderParams,
} from './services';
import {
  fetchSosoNews,
  fetchEtfHistoricalInflow,
  getNewsTitle,
  fetchSosoIndices,
  type SosoNewsItem,
  type EtfDayData,
} from './sosoServices';
import {
  aggregateInstitutionalBtcFlow,
  type BtcPurchaseRow,
} from './sosoExtraServices';
import { analyzeSentimentBatch } from './geminiClient';

// ─── Public types ─────────────────────────────────────────────────────────────

export type CycleDurationMinutes = 1 | 3 | 5 | 15 | 60;

export interface CycleConfig {
  /** Trading symbol. Default "BTC-USD". */
  symbol: string;
  /** Market type: 'spot' or 'perps'. Default 'perps'. */
  market?: 'spot' | 'perps';
  /** Cycle window in minutes. Used both for the resolution timer and for
   *  picking the kline interval. */
  durationMinutes: CycleDurationMinutes;
  /** Notional position size in USDT when auto-trade is enabled. */
  tradeAmountUsdt: number;
  /** Leverage in x. Clamped to 1..25 (SoDEX cap). */
  leverage: number;
  /** When true, the cycle places a perps market order on its decision. */
  autoTrade: boolean;
  /** Skip the trade if the rule-decision confidence is below this. 0..100. */
  minConfidence: number;
  /** When true, the Strategist's `sizeMultiplier` scales the order size. */
  aiSizeAdjust: boolean;
  /** When true, opposite-direction Strategist verdicts skip the trade. */
  aiSkipOnDisagree: boolean;
}

export interface CycleResult {
  /** Composite rule-based direction. */
  direction: PredictionDirection;
  /** Final confidence used for sizing (post-AI overlay). 0..100. */
  confidence: number;
  /** Rule-based confidence before AI overlay. 0..100. */
  ruleConfidence: number;
  /** Full signal vector — also persisted in the predictor store. */
  signals: SignalSnapshot;
  /** Strategist verdict (may be `unavailable` if Gemini failed). */
  ai: StrategistVerdict;
  /** Live mark price at the moment of the decision. */
  entryPrice: number;
  /** Plain-English reason the cycle skipped, when applicable. */
  skippedReason?: string;
  /** Outcome of the optional auto-trade. */
  trade?: {
    placed: boolean;
    side?: 'LONG' | 'SHORT';
    quantity?: number;
    notional?: number;
    error?: string;
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Map cycle duration → primary kline interval used for signal computation. */
const CYCLE_TO_INTERVAL: Record<CycleDurationMinutes, string> = {
  1: '1m',
  3: '1m',
  5: '5m',
  15: '15m',
  60: '1h',
};

/** Number of klines pulled per cycle. 200 covers all indicators (MACD-26,
 *  ATR-14, RSI-14, EMA-21) with substantial warm-up overhead. */
const KLINE_LIMIT = 200;

/** Minimum |weightedScore| required to commit to a directional trade.
 *  Below this threshold the cycle is NEUTRAL with reason `weak_score`. */
const SCORE_THRESHOLD = 0.10;

/** Minimum agreement count among non-neutral signals to commit to a
 *  directional trade. Below this the cycle is NEUTRAL/`low_conviction`. */
const MIN_AGREEMENT = 3;

/** Round-trip taker fee margin multiplier — score must clear this many
 *  multiples of the fee envelope to overcome friction. */
const FEE_MARGIN_MULTIPLIER = 0.8;

/** Public Fear & Greed Index proxy fallback */
const FNG_PROXY_URL = 'https://api.allorigins.win/raw?url=https://api.alternative.me/fng/';
/** Cached F&G value (refreshed at most once per hour). */
let _fngCache: { value: number; ts: number } | null = null;
const FNG_CACHE_TTL = 60 * 60 * 1000;

// ─── Math helpers (private) ───────────────────────────────────────────────────

function sma(values: number[], period: number): number {
  if (values.length < period) return NaN;
  let sum = 0;
  for (let i = values.length - period; i < values.length; i++) sum += values[i];
  return sum / period;
}

function emaSeries(values: number[], period: number): number[] {
  const out: number[] = [];
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let prev = sma(values.slice(0, period), period);
  out.push(prev);
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

function rsi(values: number[], period = 14): number {
  if (values.length < period + 1) return 50;
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff > 0) avgGain += diff;
    else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;
  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

function macd(values: number[], fast = 12, slow = 26, sigP = 9): { hist: number; line: number } {
  if (values.length < slow + sigP) return { hist: 0, line: 0 };
  const fastE = emaSeries(values, fast);
  const slowE = emaSeries(values, slow);
  // Align the two EMA series at the tail.
  const off = fastE.length - slowE.length;
  if (off < 0) return { hist: 0, line: 0 };
  const line: number[] = [];
  for (let i = 0; i < slowE.length; i++) {
    line.push(fastE[i + off] - slowE[i]);
  }
  if (line.length < sigP) return { hist: 0, line: line[line.length - 1] ?? 0 };
  const sig = emaSeries(line, sigP);
  const hist = line[line.length - 1] - sig[sig.length - 1];
  return { hist, line: line[line.length - 1] };
}

/** Average True Range as % of price (volatility regime indicator). */
function atrPct(klines: Kline[], period = 14): number {
  if (klines.length < period + 1) return 0;
  const trs: number[] = [];
  for (let i = 1; i < klines.length; i++) {
    const high = klines[i].high;
    const low = klines[i].low;
    const prevClose = klines[i - 1].close;
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trs.push(tr);
  }
  // Wilder smoothing initial = simple mean of first `period` TRs.
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
  }
  const lastClose = klines[klines.length - 1].close;
  return lastClose > 0 ? (atr / lastClose) * 100 : 0;
}

/** Volume-Weighted Average Price across the supplied klines, using each
 *  candle's typical price (h+l+c)/3 weighted by volume. */
function vwap(klines: Kline[]): number {
  let pv = 0;
  let v = 0;
  for (const k of klines) {
    const typ = (k.high + k.low + k.close) / 3;
    const vol = k.volume ?? 0;
    pv += typ * vol;
    v += vol;
  }
  return v > 0 ? pv / v : klines[klines.length - 1]?.close ?? 0;
}

/** Map an unbounded value into the [-1, +1] range using tanh. */
function squash(x: number, scale: number): number {
  if (!Number.isFinite(x) || !Number.isFinite(scale) || scale === 0) return 0;
  const v = Math.tanh(x / scale);
  return Math.max(-1, Math.min(1, v));
}

// ─── Kline normalisation ─────────────────────────────────────────────────────

interface Kline {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

function normaliseKlines(raw: Record<string, unknown>[]): Kline[] {
  const out: Kline[] = [];
  for (const r of raw) {
    const time = Number(r.time ?? r.openTime ?? r.t ?? 0);
    const open = parseFloat(String(r.open ?? r.o ?? 0));
    const high = parseFloat(String(r.high ?? r.h ?? 0));
    const low = parseFloat(String(r.low ?? r.l ?? 0));
    const close = parseFloat(String(r.close ?? r.c ?? 0));
    const volume = parseFloat(String(r.volume ?? r.v ?? 0));
    if (close > 0) out.push({ time, open, high, low, close, volume });
  }
  out.sort((a, b) => a.time - b.time);
  return out;
}

// ─── External: Fear & Greed Index ─────────────────────────────────────────────

/**
 * Fetch the current Crypto Fear & Greed Index from alternative.me.
 * Returns a [-1, +1] contrarian signal: extreme greed (>=75) leans
 * BEARISH (mean reversion), extreme fear (<=25) leans BULLISH.
 *
 * The endpoint is public, no key required, rate-limited generously.
 * We cache for 1 hour because the index updates daily anyway.
 */
async function fetchFearGreedSignal(): Promise<{ raw: number; signal: number } | null> {
  const now = Date.now();
  if (_fngCache && now - _fngCache.ts < FNG_CACHE_TTL) {
    const v = _fngCache.value;
    return { raw: v, signal: contrarianFng(v) };
  }
  
  // 1. Try SoSoValue
  const sosoData = await fetchSosoIndices();
  if (sosoData?.fngIndex) {
    const raw = parseInt(sosoData.fngIndex);
    _fngCache = { value: raw, ts: now };
    return { raw, signal: contrarianFng(raw) };
  }

  // 2. Fallback to alternative.me
  try {
    const res = await fetch(`${FNG_PROXY_URL}?limit=1`, { method: 'GET' });
    if (!res.ok) return null;
    const json = await res.json() as { data?: Array<{ value?: string | number }> };
    const raw = Number(json?.data?.[0]?.value ?? NaN);
    if (!Number.isFinite(raw)) return null;
    _fngCache = { value: raw, ts: now };
    return { raw, signal: contrarianFng(raw) };
  } catch {
    return null;
  }
}

function contrarianFng(value: number): number {
  // 0..100 → mapped contrarian
  // value 50 = neutral, 25 = strong long bias, 75 = strong short bias.
  const centred = (50 - value) / 50;  // [-1, +1] (50 → 0)
  return Math.max(-1, Math.min(1, centred));
}

export async function fetchFearGreedHistory(limit = 300): Promise<{ date: string; value: number }[]> {
  try {
    const res = await fetch(`${FNG_PROXY_URL}?limit=${limit}`, { method: 'GET' });
    if (!res.ok) return [];
    const json = await res.json() as { data?: Array<{ value?: string | number; timestamp?: string }> };
    const list = json?.data ?? [];
    return list.map(item => {
      const val = Number(item.value);
      const ts = Number(item.timestamp) * 1000;
      const date = new Date(ts).toISOString().slice(0, 10);
      return { date, value: val };
    }).filter(x => Number.isFinite(x.value));
  } catch {
    return [];
  }
}

// ─── Signal gathering ─────────────────────────────────────────────────────────

interface GatherContext {
  symbol: string;
  market?: 'spot' | 'perps';
  interval: string;
  /** When provided, cap async work to a stale-tolerant subset (e.g. backtest). */
  skipExternal?: boolean;
}

/**
 * Pull every input the Predictor needs and build a {@link SignalSnapshot}.
 *
 * Concurrency: every fetch is fired in parallel. The slowest leg (SoSoValue
 * news + sentiment classification) is also the one most likely to fail —
 * we recover via deterministic demo synth in `geminiClient` so the cycle
 * never blocks waiting for a flaky upstream.
 */
export async function gatherSignals(ctx: GatherContext): Promise<{
  signals: SignalSnapshot;
  klines: Kline[];
  livePrice: number;
}> {
  const { symbol, interval } = ctx;

  // ── Fetch inputs in parallel ────────────────────────────────────────────────
  const klinesP = fetchKlines(symbol, interval, KLINE_LIMIT, 'perps', { bypassCache: true })
    .then((raw) => normaliseKlines(raw as Record<string, unknown>[]))
    .catch((): Kline[] => []);

  // 1m klines for the multi-timeframe alignment check (only for >=5m cycles).
  const oneMinKlinesP = interval === '1m'
    ? Promise.resolve<Kline[]>([])
    : fetchKlines(symbol, '1m', 60, 'perps', { bypassCache: true })
        .then((raw) => normaliseKlines(raw as Record<string, unknown>[]))
        .catch((): Kline[] => []);

  const orderbookP = fetchOrderbook(symbol, 'perps', 25)
    .catch(() => null);

  const fundingP = fetchFundingRates()
    .then((arr) => {
      const list = Array.isArray(arr) ? arr : [];
      const row = list.find((r) => String((r as Record<string, unknown>).symbol ?? '') === symbol)
        ?? list[0];
      const r = (row ?? {}) as Record<string, unknown>;
      const fr = parseFloat(String(r.fundingRate ?? 0));
      return Number.isFinite(fr) ? fr : 0;
    })
    .catch(() => 0);

  // News: latest 15 BTC-tagged headlines + Gemini sentiment classification.
  const newsP = ctx.skipExternal
    ? Promise.resolve({ score: 0, fallback: true, ts: null as number | null })
    : fetchSosoNews(1, 15, [1, 3, 5])
        .then(async (list) => {
          const items = list?.list ?? [];
          if (items.length === 0) return { score: 0, fallback: true, ts: Date.now() };
          // Score headlines in a single batch request!
          const headlines = items.slice(0, 8).map(getNewsTitle);
          let scored: number[] = [];
          try {
            const verdicts = await analyzeSentimentBatch(headlines);
            scored = verdicts.map((v) => {
              if (v.sentiment === 'BULLISH') return 1;
              if (v.sentiment === 'BEARISH') return -1;
              return 0;
            });
          } catch {
            scored = headlines.map(() => 0);
          }
          const sum = scored.reduce((a, b) => a + b, 0);
          const norm = scored.length > 0 ? sum / scored.length : 0;
          return { score: Math.max(-1, Math.min(1, norm)), fallback: false, ts: Date.now() };
        })
        .catch(() => ({ score: 0, fallback: true, ts: Date.now() }));

  // ETF flow: latest day net inflow direction.
  const etfP = ctx.skipExternal
    ? Promise.resolve({ score: 0, fallback: true, ts: null as number | null })
    : fetchEtfHistoricalInflow('us-btc-spot')
        .then((rows) => {
          const list = Array.isArray(rows) ? rows : [];
          if (list.length === 0) return { score: 0, fallback: true, ts: Date.now() };
          // Sort newest → oldest and look at the trailing 3-day window.
          const sorted = [...list].sort((a, b) =>
            String(b.date ?? '').localeCompare(String(a.date ?? '')),
          ).slice(0, 3);
          const sum = sorted.reduce((a, r) => a + Number(r.totalNetInflow ?? 0), 0);
          // ~$200M absolute flow saturates the signal at ±1.
          const norm = squash(sum, 200_000_000);
          return { score: norm, fallback: false, ts: Date.now() };
        })
        .catch(() => ({ score: 0, fallback: true, ts: Date.now() }));

  // Treasury accumulation 30d.
  const treasuryP = ctx.skipExternal
    ? Promise.resolve(null as null | { totalBtc: number; signal: number; topBuyer: string | null })
    : aggregateInstitutionalBtcFlow(30)
        .then((r) => ({
          totalBtc: r.totalBtc,
          signal: r.signal,
          topBuyer: r.topBuyer?.ticker ?? null,
        }))
        .catch(() => null);

  // Fear & Greed.
  const fngP = ctx.skipExternal
    ? Promise.resolve(null as null | { raw: number; signal: number })
    : fetchFearGreedSignal();

  const [klines, oneMinKlines, orderbookRaw, fundingRate, news, etf, treasury, fng] =
    await Promise.all([klinesP, oneMinKlinesP, orderbookP, fundingP, newsP, etfP, treasuryP, fngP]);

  if (klines.length < 30) {
    throw new Error('Insufficient kline history — at least 30 candles required.');
  }

  // ── Derive technical signals ───────────────────────────────────────────────
  const closes = klines.map((k) => k.close);
  const livePrice = closes[closes.length - 1];
  const prevClose = closes[closes.length - 2];

  const rsiVal = rsi(closes, 14);
  const rsiSignal = rsiVal > 70 ? -((rsiVal - 70) / 30)
    : rsiVal < 30 ? +((30 - rsiVal) / 30)
    : 0;

  // EMA cross: fast EMA(9) above EMA(21) = bullish trend.
  const ema9 = emaSeries(closes, 9);
  const ema21 = emaSeries(closes, 21);
  const emaDiff = (ema9[ema9.length - 1] ?? 0) - (ema21[ema21.length - 1] ?? 0);
  const emaSignal = squash(emaDiff, livePrice * 0.0005);  // ~0.05% spread saturates (more sensitive)

  const { hist: macdHist } = macd(closes);
  const macdSignal = squash(macdHist, livePrice * 0.0002); // ~0.02% spread saturates (more sensitive)

  // VWAP deviation — mean reversion bias when price is far from VWAP.
  const vwapVal = vwap(klines.slice(-Math.min(96, klines.length)));
  const vwapDeviation = vwapVal > 0 ? ((livePrice - vwapVal) / vwapVal) * 100 : 0;
  const vwapSignal = -squash(vwapDeviation, 0.4);  // ~0.4% deviation saturates (more sensitive)

  // Rate of Change over the last 12 candles.
  const rocBars = Math.min(12, closes.length - 1);
  const rocVal = rocBars > 0
    ? ((livePrice - closes[closes.length - 1 - rocBars]) / closes[closes.length - 1 - rocBars]) * 100
    : 0;
  const rocSignal = squash(rocVal, 0.2); // ~0.2% RoC saturates (more sensitive)

  // ATR for sizing + multi-timeframe alignment context.
  const atrPctVal = atrPct(klines);

  // Multi-timeframe alignment: 1m EMA(9) gradient sign vs main TF EMA gradient.
  let mtfAlignment = 0;
  if (oneMinKlines.length >= 30) {
    const oneMinCloses = oneMinKlines.map((k) => k.close);
    const oneMinEma = emaSeries(oneMinCloses, 9);
    if (oneMinEma.length >= 5) {
      const last = oneMinEma[oneMinEma.length - 1];
      const prev = oneMinEma[oneMinEma.length - 5];
      const grad = (last - prev) / prev;
      const oneMinSign = Math.sign(grad);
      const mainSign = Math.sign(emaDiff);
      // +0.3 alignment bonus when both agree, -0.3 when they conflict.
      mtfAlignment = oneMinSign === mainSign && oneMinSign !== 0 ? 0.3 : oneMinSign === 0 ? 0 : -0.2;
    }
  }

  // Microstructure: short-term momentum + last-candle body position.
  const lastK = klines[klines.length - 1];
  const bodyPct = lastK.high !== lastK.low
    ? ((lastK.close - lastK.low) / (lastK.high - lastK.low) - 0.5) * 2  // -1..+1
    : 0;
  const tickMomentum = prevClose > 0 ? (livePrice - prevClose) / prevClose : 0;
  const microstructureSignal = (squash(tickMomentum * 100, 0.3) + bodyPct) / 2;

  // Volume spike: last bar > 2x trailing-20 average AND directional candle.
  const volumes = klines.map((k) => k.volume ?? 0);
  const recentVols = volumes.slice(-21, -1);
  const avgVol = recentVols.length > 0 ? recentVols.reduce((a, b) => a + b, 0) / recentVols.length : 0;
  const lastVol = volumes[volumes.length - 1] ?? 0;
  const volumeSpike = avgVol > 0 && lastVol > 2 * avgVol && Math.abs(bodyPct) > 0.4;

  // ── Order-book imbalance ───────────────────────────────────────────────────
  let orderBookImbalance = 0.5;
  let orderBookSignal = 0;
  if (orderbookRaw) {
    const ob = orderbookRaw as Record<string, unknown>;
    const bidsRaw = (ob.bids ?? ob.b ?? []) as unknown[];
    const asksRaw = (ob.asks ?? ob.a ?? []) as unknown[];
    const sumSide = (rows: unknown[]): number => {
      let total = 0;
      for (const r of rows.slice(0, 10)) {
        const arr = Array.isArray(r) ? r : [];
        const qty = parseFloat(String(arr[1] ?? 0));
        if (Number.isFinite(qty)) total += qty;
      }
      return total;
    };
    const bidSize = sumSide(bidsRaw);
    const askSize = sumSide(asksRaw);
    const total = bidSize + askSize;
    if (total > 0) {
      orderBookImbalance = bidSize / total;
      // 0.6 imbalance = +0.4 signal magnitude when normalised.
      orderBookSignal = squash((orderBookImbalance - 0.5) * 2, 0.2);
    }
  }

  // ── Funding rate ──────────────────────────────────────────────────────────
  // Positive funding = longs paying shorts → crowded longs → contrarian SHORT.
  const fundingRateSignal = -squash(fundingRate, 0.00005);

  // ── News + ETF + Treasury + F&G ───────────────────────────────────────────
  const newsSentiment = news.score;
  const etfFlow = etf.score;
  const treasurySignal = treasury?.signal ?? 0;
  const fearGreedSignal = fng?.signal ?? 0;

  // ── Composite weighted ensemble ───────────────────────────────────────────
  // Each component is on the [-1, +1] axis; weights reflect how reliably
  // the source has historically predicted next-cycle direction.
  const components: Array<{ name: string; v: number; w: number }> = [
    { name: 'EMA',            v: emaSignal,            w: 1.0 },
    { name: 'MACD',           v: macdSignal,           w: 1.0 },
    { name: 'RSI',            v: rsiSignal,            w: 0.8 },
    { name: 'VWAP',           v: vwapSignal,           w: 0.7 },
    { name: 'RoC',            v: rocSignal,            w: 0.7 },
    { name: 'OrderBook',      v: orderBookSignal,      w: 0.8 },
    { name: 'Funding',        v: fundingRateSignal,    w: 0.6 },
    { name: 'Microstructure', v: microstructureSignal, w: 0.7 },
    { name: 'MTFAlign',       v: Math.sign(mtfAlignment), w: 0.5 },
    { name: 'News',           v: newsSentiment,        w: 1.2 },
    { name: 'ETF',            v: etfFlow,              w: 1.2 },
    { name: 'Treasury',       v: treasurySignal,       w: 1.0 },
    { name: 'FearGreed',      v: fearGreedSignal,      w: 0.8 },
  ];
  const totalW = components.reduce((a, c) => a + c.w, 0);
  const weightedScore = components.reduce((a, c) => a + c.v * c.w, 0) / totalW;

  // Agreement count: how many non-neutral signals point the same way as
  // the composite score sign.
  const dominantSign = Math.sign(weightedScore);
  const totalSignals = components.filter((c) => Math.abs(c.v) > 0.1).length;
  const agreementCount = components.filter(
    (c) => Math.abs(c.v) > 0.1 && Math.sign(c.v) === dominantSign,
  ).length;

  const signals: SignalSnapshot = {
    newsSentiment,
    etfFlow,
    newsLastFetched: news.ts,
    etfLastFetched: etf.ts,
    newsFallback: news.fallback,
    etfFallback: etf.fallback,
    orderBookImbalance,
    orderBookSignal,
    fundingRate,
    fundingRateSignal,
    microstructureSignal,
    volumeSpike,
    rsi: rsiVal,
    rsiSignal,
    emaSignal,
    macdSignal,
    vwapDeviation,
    vwapSignal,
    rocSignal,
    atrPct: atrPctVal,
    mtfAlignment,
    fearGreedRaw: fng?.raw,
    fearGreedSignal: fng?.signal,
    treasuryNetBtc: treasury?.totalBtc,
    treasurySignal: treasury?.signal,
    treasuryTopBuyer: treasury?.topBuyer ?? undefined,
    treasuryFallback: treasury == null,
    weightedScore,
    agreementCount,
    totalSignals,
  };

  return { signals, klines, livePrice };
}

// ─── Rule-based decision ─────────────────────────────────────────────────────

export interface RuleDecision {
  direction: PredictionDirection;
  /** 0..100 confidence — derived from |weightedScore| × agreement. */
  confidence: number;
  neutralReason?: SignalSnapshot['neutralReason'];
}

/**
 * Convert a {@link SignalSnapshot} into a tradable decision.
 *
 *  - Below the score threshold → NEUTRAL/`weak_score`.
 *  - Above threshold but |score| less than 1.5x fee envelope → NEUTRAL/`marginal_score`.
 *  - Score & confluence both clear thresholds → directional UP/DOWN.
 *  - Score clears threshold but agreement count < MIN_AGREEMENT → NEUTRAL/`low_conviction`.
 */
export function computeRuleDecision(signals: SignalSnapshot): RuleDecision {
  const score = signals.weightedScore;
  const absScore = Math.abs(score);
  const feeEnvelope = 2 * DEFAULT_TAKER_FEE_RATE;  // round-trip fee, expressed as 0..1 fraction
  const atrFraction = (signals.atrPct ?? 0.1) / 100;
  const expectedMove = atrFraction * 0.5;  // expected absolute move within one 5m cycle

  if (absScore < SCORE_THRESHOLD) {
    return { direction: 'NEUTRAL', confidence: 0, neutralReason: 'weak_score' };
  }
  if (expectedMove < FEE_MARGIN_MULTIPLIER * feeEnvelope && absScore < 0.20) {
    return { direction: 'NEUTRAL', confidence: 0, neutralReason: 'marginal_score' };
  }
  if (signals.agreementCount < MIN_AGREEMENT) {
    return { direction: 'NEUTRAL', confidence: 0, neutralReason: 'low_conviction' };
  }
  const direction: PredictionDirection = score > 0 ? 'UP' : 'DOWN';
  // Confidence: |score| (0..1) gives 0..70, then up to +30 from agreement
  // confluence above the minimum.
  const scoreComp = Math.min(70, Math.round(absScore * 100));
  const agreeComp = Math.min(30, Math.round(((signals.agreementCount - MIN_AGREEMENT) / 6) * 30));
  const confidence = Math.max(45, Math.min(95, scoreComp + agreeComp));
  return { direction, confidence };
}

// ─── Trade execution helper ──────────────────────────────────────────────────

interface TradeAttempt {
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  notionalUsdt: number;
  leverage: number;
}

/**
 * Best-effort market order to open the position recommended by the cycle.
 * Returns a tagged result so the caller can persist `OpenPosition` and
 * surface user-facing toasts.
 */
async function openMarketPosition(t: TradeAttempt): Promise<{
  placed: boolean;
  quantity?: number;
  notional?: number;
  error?: string;
}> {
  try {
    // Apply leverage first — SoDEX rejects the request if there are open
    // orders/positions on the same symbol, so any failure here propagates.
    try {
      await updatePerpsLeverage(t.symbol, t.leverage, 2);
    } catch (e) {
      // Non-fatal: leverage may already be set, or the user may have an
      // open position from a previous cycle. Don't block the cycle on it.
      console.warn('[BtcPredictor] updatePerpsLeverage skipped:', e instanceof Error ? e.message : e);
    }

    const rules = await fetchSymbolTradingRules(t.symbol, 'perps').catch(() => null);
    const stepSize = rules?.stepSize ?? 0.001;
    const qtyPrecision = rules?.quantityPrecision ?? 3;

    // Convert USDT notional → BTC quantity at the live mark.
    const rawQty = t.notionalUsdt / Math.max(t.entryPrice, 1);
    const qty = Math.max(stepSize, Math.floor(rawQty / stepSize) * stepSize);
    const qtyStr = qty.toFixed(qtyPrecision);

    const params: PlaceOrderParams = {
      symbol: t.symbol,
      side: t.side === 'LONG' ? 1 : 2,
      type: 2,                    // MARKET
      quantity: qtyStr,
      timeInForce: 3,             // IOC
      reduceOnly: false,
    };
    await placeOrder(params, 'perps');
    return { placed: true, quantity: qty, notional: qty * t.entryPrice };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { placed: false, error: msg };
  }
}

/**
 * Issue a reduce-only market close for an existing position.
 * Used by `closeOnNeutral` and the `renewEveryCycle` path.
 */
export async function closeMarketPosition(
  symbol: string,
  side: 'LONG' | 'SHORT',
  quantity: number,
): Promise<{ closed: boolean; error?: string }> {
  try {
    const rules = await fetchSymbolTradingRules(symbol, 'perps').catch(() => null);
    const qtyPrecision = rules?.quantityPrecision ?? 3;
    const params: PlaceOrderParams = {
      symbol,
      side: side === 'LONG' ? 2 : 1,    // opposite side closes
      type: 2,
      quantity: quantity.toFixed(qtyPrecision),
      timeInForce: 3,
      reduceOnly: true,
    };
    await placeOrder(params, 'perps');
    return { closed: true };
  } catch (err) {
    return { closed: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── The cycle runner ────────────────────────────────────────────────────────

/**
 * Execute a single Predictor cycle end-to-end and return a structured
 * result for the UI / store to consume.
 *
 * Side-effects: this function will hit Gemini (via aiStrategist) and
 * may place a perps market order if `cfg.autoTrade` is true. It does
 * NOT mutate the predictor store directly — that's the caller's job.
 */
export async function runCycle(cfg: CycleConfig): Promise<CycleResult> {
  const interval = CYCLE_TO_INTERVAL[cfg.durationMinutes];
  const { signals, livePrice } = await gatherSignals({ symbol: cfg.symbol, market: cfg.market, interval });
  const rule = computeRuleDecision(signals);

  // Strategist always runs (cheap synth in demo mode). Even on NEUTRAL
  // cycles we want the rationale visible so the user understands why
  // the bot stood down.
  const ai = await callAiStrategist(signals, livePrice);

  // Combine: rule-based direction wins; AI can override sizing or skip.
  let finalConfidence = rule.confidence;
  let skippedReason: string | undefined;
  let shouldTrade = cfg.autoTrade && rule.direction !== 'NEUTRAL';

  if (rule.direction === 'NEUTRAL') {
    skippedReason = signals.neutralReason ?? 'weak signals';
  }

  if (shouldTrade && rule.confidence < cfg.minConfidence) {
    shouldTrade = false;
    skippedReason = `confidence ${rule.confidence} < threshold ${cfg.minConfidence}`;
  }

  let aiSizeMul = 1;
  if (cfg.aiSkipOnDisagree && shouldTrade) {
    const ruleSide = rule.direction === 'UP' ? 'LONG' : 'SHORT';
    if ((ai.decision === 'LONG' || ai.decision === 'SHORT') && ai.decision !== ruleSide) {
      shouldTrade = false;
      skippedReason = `AI disagree: rule=${ruleSide}, ai=${ai.decision}`;
    }
  }
  if (cfg.aiSizeAdjust && shouldTrade) {
    aiSizeMul = Math.max(0, Math.min(1, ai.sizeMultiplier));
    if (aiSizeMul === 0) {
      shouldTrade = false;
      skippedReason = `AI sizeMultiplier=0 (${ai.decision})`;
    }
  }
  // Multiplicative blend: final confidence reflects AI conviction too.
  finalConfidence = Math.round(rule.confidence * (cfg.aiSizeAdjust ? aiSizeMul : 1));

  let trade: CycleResult['trade'] | undefined;
  if (shouldTrade) {
    const side: 'LONG' | 'SHORT' = rule.direction === 'UP' ? 'LONG' : 'SHORT';
    const notional = cfg.tradeAmountUsdt * (cfg.aiSizeAdjust ? aiSizeMul : 1);
    if (notional < 1) {
      trade = { placed: false, error: 'notional too small after sizing' };
    } else {
      const r = await openMarketPosition({
        symbol: cfg.symbol,
        side,
        entryPrice: livePrice,
        notionalUsdt: notional,
        leverage: cfg.leverage,
      });
      trade = { placed: r.placed, side, quantity: r.quantity, notional: r.notional, error: r.error };
    }
  }

  return {
    direction: rule.direction,
    confidence: finalConfidence,
    ruleConfidence: rule.confidence,
    signals: { ...signals, neutralReason: rule.neutralReason ?? null },
    ai,
    entryPrice: livePrice,
    skippedReason,
    trade,
  };
}

// ─── Quick backtest ──────────────────────────────────────────────────────────

export interface HistoricalBacktestData {
  etf?: EtfDayData[];
  fng?: { date: string; value: number }[];
  treasury?: BtcPurchaseRow[];
  news?: SosoNewsItem[];
}

export interface BacktestRun {
  cycles: number;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalNetPct: number;
  avgNetPct: number;
  bestPct: number;
  worstPct: number;
  sharpe: number;
  maxDrawdownPct: number;
  /** Sequence of net %s for the equity curve. */
  series: { ts: number; equity: number; drawdown: number }[];
}

// ─── Historical mapping helpers ──────────────────────────────────────────────

function tsToDateString(ts: number): string {
  const ms = ts > 1e12 ? ts : ts * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

function getHistoricalEtfScore(etfHistory: EtfDayData[] | undefined, dateStr: string): number {
  if (!etfHistory || etfHistory.length === 0) return 0;
  const idx = etfHistory.findIndex(e => e.date === dateStr);
  if (idx === -1) return 0;
  const start = Math.max(0, idx - 2);
  const slice = etfHistory.slice(start, idx + 1);
  const sum = slice.reduce((a, r) => a + Number(r.totalNetInflow ?? 0), 0);
  return squash(sum, 200_000_000);
}

function getHistoricalFngScore(fngHistory: { date: string; value: number }[] | undefined, dateStr: string): number {
  if (!fngHistory || fngHistory.length === 0) return 0;
  const entry = fngHistory.find(e => e.date === dateStr);
  if (!entry) return 0;
  return contrarianFng(entry.value);
}

function getHistoricalTreasuryScore(purchases: BtcPurchaseRow[] | undefined, ts: number): number {
  if (!purchases || purchases.length === 0) return 0;
  const ms = ts > 1e12 ? ts : ts * 1000;
  const cutoff = ms - 30 * 24 * 60 * 60 * 1000;
  const recent = purchases.filter(r => {
    const time = new Date(r.date).getTime();
    return time >= cutoff && time <= ms;
  });
  const total = recent.reduce((s, r) => s + r.btcAcq, 0);
  return Math.max(-1, Math.min(1, total / 5000));
}

function classifySentimentRegex(title: string): number {
  const t = title.toLowerCase();
  const positiveWords = [
    'bullish', 'approved', 'bought', 'accumulation', 'rally', 'rise', 'positive', 
    'long', 'gain', 'surges', 'high', 'breakout', 'success', 'inflow', 'green', 
    'support', 'pump', 'growth', 'adoption', 'partner', 'sec approves'
  ];
  const negativeWords = [
    'bearish', 'liquidated', 'drop', 'dump', 'negative', 'short', 'loss', 'falls',
    'plunges', 'breakdown', 'crash', 'panic', 'selloff', 'outflow', 'red', 'resistance',
    'hacked', 'scam', 'ban', 'rejected', 'delay', 'lawsuit', 'sec sues', 'inflation'
  ];
  let score = 0;
  for (const w of positiveWords) {
    if (t.includes(w)) score += 1;
  }
  for (const w of negativeWords) {
    if (t.includes(w)) score -= 1;
  }
  return Math.max(-1, Math.min(1, score));
}

function getHistoricalNewsScore(news: SosoNewsItem[] | undefined, ts: number): number {
  if (!news || news.length === 0) return 0;
  const ms = ts > 1e12 ? ts : ts * 1000;
  const cutoff = ms - 6 * 60 * 60 * 1000; // 6 hours
  const recent = news.filter(n => n.releaseTime >= cutoff && n.releaseTime <= ms);
  if (recent.length === 0) return 0;
  const scores = recent.map(n => classifySentimentRegex(getNewsTitle(n)));
  const sum = scores.reduce((a, b) => a + b, 0);
  return sum / scores.length;
}

/**
 * Run a deterministic local backtest over the supplied historical klines.
 * 
 * Replays the exact 13-signal rule ensemble using historical data-aligned
 * streams (ETF, Treasuries, Fear & Greed, and News sentiment).
 */
export function runQuickBacktest(
  klines: Kline[],
  opts: {
    lookback: number;
    takerFee?: number;
    historicalData?: HistoricalBacktestData;
  } = { lookback: 100 },
): BacktestRun {
  const empty: BacktestRun = {
    cycles: 0, trades: 0, wins: 0, losses: 0, winRate: 0,
    totalNetPct: 0, avgNetPct: 0, bestPct: 0, worstPct: 0,
    sharpe: 0, maxDrawdownPct: 0, series: [],
  };
  if (klines.length < 100) return empty;

  const lookback = Math.max(50, Math.min(opts.lookback, klines.length - 5));
  const fee = opts.takerFee ?? DEFAULT_TAKER_FEE_RATE;
  const startIdx = Math.max(50, klines.length - lookback);

  // Multi-bar exit envelope.
  const MAX_HOLD_BARS = 8;
  const TP_MULT = 2.0;
  const SL_MULT = 1.0;

  const returns: number[] = [];
  const series: { ts: number; equity: number; drawdown: number }[] = [];
  let equity = 0;
  let peak = 0;
  let trades = 0;
  let wins = 0;
  let best = 0;
  let worst = 0;
  let cooldownUntil = -1;

  for (let i = startIdx; i < klines.length - MAX_HOLD_BARS - 1; i++) {
    if (i < cooldownUntil) continue;

    const subset = klines.slice(0, i + 1);
    const closes = subset.map((k) => k.close);
    if (closes.length < 30) continue;

    const lastPrice = closes[closes.length - 1];
    const prevClose = closes[closes.length - 2];

    const atr = atrPct(subset);
    // Dynamic regime filter: check if volatility is sufficient to cover fee friction
    if (atr < 0.08) continue;

    // Technical Indicators
    const rsiVal = rsi(closes, 14);
    const rsiSignal = rsiVal > 70 ? -((rsiVal - 70) / 30)
      : rsiVal < 30 ? +((30 - rsiVal) / 30)
      : 0;

    const ema9 = emaSeries(closes, 9);
    const ema21 = emaSeries(closes, 21);
    const emaDiff = (ema9[ema9.length - 1] ?? 0) - (ema21[ema21.length - 1] ?? 0);
    const emaSignal = squash(emaDiff, lastPrice * 0.0005);

    const { hist } = macd(closes);
    const macdSignal = squash(hist, lastPrice * 0.0002);

    const vwapVal = vwap(subset.slice(-Math.min(96, subset.length)));
    const vwapDeviation = vwapVal > 0 ? ((lastPrice - vwapVal) / vwapVal) * 100 : 0;
    const vwapSignal = -squash(vwapDeviation, 0.4);

    const rocBars = Math.min(12, closes.length - 1);
    const rocVal = rocBars > 0
      ? ((lastPrice - closes[closes.length - 1 - rocBars]) / closes[closes.length - 1 - rocBars]) * 100
      : 0;
    const rocSignal = squash(rocVal, 0.2);

    const lastK = subset[subset.length - 1];
    const bodyPct = lastK.high !== lastK.low
      ? ((lastK.close - lastK.low) / (lastK.high - lastK.low) - 0.5) * 2
      : 0;
    const tickMomentum = prevClose > 0 ? (lastPrice - prevClose) / prevClose : 0;
    const microstructureSignal = (squash(tickMomentum * 100, 0.3) + bodyPct) / 2;

    const volumes = subset.map((k) => k.volume ?? 0);
    const recentVols = volumes.slice(-21, -1);
    const avgVol = recentVols.length > 0 ? recentVols.reduce((a, b) => a + b, 0) / recentVols.length : 0;
    const lastVol = volumes[volumes.length - 1] ?? 0;
    const volumeSpike = avgVol > 0 && lastVol > 2 * avgVol && Math.abs(bodyPct) > 0.4;

    // Stubs for microstructure orderbook & funding rates
    const orderBookImbalance = 0.5;
    const orderBookSignal = 0;
    const fundingRate = 0;
    const fundingRateSignal = 0;
    const mtfAlignment = 0;

    // Historical align streams
    const dateStr = tsToDateString(lastK.time);
    
    const newsSentiment = getHistoricalNewsScore(opts.historicalData?.news, lastK.time);
    const etfFlow = getHistoricalEtfScore(opts.historicalData?.etf, dateStr);
    const treasurySignal = getHistoricalTreasuryScore(opts.historicalData?.treasury, lastK.time);
    const fearGreedSignal = getHistoricalFngScore(opts.historicalData?.fng, dateStr);

    const components: Array<{ name: string; v: number; w: number }> = [
      { name: 'EMA',            v: emaSignal,            w: 1.0 },
      { name: 'MACD',           v: macdSignal,           w: 1.0 },
      { name: 'RSI',            v: rsiSignal,            w: 0.8 },
      { name: 'VWAP',           v: vwapSignal,           w: 0.7 },
      { name: 'RoC',            v: rocSignal,            w: 0.7 },
      { name: 'OrderBook',      v: orderBookSignal,      w: 0.8 },
      { name: 'Funding',        v: fundingRateSignal,    w: 0.6 },
      { name: 'Microstructure', v: microstructureSignal, w: 0.7 },
      { name: 'MTFAlign',       v: Math.sign(mtfAlignment), w: 0.5 },
      { name: 'News',           v: newsSentiment,        w: 1.2 },
      { name: 'ETF',            v: etfFlow,              w: 1.2 },
      { name: 'Treasury',       v: treasurySignal,       w: 1.0 },
      { name: 'FearGreed',      v: fearGreedSignal,      w: 0.8 },
    ];
    const totalW = components.reduce((a, c) => a + c.w, 0);
    const weightedScore = components.reduce((a, c) => a + c.v * c.w, 0) / totalW;

    const dominantSign = Math.sign(weightedScore);
    const totalSignals = components.filter((c) => Math.abs(c.v) > 0.1).length;
    const agreementCount = components.filter(
      (c) => Math.abs(c.v) > 0.1 && Math.sign(c.v) === dominantSign,
    ).length;

    const signals: SignalSnapshot = {
      newsSentiment,
      etfFlow,
      newsLastFetched: null,
      etfLastFetched: null,
      newsFallback: false,
      etfFallback: false,
      orderBookImbalance,
      orderBookSignal,
      fundingRate,
      fundingRateSignal,
      microstructureSignal,
      volumeSpike,
      rsi: rsiVal,
      rsiSignal,
      emaSignal,
      macdSignal,
      vwapDeviation,
      vwapSignal,
      rocSignal,
      atrPct: atr,
      mtfAlignment,
      fearGreedRaw: undefined,
      fearGreedSignal,
      treasuryNetBtc: undefined,
      treasurySignal,
      treasuryFallback: false,
      weightedScore,
      agreementCount,
      totalSignals,
    };

    const decision = computeRuleDecision(signals);
    if (decision.direction === 'NEUTRAL') continue;

    const direction = decision.direction;

    // ── Multi-bar TP/SL exit simulation ────────────────────────────
    const entry = lastPrice;
    const tpDist = entry * (atr / 100) * TP_MULT;
    const slDist = entry * (atr / 100) * SL_MULT;
    let exitPrice = entry;
    let barsHeld = MAX_HOLD_BARS;

    for (let h = 1; h <= MAX_HOLD_BARS; h++) {
      const bar = klines[i + h];
      if (!bar) break;
      const tpHit = direction === 'UP'
        ? bar.high >= entry + tpDist
        : bar.low  <= entry - tpDist;
      const slHit = direction === 'UP'
        ? bar.low  <= entry - slDist
        : bar.high >= entry + slDist;

      if (tpHit && slHit) {
        exitPrice = direction === 'UP' ? entry - slDist : entry + slDist;
        barsHeld = h;
        break;
      }
      if (tpHit) {
        exitPrice = direction === 'UP' ? entry + tpDist : entry - tpDist;
        barsHeld = h;
        break;
      }
      if (slHit) {
        exitPrice = direction === 'UP' ? entry - slDist : entry + slDist;
        barsHeld = h;
        break;
      }
      if (h === MAX_HOLD_BARS) {
        exitPrice = bar.close;
      }
    }

    // ── PnL ────────────────────────────────────────────────────────
    const pct = ((exitPrice - entry) / entry) * 100;
    const directional = direction === 'UP' ? pct : -pct;
    const net = directional - 2 * fee * 100;

    returns.push(net);
    trades++;
    if (net > 0) wins++;
    if (net > best) best = net;
    if (net < worst) worst = net;
    equity += net;
    if (equity > peak) peak = equity;
    series.push({
      ts: klines[i].time,
      equity,
      drawdown: peak - equity,
    });

    cooldownUntil = i + barsHeld + 1;
  }

  if (trades === 0) return empty;

  // Sharpe (per-trade, annualised assuming 5-min cycles ≈ 105k bars/year).
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / returns.length;
  const std = Math.sqrt(variance);
  const sharpe = std > 0 ? (mean / std) * Math.sqrt(105_120) : 0;

  return {
    cycles: klines.length - startIdx - 1,
    trades,
    wins,
    losses: trades - wins,
    winRate: wins / trades,
    totalNetPct: equity,
    avgNetPct: mean,
    bestPct: best,
    worstPct: worst,
    sharpe,
    maxDrawdownPct: Math.max(0, ...series.map((s) => s.drawdown)),
    series,
  };
}

// ─── Public utility: reload klines (used by the page's backtest button) ──────

export async function loadKlines(symbol: string, interval: string, limit = 500, market: 'spot'|'perps' = 'perps'): Promise<Kline[]> {
  const raw = await fetchKlines(symbol, interval, limit, market, { bypassCache: true });
  return normaliseKlines(raw as Record<string, unknown>[]);
}

// ─── Quick mark-price helper ────────────────────────────────────────────────

/**
 * Cheap REST fetch of the current mark price for a symbol. Used by the
 * cycle resolver as an exitPrice when no live WS tick has arrived yet.
 */
export async function fetchMarkPriceFor(symbol: string, market: 'spot' | 'perps' = 'perps'): Promise<number | null> {
  try {
    const tickers = (await fetchTickers(market)) as Record<string, unknown>[];
    const list = Array.isArray(tickers) ? tickers : [];
    const row = list.find((t) => String(t.symbol ?? '') === symbol);
    if (!row) return null;
    const px = parseFloat(String(row.markPrice ?? row.lastPrice ?? (row as any).lastPx ?? 0));
    return Number.isFinite(px) && px > 0 ? px : null;
  } catch {
    return null;
  }
}

/**
 * Lightweight read-only signal snapshot — used by the Dashboard widget to
 * populate the Headline Signal card without starting a full predictor cycle.
 *
 * Unlike `runCycle`:
 *  - Never places an order.
 *  - Never calls the AI Strategist.
 *  - Uses the 5-minute kline interval (default cycle resolution).
 *
 * Returns null on any failure so the caller can handle it gracefully.
 */
export async function runSignalSnapshot(
  symbol = 'BTC-USD',
): Promise<{ signals: SignalSnapshot; direction: PredictionDirection; confidence: number; price: number } | null> {
  try {
    const { signals, livePrice } = await gatherSignals({ symbol, interval: '5m' });
    const rule = computeRuleDecision(signals);
    return {
      signals,
      direction: rule.direction,
      confidence: rule.confidence,
      price: livePrice,
    };
  } catch {
    return null;
  }
}
