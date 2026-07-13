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
      <div className="shrink-0 px-4 pt-4 border-b border-border bg-surface select-none">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-text-primary">Account & Risk Centre</h2>
            <p className="text-[10px] text-text-secondary">Unified portfolio manager, liquidation safety, and non-custodial Web3 credentials</p>
          </div>
        </div>

        {/* Sub Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('positions')}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 border-b-2 border-transparent text-xs font-semibold transition-all duration-150 rounded-none cursor-pointer',
              activeTab === 'positions'
                ? 'border-primary text-primary bg-primary-soft/10 font-bold'
                : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.01]'
            )}
          >
            <Briefcase size={13} />
            <span>Positions & Orders</span>
          </button>

          <button
            onClick={() => setActiveTab('risk')}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 border-b-2 border-transparent text-xs font-semibold transition-all duration-150 rounded-none cursor-pointer',
              activeTab === 'risk'
                ? 'border-success text-success bg-success-soft/10 font-bold'
                : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.01]'
            )}
          >
            <Shield size={13} />
            <span>Risk & VaR Analytics</span>
          </button>

          <button
            onClick={() => setActiveTab('wallet')}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 border-b-2 border-transparent text-xs font-semibold transition-all duration-150 rounded-none cursor-pointer',
              activeTab === 'wallet'
                ? 'border-primary text-primary bg-primary-soft/10 font-bold'
                : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.01]'
            )}
          >
            <Wallet size={13} />
            <span>Wallet & Security</span>
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-background">
        {activeTab === 'positions' && <Positions />}
        {activeTab === 'risk' && <RiskCentre />}
        {activeTab === 'wallet' && <Settings />}
      </div>
    </div>
  );
};
