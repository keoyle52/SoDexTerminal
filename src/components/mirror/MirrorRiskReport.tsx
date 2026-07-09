import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { MirrorRiskGauge } from './MirrorRiskGauge';
import { MirrorStatCard } from './MirrorStatCard';
import { Activity, TrendingUp, Timer, Gauge, CheckCircle2, AlertTriangle, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import { placeOrder } from '../../api/services';

interface MirrorRiskReportProps {
  data: any;
  onSetupCopy: () => void;
}

function formatSymbol(sym: string): string {
  if (!sym) return '—';
  const clean = (s: string) => {
    let r = s;
    if (r.startsWith('w') && r[1] && r[1] === r[1].toUpperCase()) r = r.slice(1);
    if (r.startsWith('v') && r[1] && r[1] === r[1].toUpperCase()) r = r.slice(1);
    return r.toUpperCase();
  };
  if (sym.includes('_')) { const p = sym.split('_'); return `${clean(p[0])}/${clean(p[1])}`; }
  if (sym.includes('-')) { const p = sym.split('-'); return `${clean(p[0])}/${clean(p[1])}`; }
  return clean(sym);
}

export const MirrorRiskReport: React.FC<MirrorRiskReportProps> = ({ data, onSetupCopy }) => {
  const [activeTab, setActiveTab] = useState<'futures' | 'spot'>('futures');
  const [copyingTradeId, setCopyingTradeId] = useState<string | null>(null);

  const report = data.report ?? {};
  const stats = report.stats ?? {};
  const edges = report.performanceEdges ?? { positive: [], negative: [] };
  const riskFactors = report.riskFactors ?? [];
  const suggested = report.suggestedCopyConfig ?? {};

  async function handleCopyTrade(trade: any, index: number) {
    const symbol = trade.s ?? trade.symbol;
    const side = (trade.S ?? trade.side) === 'BUY' ? 1 : 2;
    const qty = trade.q ?? trade.quantity;
    const market = activeTab === 'futures' ? 'perps' : 'spot';

    if (!symbol || !qty) {
      toast.error('Invalid trade data.');
      return;
    }

    const tradeId = `${symbol}-${index}`;
    setCopyingTradeId(tradeId);
    const toastId = toast.loading(`Copying ${trade.S ?? trade.side} order for ${symbol}...`);

    try {
      await placeOrder({
        symbol,
        side,
        type: 2, // MARKET order
        quantity: String(qty),
      }, market);
      toast.success(`Successfully placed order: ${trade.S ?? trade.side} ${qty} ${symbol}!`, { id: toastId });
    } catch (err: any) {
      const msg = err.message ?? 'Failed to execute order';
      toast.error(`Order Failed: ${msg}`, { id: toastId });
    } finally {
      setCopyingTradeId(null);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header */}
      <div className="glass-card p-8 relative overflow-hidden group">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-3xl transition-transform duration-700 group-hover:scale-150" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-text-muted font-mono text-sm mb-2 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-success animate-pulse" />
              {data.address} <span className="opacity-50">|</span> #{data.accountId} <span className="opacity-50">|</span> {data.network}
            </p>
            <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-text-muted tracking-tight">
              {report.style ?? 'Unknown Style'}
            </h2>
          </div>
          <div className="flex gap-3">
             <div className="px-4 py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary font-semibold text-sm shadow-lg shadow-primary/5">
                AI Verified
             </div>
          </div>
        </div>
      </div>

      {/* Risk Gauge + AI Summary */}
      <div className="grid md:grid-cols-[250px_1fr] gap-6 glass-card p-6 md:p-8 relative overflow-hidden">
        <div className="absolute bottom-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/5 to-transparent pointer-events-none" />
        <MirrorRiskGauge score={report.riskScore ?? 0} />
        <div className="relative z-10">
          <h3 className="font-bold text-lg text-text-primary mb-3 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(0,212,255,0.8)]" />
            AI Cognitive Summary
          </h3>
          <p className="text-text-secondary leading-relaxed text-sm mb-5 p-4 rounded-xl bg-surface-2/50 border border-border/50">
            {report.summary ?? 'No analysis summary available.'}
          </p>
          {riskFactors.length > 0 && (
            <div>
              <p className="text-text-muted text-xs uppercase tracking-widest mb-3 font-bold">Risk Factors Identified</p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {riskFactors.map((f: string, i: number) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-text-secondary bg-danger/5 border border-danger/10 p-3 rounded-xl transition-all hover:border-danger/30 hover:bg-danger/10">
                    <AlertTriangle size={16} className="text-danger shrink-0 mt-0.5 drop-shadow-[0_0_4px_rgba(239,68,68,0.5)]" />
                    <span className="font-medium">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Performance Edges */}
      {(edges.positive?.length > 0 || edges.negative?.length > 0) && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="glass-card p-6 border-success/20 hover:border-success/40 transition-colors group relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-success/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <h3 className="font-bold text-success mb-5 flex items-center gap-2 text-base">
              <CheckCircle2 size={18} className="drop-shadow-[0_0_5px_rgba(16,185,129,0.8)]" /> Performance Edges
            </h3>
            <ul className="space-y-3">
              {edges.positive?.map((e: string, i: number) => (
                <li key={i} className="text-sm bg-surface-2/60 border border-success/10 rounded-xl p-3.5 flex gap-3 text-text-secondary shadow-sm">
                  <span className="text-success shrink-0 mt-0.5 font-bold">✓</span>
                  <span className="leading-relaxed">{e}</span>
                </li>
              ))}
              {(!edges.positive || edges.positive.length === 0) && (
                <p className="text-text-muted text-sm italic">No distinct positive edges identified.</p>
              )}
            </ul>
          </div>
          <div className="glass-card p-6 border-warning/20 hover:border-warning/40 transition-colors group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-warning/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <h3 className="font-bold text-warning mb-5 flex items-center gap-2 text-base">
              <AlertTriangle size={18} className="drop-shadow-[0_0_5px_rgba(245,158,11,0.8)]" /> Anti-Patterns & Leakages
            </h3>
            <ul className="space-y-3">
              {edges.negative?.map((e: string, i: number) => (
                <li key={i} className="text-sm bg-surface-2/60 border border-warning/10 rounded-xl p-3.5 flex gap-3 text-text-secondary shadow-sm">
                  <span className="text-warning shrink-0 mt-0.5 font-bold">✕</span>
                  <span className="leading-relaxed">{e}</span>
                </li>
              ))}
              {(!edges.negative || edges.negative.length === 0) && (
                <p className="text-text-muted text-sm italic">No distinct leakages observed.</p>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MirrorStatCard label="Total Trades" value={stats.totalTrades ?? '—'} icon={Activity} />
        <MirrorStatCard label="Win Rate" value={stats.winRatePct != null ? `${stats.winRatePct}%` : '—'} icon={TrendingUp} accentColor="var(--color-success)" />
        <MirrorStatCard label="Avg Hold Time" value={stats.avgHoldTimeMinutes != null ? `${stats.avgHoldTimeMinutes}m` : '—'} icon={Timer} />
        <MirrorStatCard label="Max Leverage" value={stats.maxLeverageObserved != null ? `${stats.maxLeverageObserved}x` : '—'} icon={Gauge} accentColor="var(--color-warning)" />
      </div>

      {/* Mirror CTA */}
      <div className="glass-card border-primary/30 p-8 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/20 rounded-full blur-3xl pointer-events-none animate-pulse-dot" />
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex-1">
            <h3 className="font-extrabold text-white text-2xl mb-2 flex items-center gap-3">
              <span className="bg-primary text-background p-1.5 rounded-lg shadow-[0_0_15px_rgba(0,212,255,0.6)]">
                 <Copy size={20} />
              </span>
              Initialize Mirror Protocol
            </h3>
            <p className="text-text-secondary text-sm leading-relaxed max-w-xl">
              AI-suggested config: <span className="text-primary font-semibold">{suggested.sizingMode === 'proportional' ? `${suggested.proportionalPct}% of position` : 'fixed size'}</span>, 
              max {suggested.maxLeverage ?? 1}x leverage{suggested.requireStopLoss ? ', mandatory stop-loss enforced' : ''}.
            </p>
            {suggested.rationale && <p className="text-text-muted text-xs mt-2 italic bg-black/20 p-2 rounded-lg border border-white/5">{suggested.rationale}</p>}
          </div>
          <button
            onClick={onSetupCopy}
            className={cn(
              'whitespace-nowrap flex items-center gap-2 bg-gradient-to-r from-primary to-info text-white font-bold rounded-xl px-8 py-4',
              'hover:shadow-[0_0_30px_rgba(0,212,255,0.4)] hover:scale-105 active:scale-95 transition-all duration-300'
            )}
          >
            Deploy Live Copying
          </button>
        </div>
      </div>

      {/* Historical Orders Table */}
      <div className="glass-card overflow-hidden flex flex-col">
        <div className="p-6 pb-4 border-b border-border/50 bg-surface-2/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="font-bold text-text-primary text-lg flex items-center gap-2">
            <Activity size={18} className="text-primary" /> Order Intel & History
          </h3>
          <div className="flex bg-background p-1.5 rounded-xl border border-border text-xs font-semibold shadow-inner">
            <button
              onClick={() => setActiveTab('futures')}
              className={cn(
                'px-5 py-2 rounded-lg transition-all duration-300',
                activeTab === 'futures' ? 'bg-primary text-background shadow-md shadow-primary/20 scale-100' : 'text-text-muted hover:text-text-primary hover:bg-surface-2 scale-95'
              )}
            >Perpetuals</button>
            <button
              onClick={() => setActiveTab('spot')}
              className={cn(
                'px-5 py-2 rounded-lg transition-all duration-300',
                activeTab === 'spot' ? 'bg-primary text-background shadow-md shadow-primary/20 scale-100' : 'text-text-muted hover:text-text-primary hover:bg-surface-2 scale-95'
              )}
            >Spot</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-text-muted text-left bg-surface-2/50 text-xs uppercase tracking-wider font-semibold">
                <th className="px-8 py-4">Symbol</th>
                <th className="px-6 py-4">Side</th>
                <th className="px-6 py-4">Price</th>
                <th className="px-6 py-4">Quantity</th>
                <th className="px-8 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {((activeTab === 'futures' ? data.trades : data.spotTrades) ?? []).slice(0, 100).map((t: any, i: number) => (
                <tr key={i} className="border-b border-border/20 last:border-0 hover:bg-white/[0.02] transition-colors group">
                  <td className="px-8 py-4 text-text-primary font-bold">{formatSymbol(t.s ?? t.symbol)}</td>
                  <td className={cn('px-6 py-4 font-extrabold', (t.S ?? t.side) === 'BUY' ? 'text-success drop-shadow-[0_0_3px_rgba(16,185,129,0.4)]' : 'text-danger drop-shadow-[0_0_3px_rgba(239,68,68,0.4)]')}>
                    {t.S ?? t.side}
                  </td>
                  <td className="px-6 py-4 text-text-secondary group-hover:text-white transition-colors">{t.p ?? t.price}</td>
                  <td className="px-6 py-4 text-text-secondary group-hover:text-white transition-colors">{t.q ?? t.quantity}</td>
                  <td className="px-8 py-4 text-right">
                    <button
                      disabled={copyingTradeId !== null}
                      onClick={() => handleCopyTrade(t, i)}
                      className={cn(
                        'px-4 py-1.5 rounded-lg border font-semibold text-xs transition-all',
                        copyingTradeId === `${t.s ?? t.symbol}-${i}`
                          ? 'border-text-muted text-text-muted animate-pulse bg-transparent'
                          : 'border-primary/30 text-primary hover:bg-primary hover:text-background hover:border-primary shadow-[0_0_10px_rgba(0,212,255,0)] hover:shadow-[0_0_10px_rgba(0,212,255,0.3)] disabled:opacity-50'
                      )}
                    >
                      {copyingTradeId === `${t.s ?? t.symbol}-${i}` ? 'Copying...' : 'Copy'}
                    </button>
                  </td>
                </tr>
              ))}
              {((activeTab === 'futures' ? data.trades : data.spotTrades) ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-text-muted">
                    <div className="flex flex-col items-center gap-3">
                      <Activity size={32} className="opacity-20" />
                      <p>No trade executions discovered.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
