import React from 'react';
import { Network, Cpu, ShieldCheck, Zap, ArrowRight, Database, Code, Lock, Globe, MessageSquare } from 'lucide-react';

interface BotsHowItWorksProps {
  botType?: 'Grid' | 'DCA' | 'TWAP' | 'Market Maker' | 'Signal' | 'News';
}

export const BotsHowItWorks: React.FC<BotsHowItWorksProps> = ({ botType }) => {
  
  const getBotDescription = () => {
    switch (botType) {
      case 'Grid': return "Grid Bot uses Dynamic Virtual Execution. Instead of locking capital by pre-placing all limit orders, it tracks the live websocket and fires instantaneous Market Orders only when the price crosses your defined thresholds. This prevents capital inefficiency and avoids 'Fee Drag'.";
      case 'DCA': return "DCA Bot executes time-weighted or price-weighted buys. Integrated with our AI Co-pilot, it can smartly 'Buy the Dip' by monitoring the RSI before executing a time-scheduled purchase, lowering your average entry price aggressively.";
      case 'TWAP': return "TWAP Bot breaks down massive orders into algorithmic micro-slices. It randomizes the execution intervals slightly to prevent front-running by MEV bots, guaranteeing premium execution quality over the selected timeframe.";
      case 'Market Maker': return "Market Maker provides localized liquidity. It posts Post-Only (GTX) limit orders to earn the Maker rebate. If the spread becomes too narrow compared to the fee tier, Fee Drag Protection automatically suspends quoting to prevent bleeding.";
      case 'Signal': return "Signal Bot listens to multi-indicator strategies (RSI, MACD, Bollinger). When combined with our Risk Shield, it evaluates the SoSoValue AI score in real-time before entering the signal, blocking false-positive signals in highly volatile regimes.";
      case 'News': return "News Bot consumes high-speed RSS and sentiment feeds via our AI pipeline. It executes orders within milliseconds of a sentiment breakout, instantly applying a trailing stop-loss to lock in profits from volatility spikes.";
      default: return "Our autonomous trading engine interacts directly with the SoDEX API. It leverages a collaborative Multi-Agent Consensus mechanism to run 24/7 self-operating quantitative strategies.";
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12 p-4 md:p-8 overflow-y-auto h-full custom-scrollbar">
      {/* Header */}
      <div className="glass-card p-8 relative overflow-hidden group rounded-2xl bg-surface/40 border border-border">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-3xl transition-transform duration-700 group-hover:scale-150" />
        <div className="relative z-10 text-center max-w-2xl mx-auto">
          <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-primary/80 tracking-tight mb-4">
            How {botType || 'Automated Bots'} Work{botType ? 's' : ''}
          </h2>
          <p className="text-text-secondary text-sm leading-relaxed">
            {getBotDescription()}
          </p>
        </div>
      </div>

      {/* Architecture Schema */}
      <div className="glass-card p-8 border-primary/20 shadow-[0_10px_40px_-10px_rgba(37,99,235,0.15)] relative overflow-hidden rounded-2xl bg-surface/40">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
        
        <h3 className="font-bold text-lg text-text-primary mb-8 flex items-center gap-2 relative z-10">
          <Network className="text-primary drop-shadow-[0_0_8px_rgba(37,99,235,0.8)]" />
          System Architecture
        </h3>

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-8">
          
          {/* Node 1: SoDEX Websocket */}
          <div className="flex-1 w-full bg-surface-2/80 backdrop-blur border border-border p-5 rounded-2xl flex flex-col items-center text-center relative group">
            <div className="w-12 h-12 rounded-xl bg-info/10 flex items-center justify-center mb-3 shadow-[0_0_15px_rgba(0,212,255,0.2)]">
              <Database className="text-info" size={24} />
            </div>
            <h4 className="font-bold text-text-primary text-sm mb-1">Market Data Feed</h4>
            <p className="text-xs text-text-muted">High-frequency ticker updates and live K-Line data directly sourced from SoDEX's real-time API.</p>
          </div>

          <ArrowRight className="hidden md:block text-text-muted shrink-0 animate-pulse" size={32} />
          <ArrowRight className="md:hidden text-text-muted shrink-0 rotate-90 my-2 animate-pulse" size={32} />

          {/* Node 2: Multi-Agent Consensus HUB */}
          <div className="flex-[1.2] w-full bg-surface-2/80 backdrop-blur border border-primary/30 p-5 rounded-2xl flex flex-col items-center text-center relative group shadow-[0_0_20px_rgba(37,99,235,0.1)]">
            <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary animate-pulse" />
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
              <Cpu className="text-primary" size={24} />
            </div>
            <h4 className="font-bold text-text-primary text-sm mb-1">Multi-Agent Consensus HUB</h4>
            <p className="text-xs text-text-muted">Macro, Technical, Sentiment, and Risk agents collaboratively vote in real-time, aggregating indicators to make automated trading decisions.</p>
          </div>

          <ArrowRight className="hidden md:block text-text-muted shrink-0 animate-pulse" size={32} />
          <ArrowRight className="md:hidden text-text-muted shrink-0 rotate-90 my-2 animate-pulse" size={32} />

          {/* Node 3: Execution */}
          <div className="flex-1 w-full bg-surface-2/80 backdrop-blur border border-border p-5 rounded-2xl flex flex-col items-center text-center relative group">
            <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center mb-3 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <Zap className="text-success" size={24} />
            </div>
            <h4 className="font-bold text-text-primary text-sm mb-1">Secure Execution</h4>
            <p className="text-xs text-text-muted">Cryptographically signs order payloads using delegated session keys and places orders on SoDEX.</p>
          </div>

        </div>
      </div>

      {/* Security & Features Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        
        {/* Risk Shield */}
        <div className="stat-card border-success/20 group p-6 rounded-2xl bg-surface/40 border">
          <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center mb-4">
            <ShieldCheck className="text-success drop-shadow-[0_0_5px_rgba(16,185,129,0.8)]" size={20} />
          </div>
          <h3 className="font-bold text-text-primary mb-2 text-base">Universal Risk Shield</h3>
          <p className="text-sm text-text-secondary leading-relaxed">
            Every automated bot is protected by the Universal Risk Shield. This enforces explicit <strong>Max Loss (USD or %) limits</strong> globally. If a bot's overall PnL drops below your acceptable threshold, it is automatically terminated and all its positions are closed.
          </p>
        </div>

        {/* AI Co-Pilot */}
        <div className="stat-card border-warning/20 group p-6 rounded-2xl bg-surface/40 border">
          <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center mb-4">
            <Cpu className="text-warning drop-shadow-[0_0_5px_rgba(245,158,11,0.8)]" size={20} />
          </div>
          <h3 className="font-bold text-text-primary mb-2 text-base">AI Risk Assessment</h3>
          <p className="text-sm text-text-secondary leading-relaxed">
            Our AI engine constantly audits market conditions using SoSoValue's APIs. If the real-time AI Risk Score exceeds your configured <strong>AI Risk Threshold</strong>, the bots will pause operations to protect you from unpredictable market volatility.
          </p>
        </div>

        {/* Fee Drag Protection */}
        <div className="stat-card border-info/20 group p-6 rounded-2xl bg-surface/40 border">
          <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center mb-4">
            <Code className="text-info drop-shadow-[0_0_5px_rgba(37,99,235,0.8)]" size={20} />
          </div>
          <h3 className="font-bold text-text-primary mb-2 text-base">Fee Drag Protection</h3>
          <p className="text-sm text-text-secondary leading-relaxed">
            High-frequency strategies like the Grid Bot and Market Maker are susceptible to trading fees. Fee Drag Protection ensures that trades are only executed when the expected profit strictly exceeds the estimated <strong>Maker/Taker fees</strong>.
          </p>
        </div>

        {/* Flash Crash Prevention */}
        <div className="stat-card border-primary/20 group p-6 rounded-2xl bg-surface/40 border">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
            <Lock className="text-primary drop-shadow-[0_0_5px_rgba(37,99,235,0.8)]" size={20} />
          </div>
          <h3 className="font-bold text-text-primary mb-2 text-base">Flash Crash Slippage Protection</h3>
          <p className="text-sm text-text-secondary leading-relaxed">
            Avoids filling orders into dead orderbooks. By defining a maximum acceptable slippage percentage, the engine guarantees that no market orders are executed during catastrophic flash crashes.
          </p>
        </div>

      </div>
    </div>
  );
};
