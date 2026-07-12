import axios from 'axios';
import { signPayload, deriveActionType, resolveApiKey } from './signer';
import { useSettingsStore } from '../store/settingsStore';

const BASE_URL_MAINNET = 'https://mainnet-gw.sodex.dev/api/v1/spot';

export const spotClient = axios.create({
  baseURL: BASE_URL_MAINNET,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

spotClient.interceptors.request.use(async (config) => {
  const state = useSettingsStore.getState();
  const { apiKeyName, privateKey, isWalletConnected, walletAddress, isDemoMode } = state;
  const method = (config.method ?? 'GET').toUpperCase();

  // Handle Demo Mode explicitly
  if (isDemoMode && method !== 'GET') {
    config.adapter = async () => {
      console.log(`[DEMO MODE] Simulated ${method} to ${config.url}`);
      return {
        data: {
          code: 0,
          msg: "Success (Demo Mode)",
          timestamp: Date.now(),
          data: {
             orderId: "demo-" + Math.floor(Math.random() * 1000000)
          }
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: config,
        request: {}
      };
    };
    return config;
  }

  // Sign write (non-GET) requests if private key OR connected Web3 wallet is active
  if (method !== 'GET' && (privateKey || (isWalletConnected && walletAddress))) {
    const effectiveApiKey = resolveApiKey({ apiKeyName, privateKey, walletAddress });

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
        'spot',
        effectiveApiKey,
        useBrowserWallet
      );
      config.headers['X-API-Key'] = effectiveApiKey;
      config.headers['X-API-Nonce'] = nonce;
      config.headers['X-API-Sign'] = signature;

      if (typeof window !== 'undefined') {
        console.log(
          `[spotClient] %cMAINNET (${useBrowserWallet ? 'Web3Wallet' : 'PK'})%c ${method} ${config.url}`
          + `\n  X-API-Key  = ${effectiveApiKey}`
          + `\n  X-API-Nonce= ${nonce}`
          + `\n  action     = ${actionType}`,
          'color:#22d3ee;font-weight:bold',
          'color:inherit',
        );
      }
    } catch (error) {
      return Promise.reject(error);
    }
  }

  return config;
});

spotClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const data = error?.response?.data;
    const msg = data?.error ?? data?.message ?? data?.msg
      ?? (typeof data === 'string' ? data : null)
      ?? error?.message;
    if (msg && typeof msg === 'string') {
      const lower = msg.toLowerCase();
      if (lower.includes('api key not found') || lower.includes('apikey not found')) {
        error.message = `${msg} — please authorize your wallet in settings.`;
      } else {
        error.message = msg;
      }
    }
    return Promise.reject(error);
  },
);
