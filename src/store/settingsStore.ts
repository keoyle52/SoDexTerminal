import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface SettingsState {
  apiKeyName: string;
  privateKey: string; // Excluded from localStorage persistence
  
  network: 'mainnet' | 'testnet';
  theme: 'dark' | 'light';
  defaultOrderType: string;
  showConfirmDialog: boolean;
  soundEnabled: boolean;
  priceDecimals: number | null; // Null means auto based on symbol
  gridLayout: any[];

  // Actions
  setApiKeyName: (name: string) => void;
  setPrivateKey: (key: string) => void;
  setNetwork: (network: 'mainnet' | 'testnet') => void;
  setTheme: (theme: 'dark' | 'light') => void;
  updatePreferences: (prefs: Partial<SettingsState>) => void;
  updateLayout: (layout: any) => void;
  layoutReset: () => void;
  disconnectSettings: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      apiKeyName: '',
      privateKey: '', // memory only
      
      network: 'testnet', // Starting with testnet per user instruction
      theme: 'dark',
      defaultOrderType: 'LIMIT',
      showConfirmDialog: true,
      soundEnabled: true,
      priceDecimals: null,
      gridLayout: [],

      setApiKeyName: (name) => set({ apiKeyName: name }),
      setPrivateKey: (key) => set({ privateKey: key }),
      setNetwork: (network) => set({ network }),
      setTheme: (theme) => {
        // Toggle document level class for tailwind
        if (theme === 'dark') document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
        set({ theme });
      },
      updatePreferences: (prefs) => set((state) => ({ ...state, ...prefs })),
      updateLayout: (layout) => set({ gridLayout: layout }),
      layoutReset: () => set({ gridLayout: [] }),
      
      disconnectSettings: () => set({ apiKeyName: '', privateKey: '' })
    }),
    {
      name: 'sodex-terminal-settings',
      partialize: (state) => ({
        apiKeyName: state.apiKeyName,
        network: state.network,
        theme: state.theme,
        defaultOrderType: state.defaultOrderType,
        showConfirmDialog: state.showConfirmDialog,
        soundEnabled: state.soundEnabled,
        priceDecimals: state.priceDecimals,
        gridLayout: state.gridLayout,
      }),
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// Initialize document classes based on default/cached state
if (typeof document !== 'undefined') {
    const isDark = JSON.parse(localStorage.getItem('sodex-terminal-settings') || '{}')?.state?.theme !== 'light';
    if (isDark) document.documentElement.classList.add('dark');
}
