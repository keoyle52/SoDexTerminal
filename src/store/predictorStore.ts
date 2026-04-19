import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  orderBookSignal: number;      // -1 / 0 / +1
  // Funding rate
  fundingRate: number;          // raw value
  fundingRateSignal: number;    // -1 / 0 / +1
  // Price microstructure
  microstructureSignal: number; // -1 to +1
  volumeSpike: boolean;
  // Technical
  rsi: number;
  rsiSignal: number;
  emaSignal: number;
  macdSignal: number;
  // Composite
  weightedScore: number;
  agreementCount: number;       // how many signals agree with direction
  totalSignals: number;         // total non-neutral signals counted
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
  signals: SignalSnapshot;
}

interface PredictorState {
  // current cycle
  currentPrediction: PredictionDirection;
  currentConfidence: number;
  currentSignals: SignalSnapshot | null;
  cycleStartTime: number | null;   // epoch ms when current 5-min window started
  entryPrice: number | null;

  // history (max 100)
  history: PredictionEntry[];

  // accuracy stats
  correct: number;
  wrong: number;
  skipped: number;

  // ── Trading settings (optional auto-order placement) ──
  /** When true, predictor places a market order on each non-neutral prediction. */
  autoTradeEnabled: boolean;
  /** Order quantity in BTC. */
  tradeQuantity: string;
  /** Leverage applied before placing the order (1-50). */
  tradeLeverage: number;
  /** When true, only place order on the very first prediction after Start. */
  tradeOncePerStart: boolean;

  // actions
  setCurrentPrediction: (d: PredictionDirection, conf: number, signals: SignalSnapshot, price: number) => void;
  resolvePrediction: (id: string, exitPrice: number) => void;
  addHistoryEntry: (entry: PredictionEntry) => void;
  resetStats: () => void;
  setAutoTradeEnabled: (v: boolean) => void;
  setTradeQuantity: (v: string) => void;
  setTradeLeverage: (v: number) => void;
  setTradeOncePerStart: (v: boolean) => void;
}

export const usePredictorStore = create<PredictorState>()(
  persist(
    (set, get) => ({
      currentPrediction: 'NEUTRAL',
      currentConfidence: 0,
      currentSignals: null,
      cycleStartTime: null,
      entryPrice: null,
      history: [],
      correct: 0,
      wrong: 0,
      skipped: 0,

      // Trading defaults: disabled, conservative size + leverage
      autoTradeEnabled: false,
      tradeQuantity: '0.001',
      tradeLeverage: 5,
      tradeOncePerStart: true,

      setAutoTradeEnabled: (v) => set({ autoTradeEnabled: v }),
      setTradeQuantity: (v) => set({ tradeQuantity: v }),
      setTradeLeverage: (v) => set({ tradeLeverage: Math.max(1, Math.min(50, v)) }),
      setTradeOncePerStart: (v) => set({ tradeOncePerStart: v }),

      setCurrentPrediction: (direction, confidence, signals, price) =>
        set({
          currentPrediction: direction,
          currentConfidence: confidence,
          currentSignals: signals,
          cycleStartTime: Date.now(),
          entryPrice: price,
        }),

      resolvePrediction: (id, exitPrice) => {
        const state = get();
        const entry = state.history.find((e) => e.id === id);
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

        set((s) => ({
          history: s.history.map((e) =>
            e.id === id ? { ...e, exitPrice, pricePct: pct, result } : e,
          ),
          correct: result === 'CORRECT' ? s.correct + 1 : s.correct,
          wrong:   result === 'WRONG'   ? s.wrong + 1   : s.wrong,
          skipped: result === 'SKIPPED' ? s.skipped + 1 : s.skipped,
        }));
      },

      addHistoryEntry: (entry) =>
        set((s) => ({
          history: [entry, ...s.history].slice(0, 100),
          skipped: entry.result === 'SKIPPED' ? s.skipped + 1 : s.skipped,
        })),

      resetStats: () =>
        set({ history: [], correct: 0, wrong: 0, skipped: 0, currentPrediction: 'NEUTRAL', currentConfidence: 0, currentSignals: null, cycleStartTime: null, entryPrice: null }),
    }),
    {
      name: 'predictor-store-v2',
      partialize: (s) => ({
        history: s.history,
        correct: s.correct,
        wrong: s.wrong,
        skipped: s.skipped,
        autoTradeEnabled: s.autoTradeEnabled,
        tradeQuantity: s.tradeQuantity,
        tradeLeverage: s.tradeLeverage,
        tradeOncePerStart: s.tradeOncePerStart,
      }),
    },
  ),
);
