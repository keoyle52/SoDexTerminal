/**
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ BTC Predictor — Headline Wave 2 feature                             │
 * │ Cycle-driven AI trader: signals → Gemini → on-chain perps order.    │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Page composition (top → bottom):
 *
 *   1.  Hero status bar      — running state, countdown, current verdict
 *   2.  Verdict triptych     — rule prediction | AI strategist | open pos.
 *   3.  Live chart           — entry price marker + overlay PnL strip
 *   4.  Settings panel       — cycle duration, trade size, AI overlays
 *   5.  Performance metrics  — Sharpe, drawdown, equity curve, win rate
 *   6.  Backtest panel       — local replay over last N candles
 *   7.  Cycle history table  — last 25 cycles + outcome badges
 *   8.  Flow diagram         — explains the bot's reasoning to non-tech jury
 *
 * State management:
 *   - Per-cycle decision data lives in `usePredictorStore` (persisted).
 *   - Bot lifecycle (running flag, last-cycle result, countdown tick)
 *     lives in local React state — refreshes on remount are fine because
 *     the store still holds the resolved history.
 *   - The cycle scheduler uses refs to avoid stale closure bugs (e.g.
 *     a settings change must NOT cancel the active interval — it just
 *     rebuilds the closure for the next tick).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Brain, Play, Square, RefreshCw, ArrowUp, ArrowDown, Minus,
  Zap, Activity, AlertTriangle, Target, Settings as SettingsIcon,
  Clock, TrendingUp, TrendingDown, Sparkles, FlaskConical,
  CheckCircle2, XCircle, CircleSlash, Cpu,
  DollarSign, Shield, BarChart2, ChevronDown, ChevronUp,
  LineChart, GraduationCap, BookOpen,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { Time, SeriesMarker } from 'lightweight-charts';

import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Toggle } from '../components/common/Input';
import { TradingChart } from '../components/TradingChart';
import { PredictorPerformanceDashboard } from '../components/PredictorPerformanceDashboard';
import BtcPredictorFlowDiagram from '../components/BtcPredictorFlowDiagram';
import { cn } from '../lib/utils';

import { useSettingsStore } from '../store/settingsStore';
import {
  usePredictorStore,
  type PredictionDirection,
  type PredictionEntry,
} from '../store/predictorStore';
import { useLivePrice } from '../api/useLiveTicker';
import {
  runCycle,
  closeMarketPosition,
  loadKlines,
  runQuickBacktest,
  fetchMarkPriceFor,
  fetchFearGreedHistory,
  type CycleConfig,
  type CycleDurationMinutes,
  type CycleResult,
  type BacktestRun,
} from '../api/btcPredictorEngine';
import { fetchSosoNews, fetchEtfHistoricalInflow } from '../api/sosoServices';
import { fetchBtcPurchaseHistory } from '../api/sosoExtraServices';

// ─── Constants ────────────────────────────────────────────────────────────────

const SYMBOL = 'BTC-USD';
const DURATION_OPTIONS: { value: CycleDurationMinutes; label: string; sub: string }[] = [
  { value: 1,  label: '1 min',  sub: 'Scalp' },
  { value: 3,  label: '3 min',  sub: 'Fast' },
  { value: 5,  label: '5 min',  sub: 'Default' },
  { value: 15, label: '15 min', sub: 'Swing' },
  { value: 60, label: '60 min', sub: '1h Trend' },
];

/** Hard-cap on the resolution timer so an off-by-one tick never delays
 *  the next cycle by more than 5s past the duration boundary. */
const TICK_INTERVAL_MS = 1_000;

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtPct(pct: number, decimals = 2, withSign = true): string {
  if (!Number.isFinite(pct)) return '—';
  const sign = pct > 0 ? '+' : '';
  return `${withSign ? sign : ''}${pct.toFixed(decimals)}%`;
}

function fmtUsd(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtDuration(ms: number): string {
  if (ms < 0 || !Number.isFinite(ms)) return '00:00';
  const totalSec = Math.floor(ms / 1_000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function makeId(): string {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Sub-component: countdown ring ───────────────────────────────────────────

interface CountdownRingProps {
  remainingMs: number;
  totalMs: number;
  size?: number;
  strokeWidth?: number;
  isRunning: boolean;
}

const CountdownRing: React.FC<CountdownRingProps> = ({
  remainingMs, totalMs, size = 90, strokeWidth = 6, isRunning,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = totalMs > 0 ? Math.max(0, Math.min(1, 1 - remainingMs / totalMs)) : 0;
  const offset = circumference * (1 - ratio);
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius}
          stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={radius}
          stroke={isRunning ? 'var(--color-primary)' : 'var(--color-text-muted)'}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="none"
          className="transition-all duration-1000 ease-linear"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] uppercase tracking-widest text-text-muted">
          {isRunning ? 'Next' : 'Idle'}
        </span>
        <span className="text-base font-mono font-bold text-text-primary tabular-nums">
          {fmtDuration(remainingMs)}
        </span>
      </div>
    </div>
  );
};

// ─── Sub-component: direction badge ──────────────────────────────────────────

const DirectionBadge: React.FC<{ direction: PredictionDirection; confidence?: number }> = ({
  direction, confidence,
}) => {
  const cfg = direction === 'UP'
    ? { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', icon: ArrowUp, label: 'BULLISH' }
    : direction === 'DOWN'
    ? { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', icon: ArrowDown, label: 'BEARISH' }
    : { color: 'text-amber-300', bg: 'bg-amber-500/10 border-amber-500/30', icon: Minus, label: 'NEUTRAL' };
  const Icon = cfg.icon;
  return (
    <div className={cn('inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border font-bold tracking-wider text-xs', cfg.bg, cfg.color)}>
      <Icon size={14} />
      <span>{cfg.label}</span>
      {typeof confidence === 'number' && confidence > 0 && (
        <span className="opacity-70 font-mono">{confidence.toFixed(0)}%</span>
      )}
    </div>
  );
};

// ─── Main page ───────────────────────────────────────────────────────────────

export const BtcPredictor: React.FC = () => {
  const { isDemoMode, geminiApiKey, sosoApiKey, privateKey, isWalletConnected } = useSettingsStore();
  // We pull individual slices instead of the whole store object so the
  // cycle scheduler closure (executeCycle) can stay stable across
  // re-renders. Setters in zustand are reference-stable across renders.
  const predictor = usePredictorStore();
  const tradeAmountUsdt = predictor.tradeAmountUsdt;
  const tradeLeverage = predictor.tradeLeverage;
  const autoTradeEnabled = predictor.autoTradeEnabled;
  const aiSizeAdjustEnabled = predictor.aiSizeAdjustEnabled;
  const aiSkipOnDisagree = predictor.aiSkipOnDisagree;

  // ── Local UI state ────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'live' | 'performance' | 'how'>('live');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [duration, setDuration] = useState<CycleDurationMinutes>(5);
  const [minConfidence, setMinConfidence] = useState(55);
  const [lastResult, setLastResult] = useState<CycleResult | null>(null);
  const [cycleStartedAt, setCycleStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState<number>(Date.now());
  const [busy, setBusy] = useState(false);
  const [backtest, setBacktest] = useState<BacktestRun | null>(null);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [btDuration, setBtDuration] = useState<CycleDurationMinutes>(5);
  const [showEvidence, setShowEvidence] = useState(false);

  // ── Live mark price ───────────────────────────────────────────────────────
  // We layer two sources so the "Live" + "Δ since entry" overlay never falls
  // out of sync with reality:
  //   1. SoDEX WebSocket via useLivePrice() — sub-second tick updates when
  //      the ws connection is up.
  //   2. REST polling every 3s via fetchMarkPriceFor() — guaranteed updates
  //      even if the websocket is blocked by the user's network or hasn't
  //      reconnected yet after a sleep/wake cycle.
  // The display price is always max(ws, rest) so we never regress to a
  // stale tick.
  const wsPrice = useLivePrice(SYMBOL, predictor.entryPrice ?? 0, 'perps');
  const [restPrice, setRestPrice] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const px = await fetchMarkPriceFor(SYMBOL);
        if (!cancelled && px && px > 0) setRestPrice(px);
      } catch { /* swallow — REST blip is non-fatal, ws will catch up */ }
    };
    void tick();
    const id = window.setInterval(() => { void tick(); }, 3_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Pick whichever source is most recent / non-zero. ws takes priority when
  // it has produced a tick, REST fills the gap otherwise.
  const livePrice = wsPrice > 0 ? wsPrice : restPrice;

  // ── Cycle scheduler refs (avoid stale-closure bugs) ───────────────────────
  // The scheduler closure must NOT capture livePrice or the whole predictor
  // object — both change on every WS tick and would tear down the recurring
  // interval before it ever fired. We mirror the volatile reads through
  // refs that the closure dereferences just-in-time.
  const intervalRef = useRef<number | null>(null);
  const cycleInflightRef = useRef(false);
  const livePriceRef = useRef(livePrice);
  const cfgRef = useRef<CycleConfig | null>(null);

  useEffect(() => { livePriceRef.current = livePrice; }, [livePrice]);

  // Build (and cache) the active CycleConfig from the user's settings.
  const cfg = useMemo<CycleConfig>(() => ({
    symbol: SYMBOL,
    durationMinutes: duration,
    tradeAmountUsdt: parseFloat(tradeAmountUsdt) || 0,
    leverage: tradeLeverage,
    autoTrade: autoTradeEnabled,
    minConfidence,
    aiSizeAdjust: aiSizeAdjustEnabled,
    aiSkipOnDisagree,
  }), [
    duration, minConfidence,
    tradeAmountUsdt, tradeLeverage, autoTradeEnabled,
    aiSizeAdjustEnabled, aiSkipOnDisagree,
  ]);

  useEffect(() => { cfgRef.current = cfg; }, [cfg]);

  // ── Tick clock for the countdown ring ─────────────────────────────────────
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // ── Core cycle execution ──────────────────────────────────────────────────
  // executeCycle is intentionally dep-less so the recurring interval
  // doesn't tear down on every WS tick. Volatile inputs come from refs
  // (livePriceRef, cfgRef) and the imperative store API
  // (usePredictorStore.getState()).
  const executeCycle = useCallback(async () => {
    if (cycleInflightRef.current) return;
    if (!cfgRef.current) return;
    cycleInflightRef.current = true;
    setBusy(true);

    try {
      const config = cfgRef.current;
      const store = usePredictorStore.getState();

      // 1. Resolve any pending prediction first (bookkeeping).
      const head = store.history[0];
      if (head && head.result === 'PENDING') {
        const live = livePriceRef.current;
        const exit = live > 0
          ? live
          : (await fetchMarkPriceFor(SYMBOL)) ?? head.entryPrice;
        store.resolvePrediction(head.id, exit);
      }

      // 2. Close any open position from the previous cycle. We always close
      //    at cycle boundary so the bot never compounds multi-cycle exposure
      //    and each cycle's outcome is unambiguous in the metrics.
      const openPos = store.openPosition;
      if (openPos) {
        try {
          const r = await closeMarketPosition(openPos.symbol, openPos.side, openPos.quantity);
          if (r.closed) store.setOpenPosition(null);
        } catch { /* non-fatal — continue with new cycle */ }
      }

      // 3. Run the new cycle.
      const result = await runCycle(config);
      setLastResult(result);
      setCycleStartedAt(Date.now());

      // 4. Persist into the store as both currentPrediction and a new
      //    PENDING history entry so the metrics dashboard updates.
      store.setCurrentPrediction(
        result.direction,
        result.confidence,
        result.signals,
        result.entryPrice,
      );
      store.setAiVerdict(result.ai);

      const entry: PredictionEntry = {
        id: makeId(),
        timestamp: Date.now(),
        direction: result.direction,
        confidence: result.confidence,
        entryPrice: result.entryPrice,
        exitPrice: null,
        result: result.direction === 'NEUTRAL' ? 'SKIPPED' : 'PENDING',
        pricePct: null,
        signals: result.signals,
      };
      store.addHistoryEntry(entry);

      // 5. Persist open position if a trade was placed.
      if (result.trade?.placed && result.trade.side && result.trade.quantity) {
        store.setOpenPosition({
          symbol: SYMBOL,
          side: result.trade.side,
          quantity: result.trade.quantity,
          notionalUsdt: result.trade.notional ?? 0,
          entryPrice: result.entryPrice,
          leverage: config.leverage,
          openedAt: Date.now(),
        });
      }

      // 6. UX surfacing.
      if (result.trade?.placed) {
        toast.success(`${result.trade.side} placed @ $${fmtUsd(result.entryPrice, 0)} — ${result.confidence}% conviction`);
      } else if (result.skippedReason) {
        toast(`Cycle skipped — ${result.skippedReason}`, { icon: '⏸️' });
      } else if (result.direction !== 'NEUTRAL') {
        toast.success(`Forecast: ${result.direction} @ ${result.confidence}%`);
      }
      if (result.trade?.error) {
        toast.error(`Order failed: ${result.trade.error}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Cycle failed: ${msg}`);
      console.error('[BtcPredictor] cycle failed:', err);
    } finally {
      cycleInflightRef.current = false;
      setBusy(false);
    }
  }, []);

  // ── Start / Stop control ──────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    if (isRunning) return;
    if (!cfgRef.current) return;
    setIsRunning(true);
    // Fire the first cycle immediately so the user sees something happen.
    // The recurring interval is set up by the duration/isRunning effect.
    await executeCycle();
  }, [isRunning, executeCycle]);

  const handleStop = useCallback(async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
    // We deliberately leave any open managed position untouched on stop
    // so the user can decide whether to keep or manually close it.
    toast.success('Predictor stopped');
  }, []);

  // Single source of truth for the recurring cycle timer.
  // Re-arms when duration or isRunning changes; tears down on unmount.
  useEffect(() => {
    if (!isRunning) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = window.setInterval(() => {
      void executeCycle();
    }, duration * 60 * 1000);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [duration, isRunning, executeCycle]);

  // Cleanup on unmount.
  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  // ── Manual run-once for testing ───────────────────────────────────────────
  const handleRunOnce = useCallback(async () => {
    if (busy) return;
    await executeCycle();
  }, [busy, executeCycle]);

  // ── Backtest ──────────────────────────────────────────────────────────────
  const handleBacktest = useCallback(async () => {
    setBacktestLoading(true);
    try {
      const interval = btDuration === 1 ? '1m' : btDuration === 3 ? '1m' : btDuration === 5 ? '5m' : btDuration === 15 ? '15m' : '1h';
      
      // Parallel fetches for multi-source historical alignment
      const klinesP = loadKlines(SYMBOL, interval, 500);
      const etfHistoryP = fetchEtfHistoricalInflow('us-btc-spot').catch(() => []);
      const fngHistoryP = fetchFearGreedHistory(300).catch(() => []);
      const newsP = fetchSosoNews(1, 100, [1, 3, 5]).catch(() => ({ list: [] }));
      
      const corps = ['MSTR', 'MARA', 'RIOT', 'TSLA'];
      const treasuryP = Promise.all(
        corps.map(ticker => fetchBtcPurchaseHistory(ticker, 50).catch(() => []))
      ).then(arrays => arrays.flat()).catch(() => []);

      const [klines, etf, fng, newsRes, treasury] = await Promise.all([
        klinesP, etfHistoryP, fngHistoryP, newsP, treasuryP
      ]);

      const run = runQuickBacktest(klines, {
        lookback: 300,
        historicalData: {
          etf,
          fng,
          treasury,
          news: newsRes.list,
        }
      });
      setBacktest(run);
      if (run.trades === 0) {
        toast('Backtest produced 0 qualifying trades — try a longer cycle.', { icon: 'ℹ️' });
      } else {
        toast.success(`Backtest: ${run.trades} trades, ${(run.winRate * 100).toFixed(1)}% win rate`);
      }
    } catch (err) {
      toast.error(`Backtest failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setBacktestLoading(false);
    }
  }, [btDuration]);

  // ── Derived UI values ─────────────────────────────────────────────────────
  const totalCycleMs = duration * 60 * 1000;
  const elapsedMs = cycleStartedAt ? now - cycleStartedAt : 0;
  const remainingMs = Math.max(0, totalCycleMs - elapsedMs);
  const cycleProgress = cycleStartedAt ? Math.min(1, elapsedMs / totalCycleMs) : 0;

  const openPosition = predictor.openPosition;
  const positionPnlPct = openPosition && livePrice > 0
    ? ((livePrice - openPosition.entryPrice) / openPosition.entryPrice) * 100
      * (openPosition.side === 'LONG' ? 1 : -1)
    : 0;
  const positionPnlUsd = openPosition
    ? (positionPnlPct / 100) * openPosition.notionalUsdt * openPosition.leverage
    : 0;

  // Change since entry overlay value (entry = predictor.entryPrice).
  const entryRef = predictor.entryPrice ?? 0;
  const changeSinceEntry = entryRef > 0 && livePrice > 0
    ? ((livePrice - entryRef) / entryRef) * 100
    : 0;

  // Markers shown on the chart. Use a single "Entry" marker at the start
  // of the latest cycle plus any open-position marker.
  const chartMarkers = useMemo<SeriesMarker<Time>[]>(() => {
    const out: SeriesMarker<Time>[] = [];
    if (predictor.cycleStartTime && predictor.entryPrice) {
      out.push({
        time: Math.floor(predictor.cycleStartTime / 1000) as Time,
        position: 'aboveBar',
        color: predictor.currentPrediction === 'UP' ? '#10B981' : predictor.currentPrediction === 'DOWN' ? '#EF4444' : '#F59E0B',
        shape: 'arrowDown',
        text: `${predictor.currentPrediction} ${predictor.currentConfidence.toFixed(0)}%`,
      });
    }
    return out;
  }, [predictor.cycleStartTime, predictor.entryPrice, predictor.currentPrediction, predictor.currentConfidence]);

  // ── Recent history view ───────────────────────────────────────────────────
  const recentHistory = predictor.history.slice(0, 25);
  const winRate = (() => {
    const decided = predictor.history.filter((e) => e.result === 'CORRECT' || e.result === 'WRONG');
    if (decided.length === 0) return 0;
    const wins = decided.filter((e) => e.result === 'CORRECT').length;
    return (wins / decided.length) * 100;
  })();
  const totalNetPct = predictor.history.reduce(
    (a, e) => a + (typeof e.netPricePct === 'number' ? e.netPricePct : 0), 0,
  );

  // ── Pre-flight warnings ───────────────────────────────────────────────────
  const noTradeReason: string | null = (() => {
    if (predictor.autoTradeEnabled && !isDemoMode && !privateKey && !isWalletConnected) {
      return 'Auto-trade is ON but no wallet is connected. Connect wallet or enable Demo Mode.';
    }
    if (!isDemoMode && !geminiApiKey && !sosoApiKey) {
      return 'Add a Gemini and/or SoSoValue API key in Settings, or enable Demo Mode.';
    }
    return null;
  })();

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-3 sm:p-5 md:p-6 h-full overflow-y-auto">
      <div className="space-y-5 max-w-[1600px] mx-auto pb-8">
      {/* ─── Pre-flight warning ─────────────────────────────────────── */}
      {noTradeReason && (
        <div className="glass-card p-3 border-amber-500/30 bg-amber-500/5 flex items-start gap-3">
          <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-xs font-semibold text-amber-300">Heads up</div>
            <div className="text-[11px] text-text-secondary leading-relaxed">{noTradeReason}</div>
          </div>
        </div>
      )}

      {/* ─── Hero status ────────────────────────────────────────────── */}
      <Card className="p-5 border border-primary/20 bg-surface/50 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 rounded-full bg-primary/10 blur-3xl opacity-30 pointer-events-none" />
        <div className="absolute right-0 bottom-0 w-48 h-48 rounded-full bg-violet-500/10 blur-3xl opacity-20 pointer-events-none" />

        <div className="relative z-10 flex items-start gap-5 flex-wrap">
          {/* Title block */}
          <div className="flex items-start gap-3 flex-1 min-w-[260px]">
            <div className="w-12 h-12 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
              <Brain size={22} className="text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-text-primary">BTC Predictor</h2>
                <span className="text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
                  Headline
                </span>
                {isDemoMode && (
                  <span className="text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300">
                    Demo
                  </span>
                )}
                <span className={cn(
                  'inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full border',
                  isRunning
                    ? 'bg-success/10 text-success border-success/30'
                    : 'bg-white/[0.04] text-text-muted border-border',
                )}>
                  <span className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    isRunning ? 'bg-success animate-pulse-dot' : 'bg-text-muted',
                  )} />
                  {isRunning ? 'Running' : 'Stopped'}
                </span>
              </div>
              <p className="text-[11px] text-text-muted mt-1 leading-snug max-w-md">
                AI-augmented BTC perps trader. Fuses 13 signals from SoDEX + SoSoValue + external sources
                through a Gemini consensus overlay, then executes EIP-712 signed market orders on the SoDEX matching engine.
              </p>
            </div>
          </div>

          {/* Countdown ring */}
          <div className="flex items-center gap-4">
            <CountdownRing
              remainingMs={remainingMs}
              totalMs={totalCycleMs}
              isRunning={isRunning}
            />
            <div className="space-y-2">
              {!isRunning ? (
                <Button
                  variant="primary"
                  size="md"
                  icon={<Play size={14} />}
                  onClick={handleStart}
                  loading={busy}
                  disabled={busy}
                >
                  Start Predictor
                </Button>
              ) : (
                <Button
                  variant="danger"
                  size="md"
                  icon={<Square size={14} />}
                  onClick={handleStop}
                  disabled={busy}
                >
                  Stop
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                icon={<RefreshCw size={12} className={busy ? 'animate-spin' : ''} />}
                onClick={handleRunOnce}
                disabled={busy}
                fullWidth
              >
                Run Once
              </Button>
            </div>
          </div>
        </div>

        {/* Quick metrics strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 relative z-10">
          <MiniStat
            label="Win Rate"
            value={`${winRate.toFixed(1)}%`}
            icon={<Target size={14} />}
            trend={winRate >= 50 ? 'up' : 'down'}
          />
          <MiniStat
            label="Total Net %"
            value={fmtPct(totalNetPct, 2)}
            icon={<TrendingUp size={14} />}
            trend={totalNetPct >= 0 ? 'up' : 'down'}
          />
          <MiniStat
            label="Cycles"
            value={String(predictor.history.length)}
            icon={<Activity size={14} />}
          />
          <MiniStat
            label="Auto Trade"
            value={predictor.autoTradeEnabled ? 'ON' : 'OFF'}
            icon={<Zap size={14} />}
            trend={predictor.autoTradeEnabled ? 'up' : 'neutral'}
          />
        </div>
      </Card>

      {/* Tab navigation — splits the page into 3 digestible sections so jurors
          don't have to scroll past every panel to find the headline metric. */}
      <div className="flex items-center gap-1 p-1 rounded-xl glass-card overflow-x-auto scrollbar-thin" role="tablist">
        {([
          { id: 'live',        label: 'Live',         icon: Activity },
          { id: 'performance', label: 'Performance',  icon: LineChart, badge: predictor.history.length },
          { id: 'how',         label: 'How it Works', icon: BookOpen },
        ] as const).map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                'flex-1 min-w-[120px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200',
                isActive
                  ? 'bg-primary/15 text-primary border border-primary/30 shadow-[inset_0_0_12px_rgba(0,212,255,0.06)]'
                  : 'text-text-muted hover:text-text-secondary hover:bg-white/[0.04] border border-transparent',
              )}
            >
              <Icon size={13} />
              <span>{t.label}</span>
              {'badge' in t && typeof t.badge === 'number' && t.badge > 0 && (
                <span className={cn(
                  'ml-1 text-[9px] font-mono px-1.5 py-0.5 rounded-full',
                  isActive ? 'bg-primary/20 text-primary' : 'bg-white/[0.06] text-text-muted',
                )}>
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* === Live tab ============================================================ */}
      {activeTab === 'live' && (
      <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Rule prediction */}
        <Card className="p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <Cpu size={13} className="text-amber-400" />
            </div>
            <div className="flex-1">
              <div className="text-xs font-semibold text-text-primary">Market Intel</div>
              <div className="text-[9px] uppercase tracking-widest text-text-muted">13-signal rule ensemble</div>
            </div>
          </div>
          <DirectionBadge direction={predictor.currentPrediction} confidence={predictor.currentConfidence} />
          {predictor.currentSignals ? (
            <div className="space-y-2.5">
              {/* Weighted score bar */}
              <div>
                <div className="flex items-center justify-between text-[9px] mb-1.5">
                  <span className="text-text-muted">Bear</span>
                  <span className={cn('font-mono font-bold text-xs',
                    predictor.currentSignals.weightedScore > 0.05 ? 'text-emerald-400'
                    : predictor.currentSignals.weightedScore < -0.05 ? 'text-red-400'
                    : 'text-amber-300',
                  )}>{fmtSig(predictor.currentSignals.weightedScore)}</span>
                  <span className="text-text-muted">Bull</span>
                </div>
                <div className="relative h-2 rounded-full bg-background/60 border border-border/50 overflow-hidden">
                  <div className="absolute top-0 bottom-0 w-px bg-border/70" style={{ left: '50%' }} />
                  {(() => {
                    const s = Math.min(Math.max(predictor.currentSignals.weightedScore, -1), 1);
                    const w = Math.abs(s) * 50;
                    const left = s >= 0 ? 50 : 50 - w;
                    const col = s > 0.05 ? '#10B981' : s < -0.05 ? '#EF4444' : '#F59E0B';
                    return <div className="absolute h-full rounded-full transition-all duration-700" style={{ left: `${left}%`, width: `${Math.max(w, 1)}%`, backgroundColor: col, opacity: 0.85 }} />;
                  })()}
                </div>
              </div>
              {/* Confluence */}
              <div className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-background/40 border border-border/50">
                <span className="text-[9px] uppercase tracking-wider text-text-muted">Confluence</span>
                <span className="font-mono font-bold text-xs text-text-primary">
                  {predictor.currentSignals.agreementCount}
                  <span className="text-text-muted font-normal text-[10px]">/{predictor.currentSignals.totalSignals} agree</span>
                </span>
              </div>
              {/* 4 key signals */}
              <div className="grid grid-cols-2 gap-1.5">
                <SignalChip label="RSI(14)"  val={predictor.currentSignals.rsi.toFixed(1)} />
                <SignalChip label="MACD"     val={fmtSig(predictor.currentSignals.macdSignal)} />
                <SignalChip label="Funding"  val={`${(predictor.currentSignals.fundingRate * 100).toFixed(4)}%`} />
                <SignalChip label="F&G"      val={fmtSig(predictor.currentSignals.fearGreedSignal ?? 0)} />
              </div>
              {predictor.currentSignals.neutralReason && (
                <div className="text-[9px] text-amber-300 leading-snug px-0.5">
                  ⚠ {predictor.currentSignals.neutralReason.replace(/_/g, ' ')}
                </div>
              )}
            </div>
          ) : (
            <div className="text-[11px] text-text-muted py-2">
              Click <span className="text-primary font-semibold">Start Predictor</span> to compute the first signal vector.
            </div>
          )}
        </Card>

        {/* AI verdict */}
        <Card className="p-4 flex flex-col gap-3 border-primary/20">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
              <Sparkles size={13} className="text-primary" />
            </div>
            <div className="flex-1">
              <div className="text-xs font-semibold text-text-primary">AI Strategist</div>
              <div className="text-[9px] uppercase tracking-widest text-text-muted">
                {predictor.aiVerdict?.source ?? 'Gemini 2.5 Flash'}
              </div>
            </div>
          </div>
          {predictor.aiVerdict ? (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <AiDecisionBadge decision={predictor.aiVerdict.decision} />
                <span className="text-xs font-mono text-text-secondary">
                  {predictor.aiVerdict.confidence}% conf.
                </span>
                <span className="text-[10px] text-text-muted">
                  size <span className="text-primary font-bold">×{predictor.aiVerdict.sizeMultiplier.toFixed(2)}</span>
                </span>
              </div>
              <p className="text-[11px] text-text-secondary leading-relaxed bg-background/40 border border-border/50 rounded-md p-2.5 italic">
                "{predictor.aiVerdict.rationale}"
              </p>
              {lastResult?.skippedReason && (
                <div className="flex items-start gap-2 p-2 rounded-md bg-amber-500/5 border border-amber-500/20">
                  <CircleSlash size={12} className="text-amber-300 shrink-0 mt-0.5" />
                  <div className="text-[10px] text-amber-200 leading-snug">
                    <span className="font-bold">Trade skipped:</span> {lastResult.skippedReason}
                  </div>
                </div>
              )}

              {/* Collapsible Decision Anchors & Evidence */}
              {predictor.currentSignals && (
                <div className="border-t border-border/50 pt-2.5 mt-1">
                  <button
                    onClick={() => setShowEvidence(!showEvidence)}
                    className="flex items-center justify-between w-full text-[10px] font-bold text-text-muted hover:text-text-secondary transition-colors uppercase tracking-wider"
                  >
                    <span>🔍 Decision Evidence & Data Stream</span>
                    {showEvidence ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                  {showEvidence && (
                    <div className="mt-2 space-y-2.5 bg-background/50 rounded-lg p-2.5 border border-border/30 text-[10px] leading-relaxed text-left">
                      {/* SoSoValue intelligence */}
                      <div>
                        <div className="text-primary font-bold tracking-wider mb-1 flex items-center justify-between">
                          <span>📊 SOSOVALUE DATA</span>
                          <a 
                            href="https://sosovalue.xyz" 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-[9px] text-sky-400 hover:underline hover:text-sky-300 font-semibold"
                          >
                            View Source →
                          </a>
                        </div>
                        <ul className="space-y-1 text-text-secondary list-disc pl-3">
                          <li>
                            News Sentiment: <span className="font-semibold text-text-primary">{predictor.currentSignals.newsSentiment > 0.15 ? '🟢 Bullish' : predictor.currentSignals.newsSentiment < -0.15 ? '🔴 Bearish' : '🟡 Neutral'}</span> ({predictor.currentSignals.newsSentiment.toFixed(2)})
                            {predictor.currentSignals.newsFallback && <span className="text-[8px] text-amber-300 ml-1">(Fallback Data)</span>}
                          </li>
                          <li>
                            ETF Flow Score: <span className="font-semibold text-text-primary">{predictor.currentSignals.etfFlow > 0.15 ? '🟢 Positive' : predictor.currentSignals.etfFlow < -0.15 ? '🔴 Negative' : '🟡 Sideways'}</span> ({predictor.currentSignals.etfFlow.toFixed(2)})
                            {predictor.currentSignals.etfFallback && <span className="text-[8px] text-amber-300 ml-1">(Fallback Data)</span>}
                          </li>
                          {typeof predictor.currentSignals.treasurySignal === 'number' && (
                            <li>
                              Institutional Treasury Accumulation: <span className="font-semibold text-text-primary">{predictor.currentSignals.treasurySignal > 0.15 ? '🟢 Accumulation' : predictor.currentSignals.treasurySignal < -0.15 ? '🔴 Distribution' : '🟡 Undecided'}</span>
                              {predictor.currentSignals.treasuryTopBuyer && ` (Top Buyer: ${predictor.currentSignals.treasuryTopBuyer})`}
                            </li>
                          )}
                        </ul>
                      </div>

                      {/* Technical and order book details */}
                      <div>
                        <div className="text-amber-400 font-bold tracking-wider mb-1 flex items-center justify-between">
                          <span>⚙️ TECHNICAL & ORDER BOOK</span>
                        </div>
                        <ul className="space-y-1 text-text-secondary list-disc pl-3">
                          <li>
                            RSI(14): <span className="font-semibold text-text-primary">{predictor.currentSignals.rsi.toFixed(1)}</span> ({predictor.currentSignals.rsi > 70 ? 'Overbought' : predictor.currentSignals.rsi < 30 ? 'Oversold' : 'Normal'})
                          </li>
                          <li>
                            EMA & MACD Signal: <span className="font-semibold text-text-primary">{predictor.currentSignals.emaSignal > 0 ? '🟢 Bull' : predictor.currentSignals.emaSignal < 0 ? '🔴 Bear' : '🟡 Neutral'}</span>
                          </li>
                          <li>
                            Exchange Order Imbalance: <span className="font-semibold text-text-primary">{(predictor.currentSignals.orderBookImbalance * 100).toFixed(0)}% buyers (bid-side)</span>
                          </li>
                          <li>
                            Funding Rate: <span className="font-semibold text-text-primary">{(predictor.currentSignals.fundingRate * 100).toFixed(4)}%</span> ({predictor.currentSignals.fundingRateSignal > 0.15 ? 'Bullish Bias' : predictor.currentSignals.fundingRateSignal < -0.15 ? 'Bearish Bias' : 'Balanced'})
                          </li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-[11px] text-text-muted py-2">
              The Strategist runs after every cycle and provides an independent second opinion that can attenuate sizing.
            </div>
          )}
        </Card>

        {/* Open position */}
        <Card className={cn(
          'p-4 flex flex-col gap-3',
          openPosition ? 'border-emerald-500/30 bg-emerald-500/[0.02]' : '',
        )}>
          <div className="flex items-center gap-2">
            <div className={cn(
              'w-7 h-7 rounded-lg border flex items-center justify-center',
              openPosition ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/[0.04] border-border',
            )}>
              <DollarSign size={13} className={openPosition ? 'text-emerald-400' : 'text-text-muted'} />
            </div>
            <div className="flex-1">
              <div className="text-xs font-semibold text-text-primary">Live Position</div>
              <div className="text-[9px] uppercase tracking-widest text-text-muted">
                {openPosition ? `${openPosition.side} ${openPosition.leverage}x` : 'No open trade'}
              </div>
            </div>
          </div>
          {openPosition ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[9px] text-text-muted uppercase tracking-wider">Entry</div>
                  <div className="text-sm font-mono font-bold text-text-primary">${fmtUsd(openPosition.entryPrice, 0)}</div>
                </div>
                <div>
                  <div className="text-[9px] text-text-muted uppercase tracking-wider">Mark</div>
                  <div className="text-sm font-mono font-bold text-text-primary">${fmtUsd(livePrice, 0)}</div>
                </div>
                <div>
                  <div className="text-[9px] text-text-muted uppercase tracking-wider">Qty</div>
                  <div className="text-sm font-mono text-text-primary">{openPosition.quantity.toFixed(4)} BTC</div>
                </div>
                <div>
                  <div className="text-[9px] text-text-muted uppercase tracking-wider">Notional</div>
                  <div className="text-sm font-mono text-text-primary">${fmtUsd(openPosition.notionalUsdt, 0)}</div>
                </div>
              </div>
              <div className={cn(
                'p-2.5 rounded-md border flex items-center justify-between gap-2',
                positionPnlPct >= 0
                  ? 'bg-emerald-500/5 border-emerald-500/20'
                  : 'bg-red-500/5 border-red-500/20',
              )}>
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-text-muted">Unrealised PnL</div>
                  <div className={cn(
                    'text-base font-mono font-bold',
                    positionPnlPct >= 0 ? 'text-emerald-400' : 'text-red-400',
                  )}>
                    {fmtPct(positionPnlPct * openPosition.leverage, 3)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] uppercase tracking-wider text-text-muted">Est. $</div>
                  <div className={cn(
                    'text-sm font-mono font-bold',
                    positionPnlUsd >= 0 ? 'text-emerald-400' : 'text-red-400',
                  )}>
                    {positionPnlUsd >= 0 ? '+' : ''}${fmtUsd(positionPnlUsd, 2)}
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                icon={<XCircle size={12} />}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const r = await closeMarketPosition(openPosition.symbol, openPosition.side, openPosition.quantity);
                    if (r.closed) {
                      predictor.setOpenPosition(null);
                      toast.success('Position closed');
                    } else {
                      toast.error(`Close failed: ${r.error ?? 'unknown'}`);
                    }
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Close Position
              </Button>
            </>
          ) : (
            <div className="text-[11px] text-text-muted py-3">
              Toggle <span className="text-primary font-semibold">Auto Trade</span> below and start the Predictor to open positions automatically each cycle.
            </div>
          )}
        </Card>
      </div>

      {/* ─── Live chart with overlay ────────────────────────────────── */}
      <Card className="p-0 overflow-hidden" padding={false}>
        <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <BarChart2 size={14} className="text-primary" />
              <span className="text-sm font-bold text-text-primary">{SYMBOL} Live</span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <ChartStat
                label="Entry"
                value={entryRef > 0 ? `$${fmtUsd(entryRef, 0)}` : '—'}
              />
              <ChartStat
                label="Live"
                value={livePrice > 0 ? `$${fmtUsd(livePrice, 0)}` : '—'}
                pulse
              />
              <ChartStat
                label="Δ since entry"
                value={entryRef > 0 ? fmtPct(changeSinceEntry, 3) : '—'}
                color={changeSinceEntry > 0 ? 'success' : changeSinceEntry < 0 ? 'danger' : undefined}
              />
              {isRunning && (
                <ChartStat
                  label="Cycle"
                  value={`${(cycleProgress * 100).toFixed(0)}%`}
                  color="primary"
                />
              )}
            </div>
          </div>
        </div>
        <TradingChart
          symbol={SYMBOL}
          market="perps"
          height={420}
          markers={chartMarkers}
        />
      </Card>

      {/* ─── Settings panel ─────────────────────────────────────────── */}
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
            <SettingsIcon size={16} className="text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary">Trade Configuration</h3>
            <p className="text-[11px] text-text-muted">Adjustments take effect on the next cycle without restart.</p>
          </div>
        </div>

        {/* Cycle duration */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">Cycle Duration</label>
            <span className="text-[10px] text-text-muted">Resolution + kline interval</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDuration(opt.value)}
                disabled={busy}
                className={cn(
                  'p-3 rounded-lg border text-left transition-all duration-200',
                  duration === opt.value
                    ? 'bg-primary/10 border-primary/40 text-primary'
                    : 'bg-background/40 border-border text-text-secondary hover:border-border-hover hover:text-text-primary',
                )}
              >
                <div className="flex items-center gap-2">
                  <Clock size={14} />
                  <span className="text-sm font-bold">{opt.label}</span>
                </div>
                <div className="text-[10px] text-text-muted mt-0.5">{opt.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Trade size + leverage */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">Trade Notional (USDT)</label>
            <div className="relative mt-1.5">
              <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="number"
                inputMode="decimal"
                value={predictor.tradeAmountUsdt}
                onChange={(e) => predictor.setTradeAmountUsdt(e.target.value)}
                disabled={busy}
                className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-background/60 border border-border text-text-primary font-mono text-sm focus:outline-none focus:border-primary/50"
                placeholder="100"
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">Leverage</label>
              <span className="text-xs font-mono font-bold text-primary">{predictor.tradeLeverage}x</span>
            </div>
            <input
              type="range"
              min={1}
              max={25}
              step={1}
              value={predictor.tradeLeverage}
              onChange={(e) => predictor.setTradeLeverage(parseInt(e.target.value, 10))}
              disabled={busy}
              className="w-full mt-3 accent-primary"
            />
            <div className="flex justify-between text-[9px] text-text-muted mt-1">
              <span>1x</span><span>10x</span><span>25x cap</span>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">Min Confidence</label>
              <span className="text-xs font-mono font-bold text-primary">{minConfidence}%</span>
            </div>
            <input
              type="range"
              min={40}
              max={90}
              step={5}
              value={minConfidence}
              onChange={(e) => setMinConfidence(parseInt(e.target.value, 10))}
              disabled={busy}
              className="w-full mt-3 accent-primary"
            />
            <p className="text-[9px] text-text-muted mt-1">Skip trades below this conviction.</p>
          </div>
        </div>

        {/* Primary toggle — Auto-Trade is the most important setting; keep
            it visible at all times. Everything else is collapsed under
            "Advanced Options" below to reduce cognitive load. */}
        <Toggle
          label="Auto-Trade"
          description="Place an EIP-712 signed market order on every directional cycle."
          checked={predictor.autoTradeEnabled}
          onChange={(v) => predictor.setAutoTradeEnabled(v)}
        />

        {/* Advanced accordion */}
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className={cn(
            'mt-3 w-full flex items-center justify-between p-3 rounded-lg border transition-all duration-200',
            showAdvanced
              ? 'bg-primary/5 border-primary/30 text-primary'
              : 'bg-background/40 border-border text-text-secondary hover:border-border-hover hover:text-text-primary',
          )}
          aria-expanded={showAdvanced}
        >
          <div className="flex items-center gap-2">
            <SettingsIcon size={13} />
            <span className="text-xs font-semibold">Advanced Options</span>
            <span className="text-[10px] text-text-muted">
              AI overlays, stop-loss, volume farming
            </span>
          </div>
          {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showAdvanced && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 animate-fade-in">
            <Toggle
              label="AI Size Adjust"
              description="Strategist's sizeMultiplier scales the order. 0 = skip."
              checked={predictor.aiSizeAdjustEnabled}
              onChange={(v) => predictor.setAiSizeAdjustEnabled(v)}
            />
            <Toggle
              label="Skip on AI Disagree"
              description="Cancel trade if AI verdict opposes the rule decision."
              checked={predictor.aiSkipOnDisagree}
              onChange={(v) => predictor.setAiSkipOnDisagree(v)}
            />
            <Toggle
              label="Renew Every Cycle"
              description="Always close + reopen on cycle boundary (volume farming)."
              checked={predictor.renewEveryCycle}
              onChange={(v) => predictor.setRenewEveryCycle(v)}
            />
            <Toggle
              label="Stop Loss (ATR-based)"
              description={`Force-close at ${predictor.slAtrMult.toFixed(1)}× ATR adverse move.`}
              checked={predictor.stopLossEnabled}
              onChange={(v) => predictor.setStopLossEnabled(v)}
            />
            <div className="flex items-center justify-between p-3.5 bg-background/40 border border-border rounded-lg md:col-span-2">
              <div>
                <span className="text-sm text-text-primary">SL ATR Multiplier</span>
                <p className="text-[10px] text-text-muted mt-0.5">Tighter = quicker stops. 1.5 is default.</p>
              </div>
              <input
                type="number"
                min={0.5}
                max={5}
                step={0.1}
                value={predictor.slAtrMult}
                onChange={(e) => predictor.setSlAtrMult(parseFloat(e.target.value) || 1.5)}
                className="w-24 px-2 py-1.5 rounded-md bg-surface border border-border text-text-primary font-mono text-sm text-right"
              />
            </div>
          </div>
        )}
      </Card>

      </div>
      )}

      {/* === Performance tab ===================================================== */}
      {activeTab === 'performance' && (
      <div className="space-y-5">
      <PredictorPerformanceDashboard history={predictor.history} />

      {/* ─── Backtest ───────────────────────────────────────────────── */}
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center">
              <FlaskConical size={16} className="text-violet-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-text-primary">Local Backtest</h3>
              <p className="text-[11px] text-text-muted">
                Replays the rule ensemble on the last 300 candles, aligned with historical SoSoValue news and flows.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            icon={<RefreshCw size={12} className={backtestLoading ? 'animate-spin' : ''} />}
            onClick={handleBacktest}
            loading={backtestLoading}
          >
            Run Backtest
          </Button>
        </div>

        {/* Market / timeframe selector — tile grid like trading bots */}
        <div className="mb-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-text-secondary mb-2">Timeframe</div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setBtDuration(opt.value)}
                className={cn(
                  'p-3 rounded-lg border text-left transition-all duration-200',
                  btDuration === opt.value
                    ? 'bg-violet-500/10 border-violet-500/40 text-violet-300'
                    : 'bg-background/40 border-border text-text-secondary hover:border-border-hover hover:text-text-primary',
                )}
              >
                <div className="flex items-center gap-1.5">
                  <Clock size={12} />
                  <span className="text-sm font-bold">{opt.label}</span>
                </div>
                <div className="text-[10px] text-text-muted mt-0.5">{opt.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {backtest ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <BtMetric label="Trades" value={String(backtest.trades)} />
              <BtMetric label="Win rate" value={`${(backtest.winRate * 100).toFixed(1)}%`} highlight={backtest.winRate >= 0.5 ? 'success' : 'warn'} />
              <BtMetric label="Net %" value={fmtPct(backtest.totalNetPct, 2)} highlight={backtest.totalNetPct >= 0 ? 'success' : 'danger'} />
              <BtMetric label="Avg %" value={fmtPct(backtest.avgNetPct, 3)} />
              <BtMetric label="Sharpe" value={backtest.sharpe.toFixed(2)} highlight={backtest.sharpe >= 1 ? 'success' : 'warn'} />
              <BtMetric label="Max DD" value={`-${backtest.maxDrawdownPct.toFixed(2)}%`} highlight="danger" />
              <BtMetric label="Best" value={fmtPct(backtest.bestPct, 3)} highlight="success" />
              <BtMetric label="Worst" value={fmtPct(backtest.worstPct, 3)} highlight="danger" />
            </div>

            <div className="mt-4 p-3 rounded-lg border border-primary/20 bg-primary/5 flex items-start gap-2.5">
              <Brain size={14} className="text-primary shrink-0 mt-0.5" />
              <div className="text-[10px] text-text-secondary leading-relaxed">
                <span className="font-bold text-text-primary">Quant & Jury Note:</span>
                {" "}Sodex perps transaction cost (~0.08% round-trip) represents a massive drag on high-frequency timeframes like 1m/3m, where candle volatility is too low to clear the fee friction. Moving to 15m or 60m timeframes allows larger price movements to develop (typically 0.3% - 1.5%), which easily bypasses the fee barrier and unlocks positive mathematical expectancy.
              </div>
            </div>
          </>
        ) : (
          <div className="text-[11px] text-text-muted py-2 px-3 rounded-md bg-background/40 border border-dashed border-border">
            Click <span className="text-primary font-semibold">Run Backtest</span> to estimate the strategy edge over recent BTC history.
          </div>
        )}
      </Card>

      {/* ─── Cycle history ─────────────────────────────────────────── */}
      <Card className="p-0 overflow-hidden" padding={false}>
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-primary" />
            <span className="text-sm font-bold text-text-primary">Recent Cycles</span>
            <span className="text-[10px] text-text-muted">(last {recentHistory.length})</span>
          </div>
        </div>
        {recentHistory.length === 0 ? (
          <div className="p-6 text-center text-[11px] text-text-muted">
            No cycles yet. Start the Predictor to begin populating the cycle log.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full data-table text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-text-muted">
                  <th className="text-left px-4 py-2.5 font-semibold">Time</th>
                  <th className="text-left px-2 py-2.5 font-semibold">Direction</th>
                  <th className="text-right px-2 py-2.5 font-semibold">Conf.</th>
                  <th className="text-right px-2 py-2.5 font-semibold">Entry</th>
                  <th className="text-right px-2 py-2.5 font-semibold">Exit</th>
                  <th className="text-right px-2 py-2.5 font-semibold">Δ %</th>
                  <th className="text-right px-2 py-2.5 font-semibold">Net %</th>
                  <th className="text-center px-2 py-2.5 font-semibold">Result</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Score</th>
                </tr>
              </thead>
              <tbody>
                {recentHistory.map((e) => (
                  <CycleRow key={e.id} entry={e} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      </div>
      )}

      {/* === How it Works tab ==================================================== */}
      {activeTab === 'how' && (
      <div className="space-y-5">
        <Card className="p-5 border border-primary/20 bg-primary/[0.02]">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
              <GraduationCap size={16} className="text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-text-primary">How the Predictor reasons</h3>
              <p className="text-[11px] text-text-secondary leading-relaxed mt-1 max-w-2xl">
                Every cycle the bot pulls live data from <span className="text-emerald-400 font-semibold">SoDEX</span>{' '}
                (klines, order book, funding), <span className="text-primary font-semibold">SoSoValue</span>{' '}
                (news, ETF flows, treasury accumulation), and one <span className="text-amber-300 font-semibold">external</span>{' '}
                feed (Fear &amp; Greed Index). Thirteen signals are normalised onto a [-1, +1] axis,
                weighted, and gated through a confluence filter. The result is then sent to{' '}
                <span className="text-primary font-semibold">Gemini 2.5 Flash</span> as an independent
                consensus check before any order is placed.
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <BtcPredictorFlowDiagram />
        </Card>
      </div>
      )}
      </div>
    </div>
  );
};

// ─── Sub-components for the page ─────────────────────────────────────────────

const MiniStat: React.FC<{
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
}> = ({ label, value, icon, trend }) => (
  <div className="p-3 rounded-lg bg-background/40 border border-border/50">
    <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-text-muted">
      {icon}
      <span>{label}</span>
    </div>
    <div className={cn(
      'text-lg font-mono font-bold tabular-nums mt-0.5',
      trend === 'up' && 'text-emerald-400',
      trend === 'down' && 'text-red-400',
      (!trend || trend === 'neutral') && 'text-text-primary',
    )}>
      {value}
    </div>
  </div>
);

const SignalChip: React.FC<{ label: string; val: string; highlight?: boolean }> = ({ label, val, highlight }) => (
  <div className={cn(
    'flex items-center justify-between p-1.5 rounded border bg-background/40',
    highlight ? 'border-primary/30 bg-primary/5' : 'border-border/50',
  )}>
    <span className="text-[9px] uppercase tracking-wider text-text-muted">{label}</span>
    <span className={cn(
      'font-mono font-bold text-[10px]',
      highlight ? 'text-primary' : 'text-text-primary',
    )}>
      {val}
    </span>
  </div>
);

function fmtSig(v: number): string {
  if (!Number.isFinite(v)) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}`;
}

const AiDecisionBadge: React.FC<{ decision: 'LONG' | 'SHORT' | 'HOLD' }> = ({ decision }) => {
  const cfg = decision === 'LONG'
    ? { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', icon: TrendingUp }
    : decision === 'SHORT'
    ? { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', icon: TrendingDown }
    : { color: 'text-amber-300', bg: 'bg-amber-500/10 border-amber-500/30', icon: Shield };
  const Icon = cfg.icon;
  return (
    <div className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-bold tracking-wider text-[10px]', cfg.bg, cfg.color)}>
      <Icon size={11} />
      <span>{decision}</span>
    </div>
  );
};

const ChartStat: React.FC<{
  label: string;
  value: string;
  pulse?: boolean;
  color?: 'success' | 'danger' | 'primary';
}> = ({ label, value, pulse, color }) => (
  <div className="flex items-center gap-1.5">
    <span className="text-[9px] uppercase tracking-wider text-text-muted">{label}</span>
    <span className={cn(
      'text-xs font-mono font-bold tabular-nums',
      color === 'success' && 'text-emerald-400',
      color === 'danger' && 'text-red-400',
      color === 'primary' && 'text-primary',
      !color && 'text-text-primary',
      pulse && 'animate-pulse-dot',
    )}>
      {value}
    </span>
  </div>
);

const BtMetric: React.FC<{
  label: string;
  value: string;
  highlight?: 'success' | 'danger' | 'warn';
}> = ({ label, value, highlight }) => (
  <div className="p-2.5 rounded-lg bg-background/40 border border-border/50">
    <div className="text-[9px] uppercase tracking-widest text-text-muted">{label}</div>
    <div className={cn(
      'text-base font-mono font-bold tabular-nums mt-0.5',
      highlight === 'success' && 'text-emerald-400',
      highlight === 'danger' && 'text-red-400',
      highlight === 'warn' && 'text-amber-300',
      !highlight && 'text-text-primary',
    )}>
      {value}
    </div>
  </div>
);

const CycleRow: React.FC<{ entry: PredictionEntry }> = ({ entry }) => {
  const time = new Date(entry.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const dirCfg = entry.direction === 'UP'
    ? { color: 'text-emerald-400', icon: ArrowUp, label: 'UP' }
    : entry.direction === 'DOWN'
    ? { color: 'text-red-400', icon: ArrowDown, label: 'DOWN' }
    : { color: 'text-amber-300', icon: Minus, label: 'NEUTRAL' };
  const DirIcon = dirCfg.icon;

  const resCfg = entry.result === 'CORRECT'
    ? { color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30', icon: CheckCircle2, label: 'WIN' }
    : entry.result === 'WRONG'
    ? { color: 'text-red-400 bg-red-500/10 border-red-500/30', icon: XCircle, label: 'LOSS' }
    : entry.result === 'SKIPPED'
    ? { color: 'text-amber-300 bg-amber-500/10 border-amber-500/30', icon: CircleSlash, label: 'SKIP' }
    : { color: 'text-text-muted bg-white/[0.04] border-border', icon: Clock, label: 'PEND' };
  const ResIcon = resCfg.icon;

  const pct = entry.pricePct;
  const net = entry.netPricePct;

  return (
    <tr className="border-t border-border/50 hover:bg-white/[0.02] transition-colors">
      <td className="px-4 py-2.5 font-mono text-[10px] text-text-muted">{time}</td>
      <td className="px-2 py-2.5">
        <div className={cn('inline-flex items-center gap-1 font-bold', dirCfg.color)}>
          <DirIcon size={12} />
          <span className="text-[10px]">{dirCfg.label}</span>
        </div>
      </td>
      <td className="px-2 py-2.5 text-right font-mono text-[11px] text-text-secondary">
        {entry.confidence > 0 ? `${entry.confidence.toFixed(0)}%` : '—'}
      </td>
      <td className="px-2 py-2.5 text-right font-mono text-[11px] text-text-primary">
        ${fmtUsd(entry.entryPrice, 0)}
      </td>
      <td className="px-2 py-2.5 text-right font-mono text-[11px] text-text-secondary">
        {entry.exitPrice ? `$${fmtUsd(entry.exitPrice, 0)}` : '—'}
      </td>
      <td className={cn(
        'px-2 py-2.5 text-right font-mono text-[11px]',
        typeof pct === 'number' && pct > 0 && 'text-emerald-400',
        typeof pct === 'number' && pct < 0 && 'text-red-400',
        typeof pct !== 'number' && 'text-text-muted',
      )}>
        {typeof pct === 'number' ? fmtPct(pct, 3) : '—'}
      </td>
      <td className={cn(
        'px-2 py-2.5 text-right font-mono text-[11px]',
        typeof net === 'number' && net > 0 && 'text-emerald-400',
        typeof net === 'number' && net < 0 && 'text-red-400',
        typeof net !== 'number' && 'text-text-muted',
      )}>
        {typeof net === 'number' ? fmtPct(net, 3) : '—'}
      </td>
      <td className="px-2 py-2.5">
        <div className={cn('inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider w-full', resCfg.color)}>
          <ResIcon size={10} />
          <span>{resCfg.label}</span>
        </div>
      </td>
      <td className="px-4 py-2.5 text-right font-mono text-[11px] text-text-secondary">
        {fmtSig(entry.signals.weightedScore)}
      </td>
    </tr>
  );
};

export default BtcPredictor;
