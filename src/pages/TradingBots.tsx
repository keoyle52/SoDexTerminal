import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Sparkles, Grid2X2, Clock, Repeat, Layers, Activity, Play, StopCircle, 
  ShieldAlert, ShieldCheck, Cpu, Brain, Newspaper, X
} from 'lucide-react';
import { useWave3Store } from '../store/wave3Store';
import { useRiskStore } from '../store/riskStore';
import { SymbolSelector } from '../components/common/SymbolSelector';
import { NumberDisplay } from '../components/common/NumberDisplay';
import { cn } from '../lib/utils';
import { RiskSummaryModal } from '../components/common/RiskSummaryModal';

// Old Components Restored
import { GridBot } from './GridBot';
import { DcaBot } from './DcaBot';
import { TwapBot } from './TwapBot';
import { MarketMakerBot } from './MarketMakerBot';
import { SignalBot } from './SignalBot';
import { NewsBot } from './NewsBot';

// --- Wave 3 Autonomous Agent Component ---
const Wave3AgentConsole: React.FC = () => {
  const w3 = useWave3Store();
  const { currentRiskLevel } = useRiskStore();
  const [showPreFlight, setShowPreFlight] = useState(false);

  const isSoso = w3.targetCoin.startsWith('SOSO');

  const [showInfo, setShowInfo] = useState(false);

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

  const handleAssetChange = (c: string) => {
    w3.setTargetCoin(c + '-USD');
    if (c === 'SOSO') {
      w3.setMarket('spot');
    }
  };

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex-1 space-y-6">
          <div className="p-6 rounded-2xl bg-surface/50 border border-border/50 backdrop-blur-xl shadow-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
            
            <div className="flex items-start justify-between mb-8 relative z-10">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-3xl font-black text-text-primary flex items-center gap-3 tracking-tight">
                    <Sparkles className="text-purple-400" size={28} />
                    Wave 3 <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400">Autonomous</span>
                  </h2>
                  <button onClick={() => setShowInfo(true)} className="px-2 py-1 bg-surface-2 hover:bg-surface border border-border rounded-lg text-xs font-bold text-text-secondary transition-colors">How it works</button>
                </div>
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2 block">Target Asset</label>
                  <SymbolSelector market={w3.market} value={w3.targetCoin.replace('-USD', '')} onChange={handleAssetChange} />
                </div>
                <div>
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2 block">Market</label>
                  <div className="flex bg-background/50 p-1 rounded-xl border border-border">
                    <button onClick={() => w3.setMarket('spot')} className={cn("flex-1 py-1.5 text-sm font-bold rounded-lg transition-colors", w3.market === 'spot' ? 'bg-primary text-background' : 'text-text-muted hover:text-text-primary')}>Spot</button>
                    <button onClick={() => !isSoso && w3.setMarket('perps')} disabled={isSoso} className={cn("flex-1 py-1.5 text-sm font-bold rounded-lg transition-colors", w3.market === 'perps' ? 'bg-primary text-background' : isSoso ? 'opacity-30 cursor-not-allowed' : 'text-text-muted hover:text-text-primary')}>Perps</button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2 block">Investment</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted font-bold">$</span>
                    <input type="number" value={w3.investment} onChange={(e) => w3.setInvestment(Number(e.target.value))} className="w-full bg-background border border-border rounded-xl h-11 pl-8 pr-4 font-bold text-text-primary focus:outline-none focus:border-primary transition-colors" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2 block">Max Drawdown</label>
                  <div className="relative">
                    <input type="number" value={w3.maxDrawdownPct} onChange={(e) => w3.setMaxDrawdownPct(Number(e.target.value))} className="w-full bg-background border border-border rounded-xl h-11 px-4 pr-8 font-bold text-text-primary focus:outline-none focus:border-primary transition-colors" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted font-bold">%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between bg-background/40 border border-border/50 rounded-xl px-4 mt-6">
                  <div>
                    <div className="text-xs font-bold text-text-primary">Fee Drag Prot.</div>
                  </div>
                  <button onClick={() => w3.setFeeDragProtection(!w3.feeDragProtection)} className={cn("w-10 h-5 rounded-full transition-colors relative", w3.feeDragProtection ? "bg-emerald-500" : "bg-border")}>
                    <div className={cn("absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-300", w3.feeDragProtection ? "translate-x-5" : "translate-x-0")} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-background/40 border border-border/50">
                  <div className="text-[10px] text-text-muted uppercase tracking-widest font-bold mb-1">Live Regime</div>
                  <div className="text-lg font-bold text-text-primary">{w3.currentRegime.replace('_', ' ')}</div>
                </div>
                <div className="p-4 rounded-xl bg-background/40 border border-border/50">
                  <div className="text-[10px] text-text-muted uppercase tracking-widest font-bold mb-1">Active Action</div>
                  <div className="text-lg font-bold text-purple-400">{w3.activeAction.replace('_', ' ')}</div>
                </div>
              </div>

              <button
                onClick={handleStartRequest}
                className={cn(
                  "w-full py-4 rounded-xl font-black text-lg flex items-center justify-center gap-3 transition-all duration-300 shadow-xl relative overflow-hidden",
                  w3.isAgentRunning 
                    ? "bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20"
                    : "bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500 border border-purple-400/50 hover:shadow-purple-500/25"
                )}
              >
                {w3.isAgentRunning && <span className="absolute inset-0 bg-red-400/10 animate-pulse" />}
                {w3.isAgentRunning ? <StopCircle size={24} /> : <Play size={24} fill="currentColor" />}
                {w3.isAgentRunning ? 'HALT AUTONOMOUS AGENT' : 'START AUTONOMOUS AGENT'}
              </button>
            </div>
          </div>

          {w3.activePosition && (
            <div className="p-6 rounded-2xl bg-surface/50 border border-border/50 backdrop-blur-xl animate-in slide-in-from-bottom-2">
              <h3 className="text-sm font-bold text-text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                <Activity size={16} /> Live Bot Execution
              </h3>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-black text-text-primary">{w3.activePosition.botType}</div>
                  <div className="text-xs text-text-secondary mt-1">Size: ${w3.activePosition.size} • Entry: ${w3.activePosition.entryPrice.toFixed(4)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-text-muted uppercase font-bold mb-1">Unrealized PnL</div>
                  <NumberDisplay value={w3.activePosition.pnl} prefix="$" decimals={4} trend={w3.activePosition.pnl > 0 ? "up" : w3.activePosition.pnl < 0 ? "down" : "neutral"} className="text-2xl font-black" />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col min-h-[500px] p-6 rounded-2xl bg-[#0a0a0c] border border-border/40 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-indigo-500 to-emerald-500 opacity-50" />
          <h3 className="text-sm font-bold text-text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
            <Cpu size={16} /> Gemini Orchestrator Log
          </h3>
          
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
            {w3.logs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-text-muted/50 gap-3">
                <Brain size={48} className="opacity-20" />
                <p className="text-sm font-medium">Agent offline. Waiting for initialization.</p>
              </div>
            ) : (
              w3.logs.map((log) => (
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
      
      <RiskSummaryModal 
        isOpen={showPreFlight} 
        title="Pre-Flight Risk Check"
        botName="Wave 3 Agent" 
        onCancel={() => setShowPreFlight(false)} 
        onConfirm={handleConfirmStart} 
      />

      {showInfo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in p-4">
          <div className="w-[500px] max-w-full bg-surface border border-border rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-6 bg-primary/10 border-b border-border flex justify-between items-center">
              <h3 className="text-xl font-black flex items-center gap-2"><Sparkles className="text-primary" /> How Wave 3 Works</h3>
              <button onClick={() => setShowInfo(false)} className="p-1 hover:bg-white/10 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4 text-sm text-text-secondary leading-relaxed">
              <p>Wave 3 is a fully autonomous quantitative orchestrator that connects directly to the exchange's data stream. It analyzes real-time <strong className="text-text-primary">1-minute k-lines</strong> every 10 seconds.</p>
              
              <div className="space-y-3 bg-background p-4 rounded-xl border border-border">
                <div className="flex gap-3"><div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" /><div><strong>High Volatility:</strong> If the max/min spread of the last 14 mins exceeds 1.5%, it deploys the <strong className="text-purple-400">Grid Bot</strong> to capture wide price swings.</div></div>
                <div className="flex gap-3"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" /><div><strong>Trending Up (RSI &lt; 40):</strong> Market is oversold. Deploys the <strong className="text-purple-400">DCA Bot</strong> to accumulate Long positions at the dip.</div></div>
                <div className="flex gap-3"><div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" /><div><strong>Trending Down (RSI &gt; 60):</strong> Market is overbought. Deploys the <strong className="text-purple-400">Signal Bot</strong> to execute Short positions.</div></div>
                <div className="flex gap-3"><div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" /><div><strong>Consolidation (RSI 40-60):</strong> Price is moving sideways. Deploys the <strong className="text-purple-400">Market Maker Bot</strong> to farm tight bid/ask spreads.</div></div>
              </div>

              <p>Positions are automatically monitored and closed out when target profits are reached or RSI indicators reverse. <strong className="text-text-primary">Flash Crash Protection</strong> instantly liquidates everything if the price drops &gt;3% in a single tick.</p>
            </div>
            <div className="p-4 border-t border-border bg-surface-2">
              <button onClick={() => setShowInfo(false)} className="w-full py-3 bg-primary text-background font-bold rounded-xl hover:bg-primary/90 transition-colors">Understood</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

type BotTab = 'wave3' | 'grid' | 'dca' | 'twap' | 'marketmaker' | 'signal' | 'news';

const BOTS_CONFIG: Record<BotTab, { label: string; icon: React.ElementType; component: React.ComponentType | null }> = {
  wave3: { label: 'Wave 3 Autonomous', icon: Sparkles, component: null },
  grid: { label: 'Grid Bot', icon: Grid2X2, component: GridBot },
  dca: { label: 'DCA Bot', icon: Clock, component: DcaBot },
  twap: { label: 'TWAP Bot', icon: Repeat, component: TwapBot },
  marketmaker: { label: 'Market Maker', icon: Layers, component: MarketMakerBot },
  signal: { label: 'Signal Bot', icon: Activity, component: SignalBot },
  news: { label: 'News Bot', icon: Newspaper, component: NewsBot },
};

export const TradingBots: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get('bot') as BotTab) || 'wave3';

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden relative">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="shrink-0 px-8 pt-8 pb-4 border-b border-border/40 relative z-10">
        <h1 className="text-4xl font-black text-text-primary tracking-tight mb-6">Trading Execution</h1>
        
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-2">
          {(Object.entries(BOTS_CONFIG) as [BotTab, typeof BOTS_CONFIG[BotTab]][]).map(([key, config]) => {
            const Icon = config.icon;
            const isActive = currentTab === key;
            return (
              <button
                key={key}
                onClick={() => setSearchParams({ bot: key })}
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

      <div className="flex-1 overflow-y-auto p-8 relative z-10 custom-scrollbar">
        {currentTab === 'wave3' ? (
          <Wave3AgentConsole />
        ) : (
          (() => {
            const ActiveComponent = BOTS_CONFIG[currentTab]?.component;
            return ActiveComponent ? (
               <div className="w-full h-full bg-surface/30 border border-border/40 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-2xl">
                 <ActiveComponent />
               </div>
            ) : null;
          })()
        )}
      </div>
    </div>
  );
};
