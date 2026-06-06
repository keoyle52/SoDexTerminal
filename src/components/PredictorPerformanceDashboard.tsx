import React, { useMemo } from 'react';
import {
  TrendingUp, Activity, BarChart3, Target,
  Award, AlertTriangle, Calendar,
  Percent, Shield
} from 'lucide-react';
import { Card, StatCard } from './common/Card';
import { NumberDisplay } from './common/NumberDisplay';
import { usePredictorStore, computePerformanceMetrics, type PredictionEntry } from '../store/predictorStore';
import { cn } from '../lib/utils';

interface PredictorPerformanceDashboardProps {
  history: PredictionEntry[];
  className?: string;
}

export const PredictorPerformanceDashboard: React.FC<PredictorPerformanceDashboardProps> = ({
  history,
  className,
}) => {
  const resetStats = usePredictorStore((s) => s.resetStats);
  const metrics = useMemo(() => computePerformanceMetrics(history), [history]);

  // Determine performance grade
  const performanceGrade = useMemo(() => {
    if (metrics.tradesCount < 10) return { grade: 'N/A', color: 'text-text-muted', bg: 'bg-surface' };
    const score = metrics.sharpeRatio * 20 + metrics.winRate * 30 + (metrics.totalNetPct / Math.max(metrics.tradesCount, 1)) * 10;
    if (score >= 80) return { grade: 'A+', color: 'text-emerald-400', bg: 'bg-emerald-500/10' };
    if (score >= 65) return { grade: 'A', color: 'text-emerald-400', bg: 'bg-emerald-500/10' };
    if (score >= 50) return { grade: 'B', color: 'text-primary', bg: 'bg-primary/10' };
    if (score >= 35) return { grade: 'C', color: 'text-amber-400', bg: 'bg-amber-500/10' };
    return { grade: 'D', color: 'text-red-400', bg: 'bg-red-500/10' };
  }, [metrics]);

  // Risk level assessment
  const riskLevel = useMemo(() => {
    if (metrics.maxDrawdownPct > 5) return { level: 'High', color: 'text-red-400' };
    if (metrics.maxDrawdownPct > 2.5) return { level: 'Medium', color: 'text-amber-400' };
    return { level: 'Low', color: 'text-emerald-400' };
  }, [metrics.maxDrawdownPct]);

  if (metrics.tradesCount === 0) {
    return (
      <Card className={cn("p-6 flex flex-col items-center justify-center text-center", className)}>
        <div className="w-16 h-16 rounded-full bg-surface border border-border flex items-center justify-center mb-4">
          <Activity size={28} className="text-text-muted" />
        </div>
        <h3 className="text-sm font-semibold text-text-primary mb-2">No Trading History Yet</h3>
        <p className="text-xs text-text-muted max-w-xs">
          Start the BTC Predictor to begin collecting performance metrics. 
          At least 10 trades are needed for statistically significant analysis.
        </p>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header with Grade */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <BarChart3 size={20} className="text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary">Performance Validation</h3>
            <p className="text-[10px] text-text-muted">
              {metrics.tradesCount} trades analyzed • Sharpe: {metrics.sharpeRatio.toFixed(2)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (window.confirm("Are you sure you want to clear all predictor history and reset statistics? This cannot be undone.")) {
                resetStats();
              }
            }}
            className="px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Activity size={12} />
            Reset Stats
          </button>
          <div className={cn("px-3 py-1.5 rounded-lg border", performanceGrade.bg, "border-current", performanceGrade.color)}>
            <span className={cn("text-lg font-bold", performanceGrade.color)}>{performanceGrade.grade}</span>
          </div>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total Return"
          value={
            <NumberDisplay
              value={Math.abs(metrics.totalNetPct)}
              prefix={metrics.totalNetPct >= 0 ? '+' : '-'}
              suffix="%"
              trend={metrics.totalNetPct >= 0 ? 'up' : 'down'}
            />
          }
          icon={<Percent size={14} />}
          trend={metrics.totalNetPct >= 0 ? 'up' : 'down'}
        />
        <StatCard
          label="Win Rate"
          value={
            <NumberDisplay
              value={metrics.winRate * 100}
              suffix="%"
              decimals={1}
            />
          }
          icon={<Target size={14} />}
          trend={metrics.winRate >= 0.5 ? 'up' : 'down'}
        />
        <StatCard
          label="Sharpe Ratio"
          value={
            <span className={cn(
              "font-mono font-bold",
              metrics.sharpeRatio >= 1 ? 'text-emerald-400' : metrics.sharpeRatio >= 0.5 ? 'text-primary' : 'text-amber-400'
            )}>
              {metrics.sharpeRatio.toFixed(2)}
            </span>
          }
          icon={<Award size={14} />}
          trend={metrics.sharpeRatio >= 1 ? 'up' : 'neutral'}
        />
        <StatCard
          label="Max Drawdown"
          value={
            <NumberDisplay
              value={metrics.maxDrawdownPct}
              prefix="-"
              suffix="%"
              decimals={2}
            />
          }
          icon={<AlertTriangle size={14} />}
          trend={metrics.maxDrawdownPct < 2 ? 'up' : 'down'}
        />
      </div>

      {/* Extended Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="p-3">
          <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Profit Factor</div>
          <div className={cn(
            "text-lg font-bold font-mono",
            metrics.profitFactor >= 1.5 ? 'text-emerald-400' : metrics.profitFactor >= 1 ? 'text-primary' : 'text-amber-400'
          )}>
            {metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2)}
          </div>
          <div className="text-[9px] text-text-muted mt-0.5">
            Gross Profit / Gross Loss
          </div>
        </Card>

        <Card className="p-3">
          <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Avg Win</div>
          <div className="text-lg font-bold font-mono text-emerald-400">
            +{metrics.avgWinPct.toFixed(3)}%
          </div>
          <div className="text-[9px] text-text-muted mt-0.5">
            Per winning trade
          </div>
        </Card>

        <Card className="p-3">
          <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Avg Loss</div>
          <div className="text-lg font-bold font-mono text-red-400">
            -{metrics.avgLossPct.toFixed(3)}%
          </div>
          <div className="text-[9px] text-text-muted mt-0.5">
            Per losing trade
          </div>
        </Card>
      </div>

      {/* Risk Assessment */}
      <Card className={cn("p-4 border-l-4", riskLevel.color.replace('text-', 'border-l-'))}>
        <div className="flex items-start gap-3">
          <Shield size={16} className={riskLevel.color} />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-text-primary">Risk Assessment</span>
              <span className={cn("text-xs font-bold", riskLevel.color)}>{riskLevel.level} Risk</span>
            </div>
            <p className="text-[10px] text-text-muted leading-relaxed">
              Max drawdown of {metrics.maxDrawdownPct.toFixed(2)}% with {metrics.tradesCount} trades. 
              Expectancy: {metrics.expectancyPct >= 0 ? '+' : ''}{metrics.expectancyPct.toFixed(3)}% per trade.
              {metrics.expectancyPct > 0 
                ? ' Positive expectancy indicates profitable strategy over time.' 
                : ' Negative expectancy suggests strategy needs optimization.'}
            </p>
          </div>
        </div>
      </Card>

      {/* Equity Curve Mini Chart */}
      {metrics.equityCurve.length > 1 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-primary" />
              <span className="text-xs font-semibold text-text-primary">Equity Curve</span>
            </div>
            <span className="text-[10px] text-text-muted">Cumulative P&L %</span>
          </div>
          <EquityCurveChart data={metrics.equityCurve} />
        </Card>
      )}

      {/* Monthly Performance */}
      {metrics.monthlyReturns.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={14} className="text-primary" />
            <span className="text-xs font-semibold text-text-primary">Monthly Performance</span>
          </div>
          <div className="space-y-2">
            {metrics.monthlyReturns.slice(-6).map((month) => (
              <div key={month.month} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                <span className="text-xs text-text-secondary">{month.month}</span>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-text-muted">{month.trades} trades</span>
                  <span className={cn(
                    "text-xs font-mono font-bold",
                    month.returnPct >= 0 ? 'text-emerald-400' : 'text-red-400'
                  )}>
                    {month.returnPct >= 0 ? '+' : ''}{month.returnPct.toFixed(2)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Best/Worst Trades */}
      {metrics.bestNetPct !== 0 && (
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-3 border-l-2 border-l-emerald-500">
            <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Best Trade</div>
            <div className="text-lg font-bold font-mono text-emerald-400">
              +{metrics.bestNetPct.toFixed(3)}%
            </div>
          </Card>
          <Card className="p-3 border-l-2 border-l-red-500">
            <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Worst Trade</div>
            <div className="text-lg font-bold font-mono text-red-400">
              {metrics.worstNetPct.toFixed(3)}%
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

// Simple SVG equity curve chart
const EquityCurveChart: React.FC<{ data: { equity: number; tradeCount: number }[] }> = ({ data }) => {
  const width = 100;
  const height = 60;
  const padding = 5;

  const values = data.map(d => d.equity);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const range = max - min || 1;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * (width - 2 * padding);
    const y = height - padding - ((d.equity - min) / range) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(' ');

  const isPositive = data[data.length - 1]?.equity >= 0;
  const strokeColor = isPositive ? '#34D399' : '#F87171';

  return (
    <div className="w-full h-16 relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="none">
        {/* Zero line */}
        <line
          x1={padding}
          y1={height - padding - ((0 - min) / range) * (height - 2 * padding)}
          x2={width - padding}
          y2={height - padding - ((0 - min) / range) * (height - 2 * padding)}
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="0.5"
          strokeDasharray="2,2"
        />
        {/* Equity curve */}
        <polyline
          points={points}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Area fill */}
        <polygon
          points={`${points} ${width - padding},${height - padding} ${padding},${height - padding}`}
          fill={isPositive ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)'}
        />
      </svg>
    </div>
  );
};
