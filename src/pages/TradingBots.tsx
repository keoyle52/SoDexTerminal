import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Sparkles, Grid2X2, Clock, Repeat, Layers, Activity, Play, StopCircle, 
  ShieldAlert, ShieldCheck, Cpu, Brain, X, Zap, TrendingUp, TrendingDown
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

const SosoLogo: React.FC<{ className?: string }> = ({ className }) => (
  <img src="/soso.png" className={className} alt="SOSO" />
);

const COINS = [
  { value: 'BTC-USD', logo: 'https://cryptologos.cc/logos/bitcoin-btc-logo.svg' },
  { value: 'ETH-USD', logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.svg' },
  { value: 'SOL-USD', logo: 'https://cryptologos.cc/logos/solana-sol-logo.svg' },
  { value: 'SOSO-USD', logo: '', isSoso: true }
];

const Wave3AgentConsole: React.FC = () => {
  const w3 = useWave3Store();
  const { currentRiskLevel } = useRiskStore();
  const [showPreFlight, setShowPreFlight] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const isSoso = w3.targetCoin.startsWith('SOSO');
  const selectedCoin = COINS.find(c => c.value === w3.targetCoin) || COINS[0];

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
          <div className="p-5 rounded-sm bg-surface border border-border relative">
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
                <div className="relative">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5 block">Target Asset</label>
                  <button 
                    type="button"
                    onClick={() => !w3.isAgentRunning && setDropdownOpen(!dropdownOpen)}
                    disabled={w3.isAgentRunning}
                    className={cn(
                      "w-full bg-[#0B0E11] border border-border rounded-sm h-9 px-3 font-bold text-text-primary flex items-center justify-between font-mono text-xs cursor-pointer select-none",
                      w3.isAgentRunning && "opacity-80 cursor-not-allowed"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {selectedCoin.isSoso ? (
                        <SosoLogo className="w-4 h-4 shrink-0" />
                      ) : (
                        <img src={selectedCoin.logo} className="w-4 h-4" alt={selectedCoin.value} />
                      )}
                      <span>{selectedCoin.value}</span>
                    </div>
                    <span className="text-text-muted text-[10px]">▼</span>
                  </button>
                  {dropdownOpen && !w3.isAgentRunning && (
                    <div className="absolute left-0 right-0 mt-1 bg-[#101317] border border-border rounded-sm shadow-xl z-50 overflow-hidden">
                      {COINS.map(coin => (
                        <button
                          key={coin.value}
                          type="button"
                          onClick={() => {
                            w3.setTargetCoin(coin.value);
                            if (coin.isSoso) {
                              w3.setMarket('spot');
                            }
                            setDropdownOpen(false);
                          }}
                          className={cn(
                            "w-full px-3 py-2 text-left hover:bg-[#1C2026] flex items-center gap-2 font-mono text-xs text-text-primary transition-colors cursor-pointer",
                            w3.targetCoin === coin.value && "bg-[#1C2026] text-primary"
                          )}
                        >
                          {coin.isSoso ? (
                            <SosoLogo className="w-4 h-4 shrink-0" />
                          ) : (
                            <img src={coin.logo} className="w-4 h-4" alt={coin.value} />
                          )}
                          <span>{coin.value}</span>
                        </button>
                      ))}
                    </div>
                  )}
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

              <div className="font-mono">
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

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl bg-[#0B0E11] border border-border flex items-center gap-3.5 relative overflow-hidden select-none">
                  {/* Glowing Radar Circle */}
                  <div className="relative w-11 h-11 shrink-0 flex items-center justify-center rounded-full border border-white/10 bg-white/[0.02]">
                    {w3.currentRegime === 'CONSOLIDATION' ? (
                      <>
                        <span className="absolute inset-0 rounded-full border border-warning/30 animate-ping opacity-60" />
                        <span className="w-2.5 h-2.5 rounded-full bg-warning shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse" />
                      </>
                    ) : w3.currentRegime === 'TRENDING_UP' ? (
                      <>
                        <span className="absolute inset-0 rounded-full border border-success/30 animate-ping opacity-60" />
                        <span className="w-2.5 h-2.5 rounded-full bg-success shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                        <TrendingUp size={12} className="text-success absolute top-1.5" />
                      </>
                    ) : w3.currentRegime === 'TRENDING_DOWN' ? (
                      <>
                        <span className="absolute inset-0 rounded-full border border-danger/30 animate-ping opacity-60" />
                        <span className="w-2.5 h-2.5 rounded-full bg-danger shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                        <TrendingDown size={12} className="text-danger absolute bottom-1.5" />
                      </>
                    ) : (
                      <>
                        <span className="absolute inset-0 rounded-full border border-purple-500/30 animate-ping opacity-60" />
                        <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]" />
                        <Activity size={12} className="text-purple-400 absolute" />
                      </>
                    )}
                  </div>
                  <div>
                    <div className="text-[9px] text-text-secondary uppercase tracking-widest font-bold">Live Regime</div>
                    <div className="text-xs font-black text-text-primary font-mono mt-0.5">{w3.currentRegime.replace('_', ' ')}</div>
                    <div className={cn(
                      "text-[9px] font-bold mt-0.5",
                      w3.currentRegime === 'TRENDING_UP' ? 'text-success' :
                      w3.currentRegime === 'TRENDING_DOWN' ? 'text-danger' :
                      w3.currentRegime === 'HIGH_VOLATILITY' ? 'text-purple-400' :
                      'text-warning'
                    )}>
                      {w3.currentRegime === 'TRENDING_UP' ? 'Bullish Breakout' :
                       w3.currentRegime === 'TRENDING_DOWN' ? 'Bearish Breakout' :
                       w3.currentRegime === 'HIGH_VOLATILITY' ? 'Extreme Volatility' : 'Consolidating'}
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-sm bg-[#0B0E11] border border-border flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-[9px] text-text-secondary uppercase tracking-widest font-bold mb-0.5">SoSo Sentiment</div>
                      <div className="text-sm font-black text-text-primary font-mono">
                        {w3.currentRegime === 'TRENDING_UP' ? '82' :
                         w3.currentRegime === 'TRENDING_DOWN' ? '24' :
                         w3.currentRegime === 'HIGH_VOLATILITY' ? '65' : '50'}/100
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 space-y-0.5">
                    <div className="h-1 w-full bg-white/5 rounded-sm relative overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-emerald-500 transition-all duration-500 rounded-sm"
                        style={{ 
                          width: `${
                            w3.currentRegime === 'TRENDING_UP' ? 82 :
                            w3.currentRegime === 'TRENDING_DOWN' ? 24 :
                            w3.currentRegime === 'HIGH_VOLATILITY' ? 65 : 50
                          }%` 
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[7px] text-text-muted font-bold font-mono">
                      <span>BEAR</span>
                      <span>BULL</span>
                    </div>
                  </div>
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

              {w3.isAgentRunning && w3.currentRegime === 'CONSOLIDATION' && (
                <div className="mt-4 p-4 rounded-xl border border-warning/30 bg-warning/5 text-warning flex items-start gap-3 shadow-[0_0_15px_rgba(245,158,11,0.1)] animate-pulse">
                  <ShieldAlert className="shrink-0 mt-0.5 text-warning" size={16} />
                  <div>
                    <h4 className="text-xs font-bold text-text-primary">Capital Preservation Mode Active</h4>
                    <p className="text-[10px] text-text-secondary mt-1 leading-relaxed">
                      The agent has detected a consolidation (flat) phase in the market. To safeguard capital from fee-drag and chop, all operations have been suspended. The bot is actively monitoring the market and will resume once a clear trending breakout occurs.
                    </p>
                  </div>
                </div>
              )}
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
                <div className="flex items-center gap-4">
                  {/* Mini Sparkline */}
                  <div className="w-16 h-8 shrink-0">
                    <svg className="w-full h-full" viewBox="0 0 60 20">
                      <path
                        d={w3.activePosition.pnl >= 0 
                          ? "M 0 15 Q 15 5, 30 12 T 60 2" 
                          : "M 0 5 Q 15 15, 30 8 T 60 18"
                        }
                        fill="none"
                        stroke={w3.activePosition.pnl >= 0 ? "#00B574" : "#EF454A"}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
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
                <div className="flex gap-2"><div className="w-1 h-1 rounded-full bg-warning mt-1.5 shrink-0" /><div><strong>Consolidation (RSI 40-60):</strong> Sideways chop. Orchestrator <strong className="text-purple-400">halts active trading</strong> and waits for trend/volatility breakout to preserve capital.</div></div>
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

type BotTab = 'wave3' | 'signal' | 'grid' | 'dca' | 'twap' | 'marketmaker' | 'howItWorks';

const BOTS_CONFIG: Record<BotTab, { label: string; icon: React.ElementType; component: React.ComponentType | null }> = {
  wave3: { label: 'Wave 3 Autonomous', icon: Sparkles, component: null },
  signal: { label: 'Signal Bot', icon: Activity, component: SignalBot },
  grid: { label: 'Grid Bot', icon: Grid2X2, component: GridBot },
  dca: { label: 'DCA Bot', icon: Clock, component: DcaBot },
  twap: { label: 'TWAP Bot', icon: Repeat, component: TwapBot },
  marketmaker: { label: 'Market Maker', icon: Layers, component: MarketMakerBot },
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
