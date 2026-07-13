import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Sparkles, Grid2X2, Clock, Repeat, Layers, Activity, Play, StopCircle, 
  ShieldAlert, ShieldCheck, Cpu, Brain, X, Zap
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useWave3Store } from '../store/wave3Store';
import { useRiskStore } from '../store/riskStore';
import { NumberDisplay } from '../components/common/NumberDisplay';
import { cn } from '../lib/utils';
import { BotRiskSetupModal } from '../components/common/BotRiskSetupModal';

// Components
import { GridBot } from './GridBot';
import { DcaBot } from './DcaBot';
import { TwapBot } from './TwapBot';
import { MarketMakerBot } from './MarketMakerBot';
import { SignalBot } from './SignalBot';
import { BotsHowItWorks } from '../components/bots/BotsHowItWorks';

// --- Wave 3 Autonomous Agent Component ---
const Wave3AgentConsole: React.FC = () => {
  const w3 = useWave3Store();
  const { currentRiskLevel } = useRiskStore();
  const [showPreFlight, setShowPreFlight] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const isSoso = w3.targetCoin.startsWith('SOSO');

  const handleStartRequest = () => {
    if (w3.isAgentRunning) {
      w3.setAgentRunning(false);
    } else {
      setShowPreFlight(true);
    }
  };

  const handleConfirmStart = () => {
    setShowPreFlight(false);
    w3.setAgentRunning(true);
  };

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-4 select-none">
        <div className="flex-1 space-y-4">
          <div className="p-5 rounded-sm bg-surface border border-border relative overflow-hidden">
            <div className="flex items-start justify-between mb-6 relative z-10">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-text-primary flex items-center gap-2 tracking-tight">
                    <Sparkles className="text-purple-400" size={18} />
                    Wave 3 Autonomous Agent
                  </h2>
                  <button 
                    onClick={() => setShowInfo(true)} 
                    className="px-2 py-0.5 bg-white/5 hover:bg-white/10 border border-border rounded-sm text-[10px] font-semibold text-text-secondary transition-colors cursor-pointer"
                  >
                    How it works
                  </button>
                </div>
                <p className="text-xs text-text-secondary mt-1">Fully autonomous AI agent. Select an asset and let Gemini orchestrate your portfolio 24/7.</p>
              </div>
              
              <div className={cn(
                "px-2.5 py-1 rounded-sm border flex items-center gap-1.5 text-xs font-bold shadow-sm transition-colors duration-300",
                currentRiskLevel === 'SAFE' ? "bg-success/5 border-success/30 text-success" :
                currentRiskLevel === 'ELEVATED' ? "bg-warning/5 border-warning/30 text-warning" :
                "bg-danger/10 border-danger/30 text-danger animate-pulse"
              )}>
                {currentRiskLevel === 'SAFE' ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
                Risk: {currentRiskLevel}
              </div>
            </div>

            <div className="space-y-4 relative z-10">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5 block">Target Asset</label>
                  <div className="w-full bg-[#0B0E11] border border-border rounded-sm h-9 px-3 font-bold text-text-primary flex items-center justify-between opacity-80 font-mono text-xs">
                    <div className="flex items-center gap-2">
                      <img src="https://cryptologos.cc/logos/bitcoin-btc-logo.svg" className="w-4 h-4" alt="BTC" />
                      <span>BTC-USD</span>
                    </div>
                    <span className="text-[9px] text-purple-400 border border-purple-500/20 px-1.5 py-0.2 rounded-sm bg-purple-500/5">FIXED</span>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5 block">Market</label>
                  <div className="flex bg-[#0B0E11] p-0.5 rounded-sm border border-border h-9">
                    <button 
                      onClick={() => w3.setMarket('spot')} 
                      className={cn("flex-1 text-xs font-semibold rounded-sm transition-colors cursor-pointer", w3.market === 'spot' ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary')}
                    >
                      Spot
                    </button>
                    <button 
                      onClick={() => !isSoso && w3.setMarket('perps')} 
                      disabled={isSoso} 
                      className={cn("flex-1 text-xs font-semibold rounded-sm transition-colors cursor-pointer", w3.market === 'perps' ? 'bg-primary text-white' : isSoso ? 'opacity-30 cursor-not-allowed' : 'text-text-secondary hover:text-text-primary')}
                    >
                      Perps
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 font-mono">
                <div>
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5 block">Investment</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-xs">$</span>
                    <input 
                      type="number" 
                      value={w3.investment} 
                      onChange={(e) => w3.setInvestment(Number(e.target.value))} 
                      className="w-full bg-[#0B0E11] border border-border rounded-sm h-9 pl-7 pr-3 text-xs font-bold text-text-primary focus:outline-none focus:border-primary transition-colors" 
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5 block">Max Drawdown</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={w3.maxDrawdownPct} 
                      onChange={(e) => w3.setMaxDrawdownPct(Number(e.target.value))} 
                      className="w-full bg-[#0B0E11] border border-border rounded-sm h-9 px-3 pr-7 text-xs font-bold text-text-primary focus:outline-none focus:border-primary transition-colors" 
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-xs">%</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-sm bg-[#0B0E11] border border-border">
                  <div className="text-[9px] text-text-secondary uppercase tracking-widest font-bold mb-1">Live Regime</div>
                  <div className="text-sm font-bold text-text-primary">{w3.currentRegime.replace('_', ' ')}</div>
                </div>
                <div className="p-3 rounded-sm bg-[#0B0E11] border border-border">
                  <div className="text-[9px] text-text-secondary uppercase tracking-widest font-bold mb-1">Active Action</div>
                  <div className="text-sm font-bold text-purple-400">{w3.activeAction.replace('_', ' ')}</div>
                </div>
              </div>

              <button
                onClick={handleStartRequest}
                className={cn(
                  "w-full py-3 rounded-sm font-bold text-sm flex items-center justify-center gap-2 transition-all duration-300 relative overflow-hidden cursor-pointer",
                  w3.isAgentRunning 
                    ? "bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20"
                    : "bg-purple-600 text-white hover:bg-purple-500 border border-purple-500"
                )}
              >
                {w3.isAgentRunning && <span className="absolute inset-0 bg-danger/5 animate-pulse" />}
                {w3.isAgentRunning ? <StopCircle size={16} /> : <Play size={16} fill="currentColor" />}
                {w3.isAgentRunning ? 'HALT AUTONOMOUS AGENT' : 'START AUTONOMOUS AGENT'}
              </button>
            </div>
          </div>

          {w3.activePosition && (
            <div className="p-4 rounded-sm bg-surface border border-border">
              <h3 className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <Activity size={12} /> Live Bot Execution
              </h3>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-bold text-text-primary font-mono">{w3.activePosition.botType}</div>
                  <div className="text-[11px] text-text-secondary mt-0.5 font-mono">
                    Size: ${w3.activePosition.size} • Entry: ${w3.activePosition.entryPrice.toFixed(4)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] text-text-secondary uppercase font-bold mb-0.5">Unrealized PnL</div>
                  <NumberDisplay 
                    value={w3.activePosition.pnl} 
                    prefix="$" 
                    decimals={4} 
                    trend={w3.activePosition.pnl > 0 ? "up" : w3.activePosition.pnl < 0 ? "down" : "neutral"} 
                    className="text-lg font-bold" 
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col min-h-[400px] p-4 rounded-sm bg-[#0B0E11] border border-border relative overflow-hidden">
          <h3 className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <Cpu size={12} /> Gemini Orchestrator Log
          </h3>
          
          <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-none font-mono text-[11px]">
            {w3.logs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-text-muted/40 gap-2">
                <Brain size={32} className="opacity-20" />
                <p className="text-xs font-semibold">Agent offline. Waiting for initialization.</p>
              </div>
            ) : (
              w3.logs.map((log) => (
                <div key={log.id} className="flex gap-2.5 animate-fade-in">
                  <span className="text-text-muted font-mono text-[10px] shrink-0 mt-0.5">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, fractionalSecondDigits: 2 })}
                  </span>
                  <span className={cn(
                    "font-medium",
                    log.type === 'ACTION' ? "text-purple-400" :
                    log.type === 'SUCCESS' ? "text-success" :
                    log.type === 'WARNING' ? "text-warning" : "text-text-secondary"
                  )}>
                    {log.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      
      <BotRiskSetupModal 
        isOpen={showPreFlight} 
        title="Pre-Flight Risk Check"
        botName="Wave 3 Agent" 
        onCancel={() => setShowPreFlight(false)} 
        onConfirm={handleConfirmStart} 
      />

      {showInfo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <div className="w-[450px] max-w-full bg-surface border border-border rounded-sm shadow-xl overflow-hidden">
            <div className="p-4 bg-[#101317] border-b border-border flex justify-between items-center">
              <h3 className="text-sm font-bold flex items-center gap-1.5"><Sparkles className="text-primary" size={16} /> How Wave 3 Works</h3>
              <button onClick={() => setShowInfo(false)} className="p-1 hover:bg-white/5 rounded-sm cursor-pointer"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-3 text-xs text-text-secondary leading-relaxed font-sans">
              <p>Wave 3 is a fully autonomous quantitative orchestrator that connects directly to the exchange's data stream. It analyzes real-time <strong className="text-text-primary font-mono">1-minute k-lines</strong> every 10 seconds.</p>
              
              <div className="space-y-2 bg-[#0B0E11] p-3 rounded-sm border border-border font-mono text-[11px]">
                <div className="flex gap-2"><div className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" /><div><strong>High Volatility:</strong> Max/min spread &gt; 1.5% in 14m. Deploys <strong className="text-purple-400">Grid Bot</strong> to capture wide price swings.</div></div>
                <div className="flex gap-2"><div className="w-1 h-1 rounded-full bg-success mt-1.5 shrink-0" /><div><strong>Trending Up (RSI &lt; 40):</strong> Oversold. Deploys <strong className="text-purple-400">DCA Bot</strong> to accumulate Long positions on dip.</div></div>
                <div className="flex gap-2"><div className="w-1 h-1 rounded-full bg-danger mt-1.5 shrink-0" /><div><strong>Trending Down (RSI &gt; 60):</strong> Overbought. Deploys <strong className="text-purple-400">Signal Bot</strong> to execute Short positions.</div></div>
                <div className="flex gap-2"><div className="w-1 h-1 rounded-full bg-warning mt-1.5 shrink-0" /><div><strong>Consolidation (RSI 40-60):</strong> Sideways. Deploys <strong className="text-purple-400">Market Maker Bot</strong> to farm tight bid/ask spreads.</div></div>
              </div>

              <p>Positions are automatically monitored and closed out when target profits are reached. <strong className="text-text-primary">Flash Crash Protection</strong> instantly liquidates everything if the price drops &gt;3% in a single tick.</p>
            </div>
            <div className="p-3 border-t border-border bg-[#101317] flex justify-end">
              <button onClick={() => setShowInfo(false)} className="px-4 py-2 bg-primary text-white font-bold rounded-sm text-xs hover:bg-primary/90 transition-colors cursor-pointer">Understood</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

type BotTab = 'wave3' | 'grid' | 'dca' | 'twap' | 'marketmaker' | 'signal' | 'howItWorks';

const BOTS_CONFIG: Record<BotTab, { label: string; icon: React.ElementType; component: React.ComponentType | null }> = {
  wave3: { label: 'Wave 3 Autonomous', icon: Sparkles, component: null },
  grid: { label: 'Grid Bot', icon: Grid2X2, component: GridBot },
  dca: { label: 'DCA Bot', icon: Clock, component: DcaBot },
  twap: { label: 'TWAP Bot', icon: Repeat, component: TwapBot },
  marketmaker: { label: 'Market Maker', icon: Layers, component: MarketMakerBot },
  signal: { label: 'Signal Bot', icon: Activity, component: SignalBot },
  howItWorks: { label: 'How it Works', icon: ShieldCheck, component: BotsHowItWorks },
};

export const TradingBots: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get('bot') as BotTab) || 'wave3';

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden relative">
      <div className="shrink-0 px-4 pt-4 border-b border-border bg-surface select-none">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-sm font-bold text-text-primary">Trading Execution Studio</h1>
            <p className="text-[10px] text-text-secondary">Deploy pre-configured algorithmic bot daemons or initialize autonomous mode.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          {(Object.entries(BOTS_CONFIG) as [BotTab, typeof BOTS_CONFIG[BotTab]][]).map(([key, config]) => {
            const Icon = config.icon;
            const isActive = currentTab === key;
            return (
              <button
                key={key}
                onClick={() => setSearchParams({ bot: key })}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 border-b-2 border-transparent text-xs font-semibold transition-all duration-150 whitespace-nowrap rounded-none cursor-pointer",
                  isActive 
                    ? key === 'wave3'
                      ? "border-purple-400 text-purple-400 bg-purple-500/5 font-bold"
                      : "border-primary text-primary bg-primary-soft/10 font-bold"
                    : "text-text-secondary hover:text-text-primary hover:bg-white/[0.01]"
                )}
              >
                <Icon size={13} />
                <span>{config.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 relative z-10 scrollbar-none">
        {currentTab === 'wave3' ? (
          <Wave3AgentConsole />
        ) : (
          (() => {
            const ActiveComponent = BOTS_CONFIG[currentTab]?.component;
            return ActiveComponent ? (
               <div className="w-full bg-surface border border-border rounded-sm overflow-hidden">
                 <ActiveComponent />
               </div>
            ) : null;
          })()
        )}
      </div>
    </div>
  );
};
