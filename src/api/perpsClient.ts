import axios from 'axios';
import { signPayload, deriveActionType, resolveApiKey } from './signer';
import { useSettingsStore } from '../store/settingsStore';

/**
 * SoDEX Perps (Bolt engine) REST client.
 *
 * Endpoints: see `sodexdocument/sodex-rest-perps-api.md`.
 *  - Mainnet: https://mainnet-gw.sodex.dev/api/v1/perps
 *  - Testnet: https://testnet-gw.sodex.dev/api/v1/perps
 *
 * - Public GET endpoints are unsigned.
 * - Signed writes (POST/DELETE) attach `X-API-Key`, `X-API-Sign`,
 *   `X-API-Nonce` headers via EIP-712 (`signer.ts → signPayload`).
 */
const BASE_URL_MAINNET = 'https://mainnet-gw.sodex.dev/api/v1/perps';
const BASE_URL_TESTNET = 'https://testnet-gw.sodex.dev/api/v1/perps';

export const perpsClient = axios.create({
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

perpsClient.interceptors.request.use(async (config) => {
  const state = useSettingsStore.getState();
  config.baseURL = state.isTestnet ? BASE_URL_TESTNET : BASE_URL_MAINNET;

  const { apiKeyName, privateKey, isTestnet, isWalletConnected, walletAddress } = state;
  const method = (config.method ?? 'GET').toUpperCase();

  // Sign write (non-GET) requests if private key OR connected Web3 wallet is active
  if (method !== 'GET' && (privateKey || (isWalletConnected && walletAddress))) {
    const effectiveApiKey = resolveApiKey({ apiKeyName, privateKey, isTestnet, walletAddress });

    if (!effectiveApiKey) {
      return Promise.reject(new Error('Invalid credentials: could not resolve wallet address'));
    }

    const payload = (config.data ?? {}) as Record<string, unknown>;
    const actionType = deriveActionType(method, config.url ?? '');
    const useBrowserWallet = isWalletConnected && !!walletAddress && !privateKey;
    try {
      const { signature, nonce } = await signPayload(
        actionType,
        payload,
        privateKey,
        'futures',
        isTestnet,
        effectiveApiKey,
        useBrowserWallet
      );
      config.headers['X-API-Key'] = effectiveApiKey;
      config.headers['X-API-Nonce'] = nonce;
      config.headers['X-API-Sign'] = signature;

      if (typeof window !== 'undefined') {
        console.log(
          `[perpsClient] %c${isTestnet ? 'TESTNET' : 'MAINNET'} (${useBrowserWallet ? 'Web3Wallet' : 'PK'})%c ${method} ${config.url}`
          + `\n  X-API-Key  = ${effectiveApiKey}`
          + `\n  X-API-Nonce= ${nonce}`
          + `\n  action     = ${actionType}`,
          isTestnet ? 'color:#fbbf24;font-weight:bold' : 'color:#22d3ee;font-weight:bold',
          'color:inherit',
        );
      }
    } catch (error) {
      return Promise.reject(error);
    }
  }

  return config;
});

// Unwrap axios → the value we return to callers IS the JSON body.
// Keeps the rest of the codebase simple: `const body = await perpsClient.get(...)`.
perpsClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    // Surface SoDEX backend error message (often hidden in nested fields)
    // so users see "api key not found" instead of generic 401/400.
    const data = error?.response?.data;
    const msg = data?.error ?? data?.message ?? data?.msg
      ?? (typeof data === 'string' ? data : null)
      ?? error?.message;
    if (msg && typeof msg === 'string') {
      const lower = msg.toLowerCase();
      const isTestnet = useSettingsStore.getState().isTestnet;
      // Add a registration hint when the backend reports a missing key.
      if (lower.includes('api key not found') || lower.includes('apikey not found')) {
        error.message = `${msg} — register an API key for this address at ${isTestnet ? 'testnet.sodex.com' : 'sodex.com'} → Settings → API Keys, then paste its name in Settings → ${isTestnet ? 'Testnet' : 'Mainnet'} Credentials.`;
      } else {
        error.message = msg;
      }
    }
    return Promise.reject(error);
  },
);
