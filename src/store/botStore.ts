import { create } from 'zustand';
import { createDefaultSignals, type SignalConfig, type CombineMode } from '../api/signalEngine';

export interface BotLog {
  id: string;
  timestamp: number;
  message: string;
  type: 'INFO' | 'ACTION' | 'SUCCESS' | 'WARNING';
}

interface GridBotState {
  symbol: string;
  investmentUsdt: string;
  lowerPrice: string;
  upperPrice: string;
  gridCount: string;
  amountPerGrid: string;
  isSpot: boolean;
  mode: 'NEUTRAL' | 'LONG' | 'SHORT';
  spacing: 'ARITHMETIC' | 'GEOMETRIC';
  leverage: string;
  triggerPrice: string;
  triggerDirection: 'CROSS_DOWN' | 'CROSS_UP';
  stopLossPrice: string;
  takeProfitPrice: string;
  trailingProfitUsd: string;
  status: 'STOPPED' | 'RUNNING' | 'ARMED' | 'ERROR';
  activeOrders: number;
  totalInvestment: number;
  completedGrids: number;
  realizedPnl: number;
  logs: BotLog[];
  setField: <K extends keyof GridBotState>(field: K, value: GridBotState[K]) => void;
  bumpField: (field: 'activeOrders' | 'totalInvestment' | 'completedGrids' | 'realizedPnl', delta: number) => void;
  addLog: (message: string, type: BotLog['type']) => void;
  resetStats: () => void;
}

interface MarketMakerBotState {
  symbol: string;
  budgetUsdt: string;
  orderSizeUsdt: string;
  layers: string;
  spreadBps: string;
  requoteBps: string;
  volumeTargetUsdt: string;
  feeBudgetUsdt: string;
  makerFeeRate: string;
  status: 'STOPPED' | 'RUNNING' | 'ERROR';
  ordersPlaced: number;
  ordersFilled: number;
  ordersCancelled: number;
  volumeUsdt: number;
  feesUsdt: number;
  inventoryBase: number;
  realizedPnl: number;
  sessionStartedAt: number | null;
  logs: BotLog[];
  setField: <K extends keyof MarketMakerBotState>(field: K, value: MarketMakerBotState[K]) => void;
  bumpField: (field: 'ordersPlaced' | 'ordersFilled' | 'ordersCancelled' | 'volumeUsdt' | 'feesUsdt' | 'inventoryBase' | 'realizedPnl', delta: number) => void;
  addLog: (message: string, type: BotLog['type']) => void;
  resetStats: () => void;
}

export interface SignalPosition {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  quantity: number;
  leverage: number;
  tpPrice: number | null;
  slPrice: number | null;
  openTime: number;
  triggeredBy: string[];
  orderId?: string;
  tpOrderId?: string;
  slOrderId?: string;
  unrealizedPnl: number;
  status: 'OPEN' | 'TP_HIT' | 'SL_HIT' | 'CLOSED_BY_SIGNAL' | 'MANUAL_CLOSE';
}

export type ConflictResolution = 'CLOSE_AND_REVERSE' | 'CLOSE_ONLY' | 'IGNORE';

interface SignalBotState {
  symbol: string;
  investmentUsdt: string;
  isSpot: boolean;
  leverage: string;
  amountUsdt: string;
  takeProfitPct: string;
  stopLossPct: string;
  signals: SignalConfig[];
  combineMode: CombineMode;
  checkInterval: string;
  klineInterval: string;
  onConflictingSignal: ConflictResolution;
  maxOpenPositions: string;
  cooldownSeconds: string;
  status: 'STOPPED' | 'RUNNING' | 'ERROR';
  lastSignalTime: number | null;
  lastSignalDirection: 'LONG' | 'SHORT' | null;
  totalTrades: number;
  winTrades: number;
  realizedPnl: number;
  activePositions: SignalPosition[];
  logs: BotLog[];
  setField: <K extends keyof SignalBotState>(field: K, value: SignalBotState[K]) => void;
  bumpField: (field: 'realizedPnl', delta: number) => void;
  addLog: (message: string, type: BotLog['type']) => void;
  resetStats: () => void;
}

interface DcaBotState {
  symbol: string;
  investmentUsdt: string;
  orderSizeUsdt: string;
  intervalMinutes: string;
  maxDrawdownPct: string;
  status: 'STOPPED' | 'RUNNING' | 'ERROR';
  ordersPlaced: number;
  totalAccumulated: number;
  realizedPnl: number;
  logs: BotLog[];
  setField: <K extends keyof DcaBotState>(field: K, value: DcaBotState[K]) => void;
  bumpField: (field: 'realizedPnl' | 'totalAccumulated' | 'ordersPlaced', delta: number) => void;
  addLog: (message: string, type: BotLog['type']) => void;
  resetStats: () => void;
}

interface TwapBotState {
  symbol: string;
  investmentUsdt: string;
  totalDurationHours: string;
  sliceCount: string;
  priceLimit: string;
  status: 'STOPPED' | 'RUNNING' | 'ERROR';
  slicesExecuted: number;
  totalAccumulated: number;
  realizedPnl: number;
  logs: BotLog[];
  setField: <K extends keyof TwapBotState>(field: K, value: TwapBotState[K]) => void;
  bumpField: (field: 'realizedPnl' | 'totalAccumulated' | 'slicesExecuted', delta: number) => void;
  addLog: (message: string, type: BotLog['type']) => void;
  resetStats: () => void;
}

interface BotStoreState {
  gridBot: GridBotState;
  marketMakerBot: MarketMakerBotState;
  signalBot: SignalBotState;
  dcaBot: DcaBotState;
  twapBot: TwapBotState;
}

const createLog = (message: string, type: BotLog['type']): BotLog => ({
  id: Math.random().toString(36).substring(7),
  timestamp: Date.now(),
  message,
  type
});

export const useBotStore = create<BotStoreState>((set) => ({
  gridBot: {
    symbol: 'BTC-USD',
    investmentUsdt: '1000',
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
    logs: [],
    setField: (field, value) => set((state) => ({ gridBot: { ...state.gridBot, [field]: value } })),
    bumpField: (field, delta) => set((state) => ({ gridBot: { ...state.gridBot, [field]: (state.gridBot[field] as number) + delta } })),
    addLog: (message, type) => set((state) => ({ gridBot: { ...state.gridBot, logs: [createLog(message, type), ...state.gridBot.logs].slice(0, 100) } })),
    resetStats: () => set((state) => ({ gridBot: { ...state.gridBot, activeOrders: 0, totalInvestment: 0, completedGrids: 0, realizedPnl: 0, status: 'STOPPED', logs: [] } })),
  },
  marketMakerBot: {
    symbol: 'BTC-USD',
    budgetUsdt: '100',
    orderSizeUsdt: '10',
    layers: '2',
    spreadBps: '0',
    requoteBps: '5',
    volumeTargetUsdt: '',
    feeBudgetUsdt: '',
    makerFeeRate: '0.0001',
    status: 'STOPPED',
    ordersPlaced: 0,
    ordersFilled: 0,
    ordersCancelled: 0,
    volumeUsdt: 0,
    feesUsdt: 0,
    inventoryBase: 0,
    realizedPnl: 0,
    sessionStartedAt: null,
    logs: [],
    setField: (field, value) => set((state) => ({ marketMakerBot: { ...state.marketMakerBot, [field]: value } })),
    bumpField: (field, delta) => set((state) => ({ marketMakerBot: { ...state.marketMakerBot, [field]: (state.marketMakerBot[field] as number) + delta } })),
    addLog: (message, type) => set((state) => ({ marketMakerBot: { ...state.marketMakerBot, logs: [createLog(message, type), ...state.marketMakerBot.logs].slice(0, 100) } })),
    resetStats: () => set((state) => ({ marketMakerBot: { ...state.marketMakerBot, status: 'STOPPED', ordersPlaced: 0, ordersFilled: 0, ordersCancelled: 0, volumeUsdt: 0, feesUsdt: 0, inventoryBase: 0, realizedPnl: 0, sessionStartedAt: null, logs: [] } })),
  },
  signalBot: {
    symbol: 'BTC-USD',
    investmentUsdt: '500',
    isSpot: false,
    leverage: '5',
    amountUsdt: '50',
    takeProfitPct: '3',
    stopLossPct: '2',
    signals: createDefaultSignals(),
    combineMode: 'ANY',
    checkInterval: '60',
    klineInterval: '15m',
    onConflictingSignal: 'CLOSE_AND_REVERSE',
    maxOpenPositions: '1',
    cooldownSeconds: '120',
    status: 'STOPPED',
    lastSignalTime: null,
    lastSignalDirection: null,
    totalTrades: 0,
    winTrades: 0,
    realizedPnl: 0,
    activePositions: [],
    logs: [],
    setField: (field, value) => set((state) => ({ signalBot: { ...state.signalBot, [field]: value } })),
    bumpField: (field, delta) => set((state) => ({ signalBot: { ...state.signalBot, [field]: (state.signalBot[field] as number) + delta } })),
    addLog: (message, type) => set((state) => ({ signalBot: { ...state.signalBot, logs: [createLog(message, type), ...state.signalBot.logs].slice(0, 100) } })),
    resetStats: () => set((state) => ({ signalBot: { ...state.signalBot, status: 'STOPPED', lastSignalTime: null, lastSignalDirection: null, totalTrades: 0, winTrades: 0, realizedPnl: 0, activePositions: [], logs: [] } })),
  },
  dcaBot: {
    symbol: 'BTC-USD',
    investmentUsdt: '1000',
    orderSizeUsdt: '50',
    intervalMinutes: '60',
    maxDrawdownPct: '5',
    status: 'STOPPED',
    ordersPlaced: 0,
    totalAccumulated: 0,
    realizedPnl: 0,
    logs: [],
    setField: (field, value) => set((state) => ({ dcaBot: { ...state.dcaBot, [field]: value } })),
    bumpField: (field, delta) => set((state) => ({ dcaBot: { ...state.dcaBot, [field]: (state.dcaBot[field] as number) + delta } })),
    addLog: (message, type) => set((state) => ({ dcaBot: { ...state.dcaBot, logs: [createLog(message, type), ...state.dcaBot.logs].slice(0, 100) } })),
    resetStats: () => set((state) => ({ dcaBot: { ...state.dcaBot, status: 'STOPPED', ordersPlaced: 0, totalAccumulated: 0, realizedPnl: 0, logs: [] } })),
  },
  twapBot: {
    symbol: 'BTC-USD',
    investmentUsdt: '5000',
    totalDurationHours: '24',
    sliceCount: '24',
    priceLimit: '75000',
    status: 'STOPPED',
    slicesExecuted: 0,
    totalAccumulated: 0,
    realizedPnl: 0,
    logs: [],
    setField: (field, value) => set((state) => ({ twapBot: { ...state.twapBot, [field]: value } })),
    bumpField: (field, delta) => set((state) => ({ twapBot: { ...state.twapBot, [field]: (state.twapBot[field] as number) + delta } })),
    addLog: (message, type) => set((state) => ({ twapBot: { ...state.twapBot, logs: [createLog(message, type), ...state.twapBot.logs].slice(0, 100) } })),
    resetStats: () => set((state) => ({ twapBot: { ...state.twapBot, status: 'STOPPED', slicesExecuted: 0, totalAccumulated: 0, realizedPnl: 0, logs: [] } })),
  }
}));
