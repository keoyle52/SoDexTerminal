import axios from 'axios';
import { useSettingsStore } from '../store/settingsStore';

const BASE_URL = 'https://openapi.sosovalue.com';

// ─── In-Memory TTL Cache ───────────────────────────────────────────────────────
// Prevents hitting rate limits when navigating between pages or
// when React effects fire multiple times in development.
interface CacheEntry { data: unknown; expiresAt: number; }
const cache = new Map<string, CacheEntry>();

const TTL: Record<string, number> = {
  '/openapi/v1/data/default/coin/list':      5 * 60_000, // 5 min  — coins don't change often
  '/openapi/v2/etf/historicalInflowChart':   5 * 60_000, // 5 min
  '/openapi/v2/etf/currentEtfDataMetrics':   3 * 60_000, // 3 min
  '/api/v1/news/featured':                   2 * 60_000, // 2 min  — news changes faster
  '/api/v1/news/featured/currency':          2 * 60_000, // 2 min
};

function getCacheTtl(url: string): number {
  for (const [key, ttl] of Object.entries(TTL)) {
    if (url.includes(key)) return ttl;
  }
  return 0; // no caching by default
}

function cacheKey(url: string, body?: unknown): string {
  return `${url}::${body ? JSON.stringify(body) : ''}`;
}

// ─── Axios Client ─────────────────────────────────────────────────────────────

function makeClient() {
  const client = axios.create({ baseURL: BASE_URL });

  // Request interceptor: inject API key + serve from cache if fresh
  client.interceptors.request.use(async (config) => {
    const { sosoApiKey } = useSettingsStore.getState();
    if (sosoApiKey) {
      config.headers['x-soso-api-key'] = sosoApiKey;
    }

    // Check cache
    const url = config.url ?? '';
    const ttl = getCacheTtl(url);
    if (ttl > 0) {
      const key = cacheKey(url, config.data);
      const entry = cache.get(key);
      if (entry && Date.now() < entry.expiresAt) {
        // Abort the real request and return cached data via a custom flag
        // We use a custom adapter to bypass the actual network call
        config.adapter = () =>
          Promise.resolve({
            data: entry.data,
            status: 200,
            statusText: 'OK (cached)',
            headers: {},
            config,
          });
      }
    }

    return config;
  });

  // Response interceptor: validate SosoValue body codes + store in cache
  client.interceptors.response.use(
    (response) => {
      const body = response.data;

      // Store in cache if the request succeeded
      const url = response.config?.url ?? '';
      const ttl = getCacheTtl(url);
      if (ttl > 0) {
        const key = cacheKey(url, response.config?.data ? JSON.parse(response.config.data) : undefined);
        cache.set(key, { data: body, expiresAt: Date.now() + ttl });
      }

      // SosoValue: code=0 → success, anything else → error
      if (body && typeof body === 'object' && 'code' in body && body.code !== 0) {
        const msg = body.msg ?? body.message ?? `SosoValue error (code=${body.code})`;
        throw new Error(String(msg));
      }

      return body; // unwrap: services receive full body { code, data, ... }
    },
    (error) => {
      const apiMsg =
        error?.response?.data?.msg ??
        error?.response?.data?.message ??
        error?.message ??
        'Network error';
      const status = error?.response?.status;
      return Promise.reject(new Error(`[${status ?? 'ERR'}] ${apiMsg}`));
    },
  );

  return client;
}

export const sosoValueClient = makeClient();

/** Manually clear all cached SosoValue responses (e.g. on Refresh button press). */
export function clearSosoCache() {
  cache.clear();
}
