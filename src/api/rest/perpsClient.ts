import axios from 'axios';
import { API_URLS } from '../../utils/constants';
import { signExchangeAction } from './signer';
import { useSettingsStore } from '../../store/settingsStore';

const getSettings = () => useSettingsStore.getState();

const axiosInstance = axios.create();

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 429) {
      const config = error.config;
      config.retryCount = config.retryCount || 0;
      
      if (config.retryCount < 3) {
        config.retryCount += 1;
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
  const baseUrl = API_URLS[network as 'mainnet' | 'testnet'].perpsRest;
  
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
     headers['X-API-Sign'] = await signExchangeAction(privateKey, network as 'mainnet' | 'testnet', 'perps', data || {}, nonce);
  }

  try {
     const response = await axiosInstance({
        method,
        url: `${baseUrl}${endpoint}`,
        headers,
        data
     });
     return response.data;
  } catch (error: any) {
     console.warn(`[PerpsClient] Error fetching ${endpoint}:`, error.message);
     if (method.toUpperCase() === 'GET') {
         if (endpoint.includes('/orderbook')) return { bids: [], asks: [] };
         if (endpoint.includes('/klines')) return [];
         if (endpoint.includes('/trades')) return [];
         if (endpoint.includes('/fundings')) return [];
         if (endpoint.includes('/balances') || endpoint.includes('/orders') || endpoint.includes('/positions') || endpoint.includes('/symbols')) return [];
     }
     throw error;
  }
}

export const perpsClient = {
  // Public
  getSymbols: () => request('GET', '/markets/symbols', false),
  getTickers: () => request('GET', '/markets/tickers', false),
  getMiniTickers: () => request('GET', '/markets/miniTickers', false),
  getBookTickers: () => request('GET', '/markets/bookTickers', false),
  getMarkPrices: () => request('GET', '/markets/mark-prices', false),
  getOrderbook: (symbol: string, limit = 20) => request('GET', `/markets/${symbol}/orderbook?limit=${limit}`, false),
  getKlines: (symbol: string, interval = '1h', limit = 200) => request('GET', `/markets/${symbol}/klines?interval=${interval}&limit=${limit}`, false),
  getTrades: (symbol: string) => request('GET', `/markets/${symbol}/trades`, false),

  // Private
  getBalances: (address: string) => request('GET', `/accounts/${address}/balances`, true),
  getOrders: (address: string) => request('GET', `/accounts/${address}/orders`, true),
  getPositions: (address: string) => request('GET', `/accounts/${address}/positions`, true),
  getState: (address: string) => request('GET', `/accounts/${address}/state`, true),
  getOrderHistory: (address: string) => request('GET', `/accounts/${address}/orders/history`, true),
  getTradeHistory: (address: string) => request('GET', `/accounts/${address}/trades`, true),
  getFundings: (address: string) => request('GET', `/accounts/${address}/fundings`, true),
  getFeeRate: (address: string) => request('GET', `/accounts/${address}/fee-rate`, true),

  // Write operations
  placeOrder: (payload: any) => request('POST', '/trade/orders', true, payload),
  batchOrders: (payload: any) => request('POST', '/trade/orders/batch', true, payload),
  cancelOrder: (payload: any) => request('DELETE', '/trade/orders', true, payload),
  replaceOrder: (payload: any) => request('POST', '/trade/orders/replace', true, payload),
  modifyOrder: (payload: any) => request('POST', '/trade/orders/modify', true, payload),
  scheduleCancel: (payload: any) => request('POST', '/trade/orders/schedule-cancel', true, payload),
  updateLeverage: (payload: any) => request('POST', '/trade/leverage', true, payload),
  updateMargin: (payload: any) => request('POST', '/trade/margin', true, payload),
  transfer: (payload: any) => request('POST', '/accounts/transfers', true, payload),
};
