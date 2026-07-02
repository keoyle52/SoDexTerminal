import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Sparkles, Grid2X2, Clock, Repeat, Layers, Activity, Play, StopCircle, 
  ShieldAlert, ShieldCheck, Cpu, Brain, Zap, TrendingUp, FileText, AlertTriangle, ChevronDown 
} from 'lucide-react';
import { useWave3Store } from '../store/wave3Store';
import { useRiskStore } from '../store/riskStore';
import { useBotStore } from '../store/botStore';
import { SymbolSelector } from '../components/common/SymbolSelector';
import { NumberDisplay } from '../components/common/NumberDisplay';
import { TradingChart } from '../components/TradingChart';
import { cn } from '../lib/utils';

// --- Pre-Flight Risk Modal ---
const PreFlightModal: React.FC<{ botName: string; onClose: () => void; onConfirm: () => void }> = ({ botName, onClose, onConfirm }) => {
  const [flash, setFlash] = useState(true);
  const [feeDrag, setFeeDrag] = useState(true);
  const [drawdown, setDrawdown] = useState(false);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-[500px] bg-surface border border-border rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-6 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b border-border">
          <div className="flex items-center gap-3 text-amber-500 mb-2">
            <AlertTriangle size={24} />
            <h2 className="text-xl font-black">Pre-Flight Risk Check</h2>
          </div>
          <p className="text-sm text-text-secondary font-medium">Gemini AI is analyzing current market conditions before deploying {botName}. Please review recommended safeguards.</p>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl bg-background border border-border group hover:border-emerald-500/50 transition-colors cursor-pointer" onClick={() => setFlash(!flash)}>
            <div className="flex items-center gap-3">
              <ShieldCheck className={cn("transition-colors", flash ? "text-emerald-400" : "text-text-muted")} />
              <div>
                <div className="text-sm font-bold text-text-primary">Flash Crash Protection <span className="ml-2 text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full uppercase tracking-widest">Recommended</span></div>
                <div className="text-xs text-text-secondary">Auto-halt if market drops &gt;3% instantly.</div>
              </div>
            </div>
            <div className={cn("w-10 h-5 rounded-full transition-colors relative", flash ? "bg-emerald-500" : "bg-border")}>
              <div className={cn("absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-300", flash ? "translate-x-5" : "translate-x-0")} />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-background border border-border group hover:border-emerald-500/50 transition-colors cursor-pointer" onClick={() => setFeeDrag(!feeDrag)}>
            <div className="flex items-center gap-3">
              <Zap className={cn("transition-colors", feeDrag ? "text-emerald-400" : "text-text-muted")} />
              <div>
                <div className="text-sm font-bold text-text-primary">Fee Drag Prevention <span className="ml-2 text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full uppercase tracking-widest">Recommended</span></div>
                <div className="text-xs text-text-secondary">Skip trades where fees exceed expected profit.</div>
              </div>
            </div>
            <div className={cn("w-10 h-5 rounded-full transition-colors relative", feeDrag ? "bg-emerald-500" : "bg-border")}>
              <div className={cn("absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-300", feeDrag ? "translate-x-5" : "translate-x-0")} />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-background border border-border group hover:border-primary/50 transition-colors cursor-pointer" onClick={() => setDrawdown(!drawdown)}>
            <div className="flex items-center gap-3">
              <TrendingUp className={cn("transition-colors", drawdown ? "text-primary" : "text-text-muted")} />
              <div>
                <div className="text-sm font-bold text-text-primary">Max Drawdown Limit (5%)</div>
                <div className="text-xs text-text-secondary">Liquidate position if PnL hits -5%.</div>
              </div>
            </div>
            <div className={cn("w-10 h-5 rounded-full transition-colors relative", drawdown ? "bg-primary" : "bg-border")}>
              <div className={cn("absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-300", drawdown ? "translate-x-5" : "translate-x-0")} />
            </div>
          </div>
        </div>

        <div className="p-6 bg-surface-2 border-t border-border flex gap-4">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl font-bold text-text-muted hover:text-text-primary bg-background border border-border transition-colors">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-3 rounded-xl font-black text-background bg-emerald-500 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 transition-colors flex items-center justify-center gap-2">
            <Play size={18} fill="currentColor" /> Confirm & Execute
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Wave 3 Autonomous Agent Component ---
const Wave3AgentConsole: React.FC = () => {
  const w3 = useWave3Store();
  const { currentRiskLevel } = useRiskStore();
  const [showPreFlight, setShowPreFlight] = useState(false);

  const isSoso = w3.targetCoin.startsWith('SOSO');

  const handleStartRequest = () => {
    if (w3.isAgentRunning) {
      w3.setAgentRunning(false); // Stop directly without pre-flight
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2 block">Investment</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted font-bold">$</span>
                    <input type="number" value={w3.investment} onChange={(e) => w3.setInvestment(Number(e.target.value))} className="w-full bg-background border border-border rounded-xl h-11 pl-8 pr-4 font-bold text-text-primary focus:outline-none focus:border-primary transition-colors" />
                  </div>
                </div>
                <div className="flex items-center justify-between bg-background/40 border border-border/50 rounded-xl px-4 mt-6">
                  <div>
                    <div className="text-xs font-bold text-text-primary">Fee Drag Protection</div>
                    <div className="text-[10px] text-text-muted">Prevent neg. EV trades</div>
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
      
      {showPreFlight && <PreFlightModal botName="Wave 3 Agent" onClose={() => setShowPreFlight(false)} onConfirm={handleConfirmStart} />}
    </>
  );
};

// --- Standard Bot View (Form + Active State) using Real botStore ---
type BotTab = 'wave3' | 'grid' | 'dca' | 'twap' | 'marketmaker' | 'signal';

const BOTS_CONFIG: Record<BotTab, { label: string; icon: React.ElementType; color: string; desc: string }> = {
  wave3: { label: 'Wave 3 Autonomous', icon: Sparkles, color: 'from-purple-500 to-indigo-600', desc: 'Fully autonomous AI orchestrator.' },
  grid: { label: 'Grid Bot', icon: Grid2X2, color: 'from-cyan-500 to-blue-600', desc: 'High-frequency price volatility grid trading.' },
  dca: { label: 'DCA Bot', icon: Clock, color: 'from-emerald-500 to-teal-600', desc: 'Automated Dollar Cost Averaging capital accumulation.' },
  twap: { label: 'TWAP Bot', icon: Repeat, color: 'from-pink-500 to-rose-600', desc: 'Time-Weighted Average Price execution for whales.' },
  marketmaker: { label: 'Market Maker', icon: Layers, color: 'from-amber-500 to-orange-600', desc: 'Provide liquidity and capture spread.' },
  signal: { label: 'Signal Bot', icon: Activity, color: 'from-blue-500 to-indigo-600', desc: 'Execute complex TradingView/Webhook signals.' },
};

const StandardBotView: React.FC<{ type: BotTab }> = ({ type }) => {
  const config = BOTS_CONFIG[type];
  const Icon = config.icon;
  const store = useBotStore();

  const [showPreFlight, setShowPreFlight] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Derive running state from the real store
  let isRunning = false;
  let symbol = 'BTC-USD';
  let market: 'spot' | 'perps' = 'spot';
  
  if (type === 'grid') {
    isRunning = store.gridBot.status === 'RUNNING';
    symbol = store.gridBot.symbol.replace('vBTC-vUSDC', 'BTC-USD');
    market = store.gridBot.isSpot ? 'spot' : 'perps';
  } else if (type === 'marketmaker') {
    isRunning = store.marketMakerBot.status === 'RUNNING';
    symbol = store.marketMakerBot.symbol.replace('vBTC-vUSDC', 'BTC-USD');
  } else if (type === 'signal') {
    isRunning = store.signalBot.status === 'RUNNING';
    symbol = store.signalBot.symbol;
    market = store.signalBot.isSpot ? 'spot' : 'perps';
  }

  const handleAutoConfigure = () => {
    if (type === 'grid') {
      store.gridBot.setField('lowerPrice', '55000');
      store.gridBot.setField('upperPrice', '72000');
      store.gridBot.setField('gridCount', '20');
      store.gridBot.setField('amountPerGrid', '0.05');
    } else if (type === 'marketmaker') {
      store.marketMakerBot.setField('budgetUsdt', '2500');
      store.marketMakerBot.setField('layers', '3');
      store.marketMakerBot.setField('spreadBps', '1');
    } else if (type === 'signal') {
      store.signalBot.setField('takeProfitPct', '5');
      store.signalBot.setField('stopLossPct', '2.5');
    }
  };

  const handleDeployClick = () => setShowPreFlight(true);
  
  const handleConfirmDeploy = () => {
    setShowPreFlight(false);
    if (type === 'grid') store.gridBot.setField('status', 'RUNNING');
    else if (type === 'marketmaker') store.marketMakerBot.setField('status', 'RUNNING');
    else if (type === 'signal') store.signalBot.setField('status', 'RUNNING');
  };

  const handleStop = () => {
    if (type === 'grid') store.gridBot.setField('status', 'STOPPED');
    else if (type === 'marketmaker') store.marketMakerBot.setField('status', 'STOPPED');
    else if (type === 'signal') store.signalBot.setField('status', 'STOPPED');
  };

  if (isRunning) {
    return (
      <div className="h-full flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-500">
        <div className="flex items-center justify-between p-4 rounded-2xl bg-surface border border-border shadow-xl">
          <div className="flex items-center gap-4">
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br shadow-lg", config.color)}>
              <Icon size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-text-primary flex items-center gap-2">
                {config.label} <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full uppercase tracking-widest">Active</span>
              </h2>
              <div className="text-sm text-text-secondary font-medium">{symbol} • {market.toUpperCase()} Mode</div>
            </div>
          </div>
          <div className="flex gap-6 items-center">
            <div className="text-right">
              <div className="text-[10px] text-text-muted font-bold uppercase tracking-widest">Realized PnL</div>
              <div className="text-xl font-black text-emerald-400">+ $12.40</div>
            </div>
            <button onClick={handleStop} className="px-6 py-2.5 rounded-xl bg-red-500/10 text-red-400 font-bold border border-red-500/30 hover:bg-red-500/20 transition-colors flex items-center gap-2">
              <StopCircle size={18} /> HALT BOT
            </button>
          </div>
        </div>

        <div className="flex-1 flex gap-6 min-h-0">
          <div className="flex-[2] rounded-2xl overflow-hidden border border-border bg-surface shadow-2xl relative">
             <TradingChart symbol={symbol} market={market} />
          </div>
          <div className="flex-1 rounded-2xl bg-[#0a0a0c] border border-border p-4 flex flex-col shadow-2xl">
            <h3 className="text-sm font-bold text-text-muted uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-border/50 pb-2">
              <FileText size={16} /> Live Execution Log
            </h3>
            <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar text-sm font-mono">
               <div className="text-emerald-400">[{new Date().toLocaleTimeString()}] Engine fully engaged. Limits set.</div>
               <div className="text-text-secondary">[{new Date().toLocaleTimeString()}] Subscribed to {symbol} WS feeds.</div>
               <div className="text-primary">[{new Date().toLocaleTimeString()}] AI Strategy: Waiting for technical trigger...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Real Form Rendering depending on bot type ---
  const renderBotSpecificForm = () => {
    if (type === 'grid') {
      const gb = store.gridBot;
      return (
        <>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Lower Price Bound</label>
              <input type="number" value={gb.lowerPrice} onChange={e => gb.setField('lowerPrice', e.target.value)} className="w-full h-12 bg-background border border-border rounded-xl px-4 text-text-primary font-bold focus:outline-none focus:border-primary" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Upper Price Bound</label>
              <input type="number" value={gb.upperPrice} onChange={e => gb.setField('upperPrice', e.target.value)} className="w-full h-12 bg-background border border-border rounded-xl px-4 text-text-primary font-bold focus:outline-none focus:border-primary" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Grid Count</label>
              <input type="number" value={gb.gridCount} onChange={e => gb.setField('gridCount', e.target.value)} className="w-full h-12 bg-background border border-border rounded-xl px-4 text-text-primary font-bold focus:outline-none focus:border-primary" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Amount per Grid (Base)</label>
              <input type="number" value={gb.amountPerGrid} onChange={e => gb.setField('amountPerGrid', e.target.value)} className="w-full h-12 bg-background border border-border rounded-xl px-4 text-text-primary font-bold focus:outline-none focus:border-primary" />
            </div>
          </div>
        </>
      );
    }
    
    if (type === 'marketmaker') {
      const mm = store.marketMakerBot;
      return (
        <>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Budget (USDT)</label>
              <input type="number" value={mm.budgetUsdt} onChange={e => mm.setField('budgetUsdt', e.target.value)} className="w-full h-12 bg-background border border-border rounded-xl px-4 text-text-primary font-bold focus:outline-none focus:border-primary" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Order Size (USDT)</label>
              <input type="number" value={mm.orderSizeUsdt} onChange={e => mm.setField('orderSizeUsdt', e.target.value)} className="w-full h-12 bg-background border border-border rounded-xl px-4 text-text-primary font-bold focus:outline-none focus:border-primary" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
             <div className="space-y-2">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Layers</label>
              <input type="number" value={mm.layers} onChange={e => mm.setField('layers', e.target.value)} className="w-full h-12 bg-background border border-border rounded-xl px-4 text-text-primary font-bold focus:outline-none focus:border-primary" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Spread BPS</label>
              <input type="number" value={mm.spreadBps} onChange={e => mm.setField('spreadBps', e.target.value)} className="w-full h-12 bg-background border border-border rounded-xl px-4 text-text-primary font-bold focus:outline-none focus:border-primary" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Requote BPS</label>
              <input type="number" value={mm.requoteBps} onChange={e => mm.setField('requoteBps', e.target.value)} className="w-full h-12 bg-background border border-border rounded-xl px-4 text-text-primary font-bold focus:outline-none focus:border-primary" />
            </div>
          </div>
        </>
      );
    }

    if (type === 'signal') {
      const sb = store.signalBot;
      return (
        <>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Take Profit (%)</label>
              <input type="number" value={sb.takeProfitPct} onChange={e => sb.setField('takeProfitPct', e.target.value)} className="w-full h-12 bg-background border border-border rounded-xl px-4 text-text-primary font-bold focus:outline-none focus:border-primary" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Stop Loss (%)</label>
              <input type="number" value={sb.stopLossPct} onChange={e => sb.setField('stopLossPct', e.target.value)} className="w-full h-12 bg-background border border-border rounded-xl px-4 text-text-primary font-bold focus:outline-none focus:border-primary" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Leverage (Perps)</label>
              <input type="number" value={sb.leverage} onChange={e => sb.setField('leverage', e.target.value)} className="w-full h-12 bg-background border border-border rounded-xl px-4 text-text-primary font-bold focus:outline-none focus:border-primary" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Cooldown (Seconds)</label>
              <input type="number" value={sb.cooldownSeconds} onChange={e => sb.setField('cooldownSeconds', e.target.value)} className="w-full h-12 bg-background border border-border rounded-xl px-4 text-text-primary font-bold focus:outline-none focus:border-primary" />
            </div>
          </div>
        </>
      );
    }

    // Fallback for untouched bots like DCA/TWAP for now
    return (
       <div className="h-24 flex items-center justify-center text-text-muted border border-dashed border-border rounded-xl">
         Advanced Configuration Loading...
       </div>
    );
  };

  return (
    <>
      <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
        <div className="p-8 rounded-3xl bg-surface/30 border border-border/40 backdrop-blur-2xl shadow-2xl relative overflow-hidden">
          
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br shadow-lg", config.color)}>
                <Icon size={28} className="text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-black text-text-primary tracking-tight">{config.label}</h2>
                <p className="text-text-secondary mt-1 font-medium">{config.desc}</p>
              </div>
            </div>
            
            <button onClick={handleAutoConfigure} className="px-4 py-2 rounded-xl bg-primary/10 text-primary border border-primary/20 font-bold flex items-center gap-2 hover:bg-primary/20 transition-colors shadow-lg shadow-primary/10">
              <Sparkles size={16} /> AI Auto Configure
            </button>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Asset Pair</label>
                <div className="flex bg-background border border-border rounded-xl h-12 items-center px-4 font-bold text-text-primary">
                   {symbol}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Environment</label>
                <div className="flex bg-background border border-border rounded-xl h-12 p-1">
                   <button className="flex-1 rounded-lg text-sm font-bold bg-primary text-background">Live / Real</button>
                   <button disabled className="flex-1 rounded-lg text-sm font-bold text-text-muted/50 cursor-not-allowed">Mock / Demo</button>
                </div>
              </div>
            </div>

            {renderBotSpecificForm()}

            <div className="border border-border/50 rounded-xl overflow-hidden mt-6">
               <button 
                 onClick={() => setAdvancedOpen(!advancedOpen)}
                 className="w-full px-6 py-4 flex items-center justify-between bg-surface-2 hover:bg-surface transition-colors"
               >
                 <div className="font-bold text-sm text-text-primary">Advanced Trigger & Risk Settings</div>
                 <ChevronDown size={18} className={cn("text-text-muted transition-transform", advancedOpen ? "rotate-180" : "")} />
               </button>
               {advancedOpen && (
                 <div className="p-6 bg-background border-t border-border/50 space-y-4">
                    <div className="text-xs text-text-muted">Advanced settings like Conditional Triggers and global Stop-Loss will appear here.</div>
                 </div>
               )}
            </div>

            <div className="pt-4">
              <button onClick={handleDeployClick} className={cn("w-full h-14 rounded-xl text-white font-black text-lg transition-all shadow-xl bg-gradient-to-r", config.color, "hover:scale-[1.01]")}>
                REVIEW & DEPLOY BOT
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {showPreFlight && <PreFlightModal botName={config.label} onClose={() => setShowPreFlight(false)} onConfirm={handleConfirmDeploy} />}
    </>
  );
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
          <StandardBotView type={currentTab} />
        )}
      </div>
    </div>
  );
};
