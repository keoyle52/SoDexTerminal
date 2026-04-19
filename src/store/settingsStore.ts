import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'dark' | 'light';

/**
 * Per-network credentials.
 *
 * SoDEX treats mainnet and testnet as completely independent environments:
 *  - Mainnet requires a registered API key (agent wallet) that is separate
 *    from the master EVM wallet. Writes are signed by the agent's private
 *    key, but REST URLs are indexed by the master address.
 *  - Testnet does NOT have registered API keys. The master wallet's own
 *    private key signs every write; its derived address IS the X-API-Key.
 *
 * Keeping the two sets of credentials in separate slots means switching
 * networks no longer overwrites the "other" network's config, and the
 * Settings UI can show only the inputs that matter for the active network.
 */
interface SettingsState {
  // ───── Network toggle (persisted) ─────
  isTestnet: boolean;

  // ───── Mainnet credentials ─────
  /**
   * `X-API-Key` header value sent on mainnet. Typically the agent wallet's
   * EVM address. Persisted so refreshes don't drop the config.
   */
  mainnetApiKeyName: string;
  /**
   * Agent (API-key) wallet private key used to sign mainnet writes.
   * Kept in memory only — never persisted to localStorage.
   */
  mainnetPrivateKey: string;
  /**
   * Master wallet address used in mainnet REST URL paths like
   * `/accounts/{address}/state`. Persisted.
   */
  mainnetEvmAddress: string;

  // ───── Testnet credentials ─────
  /**
   * Master EVM wallet private key used on testnet to sign every write.
   * The X-API-Key header defaults to the derived address. Kept in memory only.
   */
  testnetPrivateKey: string;
  /**
   * Optional override for the testnet URL-path address. Normally the
   * derived address of `testnetPrivateKey` is used, but some users run a
   * separate master wallet and need to hit the matching account ID.
   */
  testnetEvmAddress: string;
  /**
   * Optional registered API key name sent as `X-API-Key` on testnet writes.
   * When empty, the derived address of `testnetPrivateKey` is used (legacy
   * behavior). Set this if the SoDEX testnet gateway rejects the derived
   * address with an "api key not found" error — paste the name you used
   * when registering the key. Persisted (public data, like the address).
   */
  testnetApiKeyName: string;

  // ───── Active-network passthrough fields ─────
  /**
   * Read-only mirrors of the active-network credentials. Every API client
   * reads from these fields so call sites do not need to branch on
   * `isTestnet`. They are kept in sync automatically whenever network or
   * per-network credentials change.
   */
  apiKeyName: string;
  privateKey: string;
  evmAddress: string;

  // ───── Other UI / app settings ─────
  defaultSymbol: string;
  confirmOrders: boolean;
  toastsEnabled: boolean;
  sosoApiKey: string;
  geminiApiKey: string;
  isDemoMode: boolean;
  theme: Theme;

  // ───── Actions ─────
  /** Set the mainnet `X-API-Key` header value. */
  setMainnetApiKeyName: (val: string) => void;
  /** Set the mainnet agent-key private key (in-memory only). */
  setMainnetPrivateKey: (val: string) => void;
  /** Set the mainnet master EVM address used in REST paths. */
  setMainnetEvmAddress: (val: string) => void;
  /** Set the testnet master-wallet private key (in-memory only). */
  setTestnetPrivateKey: (val: string) => void;
  /** Set the optional testnet EVM address override. */
  setTestnetEvmAddress: (val: string) => void;
  /** Set the optional testnet registered API key name. */
  setTestnetApiKeyName: (val: string) => void;
  /** Toggle between mainnet and testnet; swaps passthrough fields. */
  setIsTestnet: (val: boolean) => void;
  setDefaultSymbol: (val: string) => void;
  setConfirmOrders: (val: boolean) => void;
  setToastsEnabled: (val: boolean) => void;
  setSosoApiKey: (val: string) => void;
  setGeminiApiKey: (val: string) => void;
  setIsDemoMode: (val: boolean) => void;
  setTheme: (val: Theme) => void;
  /**
   * Clear credentials for the CURRENTLY active network only. The other
   * network's config is preserved so switching back restores the full
   * setup.
   */
  disconnect: () => void;

  // ───── Legacy compatibility setters (rewrite to active network) ─────
  /** Deprecated — use `setMainnetApiKeyName`. Writes to the active network. */
  setApiKeyName: (val: string) => void;
  /** Deprecated — use `setMainnetPrivateKey` / `setTestnetPrivateKey`. Writes to the active network. */
  setPrivateKey: (val: string) => void;
  /** Deprecated — use `setMainnetEvmAddress` / `setTestnetEvmAddress`. Writes to the active network. */
  setEvmAddress: (val: string) => void;
}

/**
 * Compute the passthrough mirror fields (apiKeyName / privateKey /
 * evmAddress) for the active network. Called after every change so
 * the rest of the app can keep reading `store.privateKey` without
 * knowing about network separation.
 */
function resolveActive(state: {
  isTestnet: boolean;
  mainnetApiKeyName: string;
  mainnetPrivateKey: string;
  mainnetEvmAddress: string;
  testnetPrivateKey: string;
  testnetEvmAddress: string;
  testnetApiKeyName: string;
}): { apiKeyName: string; privateKey: string; evmAddress: string } {
  if (state.isTestnet) {
    return {
      // If user registered an API key on testnet, use it. Otherwise fall
      // back to the derived address at request time (see signer.resolveApiKey).
      apiKeyName: state.testnetApiKeyName,
      privateKey: state.testnetPrivateKey,
      evmAddress: state.testnetEvmAddress,
    };
  }
  return {
    apiKeyName: state.mainnetApiKeyName,
    privateKey: state.mainnetPrivateKey,
    evmAddress: state.mainnetEvmAddress,
  };
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      isTestnet: true,

      mainnetApiKeyName: '',
      mainnetPrivateKey: '',
      mainnetEvmAddress: '',

      testnetPrivateKey: '',
      testnetEvmAddress: '',
      testnetApiKeyName: '',

      // Initial passthrough values — recomputed on every setter.
      apiKeyName: '',
      privateKey: '',
      evmAddress: '',

      defaultSymbol: 'BTC-USD',
      confirmOrders: true,
      toastsEnabled: true,
      sosoApiKey: '',
      geminiApiKey: '',
      isDemoMode: false,
      theme: 'dark',

      setMainnetApiKeyName: (val) => {
        set((s) => {
          const next = { ...s, mainnetApiKeyName: val.trim() };
          return { ...next, ...resolveActive(next) };
        });
      },
      setMainnetPrivateKey: (val) => {
        set((s) => {
          const next = { ...s, mainnetPrivateKey: val.trim() };
          return { ...next, ...resolveActive(next) };
        });
      },
      setMainnetEvmAddress: (val) => {
        set((s) => {
          const next = { ...s, mainnetEvmAddress: val.trim() };
          return { ...next, ...resolveActive(next) };
        });
      },
      setTestnetPrivateKey: (val) => {
        set((s) => {
          const next = { ...s, testnetPrivateKey: val.trim() };
          return { ...next, ...resolveActive(next) };
        });
      },
      setTestnetEvmAddress: (val) => {
        set((s) => {
          const next = { ...s, testnetEvmAddress: val.trim() };
          return { ...next, ...resolveActive(next) };
        });
      },
      setTestnetApiKeyName: (val) => {
        set((s) => {
          const next = { ...s, testnetApiKeyName: val.trim() };
          return { ...next, ...resolveActive(next) };
        });
      },
      setIsTestnet: (val) => {
        set((s) => {
          const next = { ...s, isTestnet: val };
          return { ...next, ...resolveActive(next) };
        });
      },
      setDefaultSymbol: (val) => set({ defaultSymbol: val }),
      setConfirmOrders: (val) => set({ confirmOrders: val }),
      setToastsEnabled: (val) => set({ toastsEnabled: val }),
      setSosoApiKey: (val) => set({ sosoApiKey: val }),
      setGeminiApiKey: (val) => set({ geminiApiKey: val }),
      setIsDemoMode: (val) => set({ isDemoMode: val }),
      setTheme: (val) => set({ theme: val }),
      disconnect: () => {
        set((s) => {
          const cleared = s.isTestnet
            ? { ...s, testnetPrivateKey: '', testnetEvmAddress: '', testnetApiKeyName: '' }
            : { ...s, mainnetApiKeyName: '', mainnetPrivateKey: '', mainnetEvmAddress: '' };
          return { ...cleared, ...resolveActive(cleared) };
        });
      },

      // Legacy setters — forward to the appropriate per-network setter
      // based on the active network. Preserves compatibility with older
      // components that still call `setPrivateKey` etc.
      setApiKeyName: (val) => {
        const s = get();
        if (s.isTestnet) s.setTestnetApiKeyName(val);
        else s.setMainnetApiKeyName(val);
      },
      setPrivateKey: (val) => {
        const s = get();
        if (s.isTestnet) s.setTestnetPrivateKey(val);
        else s.setMainnetPrivateKey(val);
      },
      setEvmAddress: (val) => {
        const s = get();
        if (s.isTestnet) s.setTestnetEvmAddress(val);
        else s.setMainnetEvmAddress(val);
      },
    }),
    {
      name: 'sodex-settings',
      version: 2,
      partialize: (state) => ({
        isTestnet: state.isTestnet,
        // Mainnet: API key name + master EVM address are public data — fine
        // to persist. The private key is never written to disk.
        mainnetApiKeyName: state.mainnetApiKeyName,
        mainnetEvmAddress: state.mainnetEvmAddress,
        // Testnet: EVM address + optional API key name are public. Private key stays in memory.
        testnetEvmAddress: state.testnetEvmAddress,
        testnetApiKeyName: state.testnetApiKeyName,
        defaultSymbol: state.defaultSymbol,
        confirmOrders: state.confirmOrders,
        toastsEnabled: state.toastsEnabled,
        sosoApiKey: state.sosoApiKey,
        geminiApiKey: state.geminiApiKey,
        isDemoMode: state.isDemoMode,
        theme: state.theme,
      }),
      // Migrate pre-v2 persisted state (single `apiKeyName` / `evmAddress`
      // slot) into per-network slots — assume the old values belonged to
      // mainnet since that was the only network with registered keys.
      migrate: (persisted, version) => {
        if (!persisted || typeof persisted !== 'object') return persisted;
        if (version < 2) {
          const old = persisted as Record<string, unknown>;
          return {
            ...old,
            mainnetApiKeyName: String(old.apiKeyName ?? ''),
            mainnetEvmAddress: String(old.evmAddress ?? ''),
            testnetEvmAddress: '',
            // Drop the legacy fields to prevent future double-writes.
            apiKeyName: undefined,
            evmAddress: undefined,
          };
        }
        return persisted;
      },
      // After rehydrating from localStorage, recompute the passthrough
      // mirrors so the first render already sees the right active-network
      // credentials without needing the user to touch the UI.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const active = resolveActive(state);
        state.apiKeyName = active.apiKeyName;
        state.privateKey = active.privateKey;
        state.evmAddress = active.evmAddress;
      },
    },
  ),
);
