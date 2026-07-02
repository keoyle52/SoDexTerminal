import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Sparkles, Grid2X2, Clock, Repeat, Layers, Activity, Play, StopCircle, ShieldAlert, ShieldCheck, Cpu, Brain } from 'lucide-react';
import { useWave3Store } from '../store/wave3Store';
import { useRiskStore } from '../store/riskStore';
import { startWave3Engine, stopWave3Engine } from '../api/wave3Engine';
import { SymbolSelector } from '../components/common/SymbolSelector';
import { cn } from '../lib/utils';
import { NumberDisplay } from '../components/common/NumberDisplay';

// --- Wave 3 Autonomous Agent Component ---
const Wave3AgentConsole: React.FC = () => {
  const { isAgentRunning, setAgentRunning, targetCoin, setTargetCoin, currentRegime, activeAction, logs, activePosition } = useWave3Store();
  const { currentRiskLevel } = useRiskStore();

  useEffect(() => {
    if (isAgentRunning) {
      startWave3Engine();
    } else {
      stopWave3Engine();
    }
    return () => stopWave3Engine();
  }, [isAgentRunning]);

  return (
    <div className="flex flex-col lg:flex-row gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Left: Control Center */}
      <div className="flex-1 space-y-6">
        <div className="p-6 rounded-2xl bg-surface/50 border border-border/50 backdrop-blur-xl shadow-2xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
          
          <div className="flex items-start justify-between mb-8 relative z-10">
            <div>
              <h2 className="text-3xl font-black text-text-primary flex items-center gap-3 tracking-tight">
                <Sparkles className="text-purple-400" size={28} />
                Wave 3 <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400">Autonomous</span>
              </h2>
              <p className="text-sm text-text-muted mt-2 font-medium">Fully autonomous AI agent. Select an asset and let Gemini orchestrate your portfolio 24/7.</p>
            </div>
            
            <div className={cn(
              "px-4 py-2 rounded-full border flex items-center gap-2 text-sm font-bold shadow-lg transition-colors duration-500",
              currentRiskLevel === 'SAFE' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
              currentRiskLevel === 'ELEVATED' ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
              "bg-red-500/20 border-red-500/30 text-red-400 animate-pulse"
            )}>
              {currentRiskLevel === 'SAFE' ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
              Risk: {currentRiskLevel}
            </div>
          </div>

          <div className="space-y-6 relative z-10">
            <div>
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2 block">Target Asset</label>
              <div className="w-64">
                <SymbolSelector market="perps" value={targetCoin.replace('-USD', '')} onChange={(c) => setTargetCoin(c + '-USD')} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-background/40 border border-border/50">
                <div className="text-[10px] text-text-muted uppercase tracking-widest font-bold mb-1">Live Regime</div>
                <div className="text-lg font-bold text-text-primary">{currentRegime.replace('_', ' ')}</div>
              </div>
              <div className="p-4 rounded-xl bg-background/40 border border-border/50">
                <div className="text-[10px] text-text-muted uppercase tracking-widest font-bold mb-1">Active Action</div>
                <div className="text-lg font-bold text-purple-400">{activeAction.replace('_', ' ')}</div>
              </div>
            </div>

            <button
              onClick={() => setAgentRunning(!isAgentRunning)}
              className={cn(
                "w-full py-4 rounded-xl font-black text-lg flex items-center justify-center gap-3 transition-all duration-300 shadow-xl relative overflow-hidden",
                isAgentRunning 
                  ? "bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20"
                  : "bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500 border border-purple-400/50 hover:shadow-purple-500/25"
              )}
            >
              {isAgentRunning && <span className="absolute inset-0 bg-red-400/10 animate-pulse" />}
              {isAgentRunning ? <StopCircle size={24} /> : <Play size={24} fill="currentColor" />}
              {isAgentRunning ? 'HALT AUTONOMOUS AGENT' : 'START AUTONOMOUS AGENT'}
            </button>
          </div>
        </div>

        {/* Active Position Card */}
        {activePosition && (
          <div className="p-6 rounded-2xl bg-surface/50 border border-border/50 backdrop-blur-xl animate-in slide-in-from-bottom-2">
            <h3 className="text-sm font-bold text-text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
              <Activity size={16} /> Live Bot Execution
            </h3>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-black text-text-primary">{activePosition.botType}</div>
                <div className="text-xs text-text-secondary mt-1">Size: ${activePosition.size} • Entry: ${activePosition.entryPrice.toFixed(4)}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-text-muted uppercase font-bold mb-1">Unrealized PnL</div>
                <NumberDisplay value={activePosition.pnl} prefix="$" decimals={4} trend={activePosition.pnl > 0 ? "up" : activePosition.pnl < 0 ? "down" : "neutral"} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right: Thought Process & Logs */}
      <div className="flex-1 flex flex-col min-h-[500px] p-6 rounded-2xl bg-[#0a0a0c] border border-border/40 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-indigo-500 to-emerald-500 opacity-50" />
        <h3 className="text-sm font-bold text-text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
          <Cpu size={16} /> Gemini Orchestrator Log
        </h3>
        
        <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
          {logs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-text-muted/50 gap-3">
              <Brain size={48} className="opacity-20" />
              <p className="text-sm font-medium">Agent offline. Waiting for initialization.</p>
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex gap-3 text-sm animate-in fade-in slide-in-from-left-2 duration-300">
                <span className="text-text-muted/50 font-mono text-xs shrink-0 mt-0.5">
                  {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, fractionalSecondDigits: 2 })}
                </span>
                <span className={cn(
                  "font-medium",
                  log.type === 'ACTION' ? "text-purple-400" :
                  log.type === 'SUCCESS' ? "text-emerald-400" :
                  log.type === 'WARNING' ? "text-amber-400" : "text-text-secondary"
                )}>
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// --- Generic Bot Configuration Form Placeholder (Apple-Grade) ---
const GenericBotForm: React.FC<{ title: string; description: string; icon: React.ElementType; color: string }> = ({ title, description, icon: Icon, color }) => {
  const { isRiskShieldActive, setRiskShieldActive } = useRiskStore();

  return (
    <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="p-8 rounded-3xl bg-surface/30 border border-border/40 backdrop-blur-2xl shadow-2xl">
        
        <div className="flex items-center gap-4 mb-8">
          <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br shadow-lg", color)}>
            <Icon size={28} className="text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-text-primary tracking-tight">{title}</h2>
            <p className="text-text-secondary mt-1 font-medium">{description}</p>
          </div>
        </div>

        {/* Global Risk Shield Toggle */}
        <div className="mb-8 p-4 rounded-2xl bg-background/50 border border-border/50 flex items-center justify-between group hover:border-border transition-colors">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg transition-colors", isRiskShieldActive ? "bg-emerald-500/20 text-emerald-400" : "bg-text-muted/10 text-text-muted")}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-text-primary">Global Flash Crash Protection</h4>
              <p className="text-xs text-text-secondary">Automatically halts bot if market drops &gt;3% instantly.</p>
            </div>
          </div>
          <button 
            onClick={() => setRiskShieldActive(!isRiskShieldActive)}
            className={cn(
              "w-12 h-6 rounded-full transition-colors relative",
              isRiskShieldActive ? "bg-emerald-500" : "bg-border"
            )}
          >
            <div className={cn(
              "absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-300",
              isRiskShieldActive ? "translate-x-6" : "translate-x-0"
            )} />
          </button>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Asset Pair</label>
              <div className="h-12 flex items-center px-4 rounded-xl bg-background border border-border text-text-primary font-bold">
                BTC / USD
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Investment</label>
              <div className="h-12 flex items-center px-4 rounded-xl bg-background border border-border text-text-primary font-bold">
                $5,000.00
              </div>
            </div>
          </div>

          <button className="w-full h-14 rounded-xl bg-primary text-background font-black text-lg hover:bg-primary/90 transition-colors shadow-xl shadow-primary/20">
            DEPLOY {title.toUpperCase()}
          </button>
        </div>
      </div>
    </div>
  );
};

type BotTab = 'wave3' | 'grid' | 'dca' | 'twap' | 'marketmaker' | 'signal';

const BOTS_CONFIG: Record<BotTab, { label: string; icon: React.ElementType; color: string; desc: string }> = {
  wave3: { label: 'Wave 3 Autonomous', icon: Sparkles, color: 'from-purple-500 to-indigo-600', desc: 'Fully autonomous AI orchestrator.' },
  grid: { label: 'Grid Bot', icon: Grid2X2, color: 'from-cyan-500 to-blue-600', desc: 'High-frequency price volatility grid trading.' },
  dca: { label: 'DCA Bot', icon: Clock, color: 'from-emerald-500 to-teal-600', desc: 'Automated Dollar Cost Averaging capital accumulation.' },
  twap: { label: 'TWAP Bot', icon: Repeat, color: 'from-pink-500 to-rose-600', desc: 'Time-Weighted Average Price execution for whales.' },
  marketmaker: { label: 'Market Maker', icon: Layers, color: 'from-amber-500 to-orange-600', desc: 'Provide liquidity and capture spread.' },
  signal: { label: 'Signal Bot', icon: Activity, color: 'from-blue-500 to-indigo-600', desc: 'Execute complex TradingView/Webhook signals.' },
};

export const TradingBots: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get('bot') as BotTab) || 'wave3';

  const handleTabChange = (tab: BotTab) => {
    setSearchParams({ bot: tab });
  };

  const activeConfig = BOTS_CONFIG[currentTab];

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden relative">
      {/* Premium Ambient Background */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Header & Navigation */}
      <div className="shrink-0 px-8 pt-8 pb-4 border-b border-border/40 relative z-10">
        <h1 className="text-4xl font-black text-text-primary tracking-tight mb-6">Trading Execution</h1>
        
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-2">
          {(Object.entries(BOTS_CONFIG) as [BotTab, typeof activeConfig][]).map(([key, config]) => {
            const Icon = config.icon;
            const isActive = currentTab === key;
            return (
              <button
                key={key}
                onClick={() => handleTabChange(key)}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-300 whitespace-nowrap",
                  isActive 
                    ? key === 'wave3' 
                        ? "bg-purple-500/15 text-purple-400 border border-purple-500/30 shadow-lg shadow-purple-500/10"
                        : "bg-primary/15 text-primary border border-primary/30 shadow-lg shadow-primary/10"
                    : "bg-surface/50 text-text-muted hover:text-text-primary border border-transparent hover:bg-surface"
                )}
              >
                <Icon size={16} className={cn(isActive && key === 'wave3' ? "animate-pulse" : "")} />
                {config.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-8 relative z-10 custom-scrollbar">
        {currentTab === 'wave3' ? (
          <Wave3AgentConsole />
        ) : (
          <GenericBotForm 
            title={activeConfig.label} 
            description={activeConfig.desc} 
            icon={activeConfig.icon}
            color={activeConfig.color}
          />
        )}
      </div>
    </div>
  );
};
