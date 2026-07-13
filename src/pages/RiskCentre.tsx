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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Risk Mitigation Policy Panel */}
        <div className="p-5 rounded-sm bg-surface border border-border space-y-4">
          <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
            <Cpu size={16} className="text-primary" /> Automated Risk Mitigation Engine
          </h3>
          <div className="space-y-3 text-xs leading-relaxed text-text-secondary">
            <div className="p-3 rounded-sm bg-[#0B0E11] border border-border flex items-start gap-3">
              <div className="p-2 rounded-sm bg-emerald-500/10 text-emerald-400 shrink-0">
                <ShieldCheck size={16} />
              </div>
              <div>
                <strong className="text-text-primary block mb-0.5">Dynamic ATR Volatility Sizing</strong>
                Position sizes automatically adjust based on Average True Range to keep drawdown bounded under 2.0% per trade.
              </div>
            </div>

            <div className="p-3 rounded-sm bg-[#0B0E11] border border-border flex items-start gap-3">
              <div className="p-2 rounded-sm bg-amber-500/10 text-amber-400 shrink-0">
                <AlertTriangle size={16} />
              </div>
              <div>
                <strong className="text-text-primary block mb-0.5">Liquidation Flash Guard</strong>
                If margin distance drops below 10%, the execution daemon runs market de-leveraging to protect principal capital.
              </div>
            </div>
          </div>
        </div>

        {/* Account Security Overview */}
        <div className="p-5 rounded-sm bg-surface border border-border space-y-4">
          <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
            <Lock size={16} className="text-emerald-400" /> Web3 Security Architecture
          </h3>
          <div className="p-4 rounded-sm bg-[#0B0E11] border border-border space-y-2">
            <p className="text-xs text-text-primary font-semibold">Wave 2 Security Critique Resolution:</p>
            <p className="text-xs text-text-secondary leading-normal">
              In Wave 1 & 2, hackathon judges flagged browser-side private key storage. In Sodex PowerOps 3.0, manual trades use non-custodial WalletConnect typed data signing (`eth_signTypedData_v4`). Automated background bots utilize temporary session keys with strictly bounded gas and trade limits.
            </p>
          </div>
        </div>

        {/* Asset Allocation Donut Chart Card */}
        <div className="p-5 rounded-sm bg-surface border border-border flex flex-col justify-between">
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-2">Asset Allocation</h3>
          
          <div className="flex items-center justify-around gap-4 py-2">
            {/* SVG Donut */}
            <div className="relative w-24 h-24 shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
                {/* Background segment placeholder */}
                <circle cx="40" cy="40" r="30" fill="transparent" stroke="#161A20" strokeWidth="9" />
                {/* BTC (45%): size = 84.825, offset = 103.675 */}
                <circle cx="40" cy="40" r="30" fill="transparent" stroke="#F7931A" strokeWidth="9" strokeDasharray="188.5" strokeDashoffset="103.675" />
                {/* ETH (30%): size = 56.55, offset = 147.025 */}
                <circle cx="40" cy="40" r="30" fill="transparent" stroke="#627EEA" strokeWidth="9" strokeDasharray="188.5" strokeDashoffset="147.025" transform="rotate(162 40 40)" />
                {/* SOL (15%): size = 28.275, offset = 160.225 */}
                <circle cx="40" cy="40" r="30" fill="transparent" stroke="#14F195" strokeWidth="9" strokeDasharray="188.5" strokeDashoffset="160.225" transform="rotate(270 40 40)" />
                {/* SOSO (10%): size = 18.85, offset = 169.65 */}
                <circle cx="40" cy="40" r="30" fill="transparent" stroke="#F0B90B" strokeWidth="9" strokeDasharray="188.5" strokeDashoffset="169.65" transform="rotate(324 40 40)" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[8px] text-text-secondary uppercase font-bold">Total</span>
                <span className="text-xs font-black text-text-primary font-mono">$78.2K</span>
              </div>
            </div>

            {/* Legend list */}
            <div className="flex flex-col gap-1.5 font-mono text-[9px] select-text">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-[#F7931A] rounded-sm shrink-0" />
                <span className="text-text-secondary font-medium">BTC: 45%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-[#627EEA] rounded-sm shrink-0" />
                <span className="text-text-secondary font-medium">ETH: 30%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-[#14F195] rounded-sm shrink-0" />
                <span className="text-text-secondary font-medium">SOL: 15%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-[#F0B90B] rounded-sm shrink-0" />
                <span className="text-text-secondary font-medium">SOSO: 10%</span>
              </div>
            </div>
          </div>
          
          <div className="text-[10px] text-text-muted leading-relaxed font-sans mt-3 border-t border-border/40 pt-2 select-text">
            Weighted allocation across active spot vaults and perpetual collateral accounts.
          </div>
        </div>
      </div>
    </div>
  );
};
