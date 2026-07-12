import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'dark' | 'light';

interface SettingsState {
  isWalletConnected: boolean;
  walletAddress: string;

  apiKeyName: string;
  privateKey: string;
  evmAddress: string;
  apiKeyExpiry: number | null;

  defaultSymbol: string;
  confirmOrders: boolean;
  toastsEnabled: boolean;
  sosoApiKey: string;
  geminiApiKey: string;
  isDemoMode: boolean;
  theme: Theme;
  telegramChatId: string;

  connectWallet: (address: string) => void;
  disconnectWallet: () => void;
  
  setApiKeyName: (val: string) => void;
  setPrivateKey: (val: string) => void;
  setEvmAddress: (val: string) => void;
  setApiKeyExpiry: (val: number | null) => void;

  setDefaultSymbol: (val: string) => void;
  setConfirmOrders: (val: boolean) => void;
  setToastsEnabled: (val: boolean) => void;
  setSosoApiKey: (val: string) => void;
  setGeminiApiKey: (val: string) => void;
  setIsDemoMode: (val: boolean) => void;
  setTheme: (val: Theme) => void;
  setTelegramChatId: (val: string) => void;
  
  hasDisconnectedManually: boolean;
  setHasDisconnectedManually: (val: boolean) => void;

  disconnect: () => void;

  // Deprecated/Compatibility layer to prevent instant crashes
  isTestnet: boolean;
  setIsTestnet: (val: boolean) => void;
  setMainnetApiKeyName: (val: string) => void;
  setMainnetPrivateKey: (val: string) => void;
  setMainnetEvmAddress: (val: string) => void;
  setTestnetPrivateKey: (val: string) => void;
  setTestnetApiKeyName: (val: string) => void;
  setTestnetEvmAddress: (val: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      isWalletConnected: false,
      walletAddress: '',
      hasDisconnectedManually: false,
      
      apiKeyName: '',
      privateKey: '',
      evmAddress: '',
      apiKeyExpiry: null as number | null,

      defaultSymbol: 'BTC-USD',
      confirmOrders: true,
      toastsEnabled: true,
      sosoApiKey: '',
      geminiApiKey: '',
      isDemoMode: false,
      theme: 'dark',
      telegramChatId: '',

      isTestnet: false,

      connectWallet: (address) => {
        set({ isWalletConnected: true, walletAddress: (address || '').trim().toLowerCase(), hasDisconnectedManually: false });
      },
      disconnectWallet: () => {
        set({ isWalletConnected: false, walletAddress: '', hasDisconnectedManually: true });
      },
      
      setApiKeyName: (val) => set({ apiKeyName: val.trim() }),
      setPrivateKey: (val) => set({ privateKey: val.trim() }),
      setEvmAddress: (val) => set({ evmAddress: val.trim().toLowerCase() }),
      setApiKeyExpiry: (val) => set({ apiKeyExpiry: val }),
      
      setDefaultSymbol: (val) => set({ defaultSymbol: val }),
      setConfirmOrders: (val) => set({ confirmOrders: val }),
      setToastsEnabled: (val) => set({ toastsEnabled: val }),
      setSosoApiKey: (val) => set({ sosoApiKey: val }),
      setGeminiApiKey: (val) => set({ geminiApiKey: val }),
      setIsDemoMode: (val) => set({ isDemoMode: val }),
      setTheme: (val) => set({ theme: val }),
      setTelegramChatId: (val) => set({ telegramChatId: val }),
      setHasDisconnectedManually: (val) => set({ hasDisconnectedManually: val }),
      
      disconnect: () => {
        set({ isWalletConnected: false, walletAddress: '', hasDisconnectedManually: true });
      },

      setIsTestnet: () => {}, // no-op
      setMainnetApiKeyName: (val) => set({ apiKeyName: val.trim() }),
      setMainnetPrivateKey: (val) => set({ privateKey: val.trim() }),
      setMainnetEvmAddress: (val) => set({ evmAddress: val.trim() }),
      setTestnetPrivateKey: () => {}, // no-op
      setTestnetApiKeyName: () => {}, // no-op
      setTestnetEvmAddress: () => {}, // no-op
    }),
    {
      name: 'sodex-settings',
      version: 3,
      partialize: (state) => ({
        isWalletConnected: state.isWalletConnected,
        walletAddress: state.walletAddress,
        apiKeyName: state.apiKeyName,
        evmAddress: state.evmAddress,
        apiKeyExpiry: state.apiKeyExpiry,
        defaultSymbol: state.defaultSymbol,
        confirmOrders: state.confirmOrders,
        toastsEnabled: state.toastsEnabled,
        sosoApiKey: state.sosoApiKey,
        geminiApiKey: state.geminiApiKey,
        isDemoMode: state.isDemoMode,
        theme: state.theme,
        telegramChatId: state.telegramChatId,
      }),
      migrate: (persisted: any, version) => {
        if (!persisted || typeof persisted !== 'object') return persisted;
        if (version < 3) {
            const old = persisted as any;
            return {
                ...old,
                apiKeyName: old.mainnetApiKeyName || old.apiKeyName || '',
                evmAddress: old.mainnetEvmAddress || old.evmAddress || '',
                isTestnet: undefined,
                testnetEvmAddress: undefined,
                testnetApiKeyName: undefined,
                mainnetApiKeyName: undefined,
                mainnetEvmAddress: undefined,
            }
        }
        return persisted;
      }
    }
  )
);
