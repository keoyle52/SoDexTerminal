import axios from 'axios';

export interface SoSoValueNewsItem {
  id: number; title: string; body: string; source: string;
  time: number; sentiment: 'positive' | 'negative' | 'neutral' | null;
}

export interface SoSoValueSectorPerformance {
  sector: string; performance24h: number;
}

export class SoSoValueClient {
  private base = 'https://api.sosovalue.com';
  private newsCache: { data: SoSoValueNewsItem[]; ts: number } | null = null;
  private sectorsCache: { data: SoSoValueSectorPerformance[]; ts: number } | null = null;

  constructor(private apiKey?: string) {}

  async getLatestNews(limit = 10): Promise<SoSoValueNewsItem[]> {
    const now = Date.now();
    if (this.newsCache && now - this.newsCache.ts < 180000) return this.newsCache.data;
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (this.apiKey) headers['x-soso-api-key'] = this.apiKey;
      const res = await axios.get(`${this.base}/openapi/v1/news/list`, { headers, params: { limit, lang: 'en' } });
      const json = res.data;
      const data = json?.data ?? json;
      const items = Array.isArray(data) ? data : data?.list ?? [];
      const result = items.map((item: any) => ({
        id: item.id, title: item.title ?? '', body: item.body ?? '',
        source: item.source ?? '', time: item.time ?? Date.now(),
        sentiment: item.sentiment === 1 ? 'positive' as const : item.sentiment === -1 ? 'negative' as const : 'neutral' as const,
      }));
      this.newsCache = { data: result, ts: now };
      return result;
    } catch {
      return [
        { id: 1, title: 'Market sentiment remains positive amid ETF inflows', body: '', source: 'MockNews', time: Date.now(), sentiment: 'positive' },
        { id: 2, title: 'BTC consolidation continues around resistance levels', body: '', source: 'MockNews', time: Date.now(), sentiment: 'neutral' },
      ];
    }
  }

  async getSectorPerformances(): Promise<SoSoValueSectorPerformance[]> {
    const now = Date.now();
    if (this.sectorsCache && now - this.sectorsCache.ts < 180000) return this.sectorsCache.data;
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (this.apiKey) headers['x-soso-api-key'] = this.apiKey;
      const res = await axios.get(`${this.base}/openapi/v1/sectors/list`, { headers });
      const json = res.data;
      const data = json?.data ?? json;
      if (!Array.isArray(data)) return [];
      const result = data.map((item: any) => ({
        sector: item.sectorName ?? item.name ?? 'unknown',
        performance24h: Number(item.performance24h ?? item.change ?? 0),
      }));
      this.sectorsCache = { data: result, ts: now };
      return result;
    } catch {
      return [
        { sector: 'DeFi', performance24h: 1.2 },
        { sector: 'Layer 1', performance24h: -0.4 },
        { sector: 'AI & DePIN', performance24h: 3.5 },
      ];
    }
  }
}
