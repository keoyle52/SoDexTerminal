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
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-3.5 gap-3.5 bg-surface text-xs leading-relaxed border-t lg:border-t-0 select-none">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-sm bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Brain size={14} />
          </div>
          <div>
            <h3 className="font-bold text-text-primary text-xs flex items-center gap-1">
              Gemini AI Orchestrator
            </h3>
            <p className="text-[9px] text-text-muted">Real-time regime classification & trade triggers</p>
          </div>
        </div>
        <button
          onClick={handleReanalyze}
          disabled={analyzing}
          className="flex items-center gap-1 px-2 py-1 rounded-sm bg-white/5 text-text-primary border border-border hover:bg-white/10 transition-all font-semibold cursor-pointer"
        >
          <Sparkles size={11} className={cn(analyzing && 'animate-spin')} />
          <span className="text-[10px]">{analyzing ? 'Analyzing...' : 'Re-Analyze'}</span>
        </button>
      </div>

      {/* Market Regime Card */}
      <div className="p-3 rounded-sm bg-[#0B0E11] border border-border space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[9px] uppercase tracking-wider font-bold text-text-secondary flex items-center gap-1">
            <Cpu size={11} /> Live Market Regime
          </span>
          <span className="px-1.5 py-0.2 rounded-sm bg-success-soft text-success border border-success/20 font-bold text-[9px]">
            Accumulation / Low Volatility
          </span>
        </div>
        <p className="text-text-primary font-bold text-xs">SOSO/USDT Consolidation Phase</p>
        <p className="text-text-secondary text-[10px] leading-normal font-sans">
          Gemini AI analysis detects tight 14-period Bollinger Compression near $0.28. High probability of grid arbitrage opportunities.
        </p>
      </div>

      {/* AI Recommendation Box */}
      <div className="p-3 rounded-sm bg-[#161A20] border border-border space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="font-bold text-text-primary flex items-center gap-1">
            <Zap size={13} className="text-warning" /> Recommended Strategy
          </span>
          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-sm bg-warning/10 text-warning border border-warning/20">
            Grid Bot (Auto-Range)
          </span>
        </div>

        <div className="space-y-1 text-[10px] text-text-secondary bg-[#0B0E11] p-2 rounded-sm border border-border/60 font-mono">
          <div className="flex justify-between">
            <span>Target Price Range:</span>
            <strong className="text-text-primary">$0.240 – $0.320</strong>
          </div>
          <div className="flex justify-between">
            <span>Optimal Grid Levels:</span>
            <strong className="text-text-primary">12 Levels</strong>
          </div>
          <div className="flex justify-between">
            <span>Est. 24h Yield:</span>
            <strong className="text-success font-bold">+1.85% / day</strong>
          </div>
        </div>

        <NavLink
          to="/trading-bots?bot=grid"
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-sm bg-primary text-white font-bold hover:bg-primary/95 transition-all text-xs h-8"
        >
          <Bot size={13} />
          <span>Deploy Grid Bot Studio</span>
          <ArrowRight size={12} />
        </NavLink>
      </div>

      {/* AI Intent Stream */}
      <div className="space-y-1.5">
        <span className="text-[9px] uppercase tracking-wider font-bold text-text-muted block">
          Gemini Signal Validation Matrix
        </span>
        <div className="space-y-1.5">
          <div className="p-2 rounded-sm bg-[#0B0E11] border border-border/60 flex items-center justify-between font-mono">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={12} className="text-success shrink-0" />
              <span className="text-text-secondary font-sans">13-Signal Consensus</span>
            </div>
            <span className="text-success font-bold">84% Bullish</span>
          </div>

          <div className="p-2 rounded-sm bg-[#0B0E11] border border-border/60 flex items-center justify-between font-mono">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={12} className="text-success shrink-0" />
              <span className="text-text-secondary font-sans">SoSoValue ETF Net Inflow</span>
            </div>
            <span className="text-success font-bold">+$428M</span>
          </div>

          <div className="p-2 rounded-sm bg-[#0B0E11] border border-border/60 flex items-center justify-between font-mono">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={12} className="text-success shrink-0" />
              <span className="text-text-secondary font-sans">Session Delegation</span>
            </div>
            <span className="text-primary font-bold">Ready</span>
          </div>
        </div>
      </div>
    </div>
  );
};
