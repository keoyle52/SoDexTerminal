import axios from 'axios';

const ENDPOINTS = {
  mainnet: { perps: 'https://api.hyperliquid.xyz', spot: 'https://api.hyperliquid.xyz' },
  testnet: { perps: 'https://api.hyperliquid-testnet.xyz', spot: 'https://api.hyperliquid-testnet.xyz' },
};

export type SodexNetwork = 'mainnet' | 'testnet';

export interface SodexAccountTrade {
  E: number; s: string; S: string; p: string; q: string;
  ordID: string; clOrdID: string; positionSide: string;
  reduceOnly: boolean; t: string;
}

let symbolCache: Map<string, number> | null = null;

async function loadSymbols(network: SodexNetwork): Promise<Map<string, number>> {
  if (symbolCache) return symbolCache;
  const base = ENDPOINTS[network].perps;
  const res = await axios.post(`${base}/info`, { type: 'meta' });
  const map = new Map<string, number>();
  const universe = res.data?.universe ?? [];
  universe.forEach((s: any, i: number) => {
    map.set(s.name, i);
  });
  symbolCache = map;
  return map;
}

export async function resolveSymbolId(symbol: string, network: SodexNetwork): Promise<number | null> {
  const cache = await loadSymbols(network);
  for (const key of [symbol, symbol.replace('_', ''), symbol.split('_')[0], symbol.split('-')[0]]) {
    const id = cache.get(key);
    if (id !== undefined) return id;
  }
  return null;
}

export async function getAccountState(address: string, network: SodexNetwork) {
  const base = ENDPOINTS[network].perps;
  const res = await axios.post(`${base}/info`, { type: 'clearinghouseState', user: address });
  return res.data;
}

export async function getPerpsUserTrades(accountId: number, network: SodexNetwork, limit = 50) {
  const base = ENDPOINTS[network].perps;
  const res = await axios.post(`${base}/info`, { type: 'userFills', user: String(accountId) });
  return (res.data ?? []).slice(0, limit);
}

export async function getPerpsOrderHistory(accountId: number, network: SodexNetwork, limit = 50) {
  const base = ENDPOINTS[network].perps;
  const res = await axios.post(`${base}/info`, { type: 'userOrders', user: String(accountId) });
  return (res.data ?? []).slice(0, limit);
}

export async function getPerpsPositionHistory(accountId: number, network: SodexNetwork, limit = 30) {
  const base = ENDPOINTS[network].perps;
  const res = await axios.post(`${base}/info`, { type: 'userPositionHistory', user: String(accountId) });
  return (res.data ?? []).slice(0, limit);
}

export async function getSpotUserTrades(accountId: number, network: SodexNetwork, limit = 50) {
  const base = ENDPOINTS[network].spot;
  const res = await axios.post(`${base}/info`, { type: 'spotUserFills', user: String(accountId) });
  return (res.data ?? []).slice(0, limit);
}

export async function getSpotOrderHistory(accountId: number, network: SodexNetwork, limit = 50) {
  const base = ENDPOINTS[network].spot;
  const res = await axios.post(`${base}/info`, { type: 'spotUserOrders', user: String(accountId) });
  return (res.data ?? []).slice(0, limit);
}

export async function getPerpsBalances(accountId: number, network: SodexNetwork) {
  const base = ENDPOINTS[network].perps;
  const res = await axios.post(`${base}/info`, { type: 'clearinghouseState', user: String(accountId) });
  return res.data;
}

export async function getMarkPrices(network: SodexNetwork) {
  const base = ENDPOINTS[network].perps;
  const res = await axios.post(`${base}/info`, { type: 'allMids' });
  return res.data;
}
