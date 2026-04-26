import React from 'react';
import { TrendingUp, Target, Activity, Award } from 'lucide-react';
import { useBotPnlStore, getWinRate, BOT_LABELS, type BotKey } from '../../store/botPnlStore';
import { cn } from '../../lib/utils';

interface BotPnlStripProps {
  /** Which bot's stats to surface. */
  botKey: BotKey;
  /** When true, renders a compact single-row variant for sidebars. */
  compact?: boolean;
  /** Optional header override — defaults to `${BOT_LABELS[botKey]} Performance`. */
  title?: string;
  className?: string;
}

function formatUsd(n: number, withSign = true): string {
  const sign = n > 0 && withSign ? '+' : n < 0 ? '−' : '';
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

/**
 * Live-updating performance strip for a single bot. Reads directly from
 * `useBotPnlStore` so any tab that records trades will instantly
 * propagate to every dashboard / page that mounts this strip.
 *
 * The numbers shown:
 *  - **Today**:    sum of pnl from trades resolved within the last 24h
 *  - **All-time**: cumulative pnl across the bot's full history
 *  - **Win rate**: wins / total trades, expressed as a %
 *  - **Trades**:   total trade count (compact mode hides this)
 *
 * Recent trades feed a 12-bar mini chart on the right so the user gets a
 * quick "is the line going up" read alongside the big numbers.
 */
export const BotPnlStrip: React.FC<BotPnlStripProps> = ({ botKey, compact = false, title, className }) => {
  const stats = useBotPnlStore((s) => s.bots[botKey]);
  if (!stats) return null;

  const winRate = getWinRate(stats);
  const winPct = stats.trades > 0 ? Math.round(winRate * 100) : null;
  const todayClr = stats.todayPnl >= 0 ? 'text-emerald-400' : 'text-red-400';
  const totalClr = stats.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400';

  // Last 12 trades for the mini bar chart (oldest left, newest right).
  const sparkTrades = stats.recent.slice(0, 12).reverse();
  const sparkMaxAbs = sparkTrades.reduce(
    (m, t) => Math.max(m, Math.abs(t.pnlUsdt)),
    0.01,
  );

  return (
    <div className={cn(
      'glass-card flex items-center gap-4 p-4',
      compact ? 'gap-3 p-3' : '',
      className,
    )}>
      {/* Title */}
      <div className="flex flex-col min-w-0 shrink-0">
        <span className="text-[10px] uppercase tracking-wider text-text-muted font-bold flex items-center gap-1">
          <Activity size={11} className="text-primary" />
          {title ?? `${BOT_LABELS[botKey]} Performance`}
        </span>
        {!compact && (
          <span className="text-[10px] text-text-muted/70 mt-0.5">
            {stats.trades > 0
              ? `${stats.trades} trades · ${stats.wins} wins`
              : 'Awaiting first trade'}
          </span>
        )}
      </div>

      {/* Metric tiles — flex-wrap so it folds on narrow viewports */}
      <div className={cn('flex flex-wrap items-center gap-4 flex-1', compact ? 'gap-3' : '')}>
        <Metric
          icon={<Target size={11} className="text-primary" />}
          label="Today"
          value={formatUsd(stats.todayPnl)}
          className={todayClr}
        />
        <Metric
          icon={<TrendingUp size={11} className="text-primary" />}
          label="Total"
          value={formatUsd(stats.totalPnl)}
          className={totalClr}
        />
        <Metric
          icon={<Award size={11} className="text-primary" />}
          label="Win rate"
          value={winPct !== null ? `${winPct}%` : '—'}
          className={
            winPct === null ? 'text-text-muted'
              : winPct >= 60 ? 'text-emerald-400'
                : winPct >= 45 ? 'text-amber-400'
                  : 'text-red-400'
          }
        />
        {!compact && (
          <Metric
            icon={<Activity size={11} className="text-primary" />}
            label="Trades"
            value={stats.trades.toString()}
            className="text-text-primary"
          />
        )}
      </div>

      {/* Mini bar chart of last 12 trades */}
      {sparkTrades.length > 0 && (
        <div className="flex items-end gap-[2px] h-8 shrink-0" title="Last 12 trades">
          {sparkTrades.map((t, i) => {
            const h = Math.max(2, Math.round((Math.abs(t.pnlUsdt) / sparkMaxAbs) * 30));
            const positive = t.pnlUsdt >= 0;
            return (
              <div
                key={i}
                className={cn('w-[3px] rounded-sm', positive ? 'bg-emerald-400' : 'bg-red-400')}
                style={{ height: `${h}px` }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

const Metric: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  className?: string;
}> = ({ icon, label, value, className }) => (
  <div className="flex flex-col min-w-[70px]">
    <span className="text-[10px] text-text-muted uppercase tracking-wider flex items-center gap-1">
      {icon}{label}
    </span>
    <span className={cn('text-sm font-bold font-mono', className)}>
      {value}
    </span>
  </div>
);
