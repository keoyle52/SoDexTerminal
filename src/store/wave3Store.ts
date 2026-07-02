import { create } from 'zustand';

export type Wave3Regime = 'CONSOLIDATION' | 'TRENDING_UP' | 'TRENDING_DOWN' | 'HIGH_VOLATILITY';
export type Wave3Action = 'DEPLOY_GRID' | 'DEPLOY_DCA' | 'DEPLOY_TWAP' | 'EMERGENCY_HALT' | 'WAITING';

export interface Wave3Log {
  id: string;
  timestamp: string;
  message: string;
  type: 'INFO' | 'ACTION' | 'WARNING' | 'SUCCESS';
}

export interface Wave3Position {
  botType: string;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  size: number;
  status: 'ACTIVE' | 'CLOSING' | 'CLOSED';
}

interface Wave3Store {
  isAgentRunning: boolean;
  setAgentRunning: (running: boolean) => void;
  
  targetCoin: string;
  setTargetCoin: (coin: string) => void;

  currentRegime: Wave3Regime;
  setCurrentRegime: (regime: Wave3Regime) => void;

  activeAction: Wave3Action;
  setActiveAction: (action: Wave3Action) => void;

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
    const isLong = state.activePosition.botType === 'DCA' || state.activePosition.botType === 'TWAP';
    // Dummy PNL calculation for visualization
    const diff = currentPrice - state.activePosition.entryPrice;
    const pnl = isLong ? diff : diff * 0.5; // grid is delta neutralish
    
    return {
      activePosition: {
        ...state.activePosition,
        currentPrice,
        pnl
      }
    };
  })
}));
