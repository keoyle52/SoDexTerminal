import React, { useState } from 'react';
import { Sparkles, Cpu, Brain, CheckCircle2, Bot, ArrowRight, Zap } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '../lib/utils';

export const AiOrchestratorPanel: React.FC = () => {
  const [analyzing, setAnalyzing] = useState(false);

  const handleReanalyze = () => {
    setAnalyzing(true);
    setTimeout(() => setAnalyzing(false), 800);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 gap-4 bg-surface text-xs leading-relaxed">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-border/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Brain size={18} />
          </div>
          <div>
            <h3 className="font-extrabold text-text-primary text-sm flex items-center gap-1.5">
              Gemini AI Orchestrator
            </h3>
            <p className="text-[10px] text-text-muted">Real-time regime classification & trade triggers</p>
          </div>
        </div>
        <button
          onClick={handleReanalyze}
          disabled={analyzing}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/30 hover:bg-purple-500/20 transition-all font-semibold"
        >
          <Sparkles size={12} className={cn(analyzing && 'animate-spin')} />
          {analyzing ? 'Analyzing...' : 'Re-Analyze'}
        </button>
      </div>

      {/* Market Regime Card */}
      <div className="p-3.5 rounded-xl bg-gradient-to-br from-purple-900/20 to-indigo-900/20 border border-purple-500/30 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider font-bold text-purple-300 flex items-center gap-1">
            <Cpu size={12} /> Live Market Regime
          </span>
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">
            Accumulation / Low Volatility
          </span>
        </div>
        <p className="text-text-primary font-bold text-sm">SOSO/USDT Consolidation Phase</p>
        <p className="text-text-secondary text-[11px] leading-normal">
          Gemini AI analysis detects tight 14-period Bollinger Compression near $0.28. High probability of grid arbitrage opportunities.
        </p>
      </div>

      {/* AI Recommendation Box */}
      <div className="p-3.5 rounded-xl bg-background/60 border border-border space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-bold text-text-primary flex items-center gap-1.5">
            <Zap size={14} className="text-amber-400" /> Recommended Strategy
          </span>
          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
            Grid Bot (Auto-Range)
          </span>
        </div>

        <div className="space-y-1.5 text-[11px] text-text-secondary bg-surface/80 p-2.5 rounded-lg border border-border/60">
          <div className="flex justify-between">
            <span>Target Price Range:</span>
            <strong className="text-text-primary">$0.240 – $0.320</strong>
          </div>
          <div className="flex justify-between">
            <span>Optimal Grid Grids:</span>
            <strong className="text-text-primary">12 Levels</strong>
          </div>
          <div className="flex justify-between">
            <span>Est. 24h Yield:</span>
            <strong className="text-emerald-400">+1.85% / day</strong>
          </div>
        </div>

        <NavLink
          to="/trading-bots?bot=grid"
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-primary text-background font-bold hover:bg-primary/90 transition-all shadow-md shadow-primary/20"
        >
          <Bot size={14} />
          Deploy Grid Bot Studio
          <ArrowRight size={14} />
        </NavLink>
      </div>

      {/* AI Intent Stream */}
      <div className="space-y-2">
        <span className="text-[10px] uppercase tracking-wider font-bold text-text-muted block">
          Gemini Signal Validation Matrix
        </span>
        <div className="space-y-2">
          <div className="p-2.5 rounded-lg bg-background/40 border border-border/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
              <span className="text-text-primary font-medium">13-Signal Consensus</span>
            </div>
            <span className="text-emerald-400 font-bold">84% Bullish</span>
          </div>

          <div className="p-2.5 rounded-lg bg-background/40 border border-border/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
              <span className="text-text-primary font-medium">SoSoValue ETF Net Inflow</span>
            </div>
            <span className="text-emerald-400 font-bold">+$428M</span>
          </div>

          <div className="p-2.5 rounded-lg bg-background/40 border border-border/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
              <span className="text-text-primary font-medium">Non-Custodial Session Delegation</span>
            </div>
            <span className="text-primary font-bold">Ready</span>
          </div>
        </div>
      </div>
    </div>
  );
};
