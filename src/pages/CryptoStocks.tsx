import React, { useEffect, useMemo, useState } from 'react';
import { Building, RefreshCw, AlertTriangle, TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import {
  fetchCryptoStocks,
  fetchCryptoStockSnapshot,
  type CryptoStockListItem,
  type CryptoStockSnapshot,
} from '../api/sosoExtraServices';
import { useSettingsStore } from '../store/settingsStore';
import { cn } from '../lib/utils';

interface StockCard {
  list: CryptoStockListItem;
  snap: CryptoStockSnapshot | null;
}

function formatBigUsd(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '—';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3)  return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export const CryptoStocks: React.FC = () => {
  const { isDemoMode, sosoApiKey } = useSettingsStore();
  const [cards, setCards] = useState<StockCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // Single round-trip per refresh: fetch list + snapshot for every ticker
  // in parallel. Each per-ticker call is cached aggressively (5 min via the
  // sosoValueClient TTL once we add it) so re-renders of this page don't
  // hammer the API.
  const refresh = async () => {
    setLoading(true);
    setErrMsg(null);
    try {
      const list = await fetchCryptoStocks();
      // Fetch snapshots in small batches to avoid hammering the rate limiter.
      const results: StockCard[] = [];
      const BATCH = 3;
      for (let i = 0; i < list.length; i += BATCH) {
        const batch = list.slice(i, i + BATCH);
        const snaps = await Promise.all(
          batch.map(async (l) => ({ list: l, snap: await fetchCryptoStockSnapshot(l.ticker).catch(() => null) })),
        );
        results.push(...snaps);
        if (i + BATCH < list.length) await new Promise((r) => setTimeout(r, 300));
      }
      setCards(results);
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Failed to load crypto stocks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [isDemoMode, sosoApiKey]);

  const sorted = useMemo(() => {
    return cards.slice().sort((a, b) => (b.snap?.totalMarketCap ?? 0) - (a.snap?.totalMarketCap ?? 0));
  }, [cards]);

  // Group by sector for the secondary "by sector" cards.
  const bySector = useMemo(() => {
    const m = new Map<string, StockCard[]>();
    for (const c of sorted) {
      const sec = c.list.sector || 'Other';
      const list = m.get(sec) ?? [];
      list.push(c);
      m.set(sec, list);
    }
    return Array.from(m.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [sorted]);

  return (
    <div className="flex flex-col gap-6 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building size={16} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">Crypto Stocks</h1>
            <p className="text-xs text-text-muted">
              The TradFi/CeFi bridge — MSTR, COIN, MARA and the rest of the listed crypto exposure stack.
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={refresh} disabled={loading}>
          Refresh
        </Button>
      </div>

      {errMsg && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
          <AlertTriangle size={13} /> {errMsg}
        </div>
      )}

      {/* Card grid — one per ticker */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.length === 0 ? (
          <Card className="p-8 text-center text-text-muted text-sm md:col-span-3">
            {loading ? 'Loading crypto stocks…' : 'No data available.'}
          </Card>
        ) : sorted.map(({ list, snap }) => {
          const change = snap?.change24hPct ?? 0;
          const positive = change >= 0;
          return (
            <Card key={list.ticker} className="p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black tracking-tight text-text-primary">{list.ticker}</span>
                    <span className="text-[10px] text-text-muted font-mono">{list.exchange}</span>
                  </div>
                  <div className="text-xs text-text-muted truncate">{list.name}</div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/30 font-semibold whitespace-nowrap">
                  {list.sector}
                </span>
              </div>

              {snap ? (
                <>
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-text-muted">Price</div>
                      <div className="text-xl font-black font-mono text-text-primary">
                        ${snap.marketPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className={cn(
                      'flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-mono font-bold',
                      positive
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-red-500/10 border-red-500/30 text-red-400',
                    )}>
                      {positive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                      {positive ? '+' : ''}{change.toFixed(2)}%
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                    <Stat label="Total mkt cap" value={formatBigUsd(snap.totalMarketCap)} />
                    <Stat label="Float mkt cap" value={formatBigUsd(snap.circulatingMarketCap)} />
                    <Stat label="Volume" value={snap.volume ? snap.volume.toLocaleString() : '—'} />
                    <Stat label="Turnover" value={formatBigUsd(snap.turnover)} />
                    <Stat label="P/E (TTM)" value={snap.peTtm != null ? snap.peTtm.toFixed(1) : '—'} />
                    <Stat label="P/B" value={snap.pb != null ? snap.pb.toFixed(2) : '—'} />
                  </div>
                </>
              ) : (
                <div className="text-center text-text-muted text-xs py-4">Snapshot unavailable.</div>
              )}

              {(list.website || list.twitter) && (
                <div className="flex items-center gap-3 pt-2 border-t border-white/5">
                  {list.website && (
                    <a
                      href={list.website}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-blue-400 hover:underline flex items-center gap-1"
                    >
                      <ExternalLink size={10} /> Website
                    </a>
                  )}
                  {list.twitter && (
                    <a
                      href={list.twitter}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-blue-400 hover:underline flex items-center gap-1"
                    >
                      <ExternalLink size={10} /> X
                    </a>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Secondary breakdown by sector */}
      {bySector.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center gap-2">
            <Building size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-text-primary">By Sector</h2>
          </div>
          <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-3">
            {bySector.map(([sec, list]) => {
              const totalCap = list.reduce((s, c) => s + (c.snap?.totalMarketCap ?? 0), 0);
              const winners = list.filter((c) => (c.snap?.change24hPct ?? 0) >= 0).length;
              return (
                <div key={sec} className="px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5">
                  <div className="text-[10px] uppercase tracking-wider text-text-muted">{sec}</div>
                  <div className="text-base font-bold font-mono text-text-primary mt-1">{formatBigUsd(totalCap)}</div>
                  <div className="text-[10px] text-text-muted mt-0.5">
                    {list.length} stock{list.length === 1 ? '' : 's'} · <span className="text-emerald-400">{winners} up</span> / <span className="text-red-400">{list.length - winners} down</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex flex-col">
    <span className="text-[10px] text-text-muted uppercase tracking-wider">{label}</span>
    <span className="text-sm font-mono font-bold text-text-primary">{value}</span>
  </div>
);
