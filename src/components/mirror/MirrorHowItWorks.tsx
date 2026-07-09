import React from 'react';
import { Network, Cpu, ShieldCheck, Zap, ArrowRight, Database, Code, Lock } from 'lucide-react';

export const MirrorHowItWorks: React.FC = () => {
  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="glass-card p-8 relative overflow-hidden group">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-info/10 rounded-full blur-3xl transition-transform duration-700 group-hover:scale-150" />
        <div className="relative z-10 text-center max-w-2xl mx-auto">
          <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-info/80 tracking-tight mb-4">
            How Mirror Protocol Works
          </h2>
          <p className="text-text-secondary text-sm leading-relaxed">
            Our infrastructure is built for sub-millisecond execution, non-custodial security, and AI-driven risk management. Explore the architecture that powers your automated trading.
          </p>
        </div>
      </div>

      {/* Architecture Schema */}
      <div className="glass-card p-8 border-info/20 shadow-[0_10px_40px_-10px_rgba(37,99,235,0.15)] relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
        
        <h3 className="font-bold text-lg text-text-primary mb-8 flex items-center gap-2 relative z-10">
          <Network className="text-info drop-shadow-[0_0_8px_rgba(37,99,235,0.8)]" />
          System Architecture
        </h3>

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-8">
          
          {/* Node 1: SoDEX Websocket */}
          <div className="flex-1 w-full bg-surface-2/80 backdrop-blur border border-border p-5 rounded-2xl flex flex-col items-center text-center relative group">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3 shadow-[0_0_15px_rgba(0,212,255,0.2)]">
              <Database className="text-primary" size={24} />
            </div>
            <h4 className="font-bold text-text-primary text-sm mb-1">SoDEX Network</h4>
            <p className="text-xs text-text-muted">Real-time WebSocket feed monitoring the target wallet's positions and trades.</p>
          </div>

          <ArrowRight className="hidden md:block text-text-muted shrink-0 animate-pulse" size={32} />
          <ArrowRight className="md:hidden text-text-muted shrink-0 rotate-90 my-2 animate-pulse" size={32} />

          {/* Node 2: Core Engine & AI */}
          <div className="flex-[1.2] w-full bg-surface-2/80 backdrop-blur border border-info/30 p-5 rounded-2xl flex flex-col items-center text-center relative group shadow-[0_0_20px_rgba(37,99,235,0.1)]">
            <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-info animate-pulse" />
            <div className="w-12 h-12 rounded-xl bg-info/10 flex items-center justify-center mb-3">
              <Cpu className="text-info" size={24} />
            </div>
            <h4 className="font-bold text-text-primary text-sm mb-1">Mirror Engine & AI</h4>
            <p className="text-xs text-text-muted">Applies your custom Risk/Budget limits, sizes the position, and runs the AI Co-Pilot audit.</p>
          </div>

          <ArrowRight className="hidden md:block text-text-muted shrink-0 animate-pulse" size={32} />
          <ArrowRight className="md:hidden text-text-muted shrink-0 rotate-90 my-2 animate-pulse" size={32} />

          {/* Node 3: Execution */}
          <div className="flex-1 w-full bg-surface-2/80 backdrop-blur border border-border p-5 rounded-2xl flex flex-col items-center text-center relative group">
            <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center mb-3 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <Zap className="text-success" size={24} />
            </div>
            <h4 className="font-bold text-text-primary text-sm mb-1">Instant Execution</h4>
            <p className="text-xs text-text-muted">Cryptographically signs the EIP-712 order and executes it on your SoDEX account.</p>
          </div>

        </div>
      </div>

      {/* Security & Features Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        
        {/* Security */}
        <div className="stat-card border-success/20 group">
          <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center mb-4">
            <ShieldCheck className="text-success drop-shadow-[0_0_5px_rgba(16,185,129,0.8)]" size={20} />
          </div>
          <h3 className="font-bold text-text-primary mb-2 text-base">Non-Custodial Security</h3>
          <p className="text-sm text-text-secondary leading-relaxed">
            We never have access to your private keys or withdrawal rights. The system generates an ephemeral 
            <strong> Agent Private Key</strong> tied specifically to the SoDEX API. This key can only execute trades 
            (<code>newOrder</code>) and cannot touch your funds.
          </p>
        </div>

        {/* AI Co-Pilot */}
        <div className="stat-card border-primary/20 group">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
            <Cpu className="text-primary drop-shadow-[0_0_5px_rgba(0,212,255,0.8)]" size={20} />
          </div>
          <h3 className="font-bold text-text-primary mb-2 text-base">AI Co-Pilot Guardrails</h3>
          <p className="text-sm text-text-secondary leading-relaxed">
            Before any trade is executed, our Neural Engine evaluates the market conditions using SoSoValue APIs. 
            If a trade is deemed too risky or manipulative, the Co-Pilot intercepts and aborts the execution automatically.
          </p>
        </div>

        {/* Dynamic Risk Engine */}
        <div className="stat-card border-warning/20 group">
          <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center mb-4">
            <Code className="text-warning drop-shadow-[0_0_5px_rgba(245,158,11,0.8)]" size={20} />
          </div>
          <h3 className="font-bold text-text-primary mb-2 text-base">Dynamic Risk Engine</h3>
          <p className="text-sm text-text-secondary leading-relaxed">
            Your limits are strictly enforced at the sub-millisecond level. Whether you set a percentage-based 
            daily loss limit or explicit stop-loss percentages, the Risk Engine calculates your live equity and 
            rejects out-of-bound trades instantly.
          </p>
        </div>

        {/* Ultra-Low Latency */}
        <div className="stat-card border-info/20 group">
          <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center mb-4">
            <Lock className="text-info drop-shadow-[0_0_5px_rgba(37,99,235,0.8)]" size={20} />
          </div>
          <h3 className="font-bold text-text-primary mb-2 text-base">EIP-712 Encrypted Payloads</h3>
          <p className="text-sm text-text-secondary leading-relaxed">
            Every trade sent to SoDEX requires cryptographic headers (<code>X-API-Sign</code>, <code>X-API-Nonce</code>). 
            The Mirror Engine formats these EIP-712 payloads locally and transmits them securely over TLS to ensure 
            complete API compliance.
          </p>
        </div>

      </div>
    </div>
  );
};
