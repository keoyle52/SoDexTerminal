import React from 'react';
import { TradingChart } from '../components/TradingChart';
import { AiOrchestratorPanel } from '../components/AiOrchestratorPanel';
import { Activity, Briefcase } from 'lucide-react';
import { NavLink } from 'react-router-dom';

export const TerminalWorkspace: React.FC = () => {

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-background p-2 md:p-3 gap-3">
        {/* LEFT / CENTER: CHART & AI OVERLAY (8 Cols) */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-3 min-h-0 overflow-hidden bg-surface border border-border rounded-2xl p-3 shadow-xl relative">
          {/* Chart Header Bar */}
          <div className="flex items-center justify-between shrink-0 border-b border-border/80 pb-2.5 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                <Activity size={16} className="text-primary" /> SOSO/USD Perpetual
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
                Live SoDEX Feed
              </span>
            </div>
          </div>

          {/* View Container */}
          <div className="flex-1 min-h-0 relative rounded-xl overflow-hidden bg-background/40">
            <div className="absolute inset-0">
              <TradingChart symbol="SOSO-USD" />
            </div>
          </div>
        </div>

        {/* RIGHT: AI ORCHESTRATOR RECOMMENDATIONS PANEL (4 Cols) */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col min-h-0 overflow-hidden bg-surface border border-border rounded-2xl shadow-xl">
          <AiOrchestratorPanel />
        </div>
      </div>

      {/* BOTTOM QUICK ACCESS STRIP */}
      <div className="h-10 shrink-0 flex items-center justify-between px-4 bg-surface border border-border rounded-xl text-xs text-text-muted font-medium">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Active Execution Daemons: <strong className="text-text-primary">2 Bots Running</strong></span>
        </div>
        <NavLink
          to="/positions"
          className="flex items-center gap-1.5 font-bold text-primary hover:underline"
        >
          <Briefcase size={13} />
          View Full Positions & Orders Manager →
        </NavLink>
      </div>
    </div>
  );
};
