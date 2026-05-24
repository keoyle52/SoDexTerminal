/**
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ BtcPredictorFlowDiagram                                             │
 * │ Visual data-flow chart explaining how the Predictor reasons.        │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Renders a 5-stage pipeline:
 *
 *     Data Sources  →  Feature Engineering  →  Rule Ensemble  →  AI Brain (Gemini)  →  Execution
 *
 * Each stage is a glass card with the constituent inputs/outputs and a
 * small badge classifying the data origin (SoDEX / SoSoValue / external /
 * local). Arrows are pure CSS so the diagram scales cleanly down to mobile.
 *
 * The component is purely cosmetic — it accepts no props, takes no live
 * data. Its only job is to make the Predictor's reasoning legible to a
 * non-technical jury within ~5 seconds of scrolling.
 */

import React from 'react';
import {
  Newspaper, Radio, BarChart3, Brain, Send, ArrowRight,
  Calculator, Target, Sparkles, Activity, Zap, Building2,
  Smile, TrendingUp, ChevronRight,
} from 'lucide-react';
import { cn } from '../lib/utils';

interface SourceItem {
  icon: React.ElementType;
  label: string;
  detail: string;
  origin: 'sodex' | 'sosovalue' | 'external' | 'local';
}

const ORIGIN_STYLES: Record<SourceItem['origin'], { dot: string; tag: string; label: string }> = {
  sodex: {
    dot: 'bg-emerald-400',
    tag: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
    label: 'SoDEX',
  },
  sosovalue: {
    dot: 'bg-primary',
    tag: 'text-primary bg-primary/10 border-primary/30',
    label: 'SoSoValue',
  },
  external: {
    dot: 'bg-amber-400',
    tag: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
    label: 'External',
  },
  local: {
    dot: 'bg-violet-400',
    tag: 'text-violet-300 bg-violet-500/10 border-violet-500/30',
    label: 'Local',
  },
};

const DATA_SOURCES: SourceItem[] = [
  { icon: BarChart3,  label: 'Klines (1m / 5m / 15m)', detail: '/markets/{sym}/klines',           origin: 'sodex' },
  { icon: Radio,      label: 'Order Book Depth',       detail: '/markets/{sym}/orderbook',        origin: 'sodex' },
  { icon: Activity,   label: 'Funding Rate',           detail: '/markets/tickers (fundingRate)',  origin: 'sodex' },
  { icon: Newspaper,  label: 'BTC News (15 latest)',   detail: '/api/v1/news/featured',           origin: 'sosovalue' },
  { icon: TrendingUp, label: 'Spot ETF Net Flow',      detail: '/openapi/v2/etf/historicalInflowChart', origin: 'sosovalue' },
  { icon: Building2,  label: 'Treasury Accumulation',  detail: '/openapi/v1/btc-treasuries/*',    origin: 'sosovalue' },
  { icon: Smile,      label: 'Fear & Greed Index',     detail: 'alternative.me/fng',              origin: 'external' },
];

const FEATURES: { label: string; detail: string }[] = [
  { label: 'RSI(14)',          detail: 'Oversold / overbought reversion' },
  { label: 'EMA(9 vs 21)',     detail: 'Trend direction + slope' },
  { label: 'MACD histogram',   detail: 'Momentum acceleration' },
  { label: 'VWAP deviation',   detail: 'Mean-reversion bias' },
  { label: 'Rate-of-Change',   detail: '12-bar return' },
  { label: 'ATR(14) %',        detail: 'Volatility regime' },
  { label: 'Order-book imbal.',detail: '10-level bid/ask ratio' },
  { label: 'Microstructure',   detail: 'Tick momentum + body shape' },
  { label: 'MTF alignment',    detail: '1m vs main TF EMA agreement' },
  { label: 'News sentiment',   detail: 'Gemini classifier on 8 headlines' },
  { label: 'ETF flow score',   detail: '3-day cumulative inflow' },
  { label: 'Treasury signal',  detail: '30-day institutional buys' },
  { label: 'F&G contrarian',   detail: 'Extreme sentiment fade' },
];

const ENSEMBLE_STEPS: { num: number; label: string; detail: string }[] = [
  { num: 1, label: 'Squash to [-1, +1]', detail: 'Each component normalised via tanh' },
  { num: 2, label: 'Weighted average',   detail: 'Higher weight on flow + sentiment (1.2x)' },
  { num: 3, label: 'Threshold gate',     detail: '|score| > 0.18 AND ≥4 signal agreement' },
  { num: 4, label: 'Fee margin filter',  detail: 'Expected move > 1.5x round-trip taker fee' },
];

const AI_STEPS: { num: number; label: string; detail: string }[] = [
  { num: 1, label: 'Build prompt',    detail: 'All 13 signals serialised as plain text' },
  { num: 2, label: 'Gemini 2.5-flash',detail: 'Strict JSON schema, 8s timeout' },
  { num: 3, label: 'Parse verdict',   detail: 'LONG / SHORT / HOLD + confidence + sizeMul' },
  { num: 4, label: 'Risk overrides',  detail: 'Skip on disagree, attenuate on weak conviction' },
];

const EXECUTION_STEPS: { num: number; label: string; detail: string }[] = [
  { num: 1, label: 'Resolve direction', detail: 'Rule decides side; AI cannot flip it' },
  { num: 2, label: 'Size the order',    detail: 'notional × AI sizeMul × leverage' },
  { num: 3, label: 'EIP-712 sign',      detail: 'agent key signs payload locally' },
  { num: 4, label: 'POST /trade/orders',detail: 'IOC market order on SoDEX perps' },
];

interface PipelineCardProps {
  step: number;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  iconClass: string;
  borderClass: string;
  children: React.ReactNode;
}

const PipelineCard: React.FC<PipelineCardProps> = ({
  step, title, subtitle, icon: Icon, iconClass, borderClass, children,
}) => (
  <div className={cn(
    'glass-card p-4 flex flex-col gap-3 relative overflow-hidden border',
    borderClass,
  )}>
    <div className="flex items-start gap-3 relative z-10">
      <div className={cn(
        'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
        iconClass,
      )}>
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted">
            Stage {step}
          </span>
        </div>
        <h4 className="text-sm font-bold text-text-primary mt-0.5 truncate">{title}</h4>
        <p className="text-[10px] text-text-muted leading-snug">{subtitle}</p>
      </div>
    </div>
    <div className="space-y-1.5 relative z-10">{children}</div>
  </div>
);

const ArrowConnector: React.FC<{ direction?: 'down' | 'right' }> = ({ direction = 'right' }) => (
  <div className={cn(
    'flex items-center justify-center text-primary/60 shrink-0',
    direction === 'down' ? 'h-6 lg:h-0 lg:w-0' : 'w-6 lg:w-8',
  )}>
    <ArrowRight
      size={20}
      className={cn(
        'animate-pulse',
        direction === 'down' && 'rotate-90 lg:rotate-0',
      )}
    />
  </div>
);

export const BtcPredictorFlowDiagram: React.FC = () => {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Sparkles size={18} className="text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-text-primary">How the Predictor Thinks</h3>
          <p className="text-[11px] text-text-muted">
            Live data → 13-signal ensemble → Gemini consensus overlay → on-chain execution
          </p>
        </div>
      </div>

      {/* Origin legend */}
      <div className="flex flex-wrap items-center gap-3 text-[10px]">
        {(['sodex', 'sosovalue', 'external', 'local'] as const).map((o) => (
          <div key={o} className="flex items-center gap-1.5">
            <span className={cn('w-2 h-2 rounded-full shrink-0', ORIGIN_STYLES[o].dot)} />
            <span className="text-text-muted uppercase tracking-wider">{ORIGIN_STYLES[o].label}</span>
          </div>
        ))}
      </div>

      {/* The pipeline. Switches from a horizontal flow on lg+ to a vertical
          stack on mobile. Arrows rotate accordingly. */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr] gap-3 lg:gap-2 items-stretch">
        {/* Stage 1 — Data Sources */}
        <PipelineCard
          step={1}
          title="Data Sources"
          subtitle="Live feed every cycle"
          icon={Radio}
          iconClass="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
          borderClass="border-emerald-500/20"
        >
          {DATA_SOURCES.map((s) => (
            <div key={s.label} className="flex items-start gap-2 p-2 rounded-md bg-background/40 border border-border/50">
              <s.icon size={12} className="text-text-muted shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-medium text-text-primary truncate">{s.label}</span>
                  <span className={cn('text-[8px] px-1 py-0.5 rounded border font-semibold tracking-wider', ORIGIN_STYLES[s.origin].tag)}>
                    {ORIGIN_STYLES[s.origin].label}
                  </span>
                </div>
                <div className="text-[9px] text-text-muted font-mono truncate">{s.detail}</div>
              </div>
            </div>
          ))}
        </PipelineCard>

        <ArrowConnector />

        {/* Stage 2 — Feature Engineering */}
        <PipelineCard
          step={2}
          title="Feature Engineering"
          subtitle="13 signals, all in [-1, +1]"
          icon={Calculator}
          iconClass="bg-violet-500/10 text-violet-400 border border-violet-500/30"
          borderClass="border-violet-500/20"
        >
          {FEATURES.map((f) => (
            <div key={f.label} className="flex items-center gap-2 p-1.5 rounded-md bg-background/40 border border-border/50">
              <ChevronRight size={10} className="text-violet-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-medium text-text-primary">{f.label}</span>
                <span className="text-[9px] text-text-muted ml-1.5">— {f.detail}</span>
              </div>
            </div>
          ))}
        </PipelineCard>

        <ArrowConnector />

        {/* Stage 3 — Rule Ensemble */}
        <PipelineCard
          step={3}
          title="Rule Ensemble"
          subtitle="Deterministic, backtestable"
          icon={Target}
          iconClass="bg-amber-500/10 text-amber-400 border border-amber-500/30"
          borderClass="border-amber-500/20"
        >
          {ENSEMBLE_STEPS.map((s) => (
            <div key={s.num} className="flex items-start gap-2 p-2 rounded-md bg-background/40 border border-border/50">
              <span className="text-[10px] font-bold text-amber-300 shrink-0 w-5 h-5 rounded-full bg-amber-500/15 flex items-center justify-center border border-amber-500/30">
                {s.num}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-medium text-text-primary">{s.label}</div>
                <div className="text-[9px] text-text-muted">{s.detail}</div>
              </div>
            </div>
          ))}
          <div className="mt-1 p-2 rounded-md bg-amber-500/5 border border-amber-500/20">
            <div className="text-[9px] text-amber-300 font-bold uppercase tracking-wider">
              Output
            </div>
            <div className="text-[10px] text-text-secondary">
              direction (UP / DOWN / NEUTRAL) + confidence (0–100)
            </div>
          </div>
        </PipelineCard>

        <ArrowConnector />

        {/* Stage 4 — AI Brain */}
        <PipelineCard
          step={4}
          title="AI Brain"
          subtitle="Gemini 2.5-flash overlay"
          icon={Brain}
          iconClass="bg-primary/10 text-primary border border-primary/30"
          borderClass="border-primary/20"
        >
          {AI_STEPS.map((s) => (
            <div key={s.num} className="flex items-start gap-2 p-2 rounded-md bg-background/40 border border-border/50">
              <span className="text-[10px] font-bold text-primary shrink-0 w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center border border-primary/30">
                {s.num}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-medium text-text-primary">{s.label}</div>
                <div className="text-[9px] text-text-muted">{s.detail}</div>
              </div>
            </div>
          ))}
          <div className="mt-1 p-2 rounded-md bg-primary/5 border border-primary/20">
            <div className="text-[9px] text-primary font-bold uppercase tracking-wider">
              Verdict
            </div>
            <div className="text-[10px] text-text-secondary">
              LONG / SHORT / HOLD + confidence + sizeMultiplier (0–1) + rationale
            </div>
          </div>
        </PipelineCard>

        <ArrowConnector />

        {/* Stage 5 — Execution */}
        <PipelineCard
          step={5}
          title="Execution"
          subtitle="On-chain, EIP-712 signed"
          icon={Send}
          iconClass="bg-rose-500/10 text-rose-400 border border-rose-500/30"
          borderClass="border-rose-500/20"
        >
          {EXECUTION_STEPS.map((s) => (
            <div key={s.num} className="flex items-start gap-2 p-2 rounded-md bg-background/40 border border-border/50">
              <span className="text-[10px] font-bold text-rose-300 shrink-0 w-5 h-5 rounded-full bg-rose-500/15 flex items-center justify-center border border-rose-500/30">
                {s.num}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-medium text-text-primary">{s.label}</div>
                <div className="text-[9px] text-text-muted">{s.detail}</div>
              </div>
            </div>
          ))}
          <div className="mt-1 p-2 rounded-md bg-rose-500/5 border border-rose-500/20">
            <div className="text-[9px] text-rose-300 font-bold uppercase tracking-wider">
              Result
            </div>
            <div className="text-[10px] text-text-secondary">
              IOC market order, position tracked in store, resolved next cycle
            </div>
          </div>
        </PipelineCard>
      </div>

      {/* Closed-loop footer — explains how the cycle iterates. */}
      <div className="glass-card p-4 border border-primary/20 bg-primary/[0.03]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
            <Zap size={14} className="text-primary" />
          </div>
          <div className="flex-1">
            <div className="text-xs font-bold text-text-primary">Closed Loop</div>
            <p className="text-[11px] text-text-secondary leading-relaxed">
              Each cycle resolves on the next interval close. Outcome (CORRECT / WRONG) is fed
              back into the performance dashboard so Sharpe ratio, max drawdown and win rate
              update <span className="text-primary font-semibold">live</span>. The loop never
              uses look-ahead data — every decision is reproducible from the signal hash alone.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BtcPredictorFlowDiagram;
