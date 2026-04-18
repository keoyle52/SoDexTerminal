import axios from 'axios';
import { ethers } from 'ethers';
import { signPayload, deriveActionType } from './signer';
import { useSettingsStore } from '../store/settingsStore';

const BASE_URL_MAINNET = 'https://mainnet-gw.sodex.dev/api/v1/spot';
const BASE_URL_TESTNET = 'https://testnet-gw.sodex.dev/api/v1/spot';

export const spotClient = axios.create();

spotClient.interceptors.request.use(async (config) => {
  const state = useSettingsStore.getState();
  const baseURL = state.isTestnet ? BASE_URL_TESTNET : BASE_URL_MAINNET;
  config.baseURL = baseURL;

  const { apiKeyName, privateKey, isTestnet } = state;
  const method = (config.method ?? 'GET').toUpperCase();

  // Only sign write (non-GET) requests — requires a private key
  if (method !== 'GET' && privateKey) {
    // SoDEX: Registered apiKeyName (agent wallet) only works on mainnet.
    // On testnet, sign with the main wallet's private key directly and
    // use the derived wallet address as the X-API-Key.
    // On mainnet, prefer the registered apiKeyName, falling back to the
    // wallet address if no name is configured.
    let effectiveApiKey: string;
    try {
      const pk = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
      const walletAddress = new ethers.Wallet(pk).address;
      effectiveApiKey = isTestnet ? walletAddress : (apiKeyName || walletAddress);
    } catch (error) {
      console.error('Invalid private key:', error);
      return Promise.reject(error);
    }

    const payload = config.data || {};
    const actionType = deriveActionType(method, config.url ?? '');
    try {
      const { signature, nonce } = await signPayload(actionType, payload, privateKey, 'spot', isTestnet, effectiveApiKey);
      config.headers['X-API-Key'] = effectiveApiKey;
      config.headers['X-API-Nonce'] = nonce;
      config.headers['X-API-Sign'] = signature;
    } catch (error) {
      console.error('Signing failed:', error);
      return Promise.reject(error);
    }
  }

  return config;
});

spotClient.interceptors.response.use(
  (response) => response.data,
  (error) => Promise.reject(error)
);
