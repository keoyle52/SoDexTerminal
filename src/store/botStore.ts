import { create } from 'zustand';

/**
 * Professional-grade Grid Bot configuration. Mirrors the parameter
 * surface of the major centralised exchanges (Binance / Bybit / OKX),
 * including arithmetic vs geometric spacing, conditional trigger price,
 * grid-wide TP/SL, and leverage for perpetuals.
 */
interface GridBotState {
  // ── Core ──────────────────────────────────────────────────────
  symbol: string;
  lowerPrice: string;
  upperPrice: string;
  gridCount: string;
  amountPerGrid: string;
  isSpot: boolean;
  mode: 'NEUTRAL' | 'LONG' | 'SHORT';
  /** Arithmetic = constant price step; Geometric = constant percent step. */
  spacing: 'ARITHMETIC' | 'GEOMETRIC';
  /** Optional leverage (perps only). */
  leverage: string;
  // ── Conditional start ─────────────────────────────────────────
  /** When set, the bot waits until last price crosses this trigger
   *  before placing initial orders. Empty string = start immediately. */
  triggerPrice: string;
  triggerDirection: 'CROSS_DOWN' | 'CROSS_UP';
  // ── Stop conditions ───────────────────────────────────────────
  /** Stop the entire grid + cancel orders if price drops to this level. */
  stopLossPrice: string;
  /** Stop the entire grid + cancel orders if price rises to this level. */
  takeProfitPrice: string;
  /** Stop & close everything once realized PnL hits this absolute value. */
  trailingProfitUsd: string;
  // ── Status ────────────────────────────────────────────────────
  status: 'STOPPED' | 'RUNNING' | 'ARMED' | 'ERROR';
  activeOrders: number;
  totalInvestment: number;
  completedGrids: number;
  realizedPnl: number;
  setField: <K extends keyof GridBotState>(field: K, value: GridBotState[K]) => void;
  resetStats: () => void;
}

interface BotStoreState {
  gridBot: GridBotState;
}

export const useBotStore = create<BotStoreState>((set) => ({
  gridBot: {
    symbol: 'BTC_USDC',
    lowerPrice: '60000',
    upperPrice: '70000',
    gridCount: '10',
    amountPerGrid: '0.01',
    isSpot: true,
    mode: 'NEUTRAL',
    spacing: 'ARITHMETIC',
    leverage: '1',
    triggerPrice: '',
    triggerDirection: 'CROSS_UP',
    stopLossPrice: '',
    takeProfitPrice: '',
    trailingProfitUsd: '',
    status: 'STOPPED',
    activeOrders: 0,
    totalInvestment: 0,
    completedGrids: 0,
    realizedPnl: 0,
    setField: (field, value) =>
      set((state) => ({
        gridBot: { ...state.gridBot, [field]: value },
      })),
    resetStats: () =>
      set((state) => ({
        gridBot: {
          ...state.gridBot,
          activeOrders: 0,
          totalInvestment: 0,
          completedGrids: 0,
          realizedPnl: 0,
          status: 'STOPPED'
        },
      })),
  },
}));
