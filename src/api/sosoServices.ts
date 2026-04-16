import { sosoValueClient } from './sosoValueClient';

// ─── Types ────────────────────────────────────────────────────────────────────

// Docs: coin list returns { id, fullName, name } — but actual field names from API:
// { currencyId (integer), fullName (string), currencyName (string) }
// We normalise to a consistent internal shape.
export interface SosoCoin {
  id: string;      // currencyId stringified (used as currencyId param in news/currency endpoint)
  fullName: string;
  name: string;    // BTC, ETH, etc. (from currencyName)
}

export interface SosoNewsItem {
  id: string;
  sourceLink: string;
  releaseTime: number; // ms epoch
  author: string;
  authorDescription?: string;
  authorAvatarUrl?: string;
  category: number;
  featureImage?: string;
  matchedCurrencies: { id: string; fullName: string; name: string }[];
  tags: string[];
  multilanguageContent: { language: string; title: string; content: string }[];
  mediaInfo?: unknown[];
  nickName?: string;
  quoteInfo?: unknown;
}

export interface SosoNewsList {
  pageNum: string;
  pageSize: string;
  totalPages: string;
  total: string;
  list: SosoNewsItem[];
}

export interface EtfDayData {
  date: string;            // YYYY-MM-DD
  totalNetInflow: number;
  totalValueTraded: number;
  totalNetAssets: number;
  cumNetInflow: number;
}

export interface EtfMetricValue {
  value: number | null;
  lastUpdateDate: string;
  status?: string;
}

export interface EtfListItem {
  id: string;
  ticker: string;
  institute: string;
  netAssets: EtfMetricValue;
  netAssetsPercentage: EtfMetricValue;
  dailyNetInflow: EtfMetricValue;
  cumNetInflow: EtfMetricValue;
  dailyValueTraded: EtfMetricValue;
  fee: EtfMetricValue;
  discountPremiumRate: EtfMetricValue;
}

export interface EtfCurrentMetrics {
  totalNetAssets: EtfMetricValue;
  totalNetAssetsPercentage: EtfMetricValue;
  totalTokenHoldings: EtfMetricValue;
  dailyNetInflow: EtfMetricValue;
  cumNetInflow: EtfMetricValue;
  dailyTotalValueTraded: EtfMetricValue;
  list: EtfListItem[];
}

export type EtfType = 'us-btc-spot' | 'us-eth-spot';

// ─── Helper: build query string without encoding commas ────────────────────────
// URLSearchParams encodes commas as %2C — SosoValue API needs literal commas.
function buildQuery(params: Record<string, string | number | undefined>): string {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${v}`)
    .join('&');
}

// ─── Coin List ────────────────────────────────────────────────────────────────

export async function fetchSosoCoins(): Promise<SosoCoin[]> {
  // Response: { code:0, data: [ { currencyId, fullName, currencyName }, ... ] }
  const res = await sosoValueClient.post('/openapi/v1/data/default/coin/list', {}) as {
    data: { currencyId: string | number; fullName: string; currencyName: string }[];
  };
  const raw = Array.isArray(res?.data) ? res.data : [];
  return raw.map((c) => ({
    id: String(c.currencyId),
    fullName: c.fullName,
    name: (c.currencyName ?? '').toUpperCase(),
  }));
}

// ─── News ─────────────────────────────────────────────────────────────────────

export async function fetchSosoNews(
  pageNum = 1,
  pageSize = 20,
  categoryList?: number[],
): Promise<SosoNewsList> {
  const q: Record<string, string | number> = {
    pageNum,
    pageSize,
  };
  // categoryList must be comma-separated WITHOUT URL-encoding the commas
  const catParam = (categoryList && categoryList.length > 0)
    ? categoryList.join(',')
    : '1,2,3,4,5,6,7,9,10';

  const query = `${buildQuery(q)}&categoryList=${catParam}`;
  const res = await sosoValueClient.get(`/api/v1/news/featured?${query}`) as { data: SosoNewsList };
  return res?.data ?? { pageNum: '1', pageSize: String(pageSize), totalPages: '0', total: '0', list: [] };
}

export async function fetchSosoNewsByCurrency(
  currencyId: string,
  pageNum = 1,
  pageSize = 20,
  categoryList?: number[],
): Promise<SosoNewsList> {
  const catParam = (categoryList && categoryList.length > 0)
    ? categoryList.join(',')
    : '1,2,3,4,5,6,7,9,10';

  const query = `${buildQuery({ pageNum, pageSize, currencyId })}&categoryList=${catParam}`;
  const res = await sosoValueClient.get(`/api/v1/news/featured/currency?${query}`) as { data: SosoNewsList };
  return res?.data ?? { pageNum: '1', pageSize: String(pageSize), totalPages: '0', total: '0', list: [] };
}

// ─── ETF ──────────────────────────────────────────────────────────────────────

export async function fetchEtfHistoricalInflow(type: EtfType): Promise<EtfDayData[]> {
  // Response: { code:0, data: { list: [ { date, totalNetInflow, ... }, ... ] } }
  const res = await sosoValueClient.post('/openapi/v2/etf/historicalInflowChart', { type }) as {
    data: { list?: EtfDayData[] } | EtfDayData[];
  };
  const raw = res?.data;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;                           // direct array
  if (raw.list && Array.isArray(raw.list)) return raw.list;    // nested list
  return [];
}

export async function fetchEtfCurrentMetrics(type: EtfType): Promise<EtfCurrentMetrics | null> {
  // Response: { code:0, data: { totalNetAssets: {...}, ..., list: [...] } }
  const res = await sosoValueClient.post('/openapi/v2/etf/currentEtfDataMetrics', { type }) as {
    data: EtfCurrentMetrics;
  };
  return res?.data ?? null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const NEWS_CATEGORIES: Record<number, { label: string; color: string }> = {
  1:  { label: 'News',        color: 'text-blue-400 bg-blue-400/10' },
  2:  { label: 'Research',    color: 'text-purple-400 bg-purple-400/10' },
  3:  { label: 'Institution', color: 'text-amber-400 bg-amber-400/10' },
  4:  { label: 'Insights',    color: 'text-emerald-400 bg-emerald-400/10' },
  5:  { label: 'Macro',       color: 'text-cyan-400 bg-cyan-400/10' },
  6:  { label: 'Macro Res.',  color: 'text-indigo-400 bg-indigo-400/10' },
  7:  { label: 'Tweets',      color: 'text-sky-400 bg-sky-400/10' },
  9:  { label: 'Price Alert', color: 'text-orange-400 bg-orange-400/10' },
  10: { label: 'On-Chain',    color: 'text-green-400 bg-green-400/10' },
};

export function getNewsTitle(item: SosoNewsItem): string {
  const en = item.multilanguageContent?.find((c) => c.language === 'en');
  return en?.title ?? item.author ?? '(no title)';
}
