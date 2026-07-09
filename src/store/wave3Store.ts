import { create } from 'zustand';

export type Wave3Regime = 'CONSOLIDATION' | 'TRENDING_UP' | 'TRENDING_DOWN' | 'HIGH_VOLATILITY';

export interface Wave3Log {
  id: string;
  timestamp: string;
  message: string;
  type: 'INFO' | 'ACTION' | 'WARNING' | 'SUCCESS';
}

export interface Wave3Position {
  botType: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  size: number;
  orderId?: string;
  status: 'ACTIVE' | 'CLOSING' | 'CLOSED';
}

interface Wave3Store {
  isAgentRunning: boolean;
  setAgentRunning: (running: boolean) => void;
  
  targetCoin: string;
  setTargetCoin: (coin: string) => void;

  market: 'spot' | 'perps';
  setMarket: (market: 'spot' | 'perps') => void;

  investment: number;
  setInvestment: (amount: number) => void;

  feeDragProtection: boolean;
  setFeeDragProtection: (active: boolean) => void;

  maxDrawdownPct: number;
  setMaxDrawdownPct: (pct: number) => void;

  currentRegime: Wave3Regime;
  setCurrentRegime: (regime: Wave3Regime) => void;

  activeAction: string;
  setActiveAction: (action: string) => void;

  logs: Wave3Log[];
  addLog: (message: string, type?: Wave3Log['type']) => void;
  clearLogs: () => void;

  activePosition: Wave3Position | null;
  setActivePosition: (pos: Wave3Position | null) => void;
  updatePositionPnl: (currentPrice: number) => void;
}

export const useWave3Store = create<Wave3Store>((set) => ({
  isAgentRunning: false,
  setAgentRunning: (running) => set({ isAgentRunning: running }),

  targetCoin: 'BTC-USD',
  setTargetCoin: (coin) => set({ targetCoin: coin }),

  market: 'perps',
  setMarket: (market) => set({ market }),

  investment: 5000,
  setInvestment: (amount) => set({ investment: amount }),

  feeDragProtection: true,
  setFeeDragProtection: (active) => set({ feeDragProtection: active }),

  maxDrawdownPct: 5,
  setMaxDrawdownPct: (pct) => set({ maxDrawdownPct: pct }),

  currentRegime: 'CONSOLIDATION',
  setCurrentRegime: (regime) => set({ currentRegime: regime }),

  activeAction: 'WAITING',
  setActiveAction: (action) => set({ activeAction: action }),

  logs: [],
  addLog: (message, type = 'INFO') => set((state) => ({
    logs: [
      {
        id: Math.random().toString(36).substring(7),
        timestamp: new Date().toISOString(),
        message,
        type
      },
      ...state.logs
    ].slice(0, 100)
  })),
  clearLogs: () => set({ logs: [] }),

  activePosition: null,
  setActivePosition: (pos) => set({ activePosition: pos }),
  updatePositionPnl: (currentPrice) => set((state) => {
    if (!state.activePosition) return state;
    const pos = state.activePosition;
    const isLong = pos.side === 'LONG';
    const diff = currentPrice - pos.entryPrice;
    
    // PnL in quote asset (USDT)
    const pnl = isLong ? (diff * pos.size) : (-diff * pos.size);
    
    return {
      activePosition: {
        ...pos,
        currentPrice,
        pnl
      }
    };
  })
}));
