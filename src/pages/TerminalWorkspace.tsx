import React from 'react';
import { TradingChart } from '../components/TradingChart';
import { AiOrchestratorPanel } from '../components/AiOrchestratorPanel';
import { Briefcase } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useBotStore } from '../store/botStore';
import { useWave3Store } from '../store/wave3Store';

export const TerminalWorkspace: React.FC = () => {
  const botStore = useBotStore();
  const wave3Store = useWave3Store();
  
  const runningCount = 
    (wave3Store.isAgentRunning ? 1 : 0) +
    (botStore.gridBot.status === 'RUNNING' ? 1 : 0) +
    (botStore.signalBot.status === 'RUNNING' ? 1 : 0) +
    (botStore.marketMakerBot.status === 'RUNNING' ? 1 : 0);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-background">
      {/* MAIN WORKSPACE GRID */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        
        {/* LEFT / CENTER: CHART AREA (75% width on large screens) */}
        <div className="flex-1 lg:w-[75%] xl:w-[80%] flex flex-col min-h-0 overflow-hidden border-r border-border">
          {/* Chart View Container */}
          <div className="flex-1 min-h-0 relative bg-[#08090C]">
            <TradingChart 
              symbol="SOSO-USD" 
              market="perps"
              height={600} 
              className="h-full border-none rounded-none bg-transparent shadow-none" 
            />
          </div>
        </div>

        {/* RIGHT: AI ORCHESTRATOR PANEL (25% width on large screens) */}
        <div className="lg:w-[25%] xl:w-[20%] flex flex-col min-h-0 overflow-hidden bg-surface">
          <AiOrchestratorPanel />
        </div>
      </div>

      {/* BOTTOM QUICK ACCESS STRIP */}
      <div className="h-8 shrink-0 flex items-center justify-between px-4 bg-[#0B0E11] border-t border-border text-[10px] text-text-secondary select-none font-mono">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${runningCount > 0 ? 'bg-success' : 'bg-white/20'}`} />
          <span>Active Execution Daemons: <strong className="text-text-primary">{runningCount} Bot{runningCount !== 1 ? 's' : ''} Running</strong></span>
        </div>
        <NavLink
          to="/account?tab=bots"
          className="flex items-center gap-1 font-bold text-primary hover:underline hover:text-primary/80 transition-colors"
        >
          <Briefcase size={11} />
          <span>Manage Active Bots →</span>
        </NavLink>
      </div>
    </div>
  );
};
