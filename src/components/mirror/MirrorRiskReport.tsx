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
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="rounded-2xl border border-border bg-surface p-6">
        <p className="text-text-muted font-mono text-xs mb-1">
          {data.address} · account #{data.accountId} · {data.network}
        </p>
        <h2 className="text-2xl font-bold text-text-primary">{report.style ?? 'Unknown Style'}</h2>
      </div>

      {/* Risk Gauge + AI Summary */}
      <div className="grid md:grid-cols-[220px_1fr] gap-6 rounded-2xl border border-border bg-surface p-6 md:p-8">
        <MirrorRiskGauge score={report.riskScore ?? 0} />
        <div>
          <h3 className="font-bold text-text-primary mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            AI Risk Summary
          </h3>
          <p className="text-text-secondary leading-relaxed text-sm mb-4">
            {report.summary ?? 'No analysis summary available.'}
          </p>
          {riskFactors.length > 0 && (
            <div>
              <p className="text-text-muted text-xs uppercase tracking-wider mb-2 font-medium">Risk Factors</p>
              <ul className="space-y-1.5">
                {riskFactors.map((f: string, i: number) => (
                  <li key={i} className="flex gap-2 text-sm text-text-secondary">
                    <AlertTriangle size={14} className="text-warning shrink-0 mt-0.5" />
                    <span>{f}</span>
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
          <div className="rounded-2xl border border-border bg-surface p-6">
            <h3 className="font-bold text-success mb-4 flex items-center gap-2 text-sm">
              <CheckCircle2 size={16} /> Performance Edges
            </h3>
            <ul className="space-y-2.5">
              {edges.positive?.map((e: string, i: number) => (
                <li key={i} className="text-sm bg-surface-2 border border-border rounded-xl p-3 flex gap-2 text-text-secondary">
                  <span className="text-success shrink-0">●</span>
                  <span>{e}</span>
                </li>
              ))}
              {(!edges.positive || edges.positive.length === 0) && (
                <p className="text-text-muted text-sm">No distinct positive edges identified.</p>
              )}
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-6">
            <h3 className="font-bold text-warning mb-4 flex items-center gap-2 text-sm">
              <AlertTriangle size={16} /> Anti-Patterns & Leakages
            </h3>
            <ul className="space-y-2.5">
              {edges.negative?.map((e: string, i: number) => (
                <li key={i} className="text-sm bg-surface-2 border border-border rounded-xl p-3 flex gap-2 text-text-secondary">
                  <span className="text-danger shrink-0">●</span>
                  <span>{e}</span>
                </li>
              ))}
              {(!edges.negative || edges.negative.length === 0) && (
                <p className="text-text-muted text-sm">No distinct leakages observed.</p>
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
      <div className="rounded-2xl border border-primary/20 bg-surface p-6 md:p-8 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="font-bold text-text-primary text-lg mb-1">Mirror This Wallet Live</h3>
            <p className="text-text-muted text-sm">
              AI-suggested config: <span className="text-text-secondary">{suggested.sizingMode === 'proportional' ? `${suggested.proportionalPct}% of position` : 'fixed size'}</span>,
              max {suggested.maxLeverage ?? 1}x leverage{suggested.requireStopLoss ? ', mandatory stop-loss' : ''}.
            </p>
            {suggested.rationale && <p className="text-text-muted text-xs mt-1">{suggested.rationale}</p>}
          </div>
          <button
            onClick={onSetupCopy}
            className={cn(
              'flex items-center gap-2 bg-primary text-background font-semibold rounded-xl px-6 py-3 text-sm',
              'hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-primary/20'
            )}
          >
            <Copy size={16} />
            Set Up Live Copying
          </button>
        </div>
      </div>

      {/* Historical Orders Table */}
      <div className="rounded-2xl border border-border bg-surface overflow-hidden">
        <div className="p-6 pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="font-bold text-text-primary">Historical Orders</h3>
          <div className="flex bg-surface-2 p-1 rounded-lg border border-border text-xs self-start sm:self-auto">
            <button
              onClick={() => setActiveTab('futures')}
              className={cn(
                'px-3.5 py-1.5 rounded-md font-semibold transition-all',
                activeTab === 'futures' ? 'bg-primary text-background shadow-sm' : 'text-text-muted hover:text-text-primary'
              )}
            >Futures (Perps)</button>
            <button
              onClick={() => setActiveTab('spot')}
              className={cn(
                'px-3.5 py-1.5 rounded-md font-semibold transition-all',
                activeTab === 'spot' ? 'bg-primary text-background shadow-sm' : 'text-text-muted hover:text-text-primary'
              )}
            >Spot Market</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm mt-4">
            <thead>
              <tr className="text-text-muted text-left border-y border-border text-xs uppercase tracking-wider">
                <th className="px-6 py-3 font-medium">Symbol</th>
                <th className="px-6 py-3 font-medium">Side</th>
                <th className="px-6 py-3 font-medium">Price</th>
                <th className="px-6 py-3 font-medium">Quantity</th>
                <th className="px-6 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {((activeTab === 'futures' ? data.trades : data.spotTrades) ?? []).slice(0, 25).map((t: any, i: number) => (
                <tr key={i} className="border-b border-border/40 last:border-0 hover:bg-surface-2/50 transition-colors">
                  <td className="px-6 py-3 text-text-primary">{formatSymbol(t.s ?? t.symbol)}</td>
                  <td className={cn('px-6 py-3 font-bold', (t.S ?? t.side) === 'BUY' ? 'text-success' : 'text-danger')}>
                    {t.S ?? t.side}
                  </td>
                  <td className="px-6 py-3 text-text-secondary">{t.p ?? t.price}</td>
                  <td className="px-6 py-3 text-text-secondary">{t.q ?? t.quantity}</td>
                  <td className="px-6 py-3 text-right">
                    <button
                      disabled={copyingTradeId !== null}
                      onClick={() => handleCopyTrade(t, i)}
                      className={cn(
                        'text-primary hover:underline text-xs font-semibold disabled:opacity-50',
                        copyingTradeId === `${t.s ?? t.symbol}-${i}` && 'text-text-muted animate-pulse'
                      )}
                    >
                      {copyingTradeId === `${t.s ?? t.symbol}-${i}` ? 'Copying...' : 'Copy'}
                    </button>
                  </td>
                </tr>
              ))}
              {((activeTab === 'futures' ? data.trades : data.spotTrades) ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-text-muted">No orders found in this category.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
