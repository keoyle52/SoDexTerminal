import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, Play, Zap, TrendingUp, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface RiskSummaryRow {
  label: string;
  value: string;
  tone?: 'default' | 'warning' | 'positive' | 'critical';
  hint?: string;
}

export interface RiskSummaryModalProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  rows?: RiskSummaryRow[];
  risk?: 'Low' | 'Medium' | 'High';
  totalRisk?: string;
  disclaimer?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** For Wave3 backward compat */
  botName?: string;
}

const TONE_STYLES: Record<NonNullable<RiskSummaryRow['tone']>, string> = {
  default:  'text-text-primary',
  warning:  'text-amber-400',
  positive: 'text-emerald-400',
  critical: 'text-red-400',
};

function inferRiskFromRows(rows: RiskSummaryRow[]): 'Low' | 'Medium' | 'High' {
  const hasCritical = rows.some((r) => r.tone === 'critical');
  if (hasCritical) return 'High';
  const warnings = rows.filter((r) => r.tone === 'warning').length;
  if (warnings >= 2) return 'High';
  if (warnings === 1) return 'Medium';
  return 'Low';
}

export const RiskSummaryModal: React.FC<RiskSummaryModalProps> = ({
  isOpen,
  title,
  subtitle,
  rows = [],
  risk,
  totalRisk,
  disclaimer,
  confirmLabel = 'Confirm & Execute',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  botName,
}) => {
  const [flash, setFlash] = useState(true);
  const [feeDrag, setFeeDrag] = useState(true);
  const [drawdown, setDrawdown] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  if (!isOpen) return null;

  const resolvedRisk = risk ?? (rows.length > 0 ? inferRiskFromRows(rows) : 'Medium');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300 p-4">
      <div className="w-[500px] max-w-full max-h-[90vh] bg-surface border border-border rounded-3xl shadow-2xl overflow-y-auto custom-scrollbar animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b border-border flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 text-amber-500 mb-2">
              <AlertTriangle size={24} />
              <h2 className="text-xl font-black">{title || 'Pre-Flight Risk Check'}</h2>
            </div>
            <p className="text-sm text-text-secondary font-medium">
              {subtitle || `Gemini AI is analyzing current market conditions before deploying ${botName || 'the bot'}. Please review recommended safeguards.`}
            </p>
          </div>
          <button onClick={onCancel} className="text-text-muted hover:text-text-primary p-1">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          {/* AI Risk Assessment */}
          <div className={cn(
            "p-4 rounded-xl border flex items-center justify-between",
            resolvedRisk === 'Low' ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" :
            resolvedRisk === 'Medium' ? "bg-amber-500/10 border-amber-500/30 text-amber-400" :
            "bg-red-500/10 border-red-500/30 text-red-400"
          )}>
            <div className="flex items-center gap-2">
              {resolvedRisk === 'Low' ? <ShieldCheck size={20} /> : <AlertTriangle size={20} />}
              <span className="font-bold">AI Risk Assessment</span>
            </div>
            <div className="font-black text-lg uppercase tracking-wider">{resolvedRisk} RISK</div>
          </div>

          {/* Rows (Optional, shown if provided by GridBot/etc) */}
          {rows.length > 0 && (
            <div className="space-y-2 mb-4 bg-background/50 rounded-xl p-3 border border-border">
              {rows.map((row) => (
                <div key={row.label} className="flex items-start justify-between gap-4 py-1">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs uppercase tracking-wider text-text-muted font-bold">{row.label}</div>
                    {row.hint && <div className="text-[10px] text-text-muted/80">{row.hint}</div>}
                  </div>
                  <div className={cn("text-sm font-mono font-bold text-right", TONE_STYLES[row.tone ?? 'default'])}>
                    {row.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Capital at Risk */}
          {totalRisk && (
            <div className="px-4 py-3 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-between mb-4">
              <span className="text-xs uppercase tracking-wider text-primary font-bold">Total Capital At Risk</span>
              <span className="text-lg font-black font-mono text-primary">{totalRisk}</span>
            </div>
          )}

          {/* Pre-Flight Safeties */}
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
          
          {rows.length > 0 && (
            <label className="flex items-start gap-2 cursor-pointer text-xs text-text-secondary mt-4">
              <input type="checkbox" className="mt-0.5 accent-primary" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />
              <span>I have reviewed the parameters above and accept the associated risk.</span>
            </label>
          )}
        </div>

        <div className="p-6 bg-surface-2 border-t border-border flex gap-4 sticky bottom-0">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl font-bold text-text-muted hover:text-text-primary bg-background border border-border transition-colors">{cancelLabel}</button>
          <button 
            onClick={onConfirm} 
            disabled={rows.length > 0 && !acknowledged}
            className="flex-1 py-3 rounded-xl font-black text-background bg-emerald-500 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play size={18} fill="currentColor" /> {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
