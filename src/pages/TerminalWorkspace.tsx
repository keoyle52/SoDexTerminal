import React, { useState } from 'react';
import { TradingChart } from '../components/TradingChart';
import { TradingBots } from './TradingBots';
import { Positions } from './Positions';
import { BtcPredictorFlowDiagram } from '../components/BtcPredictorFlowDiagram';
import { Activity, Layers, TrendingUp, Cpu } from 'lucide-react';
import { cn } from '../lib/utils';

export const TerminalWorkspace: React.FC = () => {
  const [activeView, setActiveView] = useState<'chart' | 'signals'>('chart');

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-background p-2 md:p-3 gap-3">
      {/* TOP MAIN WORKSPACE GRID */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0 overflow-hidden">
        
        {/* LEFT / CENTER: CHART & AI OVERLAY (8 Cols) */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-3 min-h-0 overflow-hidden bg-surface border border-border rounded-2xl p-3 shadow-xl relative">
          {/* Chart Header Bar */}
          <div className="flex items-center justify-between shrink-0 border-b border-border/80 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                <Activity size={16} className="text-primary" /> BTC/USDT Perpetual
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
                Live SoDEX Feed
              </span>
            </div>

            {/* View Switcher */}
            <div className="flex items-center gap-1 p-1 bg-background/80 border border-border/80 rounded-lg">
              <button
                onClick={() => setActiveView('chart')}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all',
                  activeView === 'chart'
                    ? 'bg-primary/20 text-primary border border-primary/30 shadow-sm'
                    : 'text-text-muted hover:text-text-secondary'
                )}
              >
                <TrendingUp size={13} />
                Trading Chart
              </button>
              <button
                onClick={() => setActiveView('signals')}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all',
                  activeView === 'signals'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-sm'
                    : 'text-text-muted hover:text-text-secondary'
                )}
              >
                <Cpu size={13} />
                13-Signal AI Matrix
              </button>
            </div>
          </div>

          {/* View Container */}
          <div className="flex-1 min-h-0 relative rounded-xl overflow-hidden bg-background/40">
            {activeView === 'chart' ? (
              <div className="absolute inset-0">
                <TradingChart symbol="BTCUSDT" />
              </div>
            ) : (
              <div className="absolute inset-0 overflow-y-auto p-3">
                <BtcPredictorFlowDiagram />
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: UNIFIED EXECUTION STUDIO (4 Cols) */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col min-h-0 overflow-hidden bg-surface border border-border rounded-2xl shadow-xl">
          <TradingBots />
        </div>
      </div>

      {/* BOTTOM DOCKABLE POSITIONS & MONITOR PANEL */}
      <div className="h-64 shrink-0 flex flex-col bg-surface border border-border rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-1.5">
              <Layers size={14} className="text-primary" /> Active Positions & Execution History
            </span>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <Positions />
        </div>
      </div>
    </div>
  );
};
