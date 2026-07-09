import axios from 'axios';

const ENDPOINTS = {
  mainnet: {
    spot: 'https://mainnet-gw.sodex.dev/api/v1/spot',
    perps: 'https://mainnet-gw.sodex.dev/api/v1/perps',
  },
  testnet: {
    spot: 'https://testnet-gw.sodex.dev/api/v1/spot',
    perps: 'https://testnet-gw.sodex.dev/api/v1/perps',
  },
};

export type SodexNetwork = 'mainnet' | 'testnet';

export interface SodexAccountTrade {
  E: number; s: string; S: string; p: string; q: string;
  ordID: string; clOrdID: string; positionSide: string;
  reduceOnly: boolean; t: string;
}

interface SodexEnvelope<T> {
  code: number;
  timestamp: number;
  error?: string;
  data: T;
}

async function request<T>(base: string, path: string, opts: {
  method?: 'GET' | 'POST';
  query?: Record<string, string | number | undefined>;
  body?: unknown;
}): Promise<SodexEnvelope<T>> {
  const url = new URL(base + path);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const res = await axios({
    method: opts.method ?? 'GET',
    url: url.toString(),
    headers: {
      Accept: 'application/json',
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    },
    data: opts.body,
  });

  const json = res.data as SodexEnvelope<T>;
  if (json.error) {
    throw new Error(`SoDEX API error [${path}]: ${json.error}`);
  }
  return json;
}

/* ── Account State (wallet → accountId) ─────────────── */

function extractAccountId(raw: any): number | null {
  if (!raw) return null;
  const obj = raw.data ?? raw;
  if (typeof obj !== 'object') return null;
  const keys = ['aid', 'accountID', 'accountId', 'AccountID', 'account_id'];
  for (const k of keys) {
    const v = obj[k];
    if (v != null && v !== '') {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  // Search balances array if present
  if (Array.isArray(obj.balances)) {
    for (const b of obj.balances) {
      const id = extractAccountId(b);
      if (id) return id;
    }
  }
  return null;
}

export async function getAccountState(address: string, network: SodexNetwork) {
  const endpoints = ENDPOINTS[network];
  
  // Try spot state
  try {
    const res = await request<any>(endpoints.spot, `/accounts/${address}/state`, { method: 'GET' });
    const id = extractAccountId(res);
    if (id) return { data: { aid: id } };
  } catch { /* empty */ }

  // Try perps state
  try {
    const res = await request<any>(endpoints.perps, `/accounts/${address}/state`, { method: 'GET' });
    const id = extractAccountId(res);
    if (id) return { data: { aid: id } };
  } catch { /* empty */ }

  // Try spot balances
  try {
    const res = await request<any>(endpoints.spot, `/accounts/${address}/balances`, { method: 'GET' });
    const id = extractAccountId(res);
    if (id) return { data: { aid: id } };
  } catch { /* empty */ }

  // Try perps balances
  try {
    const res = await request<any>(endpoints.perps, `/accounts/${address}/balances`, { method: 'GET' });
    const id = extractAccountId(res);
    if (id) return { data: { aid: id } };
  } catch { /* empty */ }

  return null;
}

/* ── Perps endpoints (by accountID) ─────────────────── */

export async function getPerpsOrderHistory(accountId: number, network: SodexNetwork, limit = 50) {
  const base = ENDPOINTS[network].perps;
  const envelope = await request<any[]>(base, '/trade/orders/history', {
    method: 'GET', query: { accountID: accountId, limit },
  });
  return (envelope.data ?? []).slice(0, limit);
}

export async function getPerpsUserTrades(accountId: number, network: SodexNetwork, limit = 50) {
  const base = ENDPOINTS[network].perps;
  const envelope = await request<any[]>(base, '/trade/trades', {
    method: 'GET', query: { accountID: accountId, limit },
  });
  return (envelope.data ?? []).slice(0, limit);
}

export async function getPerpsPositionHistory(accountId: number, network: SodexNetwork, limit = 30) {
  const base = ENDPOINTS[network].perps;
  const envelope = await request<any[]>(base, '/trade/positions/history', {
    method: 'GET', query: { accountID: accountId, limit },
  });
  return (envelope.data ?? []).slice(0, limit);
}

/* ── Spot endpoints (by address) ────────────────────── */

export async function getSpotOrderHistory(address: string, network: SodexNetwork, limit = 50) {
  const base = ENDPOINTS[network].spot;
  const envelope = await request<any[]>(base, `/accounts/${address}/orders/history`, {
    method: 'GET', query: { limit },
  });
  return (envelope.data ?? []).slice(0, limit);
}

export async function getSpotUserTrades(address: string, network: SodexNetwork, limit = 50) {
  const base = ENDPOINTS[network].spot;
  const envelope = await request<any[]>(base, `/accounts/${address}/trades`, {
    method: 'GET', query: { limit },
  });
  return (envelope.data ?? []).slice(0, limit);
}

/* ── Market data ────────────────────────────────────── */

export async function getPerpsBalances(accountId: number, network: SodexNetwork) {
  const base = ENDPOINTS[network].perps;
  const envelope = await request<any>(base, '/account/balances', {
    method: 'GET', query: { accountID: accountId },
  });
  return envelope.data;
}

export async function getMarkPrices(network: SodexNetwork) {
  const base = ENDPOINTS[network].perps;
  const envelope = await request<any[]>(base, '/market/markPrices', { method: 'GET' });
  return envelope.data;
}
