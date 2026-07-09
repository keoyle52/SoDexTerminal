import React from 'react';
import { ShieldCheck, ShieldAlert, Zap, X, Play } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useRiskStore } from '../../store/riskStore';

export interface BotRiskSetupModalProps {
  isOpen: boolean;
  title?: string;
  botName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const BotRiskSetupModal: React.FC<BotRiskSetupModalProps> = ({
  isOpen,
  title = "Universal Risk Shield Setup",
  botName,
  onConfirm,
  onCancel,
}) => {
  const {
    aiRiskThreshold, setAiRiskThreshold,
    feeDragProtection, setFeeDragProtection,
    maxLossMode, setMaxLossMode,
    maxLossValue, setMaxLossValue,
    flashCrashSlippagePct, setFlashCrashSlippagePct
  } = useRiskStore();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300 p-2 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-[550px] bg-surface border border-info/20 rounded-3xl shadow-[0_10px_40px_-10px_rgba(37,99,235,0.2)] flex flex-col animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-info/10 to-primary/5 border-b border-border flex justify-between items-start shrink-0 rounded-t-3xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-info/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 text-info mb-2">
              <ShieldCheck size={28} />
              <h2 className="text-xl font-black">{title}</h2>
            </div>
            <p className="text-sm text-text-secondary font-medium">
              Configure global guardrails for {botName}. These settings override individual bot parameters to ensure maximum capital protection.
            </p>
          </div>
          <button onClick={onCancel} className="text-text-muted hover:text-text-primary p-1 relative z-10">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4 sm:p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
          
          {/* AI Risk Threshold */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-text-primary flex items-center gap-2">
                <Zap size={16} className="text-warning" /> AI Risk Override
              </label>
              <span className={cn("text-xs font-mono font-bold px-2 py-0.5 rounded", aiRiskThreshold > 80 ? "bg-red-500/20 text-red-400" : "bg-warning/20 text-warning")}>
                Score Limit: {aiRiskThreshold}/100
              </span>
            </div>
            <p className="text-[11px] text-text-muted">Pause operations if SoSoValue's AI real-time risk assessment exceeds this threshold.</p>
            <input 
              type="range" min="10" max="100" 
              value={aiRiskThreshold} onChange={e => setAiRiskThreshold(Number(e.target.value))}
              className="w-full accent-warning h-1.5 bg-surface-2 rounded-lg appearance-none cursor-pointer" 
            />
          </div>

          <hr className="border-border" />

          {/* Fee Drag Protection */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="mt-0.5">
              <input 
                type="checkbox" 
                checked={feeDragProtection} onChange={e => setFeeDragProtection(e.target.checked)}
                className="w-4 h-4 rounded border-border bg-surface-2 accent-info cursor-pointer" 
              />
            </div>
            <div>
              <div className="text-sm font-bold text-text-primary group-hover:text-info transition-colors">Fee Drag Protection</div>
              <div className="text-[11px] text-text-muted mt-1 leading-relaxed">
                Automatically prevent trades where exchange fees (Maker/Taker) would exceed the projected grid or signal profit. Highly recommended for high-frequency bots.
              </div>
            </div>
          </label>

          <hr className="border-border" />

          {/* Max Loss Limit */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-text-primary">Bot Auto-Kill Switch (Max Loss)</label>
            <div className="flex gap-2">
              <div className="flex bg-surface-2 p-1 rounded-xl border border-border">
                <button 
                  onClick={() => { setMaxLossMode('usd'); setMaxLossValue(100); }}
                  className={cn('px-4 py-2 rounded-lg text-xs font-black transition-all', maxLossMode === 'usd' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'text-text-muted hover:text-text-primary')}
                >
                  $ (USD)
                </button>
                <button 
                  onClick={() => { setMaxLossMode('pct'); setMaxLossValue(5); }}
                  className={cn('px-4 py-2 rounded-lg text-xs font-black transition-all', maxLossMode === 'pct' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'text-text-muted hover:text-text-primary')}
                >
                  % (Equity)
                </button>
              </div>
              <input 
                type="number" 
                value={maxLossValue} 
                onChange={e => setMaxLossValue(Number(e.target.value))}
                className="flex-1 bg-surface-2 border border-border rounded-xl px-4 py-2 font-mono text-sm text-text-primary outline-none focus:border-red-500/50" 
              />
            </div>
            <p className="text-[11px] text-text-muted">If the bot's realized PnL drops below this threshold, all active orders are cancelled and the bot shuts down instantly.</p>
          </div>

          <hr className="border-border" />

          {/* Flash Crash Protection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-text-primary flex items-center gap-2">
                <ShieldAlert size={16} className="text-primary" /> Max Flash-Crash Slippage
              </label>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-primary/20 text-primary">
                {flashCrashSlippagePct}% Limit
              </span>
            </div>
            <p className="text-[11px] text-text-muted">Avoids executing market orders or stop-losses during extreme liquidity dry-ups.</p>
            <input 
              type="range" min="0.1" max="10" step="0.1"
              value={flashCrashSlippagePct} onChange={e => setFlashCrashSlippagePct(Number(e.target.value))}
              className="w-full accent-primary h-1.5 bg-surface-2 rounded-lg appearance-none cursor-pointer" 
            />
          </div>

        </div>

        <div className="p-4 sm:p-6 bg-surface-2 border-t border-border flex gap-3 sm:gap-4 shrink-0 rounded-b-3xl">
          <button onClick={onCancel} className="flex-1 py-3.5 rounded-xl font-bold text-text-muted hover:text-text-primary bg-background border border-border transition-colors">Cancel</button>
          <button 
            onClick={onConfirm}
            className="flex-1 py-3.5 rounded-xl font-black text-background bg-info hover:bg-info/90 shadow-lg shadow-info/20 transition-all flex items-center justify-center gap-2 group"
          >
            <Play size={18} className="fill-current group-hover:scale-110 transition-transform" /> Deploy Securely
          </button>
        </div>
      </div>
    </div>
  );
};
