import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Layers, RefreshCw, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { createChart, AreaSeries, type IChartApi, type ISeriesApi, type Time } from 'lightweight-charts';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { fetchSsiIndexList, fetchSsiIndexSnapshot, type SsiIndexSnapshot } from '../api/sosoExtraServices';
import { useSettingsStore } from '../store/settingsStore';
import { cn } from '../lib/utils';

/** Pretty-print an SSI ticker (`ssimag7` → "SSI Mag 7"). */
function formatTicker(ticker: string): string {
  if (!ticker) return '';
  const upper = ticker.toUpperCase();
  if (upper.startsWith('SSI')) {
    const tail = upper.slice(3).replace(/(\d+)/, ' $1').trim();
    return `SSI ${tail}`;
  }
  return upper;
}

const IndexKlineChart: React.FC<{ klines: SsiIndexSnapshot['klines'] }> = ({ klines }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { color: 'transparent' },
        textColor: 'rgba(241,245,249,0.7)',
        fontSize: 11,
      },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.06)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.06)', timeVisible: false },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      crosshair: { mode: 1 },
      handleScroll: false,
      handleScale: false,
    });
    const series = chart.addSeries(AreaSeries, {
      lineColor: '#a78bfa',
      topColor: 'rgba(167,139,250,0.40)',
      bottomColor: 'rgba(167,139,250,0.02)',
      lineWidth: 2,
    });
    chartRef.current = chart;
    seriesRef.current = series;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    const data = klines.map((k) => ({
      time: Math.floor(k.timestamp / 1000) as Time,
      value: k.close,
    }));
    series.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [klines]);

  return <div ref={containerRef} className="w-full h-[320px]" />;
};

export const SsiIndices: React.FC = () => {
  const { isDemoMode, sosoApiKey } = useSettingsStore();
  const [tickers, setTickers] = useState<string[]>([]);
  const [activeTicker, setActiveTicker] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<SsiIndexSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // Helpers — wrapped in useCallback so the effects below can call them
  // asynchronously without triggering "setState during render" rules.
  const loadList = useCallback(async () => {
    try {
      const list = await fetchSsiIndexList();
      setTickers(list);
      setActiveTicker((prev) => prev ?? list[0] ?? null);
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Failed to fetch index list');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSnapshot = useCallback(async (ticker: string) => {
    try {
      const snap = await fetchSsiIndexSnapshot(ticker);
      setSnapshot(snap);
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Failed to fetch index snapshot');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial list load — async work, no synchronous setState in the effect body.
  useEffect(() => { void loadList(); }, [loadList, isDemoMode, sosoApiKey]);

  // Snapshot reload when active ticker changes.
  useEffect(() => {
    if (!activeTicker) return;
    void loadSnapshot(activeTicker);
  }, [activeTicker, isDemoMode, sosoApiKey, loadSnapshot]);

  const change = snapshot?.change24h ?? 0;
  const changePositive = change >= 0;

  // Memoised sorted constituents — depend on `snapshot` directly so the
  // React-Compiler can preserve the manual memoization.
  const constituentBars = useMemo(() => {
    const list = snapshot?.constituents;
    if (!list) return [];
    return [...list].sort((a, b) => b.weight - a.weight);
  }, [snapshot]);

  return (
    <div className="flex flex-col gap-6 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles size={16} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">SSI Indices</h1>
            <p className="text-xs text-text-muted">
              SoSoValue's on-chain spot index protocol — pick a basket to see constituents, weights and history.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost" size="sm" icon={<RefreshCw size={14} />}
            disabled={loading}
            onClick={() => activeTicker && fetchSsiIndexSnapshot(activeTicker).then(setSnapshot).catch(() => {})}
          >
            Refresh
          </Button>
        </div>
      </div>

      {errMsg && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
          <AlertTriangle size={13} /> {errMsg}
        </div>
      )}

      {/* Ticker chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {tickers.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTicker(t)}
            className={cn(
              'px-3 py-1.5 rounded-md border text-xs font-medium transition-colors',
              activeTicker === t
                ? 'bg-primary/10 text-primary border-primary/30'
                : 'bg-surface-2 text-text-secondary border-border hover:border-border-hover hover:text-text-primary',
            )}
          >
            {formatTicker(t)}
          </button>
        ))}
      </div>

      {snapshot && (
        <>
          {/* Top metrics */}
          <Card className="p-5">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                {/* Square badge — strips the inner space ("LAYER 1" -> "LAYER1")
                    so it stays on a single line at every width, then auto-shrinks
                    the font when the abbreviation is longer than 4 chars. */}
                {(() => {
                  const abbr = formatTicker(snapshot.ticker).replace('SSI ', '').replace(/\s+/g, '');
                  const sizeClass = abbr.length >= 6 ? 'text-[11px]'
                    : abbr.length >= 5 ? 'text-xs'
                    : 'text-base';
                  return (
                    <div
                      className={cn(
                        'w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold tracking-tighter whitespace-nowrap leading-none px-1 text-center',
                        sizeClass,
                      )}
                      title={formatTicker(snapshot.ticker)}
                    >
                      {abbr}
                    </div>
                  );
                })()}
                <div>
                  <div className="text-base font-bold text-text-primary">
                    {formatTicker(snapshot.ticker)}
                  </div>
                  <p className="text-xs text-text-muted max-w-md leading-relaxed">
                    {snapshot.description || 'SoSoValue spot index basket.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6 flex-wrap">
                <Metric label="Price" value={`$${snapshot.price.toFixed(4)}`} />
                <Metric
                  label="24h"
                  value={`${changePositive ? '+' : ''}${change.toFixed(2)}%`}
                  className={changePositive ? 'text-emerald-400' : 'text-red-400'}
                  icon={changePositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                />
                <Metric
                  label="Implied market cap"
                  value={`$${(snapshot.marketCap / 1e6).toFixed(1)}M`}
                />
                <Metric label="Constituents" value={snapshot.constituents.length.toString()} />
              </div>
            </div>
          </Card>

          {/* Chart + constituents */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 p-0 overflow-hidden">
              <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                <TrendingUp size={16} className="text-primary" />
                <h2 className="text-sm font-semibold text-text-primary">90-Day Price</h2>
                <span className="ml-auto text-[10px] text-text-muted">Daily klines</span>
              </div>
              <div className="p-3">
                <IndexKlineChart klines={snapshot.klines} />
              </div>
            </Card>

            <Card className="p-0 overflow-hidden">
              <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                <Layers size={16} className="text-primary" />
                <h2 className="text-sm font-semibold text-text-primary">Constituents</h2>
              </div>
              <div className="p-4 flex flex-col gap-2">
                {constituentBars.map((c) => {
                  const pct = c.weight * 100;
                  return (
                    <div key={c.symbol} className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold text-text-primary w-14 uppercase shrink-0">
                        {c.symbol}
                      </span>
                      <div className="flex-1 h-2 rounded-full bg-white/[0.04] overflow-hidden">
                        <div
                          className="h-full bg-primary/60 rounded-full transition-[width] duration-500"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono font-bold text-text-secondary w-14 text-right shrink-0">
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </>
      )}

      {loading && !snapshot && (
        <div className="text-center text-text-muted text-sm py-12">Loading indices…</div>
      )}
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string; className?: string; icon?: React.ReactNode }> = ({ label, value, className, icon }) => (
  <div className="flex flex-col">
    <span className="text-[10px] uppercase tracking-wider text-text-muted">{label}</span>
    <span className={cn('text-base font-bold font-mono flex items-center gap-1', className)}>
      {icon}{value}
    </span>
  </div>
);
