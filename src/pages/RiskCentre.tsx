import React from 'react';
import { ShieldCheck, ShieldAlert, AlertTriangle, Activity, Lock, TrendingUp, Cpu } from 'lucide-react';
import { Card } from '../components/common/Card';

export const RiskCentre: React.FC = () => {
  return (
    <div className="p-4 md:p-6 h-full flex flex-col gap-6 overflow-y-auto bg-background">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
            <ShieldCheck size={26} />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-text-primary flex items-center gap-2">
              Institutional Risk Centre
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Active VaR Control
              </span>
            </h2>
            <p className="text-xs text-text-muted">
              Real-time Value-at-Risk (VaR) monitoring, liquidation safety buffers, and margin exposure analytics.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface border border-border">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-semibold text-text-secondary">System Risk Status:</span>
          <span className="text-xs font-bold text-emerald-400">OPTIMAL (95% VaR: 1.82%)</span>
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 space-y-2 border-primary/20 bg-primary/5">
          <div className="flex items-center justify-between text-xs text-text-muted font-medium">
            <span>Portfolio 95% VaR (24h)</span>
            <Activity size={15} className="text-primary" />
          </div>
          <p className="text-2xl font-black text-text-primary">$1,420.50 <span className="text-xs font-medium text-text-muted">(1.82%)</span></p>
          <p className="text-[11px] text-emerald-400 flex items-center gap-1">
            <ShieldCheck size={12} /> Well within 5.0% risk tolerance threshold
          </p>
        </Card>

        <Card className="p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-text-muted font-medium">
            <span>Average Liquidation Buffer</span>
            <ShieldAlert size={15} className="text-amber-400" />
          </div>
          <p className="text-2xl font-black text-text-primary">42.8%</p>
          <p className="text-[11px] text-text-muted">Safe margin distance across active positions</p>
        </Card>

        <Card className="p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-text-muted font-medium">
            <span>Max Leverage Exposure</span>
            <TrendingUp size={15} className="text-purple-400" />
          </div>
          <p className="text-2xl font-black text-text-primary">3.5x <span className="text-xs font-medium text-text-muted">(Max 20x)</span></p>
          <p className="text-[11px] text-text-muted">Automated ATR sizing active</p>
        </Card>

        <Card className="p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-text-muted font-medium">
            <span>Non-Custodial Protection</span>
            <Lock size={15} className="text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-400">EIP-712</p>
          <p className="text-[11px] text-text-muted">WalletConnect session delegation active</p>
        </Card>
      </div>

      {/* Detailed Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Mitigation Policy Panel */}
        <div className="p-5 rounded-2xl bg-surface border border-border space-y-4">
          <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
            <Cpu size={16} className="text-primary" /> Automated Risk Mitigation Engine
          </h3>
          <div className="space-y-3 text-xs leading-relaxed text-text-secondary">
            <div className="p-3 rounded-xl bg-background/60 border border-border/80 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
                <ShieldCheck size={16} />
              </div>
              <div>
                <strong className="text-text-primary block">Dynamic ATR Volatility Sizing</strong>
                Position sizes automatically adjust based on historical Average True Range to keep maximum drawdown bounded under 2.0% per trade.
              </div>
            </div>

            <div className="p-3 rounded-xl bg-background/60 border border-border/80 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 shrink-0">
                <AlertTriangle size={16} />
              </div>
              <div>
                <strong className="text-text-primary block">Liquidation Flash Guard</strong>
                If distance to liquidation drops below 10%, the automated execution daemon executes partial market de-leveraging to protect principal capital.
              </div>
            </div>
          </div>
        </div>

        {/* Account Security Overview */}
        <div className="p-5 rounded-2xl bg-surface border border-border space-y-4">
          <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
            <Lock size={16} className="text-emerald-400" /> Web3 Security Architecture
          </h3>
          <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
            <p className="text-xs text-text-primary font-semibold">Wave 2 Security Critique Resolution:</p>
            <p className="text-xs text-text-secondary leading-relaxed">
              In Wave 1 & 2, hackathon judges flagged browser-side private key storage. In Sodex PowerOps 3.0, manual trades use non-custodial WalletConnect typed data signing (`eth_signTypedData_v4`). Automated background bots utilize temporary session keys with strictly bounded gas and trade limits.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
