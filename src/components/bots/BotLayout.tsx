import React from 'react';
import { Play, StopCircle, Zap, Activity } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useRiskEnforcer } from '../../hooks/useRiskEnforcer';

interface BotLayoutProps {
  title: string;
  icon: React.ElementType;
  status: 'STOPPED' | 'RUNNING' | 'ERROR' | 'IDLE' | 'ARMED';
  symbol: string;
  market: 'spot' | 'perps';
  configPanel: React.ReactNode;
  statsPanel: React.ReactNode;
  logsPanel: React.ReactNode;
  howItWorksPanel?: React.ReactNode;
  isLocked: boolean;
  onStart: () => void;
  onStop: () => void;
  onAutoConfig?: () => void;
  autoConfigBusy?: boolean;
  currentPnl?: number;
  investment?: number;
}

export const BotLayout: React.FC<BotLayoutProps> = ({
  title, icon: Icon, status,
  configPanel, statsPanel, logsPanel, howItWorksPanel,
  isLocked, onStart, onStop, onAutoConfig, autoConfigBusy,
  currentPnl = 0, investment = 0
}) => {
  const [activeTab, setActiveTab] = React.useState<'dashboard' | 'howItWorks'>('dashboard');

  useRiskEnforcer({
    botName: title,
    unrealizedPnlUsdt: currentPnl,
    investmentUsdt: investment,
    onStop: () => {
      if (status === 'RUNNING') onStop();
    },
    isRunning: status === 'RUNNING'
  });

  return (
    <div className="h-full flex flex-col md:flex-row bg-[#08090C] text-text-primary animate-fade-in select-none">
      {/* LEFT: Content Area */}
      <div className="flex-1 flex flex-col min-w-0 border-b md:border-b-0 md:border-r border-border min-h-[450px] md:min-h-0 bg-[#0C0D10]">
        <div className="flex-1 flex flex-col p-4 overflow-hidden relative">
          <div className="flex-1 flex flex-col animate-fade-in h-full">
            {statsPanel}
            <div className="flex-1 overflow-hidden mt-3 bg-[#0B0E11] p-1.5 rounded-sm border border-border">
              {logsPanel}
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: Config Sidebar (Order Entry column feel) */}
      <div className="w-full md:w-[320px] shrink-0 bg-[#101317] flex flex-col overflow-y-auto border-t md:border-t-0 md:border-l border-border scrollbar-none">
        <div className="h-12 border-b border-border flex items-center justify-between px-4 bg-[#161A20] sticky top-0 z-10 select-none">
          <h2 className="text-xs font-bold flex items-center gap-1.5"><Icon className="text-text-secondary" size={14}/> {title}</h2>
          <div className={cn("px-1.5 py-0.2 rounded-sm text-[9px] font-bold uppercase border", 
            status === 'RUNNING' ? 'bg-success/5 border-success/35 text-success animate-pulse' :
            status === 'ERROR' ? 'bg-danger/10 border-danger/35 text-danger' : 'bg-white/5 border-white/10 text-text-secondary'
          )}>
            {status}
          </div>
        </div>
        
        <div className="p-4 flex-1 flex flex-col gap-4">
          <div className="space-y-3">
            {configPanel}
          </div>

          <div className="mt-auto pt-4">
            {!isLocked ? (
               <button 
                 onClick={onStart} 
                 className="w-full h-10 bg-primary text-white font-bold rounded-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5 uppercase text-xs cursor-pointer select-none"
               >
                 <Play size={14} /> <span>Start Bot</span>
               </button>
            ) : (
               <button 
                 onClick={onStop} 
                 className="w-full h-10 bg-danger text-white font-bold rounded-sm hover:bg-danger/90 transition-colors flex items-center justify-center gap-1.5 uppercase text-xs cursor-pointer select-none"
               >
                 <StopCircle size={14} /> <span>Stop Bot</span>
               </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
