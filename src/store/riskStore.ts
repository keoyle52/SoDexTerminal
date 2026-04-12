import { create } from 'zustand';

export interface PriceAlert {
  id: string;
  symbol: string;
  priceLevel: string;
  direction: 'UP' | 'DOWN';
  active: boolean;
}

export interface RiskState {
  // Dead Man's Switch
  scheduleCancelEnabled: boolean;
  scheduleCancelInterval: number; // ms
  scheduleCancelCountToday: number;
  nextScheduledCancel: Date | null;
  
  // Custom Risk Controls
  priceAlerts: PriceAlert[];
  maxDailyLoss: number | null; // Null means no limit set

  // Actions
  setScheduleCancelEnabled: (enabled: boolean) => void;
  setScheduleCancelInterval: (intervalMs: number) => void;
  incrementScheduleCancelCount: () => void;
  resetScheduleCancelCount: () => void; // Usually called daily
  setNextScheduledCancel: (date: Date | null) => void;
  
  addPriceAlert: (alert: Omit<PriceAlert, 'id' | 'active'>) => void;
  togglePriceAlert: (id: string, active: boolean) => void;
  removePriceAlert: (id: string) => void;
  
  setMaxDailyLoss: (loss: number | null) => void;
}

export const useRiskStore = create<RiskState>((set) => ({
  scheduleCancelEnabled: false,
  // Default to 1 minute: 60 * 1000 ms
  scheduleCancelInterval: 60000, 
  scheduleCancelCountToday: 0,
  nextScheduledCancel: null,
  
  priceAlerts: [],
  maxDailyLoss: null,

  setScheduleCancelEnabled: (enabled) => set({ scheduleCancelEnabled: enabled }),
  setScheduleCancelInterval: (intervalMs) => set({ scheduleCancelInterval: intervalMs }),
  incrementScheduleCancelCount: () => set((state) => ({ scheduleCancelCountToday: state.scheduleCancelCountToday + 1 })),
  resetScheduleCancelCount: () => set({ scheduleCancelCountToday: 0 }),
  setNextScheduledCancel: (date) => set({ nextScheduledCancel: date }),

  addPriceAlert: (alert) => set((state) => ({
    priceAlerts: [
      ...state.priceAlerts,
      { ...alert, id: Date.now().toString(), active: true }
    ]
  })),
  togglePriceAlert: (id, active) => set((state) => ({
    priceAlerts: state.priceAlerts.map(a => a.id === id ? { ...a, active } : a)
  })),
  removePriceAlert: (id) => set((state) => ({
    priceAlerts: state.priceAlerts.filter(a => a.id !== id)
  })),

  setMaxDailyLoss: (loss) => set({ maxDailyLoss: loss })
}));
