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
    flashCrashSlippagePct, setFlashCrashSlippagePct,
    useAiTrailingStop, setUseAiTrailingStop
  } = useRiskStore();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 animate-fade-in p-3">
      <div className="w-full max-w-[480px] max-h-[85vh] bg-surface border border-border rounded-sm shadow-xl flex flex-col animate-fade-in overflow-hidden">
        
        {/* Header */}
        <div className="px-4 py-3 bg-[#101317] border-b border-border flex justify-between items-start shrink-0 select-none">
          <div>
            <div className="flex items-center gap-2 text-primary mb-1">
              <ShieldCheck size={16} />
              <h2 className="text-sm font-bold text-text-primary">{title}</h2>
            </div>
            <p className="text-[10px] text-text-secondary leading-normal font-sans">
              Configure global guardrails for {botName}. These settings override individual bot parameters to protect capital.
            </p>
          </div>
          <button onClick={onCancel} className="text-text-muted hover:text-text-primary p-1 cursor-pointer">
            <X size={15} />
          </button>
        </div>
        
        {/* Body */}
        <div className="p-4 space-y-4 overflow-y-auto scrollbar-none flex-1 font-sans text-xs">
          
          {/* AI Risk Threshold */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-text-primary flex items-center gap-1.5 select-none">
                <Zap size={13} className="text-warning animate-pulse-dot" /> AI Risk Override
              </label>
              <span className={cn("text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-sm border", aiRiskThreshold > 80 ? "bg-danger/10 border-danger/30 text-danger" : "bg-warning/10 border-warning/30 text-warning")}>
                Score Limit: {aiRiskThreshold}/100
              </span>
            </div>
            <p className="text-[10px] text-text-secondary">Pause operations if SoSoValue's AI real-time risk assessment exceeds this threshold.</p>
            <input 
              type="range" min="10" max="100" 
              value={aiRiskThreshold} onChange={e => setAiRiskThreshold(Number(e.target.value))}
              className="w-full accent-primary h-1 bg-[#0B0E11] rounded appearance-none cursor-pointer" 
            />
          </div>

          <hr className="border-border/60" />

          {/* Fee Drag Protection */}
          <label className="flex items-start gap-2.5 cursor-pointer group select-none">
            <div className="mt-0.5">
              <input 
                type="checkbox" 
                checked={feeDragProtection} onChange={e => setFeeDragProtection(e.target.checked)}
                className="w-3.5 h-3.5 rounded-sm border-border bg-[#0B0E11] accent-primary cursor-pointer" 
              />
            </div>
            <div>
              <div className="text-[11px] font-bold text-text-primary group-hover:text-primary transition-colors">Fee Drag Protection</div>
              <div className="text-[10px] text-text-secondary mt-0.5 leading-normal">
                Automatically prevent trades where exchange fees would exceed the projected grid or signal profit. Highly recommended for high-frequency bots.
              </div>
            </div>
          </label>
          <hr className="border-border/60" />

          {/* AI Trailing Stop Loss */}
          <label className="flex items-start gap-2.5 cursor-pointer group select-none">
            <div className="mt-0.5">
              <input 
                type="checkbox" 
                checked={useAiTrailingStop} onChange={e => setUseAiTrailingStop(e.target.checked)}
                className="w-3.5 h-3.5 rounded-sm border-border bg-[#0B0E11] accent-primary cursor-pointer" 
              />
            </div>
            <div>
              <div className="text-[11px] font-bold text-text-primary group-hover:text-primary transition-colors flex items-center gap-1.5">
                <span>Use AI Trailing Stop Loss</span>
                <span className="text-[8px] bg-primary/20 text-primary px-1.5 py-0.2 rounded font-extrabold uppercase">Local AI</span>
              </div>
              <div className="text-[10px] text-text-secondary mt-0.5 leading-normal">
                Let our offline Gemini AI monitor the market trend and adjust your stop-loss level dynamically to lock in profits as prices move in your favor.
              </div>
            </div>
          </label>

          <hr className="border-border/60" />

          {/* Max Loss Limit */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-text-primary select-none">Bot Auto-Kill Switch (Max Loss)</label>
            <div className="flex gap-2">
              <div className="flex bg-[#0B0E11] p-0.5 rounded-sm border border-border h-8 shrink-0 select-none">
                <button 
                  onClick={() => { setMaxLossMode('usd'); setMaxLossValue(100); }}
                  className={cn('px-2.5 text-[10px] font-bold rounded-sm transition-colors cursor-pointer', maxLossMode === 'usd' ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary')}
                >
                  $ (USD)
                </button>
                <button 
                  onClick={() => { setMaxLossMode('pct'); setMaxLossValue(5); }}
                  className={cn('px-2.5 text-[10px] font-bold rounded-sm transition-colors cursor-pointer', maxLossMode === 'pct' ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary')}
                >
                  % (Equity)
                </button>
              </div>
              <input 
                type="number" 
                value={maxLossValue} 
                onChange={e => setMaxLossValue(Number(e.target.value))}
                className="flex-1 bg-[#0B0E11] border border-border rounded-sm px-3 h-8 font-mono text-xs text-text-primary outline-none focus:border-primary" 
              />
            </div>
            <p className="text-[10px] text-text-secondary">If the bot's realized PnL drops below this threshold, all active orders are cancelled and the bot shuts down instantly.</p>
          </div>

          <hr className="border-border/60" />

          {/* Flash Crash Protection */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-text-primary flex items-center gap-1.5 select-none">
                <ShieldAlert size={13} className="text-primary" /> Max Flash-Crash Slippage
              </label>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-sm bg-primary-soft/10 text-primary border border-primary/20">
                {flashCrashSlippagePct}% Limit
              </span>
            </div>
            <p className="text-[10px] text-text-secondary">Avoids executing market orders or stop-losses during extreme liquidity dry-ups.</p>
            <input 
              type="range" min="0.1" max="10" step="0.1"
              value={flashCrashSlippagePct} onChange={e => setFlashCrashSlippagePct(Number(e.target.value))}
              className="w-full accent-primary h-1 bg-[#0B0E11] rounded appearance-none cursor-pointer" 
            />
          </div>

        </div>

        {/* Footer */}
        <div className="p-3 bg-[#101317] border-t border-border flex gap-3 shrink-0 select-none">
          <button onClick={onCancel} className="flex-1 h-8 rounded-sm font-bold text-text-secondary hover:text-text-primary bg-transparent border border-border text-[11px] transition-colors cursor-pointer">Cancel</button>
          <button 
            onClick={onConfirm}
            className="flex-1 h-8 rounded-sm font-bold text-white bg-primary hover:bg-primary/90 text-[11px] transition-colors flex items-center justify-center gap-1 cursor-pointer"
          >
            <Play size={12} className="fill-current" /> Deploy Securely
          </button>
        </div>
      </div>
    </div>
  );
};
