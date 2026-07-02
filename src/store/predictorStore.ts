import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StrategistVerdict } from '../api/aiStrategist';

export type PredictionDirection = 'UP' | 'DOWN' | 'NEUTRAL';
export type PredictionResult = 'CORRECT' | 'WRONG' | 'SKIPPED' | 'PENDING';

export interface SignalSnapshot {
  // SoSoValue signals
  newsSentiment: number;        // -1 to +1
  etfFlow: number;              // -1 to +1
  newsLastFetched: number | null;
  etfLastFetched: number | null;
  newsFallback?: boolean;           // true when SoSoValue news was unavailable
  etfFallback?: boolean;            // true when SoSoValue ETF was unavailable
  // Order book
  orderBookImbalance: number;   // raw ratio bid/(bid+ask)
  orderBookSignal: number;      // -1 to +1 (gradient, dynamic z-score based)
  orderBookZScore?: number;     // z-score of current imbalance vs recent history
  // Funding rate
  fundingRate: number;          // raw value
  fundingRateSignal: number;    // -1 to +1
  fundingMomentum?: number;     // change rate between cycles
  fundingMomentumSignal?: number; // -1 to +1
  // Price microstructure
  microstructureSignal: number; // -1 to +1
  volumeSpike: boolean;
  // Technical
  rsi: number;
  rsiSignal: number;
  emaSignal: number;
  macdSignal: number;
  // Multi-factor extensions
  vwapDeviation?: number;       // raw % deviation from VWAP
  vwapSignal?: number;          // -1 to +1 (mean-reversion)
  rocSignal?: number;           // rate-of-change signal, -1 to +1
  atrPct?: number;              // ATR as % of price (volatility regime)
  // Multi-timeframe alignment (1m EMA gradient vs main TF)
  mtfAlignment?: number;        // -1 to +1
  // Fear & Greed Index (alternative.me, 1h cache)
  fearGreedRaw?: number;        // 0-100 raw index value
  fearGreedSignal?: number;     // -1 to +1 normalised
  // 9th signal — institutional BTC treasury flow (last 30d)
  treasuryNetBtc?: number;      // raw BTC accumulated by treasury cos. in 30d
  treasurySignal?: number;      // -1 to +1, normalised
  treasuryTopBuyer?: string;    // ticker of biggest 30d buyer
  treasuryFallback?: boolean;   // true when SoSoValue treasury data unavailable
  // Composite
  weightedScore: number;
  agreementCount: number;       // how many signals agree with proposed direction (pre-conviction)
  totalSignals: number;         // total non-neutral signals counted
  /** Populated only when the cycle resolved to NEUTRAL; null otherwise.
   *  'weak_score'     — |weightedScore| did not clear the threshold
   *  'marginal_score' — cleared threshold but by less than the margin
   *                     multiplier required to overcome round-trip fee + noise
   *  'low_conviction' — score cleared threshold but too few signals agreed
   *  'warmup'         — observation-only cycle while the engine calibrates
   *                     adaptive components (first ~10 cycles after Start) */
  neutralReason?: 'weak_score' | 'marginal_score' | 'low_conviction' | 'warmup' | null;
}

export interface PredictionEntry {
  id: string;
  timestamp: number;
  direction: PredictionDirection;
  confidence: number;          // 0–100
  entryPrice: number;
  exitPrice: number | null;
  result: PredictionResult;
  pricePct: number | null;     // actual % change after 5 min
  /** Net % after entry+exit taker fees (leverage-free). Computed at
   *  resolution. Positive = would have been profitable at 1x leverage. */
  netPricePct?: number | null;
  /** Taker fee rate snapshot used for net PnL computation (e.g. 0.0004). */
  feeRateUsed?: number;
  signals: SignalSnapshot;
}

export interface SymbolState {
  currentPrediction: PredictionDirection;
  currentConfidence: number;
  currentSignals: SignalSnapshot | null;
  cycleStartTime: number | null;
  entryPrice: number | null;
  history: PredictionEntry[];
  correct: number;
  wrong: number;
  skipped: number;
  aiVerdict: StrategistVerdict | null;
  openPosition: OpenPosition | null;
}

const defaultSymbolState: SymbolState = {
  currentPrediction: 'NEUTRAL',
  currentConfidence: 0,
  currentSignals: null,
  cycleStartTime: null,
  entryPrice: null,
  history: [],
  correct: 0,
  wrong: 0,
  skipped: 0,
  aiVerdict: null,
  openPosition: null,
};

interface PredictorState {
  symbols: Record<string, SymbolState>;

  // ── Trading settings (optional auto-order placement) ──
  autoTradeEnabled: boolean;
  tradeAmountUsdt: string;
  tradeLeverage: number;
  closeOnNeutral: boolean;
  renewEveryCycle: boolean;
  stopLossEnabled: boolean;
  slAtrMult: number;

  // ── AI Strategist overlay ──
  aiStrategistEnabled: boolean;
  aiSizeAdjustEnabled: boolean;
  aiSkipOnDisagree: boolean;

  // actions
  setCurrentPrediction: (symbol: string, d: PredictionDirection, conf: number, signals: SignalSnapshot, price: number) => void;
  resolvePrediction: (symbol: string, id: string, exitPrice: number) => void;
  addHistoryEntry: (symbol: string, entry: PredictionEntry) => void;
  resetStats: (symbol: string) => void;
  setAutoTradeEnabled: (v: boolean) => void;
  setTradeAmountUsdt: (v: string) => void;
  setTradeLeverage: (v: number) => void;
  setCloseOnNeutral: (v: boolean) => void;
  setRenewEveryCycle: (v: boolean) => void;
  setStopLossEnabled: (v: boolean) => void;
  setSlAtrMult: (v: number) => void;
  setAiStrategistEnabled: (v: boolean) => void;
  setAiSizeAdjustEnabled: (v: boolean) => void;
  setAiSkipOnDisagree: (v: boolean) => void;
  setAiVerdict: (symbol: string, v: StrategistVerdict | null) => void;
  setOpenPosition: (symbol: string, p: OpenPosition | null) => void;
}

/**
 * Round-trip taker fee rate used to compute the net-PnL metric. SoDEX
 * Tier-1 perps taker = 0.04%. One cycle => entry + exit = 2x takerRate.
 * Kept as a constant here so the store has no dependency on services.ts.
 * Call sites may override by passing an explicit rate to resolvePrediction.
 */
export const DEFAULT_TAKER_FEE_RATE = 0.0004;

/**
 * Snapshot of the position the predictor opened. Tracks just enough
 * to display PnL in the UI and to send the matching reduce-only close.
 */
export interface OpenPosition {
  symbol: string;
  side: 'LONG' | 'SHORT';
  /** BTC quantity sent to the exchange (notional / entryPrice). */
  quantity: number;
  /** USDT amount the user requested when opening. */
  notionalUsdt: number;
  entryPrice: number;
  leverage: number;
  openedAt: number;
}

export const usePredictorStore = create<PredictorState>()(
  persist(
    (set, get) => ({
      symbols: {},

      // Trading defaults: disabled, conservative size + leverage
      autoTradeEnabled: false,
      tradeAmountUsdt: '100',
      tradeLeverage: 5,
      closeOnNeutral: false,
      renewEveryCycle: false,
      stopLossEnabled: true,
      slAtrMult: 1.5,
      aiStrategistEnabled: true,
      aiSizeAdjustEnabled: true,
      aiSkipOnDisagree: false,

      setAutoTradeEnabled: (v) => set({ autoTradeEnabled: v }),
      setTradeAmountUsdt: (v) => set({ tradeAmountUsdt: v }),
      setTradeLeverage: (v) => set({ tradeLeverage: Math.max(1, Math.min(25, v)) }),
      setCloseOnNeutral: (v) => set({ closeOnNeutral: v }),
      setRenewEveryCycle: (v) => set({ renewEveryCycle: v }),
      setStopLossEnabled: (v) => set({ stopLossEnabled: v }),
      setSlAtrMult: (v) => set({ slAtrMult: Math.max(0.5, Math.min(5, v)) }),
      setAiStrategistEnabled: (v) => set({ aiStrategistEnabled: v }),
      setAiSizeAdjustEnabled: (v) => set({ aiSizeAdjustEnabled: v }),
      setAiSkipOnDisagree: (v) => set({ aiSkipOnDisagree: v }),
      
      setAiVerdict: (symbol, v) => set((s) => ({
        symbols: {
          ...s.symbols,
          [symbol]: { ...(s.symbols[symbol] || defaultSymbolState), aiVerdict: v }
        }
      })),
      
      setOpenPosition: (symbol, p) => set((s) => ({
        symbols: {
          ...s.symbols,
          [symbol]: { ...(s.symbols[symbol] || defaultSymbolState), openPosition: p }
        }
      })),

      setCurrentPrediction: (symbol, direction, confidence, signals, price) => set((s) => ({
        symbols: {
          ...s.symbols,
          [symbol]: {
            ...(s.symbols[symbol] || defaultSymbolState),
            currentPrediction: direction,
            currentConfidence: confidence,
            currentSignals: signals,
            cycleStartTime: Date.now(),
            entryPrice: price,
          }
        }
      })),

      resolvePrediction: (symbol, id, exitPrice) => {
        const state = get();
        const symState = state.symbols[symbol];
        if (!symState) return;
        
        const entry = symState.history.find((e) => e.id === id);
        if (!entry || entry.result !== 'PENDING') return;
        if (entry.entryPrice <= 0) return;

        const pct = ((exitPrice - entry.entryPrice) / entry.entryPrice) * 100;
        let result: PredictionResult;
        if (entry.direction === 'NEUTRAL') {
          result = 'SKIPPED';
        } else if (entry.direction === 'UP') {
          result = pct > 0 ? 'CORRECT' : 'WRONG';
        } else {
          result = pct < 0 ? 'CORRECT' : 'WRONG';
        }

        const feeRateUsed = DEFAULT_TAKER_FEE_RATE;
        const netPricePct = entry.direction === 'NEUTRAL'
          ? null
          : (entry.direction === 'UP' ? pct : -pct) - 2 * feeRateUsed * 100;

        set((s) => {
          const cSym = s.symbols[symbol] || defaultSymbolState;
          return {
            symbols: {
              ...s.symbols,
              [symbol]: {
                ...cSym,
                history: cSym.history.map((e) =>
                  e.id === id
                    ? { ...e, exitPrice, pricePct: pct, result, netPricePct, feeRateUsed }
                    : e,
                ),
                correct: result === 'CORRECT' ? cSym.correct + 1 : cSym.correct,
                wrong:   result === 'WRONG'   ? cSym.wrong + 1   : cSym.wrong,
                skipped: result === 'SKIPPED' ? cSym.skipped + 1 : cSym.skipped,
              }
            }
          };
        });
      },

      addHistoryEntry: (symbol, entry) => set((s) => {
        const cSym = s.symbols[symbol] || defaultSymbolState;
        return {
          symbols: {
            ...s.symbols,
            [symbol]: {
              ...cSym,
              history: [entry, ...cSym.history].slice(0, 100),
              skipped: entry.result === 'SKIPPED' ? cSym.skipped + 1 : cSym.skipped,
            }
          }
        };
      }),

      resetStats: (symbol) => set((s) => ({
        symbols: {
          ...s.symbols,
          [symbol]: { ...defaultSymbolState }
        }
      })),
    }),
    {
      name: 'predictor-store-v3',
      partialize: (s) => {
        // Strip out volatile properties like openPosition/aiVerdict from persistence if desired,
        // or just persist the core stats of each symbol.
        const persistedSymbols: Record<string, any> = {};
        for (const [sym, st] of Object.entries(s.symbols)) {
          persistedSymbols[sym] = {
            history: st.history,
            correct: st.correct,
            wrong: st.wrong,
            skipped: st.skipped,
            openPosition: st.openPosition,
          };
        }
        return {
          symbols: persistedSymbols,
          autoTradeEnabled: s.autoTradeEnabled,
          tradeAmountUsdt: s.tradeAmountUsdt,
          tradeLeverage: s.tradeLeverage,
          closeOnNeutral: s.closeOnNeutral,
          renewEveryCycle: s.renewEveryCycle,
          aiStrategistEnabled: s.aiStrategistEnabled,
          aiSizeAdjustEnabled: s.aiSizeAdjustEnabled,
          aiSkipOnDisagree: s.aiSkipOnDisagree,
        };
      },
    },
  ),
);

/**
 * Performance point for equity curve charting
 */
export interface PerformancePoint {
  timestamp: number;
  equity: number;
  drawdown: number;
  tradeCount: number;
}

/**
 * Comprehensive performance metrics for validation dashboard
 */
export interface PerformanceMetrics {
  tradesCount: number;
  totalNetPct: number;
  avgNetPct: number;
  winRate: number;
  bestNetPct: number;
  worstNetPct: number;
  sharpeRatio: number;
  maxDrawdownPct: number;
  profitFactor: number;
  avgWinPct: number;
  avgLossPct: number;
  expectancyPct: number;
  equityCurve: PerformancePoint[];
  monthlyReturns: { month: string; returnPct: number; trades: number }[];
}

/**
 * Calculate Sharpe ratio from returns series
 */
function calculateSharpeRatio(returns: number[]): number {
  if (returns.length < 2) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  const std = Math.sqrt(variance);
  if (std === 0) return 0;
  return (mean / std) * Math.sqrt(105120); // Annualized for 5-min periods
}

/**
 * Calculate max drawdown from equity values
 */
function calculateMaxDrawdown(equityValues: number[]): number {
  let peak = -Infinity;
  let maxDd = 0;
  for (const equity of equityValues) {
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDd) maxDd = dd;
  }
  return maxDd;
}

/**
 * Derive aggregate net performance from the history window. Directional
 * sign is baked into `netPricePct` so simple summation is correct.
 */
export function computeNetPerformance(history: PredictionEntry[]): {
  tradesCount: number;
  totalNetPct: number;
  avgNetPct: number;
  winRate: number;
  bestNetPct: number;
  worstNetPct: number;
} {
  const resolved = history.filter(
    (e) => e.direction !== 'NEUTRAL'
        && (e.result === 'CORRECT' || e.result === 'WRONG')
        && typeof e.netPricePct === 'number',
  );
  if (resolved.length === 0) {
    return { tradesCount: 0, totalNetPct: 0, avgNetPct: 0, winRate: 0, bestNetPct: 0, worstNetPct: 0 };
  }
  let total = 0, best = -Infinity, worst = Infinity, wins = 0;
  for (const e of resolved) {
    const net = e.netPricePct as number;
    total += net;
    if (net > best)  best  = net;
    if (net < worst) worst = net;
    if (net > 0) wins += 1;
  }
  return {
    tradesCount: resolved.length,
    totalNetPct: total,
    avgNetPct: total / resolved.length,
    winRate: wins / resolved.length,
    bestNetPct: best,
    worstNetPct: worst,
  };
}

/**
 * Compute comprehensive performance metrics for Wave 2 validation dashboard
 */
export function computePerformanceMetrics(history: PredictionEntry[]): PerformanceMetrics {
  const resolved = history.filter(
    (e) => e.direction !== 'NEUTRAL'
        && (e.result === 'CORRECT' || e.result === 'WRONG')
        && typeof e.netPricePct === 'number',
  );

  if (resolved.length === 0) {
    return {
      tradesCount: 0, totalNetPct: 0, avgNetPct: 0, winRate: 0,
      bestNetPct: 0, worstNetPct: 0, sharpeRatio: 0, maxDrawdownPct: 0,
      profitFactor: 0, avgWinPct: 0, avgLossPct: 0, expectancyPct: 0,
      equityCurve: [], monthlyReturns: [],
    };
  }

  let total = 0, best = -Infinity, worst = Infinity;
  let wins = 0, losses = 0;
  let winSum = 0, lossSum = 0;
  const returns: number[] = [];

  for (const e of resolved) {
    const net = e.netPricePct as number;
    total += net;
    returns.push(net);
    if (net > best) best = net;
    if (net < worst) worst = net;
    if (net > 0) {
      wins++;
      winSum += net;
    } else {
      losses++;
      lossSum += Math.abs(net);
    }
  }

  // Build equity curve and calculate drawdowns
  const equityCurve: PerformancePoint[] = [];
  let equity = 0;
  let peak = 0;
  for (let i = 0; i < resolved.length; i++) {
    equity += resolved[i].netPricePct as number;
    if (equity > peak) peak = equity;
    const drawdown = peak - equity;
    equityCurve.push({
      timestamp: resolved[i].timestamp,
      equity,
      drawdown,
      tradeCount: i + 1,
    });
  }

  // Monthly aggregation
  const monthlyMap = new Map<string, { returnPct: number; trades: number }>();
  for (const e of resolved) {
    const date = new Date(e.timestamp);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const existing = monthlyMap.get(monthKey) || { returnPct: 0, trades: 0 };
    existing.returnPct += e.netPricePct as number;
    existing.trades++;
    monthlyMap.set(monthKey, existing);
  }
  const monthlyReturns = Array.from(monthlyMap.entries())
    .map(([month, data]) => ({ month, ...data }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const winRate = wins / resolved.length;
  const avgWin = wins > 0 ? winSum / wins : 0;
  const avgLoss = losses > 0 ? lossSum / losses : 0;
  const expectancy = (winRate * avgWin) - ((1 - winRate) * avgLoss);

  return {
    tradesCount: resolved.length,
    totalNetPct: total,
    avgNetPct: total / resolved.length,
    winRate,
    bestNetPct: best,
    worstNetPct: worst,
    sharpeRatio: calculateSharpeRatio(returns),
    maxDrawdownPct: calculateMaxDrawdown(equityCurve.map(p => p.equity)),
    profitFactor: lossSum > 0 ? winSum / lossSum : winSum > 0 ? Infinity : 0,
    avgWinPct: avgWin,
    avgLossPct: avgLoss,
    expectancyPct: expectancy,
    equityCurve,
    monthlyReturns,
  };
}
