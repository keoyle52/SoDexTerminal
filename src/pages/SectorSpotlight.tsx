import React, { useEffect, useMemo, useState } from 'react';
import { Flame, RefreshCw, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import {
  fetchSectorSpotlight,
  type SectorSpotlightSnapshot,
  type SectorRow,
} from '../api/sosoExtraServices';
import { useSettingsStore } from '../store/settingsStore';
import { cn } from '../lib/utils';

/**
 * Map a -%∞..+%∞ change into a heat-map background colour. We clip at
 * ±5% which is roughly one standard deviation of daily sector moves so
 * the colours saturate at meaningful levels rather than only on extremes.
 */
function heatColor(change: number): { bg: string; text: string } {
  const clipped = Math.max(-5, Math.min(5, change));
  const intensity = Math.abs(clipped) / 5; // 0..1
  if (clipped >= 0) {
    // green: 16,185,129
    const a = (0.10 + intensity * 0.45).toFixed(2);
    return {
      bg: `rgba(16, 185, 129, ${a})`,
      text: intensity > 0.55 ? 'text-emerald-200' : 'text-emerald-300',
    };
  }
  const a = (0.10 + intensity * 0.45).toFixed(2);
  return {
    bg: `rgba(239, 68, 68, ${a})`,
    text: intensity > 0.55 ? 'text-red-200' : 'text-red-300',
  };
}

/**
 * Layout helper — pick a tile size proportional to dominance so larger
 * sectors visually dominate the grid. Returned values are arbitrary
 * pixel "weights" used by CSS grid-row-span / grid-column-span.
 */
function tileSpan(row: SectorRow): { col: number; row: number } {
  const dom = row.marketcapDom;
  if (dom > 0.40) return { col: 4, row: 3 };
  if (dom > 0.15) return { col: 3, row: 2 };
  if (dom > 0.05) return { col: 2, row: 2 };
  return { col: 2, row: 1 };
}

export const SectorSpotlight: React.FC = () => {
  const { isDemoMode, sosoApiKey } = useSettingsStore();
  const [snap, setSnap] = useState<SectorSpotlightSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setErrMsg(null);
    try {
      const data = await fetchSectorSpotlight();
      setSnap(data);
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Failed to load sector data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [isDemoMode, sosoApiKey]);

  // Sort sectors by absolute move so the biggest movers are scanned
  // first; the heat-map layout still respects dominance via tileSpan.
  const sortedSectors = useMemo(
    () => (snap?.sectors ?? []).slice().sort((a, b) => Math.abs(b.change24hPct) - Math.abs(a.change24hPct)),
    [snap?.sectors],
  );

  const sortedSpotlight = useMemo(
    () => (snap?.spotlight ?? []).slice().sort((a, b) => b.change24hPct - a.change24hPct),
    [snap?.spotlight],
  );

  const winners = sortedSectors.filter((s) => s.change24hPct > 0);
  const losers  = sortedSectors.filter((s) => s.change24hPct < 0);
  const topWinner = sortedSectors.slice().sort((a, b) => b.change24hPct - a.change24hPct)[0];
  const topLoser  = sortedSectors.slice().sort((a, b) => a.change24hPct - b.change24hPct)[0];

  return (
    <div className="flex flex-col gap-6 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-danger/10 flex items-center justify-center">
            <Flame size={16} className="text-danger" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">Sector Spotlight</h1>
            <p className="text-xs text-text-muted">
              Which crypto sector is leading the tape today — and which trending narratives are catching a bid.
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

      {/* Top metric strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-text-muted">Sectors tracked</div>
          <div className="text-2xl font-black font-mono text-text-primary mt-1">
            {sortedSectors.length}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-text-muted">Sectors up / down</div>
          <div className="text-2xl font-black font-mono mt-1">
            <span className="text-emerald-400">{winners.length}</span>
            <span className="text-text-muted mx-1">/</span>
            <span className="text-red-400">{losers.length}</span>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-text-muted">Top winner</div>
          <div className="text-base font-bold font-mono text-emerald-400 mt-1 uppercase">
            {topWinner ? topWinner.name : '—'}
          </div>
          <div className="text-xs text-text-muted mt-1">
            {topWinner ? `+${topWinner.change24hPct.toFixed(2)}%` : ''}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-text-muted">Biggest drag</div>
          <div className="text-base font-bold font-mono text-red-400 mt-1 uppercase">
            {topLoser ? topLoser.name : '—'}
          </div>
          <div className="text-xs text-text-muted mt-1">
            {topLoser ? `${topLoser.change24hPct.toFixed(2)}%` : ''}
          </div>
        </Card>
      </div>

      {/* Heat map */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center gap-2">
          <Flame size={16} className="text-danger" />
          <h2 className="text-sm font-semibold text-text-primary">24h Heat Map</h2>
          <span className="ml-auto text-[10px] text-text-muted">
            Tile size ∝ market-cap dominance · colour ∝ 24h change
          </span>
        </div>
        <div
          className="p-3 grid gap-2"
          style={{
            gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
            gridAutoRows: 'minmax(60px, auto)',
          }}
        >
          {sortedSectors.map((s) => {
            const span = tileSpan(s);
            const palette = heatColor(s.change24hPct);
            return (
              <div
                key={s.name}
                className="rounded-lg border border-white/5 p-3 flex flex-col justify-between transition-transform hover:-translate-y-0.5"
                style={{
                  gridColumn: `span ${span.col} / span ${span.col}`,
                  gridRow: `span ${span.row} / span ${span.row}`,
                  background: palette.bg,
                }}
                title={`${s.name} · dominance ${(s.marketcapDom * 100).toFixed(2)}%`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-text-primary uppercase tracking-wide">
                    {s.name}
                  </span>
                  <span className="text-[10px] text-text-muted font-mono">
                    {(s.marketcapDom * 100).toFixed(1)}%
                  </span>
                </div>
                <div className={cn('flex items-center gap-1 text-lg font-black font-mono', palette.text)}>
                  {s.change24hPct >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {s.change24hPct >= 0 ? '+' : ''}{s.change24hPct.toFixed(2)}%
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Spotlight narratives */}
      {sortedSpotlight.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center gap-2">
            <TrendingUp size={16} className="text-danger" />
            <h2 className="text-sm font-semibold text-text-primary">Trending Narratives</h2>
            <span className="ml-auto text-[10px] text-text-muted">{sortedSpotlight.length} themes</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
            {sortedSpotlight.map((s) => {
              const palette = heatColor(s.change24hPct);
              return (
                <div
                  key={s.name}
                  className="rounded-lg border border-white/5 p-3 flex flex-col gap-1.5"
                  style={{ background: palette.bg }}
                >
                  <span className="text-xs font-bold text-text-primary uppercase tracking-wider">
                    {s.name}
                  </span>
                  <span className={cn('text-base font-black font-mono', palette.text)}>
                    {s.change24hPct >= 0 ? '+' : ''}{s.change24hPct.toFixed(2)}%
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
};
