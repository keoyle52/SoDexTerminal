import React, { useEffect, useMemo, useState } from 'react';
import { Banknote, RefreshCw, AlertTriangle, Sparkles, TrendingUp } from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import {
  fetchFundraisingProjects,
  aggregateFundraisingBySector,
  type FundraisingProject,
} from '../api/sosoExtraServices';
import { useSettingsStore } from '../store/settingsStore';
import { cn } from '../lib/utils';

function formatUsd(amount?: number): string {
  if (!amount || !Number.isFinite(amount)) return '—';
  if (amount >= 1e9) return `$${(amount / 1e9).toFixed(2)}B`;
  if (amount >= 1e6) return `$${(amount / 1e6).toFixed(1)}M`;
  if (amount >= 1e3) return `$${(amount / 1e3).toFixed(1)}K`;
  return `$${amount.toFixed(0)}`;
}

function relativeDate(ts?: number): string {
  if (!ts) return '—';
  const days = Math.round((Date.now() - ts) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.round(days / 7);
  if (weeks === 1) return '1 week ago';
  return `${weeks} weeks ago`;
}

export const Fundraising: React.FC = () => {
  const { isDemoMode, sosoApiKey } = useSettingsStore();
  const [projects, setProjects] = useState<FundraisingProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setErrMsg(null);
    try {
      const data = await fetchFundraisingProjects();
      setProjects(data);
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Failed to load fundraising data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [isDemoMode, sosoApiKey]);

  const sectorAgg = useMemo(() => aggregateFundraisingBySector(projects), [projects]);

  // Lazy-initialised cutoff so the memo stays pure under React-Compiler's
  // purity rule. useState initializer fires once at mount.
  const [weekCutoff] = useState(() => Date.now() - 7 * 86_400_000);
  const weekStats = useMemo(() => {
    const recent = projects.filter((p) => (p.date ?? 0) >= weekCutoff);
    const total = recent.reduce((s, p) => s + (p.amountUsd ?? 0), 0);
    const top = recent.slice().sort((a, b) => (b.amountUsd ?? 0) - (a.amountUsd ?? 0))[0] ?? null;
    return { count: recent.length, total, top };
  }, [projects, weekCutoff]);

  const topSector = sectorAgg[0] ?? null;

  return (
    <div className="flex flex-col gap-6 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center shadow-[0_0_20px_rgba(20,184,166,0.4)]">
            <Banknote size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">Fundraising Intelligence</h1>
            <p className="text-xs text-text-muted">
              Where smart money is flowing — recent VC rounds and the sectors picking up the most capital.
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

      {/* Top-line stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-text-muted">This week</div>
          <div className="text-2xl font-black font-mono text-emerald-400 mt-1">
            {formatUsd(weekStats.total)}
          </div>
          <div className="text-xs text-text-muted mt-1">
            {weekStats.count} round{weekStats.count === 1 ? '' : 's'} closed
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-text-muted">Top weekly round</div>
          <div className="text-base font-bold font-mono text-text-primary mt-1 truncate" title={weekStats.top?.projectName}>
            {weekStats.top?.projectName ?? '—'}
          </div>
          <div className="text-xs text-text-muted mt-1">
            {weekStats.top
              ? `${formatUsd(weekStats.top.amountUsd)} ${weekStats.top.round ?? ''} · ${weekStats.top.sector ?? '—'}`
              : 'No recent rounds'}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-text-muted">Hottest sector</div>
          <div className="text-base font-bold font-mono text-text-primary mt-1">
            {topSector?.sector ?? '—'}
          </div>
          <div className="text-xs text-text-muted mt-1">
            {topSector
              ? `${formatUsd(topSector.totalUsd)} across ${topSector.count} rounds`
              : 'No data yet'}
          </div>
        </Card>
      </div>

      {/* Sector breakdown */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
          <Sparkles size={16} className="text-emerald-400" />
          <h2 className="text-sm font-bold text-text-primary uppercase tracking-wide">Capital by sector</h2>
          <span className="ml-auto text-[10px] text-text-muted">{sectorAgg.length} sectors</span>
        </div>
        <div className="p-5 flex flex-col gap-2">
          {sectorAgg.length === 0 ? (
            <div className="text-center text-text-muted text-sm py-4">No sector data available.</div>
          ) : sectorAgg.map((s) => {
            const max = sectorAgg[0].totalUsd || 1;
            const pct = (s.totalUsd / max) * 100;
            return (
              <div key={s.sector} className="flex items-center gap-3">
                <span className="text-xs font-bold text-text-primary w-32 shrink-0">{s.sector}</span>
                <div className="flex-1 h-3 rounded-full bg-white/[0.03] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500/60 to-teal-300/80 rounded-full transition-[width] duration-700"
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
                <span className="text-xs font-mono font-bold text-text-secondary w-20 text-right shrink-0">
                  {formatUsd(s.totalUsd)}
                </span>
                <span className="text-[10px] text-text-muted w-16 text-right shrink-0">
                  {s.count} round{s.count === 1 ? '' : 's'}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Recent rounds list */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
          <TrendingUp size={16} className="text-emerald-400" />
          <h2 className="text-sm font-bold text-text-primary uppercase tracking-wide">Recent rounds</h2>
          <span className="ml-auto text-[10px] text-text-muted">{projects.length} projects</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5 text-[11px] text-text-muted uppercase tracking-wider">
                <th className="px-5 py-2.5 text-left font-semibold">Project</th>
                <th className="px-4 py-2.5 text-left font-semibold">Sector</th>
                <th className="px-4 py-2.5 text-left font-semibold">Round</th>
                <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                <th className="px-4 py-2.5 text-left font-semibold">Lead investor</th>
                <th className="px-5 py-2.5 text-right font-semibold">When</th>
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-text-muted text-sm">
                    {loading ? 'Loading…' : 'No fundraising data available.'}
                  </td>
                </tr>
              ) : projects.slice(0, 50).map((p) => (
                <tr key={p.projectId} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-5 py-2.5">
                    <span className="text-sm font-bold text-text-primary">{p.projectName}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold">
                      {p.sector ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-text-secondary">{p.round ?? '—'}</td>
                  <td className={cn(
                    'px-4 py-2.5 text-sm font-mono font-bold text-right',
                    (p.amountUsd ?? 0) >= 50_000_000 ? 'text-emerald-400' : 'text-text-primary',
                  )}>
                    {formatUsd(p.amountUsd)}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-text-secondary">{p.leadInvestor ?? '—'}</td>
                  <td className="px-5 py-2.5 text-sm text-text-muted font-mono text-right">
                    {relativeDate(p.date)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
