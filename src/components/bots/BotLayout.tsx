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
    <div className="h-full flex flex-col md:flex-row bg-[#0b0b0f] text-text-primary animate-in fade-in duration-500">
      {/* LEFT: Content Area */}
      <div className="flex-1 flex flex-col min-w-0 border-b md:border-b-0 md:border-r border-border/40 min-h-[500px] md:min-h-0 bg-background/50">
        
        {howItWorksPanel && (
          <div className="flex border-b border-border/40 px-4 pt-2 gap-2 bg-surface/20">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={cn("px-4 py-2 text-sm font-bold border-b-2 transition-colors", activeTab === 'dashboard' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-primary')}
            >
              Dashboard
            </button>
            <button 
              onClick={() => setActiveTab('howItWorks')}
              className={cn("px-4 py-2 text-sm font-bold border-b-2 transition-colors", activeTab === 'howItWorks' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-primary')}
            >
              How It Works
            </button>
          </div>
        )}

        <div className="flex-1 flex flex-col p-4 overflow-hidden relative">
          {activeTab === 'howItWorks' && howItWorksPanel ? (
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 animate-in fade-in duration-300">
              {howItWorksPanel}
            </div>
          ) : (
            <div className="flex-1 flex flex-col animate-in fade-in duration-300 h-full">
              {statsPanel}
              <div className="flex-1 overflow-hidden mt-4 bg-surface/30 p-1 rounded-xl border border-border/50">
                {logsPanel}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Config Sidebar */}
      <div className="w-full md:w-[360px] shrink-0 bg-surface/20 flex flex-col overflow-y-auto custom-scrollbar">
        <div className="p-5 border-b border-border/40 flex items-center justify-between bg-surface/40 backdrop-blur-md sticky top-0 z-10">
          <h2 className="text-lg font-black flex items-center gap-2"><Icon className="text-primary" size={20}/> {title}</h2>
          <div className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase", 
            status === 'RUNNING' ? 'bg-emerald-500/20 text-emerald-400' :
            status === 'ERROR' ? 'bg-red-500/20 text-red-400' : 'bg-surface-2 text-text-muted'
          )}>
            {status}
          </div>
        </div>
        
        <div className="p-5 flex-1 flex flex-col gap-6">
          {onAutoConfig && !isLocked && (
             <button onClick={onAutoConfig} disabled={autoConfigBusy} className="w-full py-3 border border-purple-500/30 text-purple-400 font-bold rounded-xl hover:bg-purple-500/10 transition-colors flex items-center justify-center gap-2 text-xs">
               {autoConfigBusy ? <Activity size={14} className="animate-spin" /> : <Zap size={14} />} 
               {autoConfigBusy ? "Analyzing..." : "AI Auto-Configure"}
             </button>
          )}
          <div className="space-y-4">
            {configPanel}
          </div>

          <div className="mt-auto space-y-4 pt-6">
            {!isLocked ? (
               <button onClick={onStart} className="w-full py-4 bg-primary text-background font-black rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 uppercase tracking-widest text-sm">
                 <Play size={18} /> Start Bot
               </button>
            ) : (
               <button onClick={onStop} className="w-full py-4 bg-red-500 text-background font-black rounded-xl hover:bg-red-600 transition-all shadow-lg shadow-red-500/20 flex items-center justify-center gap-2 uppercase tracking-widest text-sm">
                 <StopCircle size={18} /> Stop Bot
               </button>
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
};
