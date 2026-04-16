import { sosoValueClient } from './sosoValueClient';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SosoCoin {
  id: string;
  fullName: string;
  name: string; // ticker e.g. "BTC"
}

export interface SosoNewsItem {
  id: string;
  sourceLink: string;
  releaseTime: number; // ms epoch
  author: string;
  authorAvatarUrl?: string;
  category: number;
  featureImage?: string;
  matchedCurrencies: { id: string; fullName: string; name: string }[];
  tags: string[];
  multilanguageContent: { language: string; title: string; content: string }[];
  nickName?: string;
}

export interface SosoNewsList {
  pageNum: string;
  pageSize: string;
  totalPages: string;
  total: string;
  list: SosoNewsItem[];
}

export interface EtfDayData {
  date: string;          // YYYY-MM-DD
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

// ─── News ────────────────────────────────────────────────────────────────────

export async function fetchSosoCoins(): Promise<SosoCoin[]> {
  const res = await sosoValueClient.post('/openapi/v1/data/default/coin/list', {}) as { data: SosoCoin[] };
  return Array.isArray(res?.data) ? res.data : [];
}

export async function fetchSosoNews(
  pageNum = 1,
  pageSize = 20,
  categoryList?: number[],
): Promise<SosoNewsList> {
  const params = new URLSearchParams({
    pageNum: String(pageNum),
    pageSize: String(pageSize),
  });
  if (categoryList && categoryList.length > 0) {
    params.set('categoryList', categoryList.join(','));
  }
  const res = await sosoValueClient.get(`/api/v1/news/featured?${params.toString()}`) as { data: SosoNewsList };
  return res?.data ?? { pageNum: '1', pageSize: String(pageSize), totalPages: '0', total: '0', list: [] };
}

export async function fetchSosoNewsByCurrency(
  currencyId: string,
  pageNum = 1,
  pageSize = 20,
  categoryList?: number[],
): Promise<SosoNewsList> {
  const params = new URLSearchParams({
    pageNum: String(pageNum),
    pageSize: String(pageSize),
    currencyId,
  });
  if (categoryList && categoryList.length > 0) {
    params.set('categoryList', categoryList.join(','));
  }
  const res = await sosoValueClient.get(`/api/v1/news/featured/currency?${params.toString()}`) as { data: SosoNewsList };
  return res?.data ?? { pageNum: '1', pageSize: String(pageSize), totalPages: '0', total: '0', list: [] };
}

// ─── ETF ─────────────────────────────────────────────────────────────────────

export async function fetchEtfHistoricalInflow(type: EtfType): Promise<EtfDayData[]> {
  const res = await sosoValueClient.post('/openapi/v2/etf/historicalInflowChart', { type }) as { data: any };
  // Robustness: Handle both { data: { list: [...] } } and { data: [...] }
  const rawData = res?.data;
  if (!rawData) return [];
  if (Array.isArray(rawData)) return rawData;
  if (rawData.list && Array.isArray(rawData.list)) return rawData.list;
  return [];
}

export async function fetchEtfCurrentMetrics(type: EtfType): Promise<EtfCurrentMetrics> {
  const res = await sosoValueClient.post('/openapi/v2/etf/currentEtfDataMetrics', { type }) as { data: EtfCurrentMetrics };
  return res?.data ?? {} as EtfCurrentMetrics;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const NEWS_CATEGORIES: Record<number, { label: string; color: string }> = {
  1:  { label: 'News',       color: 'text-blue-400 bg-blue-400/10' },
  2:  { label: 'Research',   color: 'text-purple-400 bg-purple-400/10' },
  3:  { label: 'Institution',color: 'text-amber-400 bg-amber-400/10' },
  4:  { label: 'Insights',   color: 'text-emerald-400 bg-emerald-400/10' },
  5:  { label: 'Macro',      color: 'text-cyan-400 bg-cyan-400/10' },
  6:  { label: 'Macro Res.', color: 'text-indigo-400 bg-indigo-400/10' },
  7:  { label: 'Tweets',     color: 'text-sky-400 bg-sky-400/10' },
  9:  { label: 'Price Alert',color: 'text-orange-400 bg-orange-400/10' },
  10: { label: 'On-Chain',   color: 'text-green-400 bg-green-400/10' },
};

export function getNewsTitle(item: SosoNewsItem): string {
  const en = item.multilanguageContent?.find((c) => c.language === 'en');
  return en?.title ?? item.author ?? '(no title)';
}
