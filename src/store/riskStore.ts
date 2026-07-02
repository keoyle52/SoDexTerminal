import { create } from 'zustand';

export type RiskLevel = 'SAFE' | 'ELEVATED' | 'CRITICAL';

export interface RiskEvent {
  id: string;
  timestamp: string;
  type: 'FLASH_CRASH' | 'HIGH_VOLATILITY' | 'LIQUIDATION_CASCADE';
  asset: string;
  message: string;
}

interface RiskStore {
  isRiskShieldActive: boolean;
  setRiskShieldActive: (active: boolean) => void;
  
  currentRiskLevel: RiskLevel;
  setRiskLevel: (level: RiskLevel) => void;
  
  maxDrawdownLimitPct: number;
  setMaxDrawdownLimit: (pct: number) => void;
  
  riskEvents: RiskEvent[];
  addRiskEvent: (event: Omit<RiskEvent, 'id' | 'timestamp'>) => void;
  clearRiskEvents: () => void;
}

export const useRiskStore = create<RiskStore>((set) => ({
  isRiskShieldActive: true,
  setRiskShieldActive: (active) => set({ isRiskShieldActive: active }),
  
  currentRiskLevel: 'SAFE',
  setRiskLevel: (level) => set({ currentRiskLevel: level }),
  
  maxDrawdownLimitPct: 3.0,
  setMaxDrawdownLimit: (pct) => set({ maxDrawdownLimitPct: pct }),
  
  riskEvents: [],
  addRiskEvent: (event) => set((state) => ({
    riskEvents: [
      {
        ...event,
        id: Math.random().toString(36).substring(7),
        timestamp: new Date().toISOString()
      },
      ...state.riskEvents
    ].slice(0, 50)
  })),
  clearRiskEvents: () => set({ riskEvents: [] })
}));
