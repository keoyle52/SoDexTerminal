import React, { useState } from 'react';
import { MarketIntel } from './MarketIntel';
import { Backtesting } from './Backtesting';
import { BarChart2, FlaskConical, Search } from 'lucide-react';
import { cn } from '../lib/utils';

export const ResearchHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'intel' | 'quant'>('intel');

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-background">
      {/* Top Header for Research Hub */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border bg-surface flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <Search size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-text-primary">Research Hub</h2>
            <p className="text-[10px] text-text-muted">Combined institutional market intelligence, ETF flows, and quantitative backtester</p>
          </div>
        </div>

        {/* Sub Tabs */}
        <div className="flex items-center gap-1 p-1 bg-background border border-border rounded-xl">
          <button
            onClick={() => setActiveTab('intel')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
              activeTab === 'intel'
                ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30 shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
            )}
          >
            <BarChart2 size={14} />
            Market Intel & ETF Flows
          </button>

          <button
            onClick={() => setActiveTab('quant')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
              activeTab === 'quant'
                ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30 shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
            )}
          >
            <FlaskConical size={14} />
            Quant Lab & Backtesting
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeTab === 'intel' && <MarketIntel />}
        {activeTab === 'quant' && <Backtesting />}
      </div>
    </div>
  );
};
