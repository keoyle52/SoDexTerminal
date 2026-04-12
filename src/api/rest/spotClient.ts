import axios from 'axios';
import { API_URLS } from '../../utils/constants';
import { signExchangeAction } from './signer';
import { useSettingsStore } from '../../store/settingsStore';

const getSettings = () => useSettingsStore.getState();

const axiosInstance = axios.create();

// Exponential backoff interceptor for handling 429 Too Many Requests
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 429) {
      const config = error.config;
      config.retryCount = config.retryCount || 0;
      
      if (config.retryCount < 3) {
        config.retryCount += 1;
        // Exponential backoff: 1s, 2s, 4s...
        const delay = Math.pow(2, config.retryCount - 1) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        return axiosInstance(config);
      }
    }
    return Promise.reject(error);
  }
);

async function request(method: string, endpoint: string, isPrivate: boolean, data?: any) {
  const { network, apiKeyName, privateKey } = getSettings();
  const baseUrl = API_URLS[network as 'mainnet' | 'testnet'].spotRest;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  if (isPrivate) {
     if (!apiKeyName) throw new Error("API Key Name is required for private endpoints");
     const nonce = BigInt(Date.now());
     headers['X-API-Key'] = apiKeyName;
     headers['X-API-Nonce'] = nonce.toString();
     
     // All private operations (GET/POST/DELETE) require EIP-712 signature for SoDEX.
     if (!privateKey) throw new Error("Private Key is required for private endpoints");
     headers['X-API-Sign'] = await signExchangeAction(privateKey, network as 'mainnet' | 'testnet', 'spot', data || {}, nonce);
  }

  // To support Mock/Demo Data when API isn't populated or responds with errors during development:
  try {
     const response = await axiosInstance({
        method,
        url: `${baseUrl}${endpoint}`,
        headers,
        data
     });
     return response.data;
  } catch (error: any) {
     // Return empty arrays/objects safely to ensure UI visually complete
     console.warn(`[SpotClient] Error fetching ${endpoint}:`, error.message);
     if (method.toUpperCase() === 'GET') {
         // Generic mock fallbacks for UI
         if (endpoint.includes('/orderbook')) return { bids: [], asks: [] };
         if (endpoint.includes('/klines')) return [];
         if (endpoint.includes('/trades')) return [];
         if (endpoint.includes('/balances') || endpoint.includes('/orders') || endpoint.includes('/symbols') || endpoint.includes('/tickers')) return [];
     }
     throw error;
  }
}

export const spotClient = {
  // Public
  getSymbols: () => request('GET', '/markets/symbols', false),
  getTickers: () => request('GET', '/markets/tickers', false),
  getMiniTickers: () => request('GET', '/markets/miniTickers', false),
  getBookTickers: () => request('GET', '/markets/bookTickers', false),
  getOrderbook: (symbol: string, limit = 20) => request('GET', `/markets/${symbol}/orderbook?limit=${limit}`, false),
  getKlines: (symbol: string, interval = '1h', limit = 200) => request('GET', `/markets/${symbol}/klines?interval=${interval}&limit=${limit}`, false),
  getTrades: (symbol: string) => request('GET', `/markets/${symbol}/trades`, false),

  // Private
  getBalances: (address: string) => request('GET', `/accounts/${address}/balances`, true),
  getOrders: (address: string) => request('GET', `/accounts/${address}/orders`, true),
  getState: (address: string) => request('GET', `/accounts/${address}/state`, true),
  getOrderHistory: (address: string) => request('GET', `/accounts/${address}/orders/history`, true),
  getTradeHistory: (address: string) => request('GET', `/accounts/${address}/trades`, true),
  getFeeRate: (address: string) => request('GET', `/accounts/${address}/fee-rate`, true),

  // Write operations
  batchOrders: (payload: any) => request('POST', '/trade/orders/batch', true, payload),
  cancelBatchOrders: (payload: any) => request('DELETE', '/trade/orders/batch', true, payload),
  replaceOrder: (payload: any) => request('POST', '/trade/orders/replace', true, payload),
  scheduleCancel: (payload: any) => request('POST', '/trade/orders/schedule-cancel', true, payload),
  transfer: (payload: any) => request('POST', '/accounts/transfers', true, payload),
};
