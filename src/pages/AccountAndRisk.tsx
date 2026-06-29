import React, { useState } from 'react';
import { Positions } from './Positions';
import { RiskCentre } from './RiskCentre';
import { Settings } from './Settings';
import { Briefcase, Shield, Wallet } from 'lucide-react';
import { cn } from '../lib/utils';

export const AccountAndRisk: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'positions' | 'risk' | 'wallet'>('positions');

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-background">
      {/* Top Navigation Bar for Account & Risk Hub */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border bg-surface flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
            <Shield size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-text-primary">Account & Risk Centre</h2>
            <p className="text-[10px] text-text-muted">Unified portfolio manager, liquidation safety, and non-custodial Web3 credentials</p>
          </div>
        </div>

        {/* Sub Tabs */}
        <div className="flex items-center gap-1 p-1 bg-background border border-border rounded-xl">
          <button
            onClick={() => setActiveTab('positions')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
              activeTab === 'positions'
                ? 'bg-primary/15 text-primary border border-primary/30 shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
            )}
          >
            <Briefcase size={14} />
            Positions & Orders
          </button>

          <button
            onClick={() => setActiveTab('risk')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
              activeTab === 'risk'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
            )}
          >
            <Shield size={14} />
            Risk & VaR Analytics
          </button>

          <button
            onClick={() => setActiveTab('wallet')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
              activeTab === 'wallet'
                ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30 shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
            )}
          >
            <Wallet size={14} />
            Wallet & Security
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeTab === 'positions' && <Positions />}
        {activeTab === 'risk' && <RiskCentre />}
        {activeTab === 'wallet' && <Settings />}
      </div>
    </div>
  );
};
