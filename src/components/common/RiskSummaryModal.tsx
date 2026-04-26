import React, { useState } from 'react';
import { X, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../../lib/utils';

/**
 * Generic line item shown in the modal. The page that opens the modal
 * supplies an array of these so the modal stays presentation-only.
 */
export interface RiskSummaryRow {
  label: string;
  value: string;
  /** Optional emphasis tier — drives colour and ordering hints. */
  tone?: 'default' | 'warning' | 'positive' | 'critical';
  /** Optional secondary line shown beneath the value. */
  hint?: string;
}

export interface RiskSummaryModalProps {
  isOpen: boolean;
  /** Headline (e.g. "Grid Bot Summary"). */
  title: string;
  /** Sub-headline (e.g. "Review the run before launch"). */
  subtitle?: string;
  rows: RiskSummaryRow[];
  /**
   * Optional risk level override. When provided, drives the warning banner
   * colour; defaults to inferring from row tones.
   */
  risk?: 'Low' | 'Medium' | 'High';
  /** Total capital exposure summary used by the prominent footer banner. */
  totalRisk?: string;
  /** Free-text disclaimer line. */
  disclaimer?: string;
  /** Confirmation button text — defaults to "Confirm & Start". */
  confirmLabel?: string;
  /** Cancellation button text — defaults to "Cancel". */
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const TONE_STYLES: Record<NonNullable<RiskSummaryRow['tone']>, string> = {
  default:  'text-text-primary',
  warning:  'text-amber-400',
  positive: 'text-emerald-400',
  critical: 'text-red-400',
};

const RISK_BANNER: Record<'Low' | 'Medium' | 'High', { text: string; icon: typeof ShieldCheck; className: string; description: string }> = {
  Low: {
    text: 'Low risk',
    icon: ShieldCheck,
    className: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
    description: 'Conservative parameters. Capital exposure is limited.',
  },
  Medium: {
    text: 'Medium risk',
    icon: AlertTriangle,
    className: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
    description: 'Balanced exposure. Monitor while running.',
  },
  High: {
    text: 'High risk',
    icon: AlertTriangle,
    className: 'bg-red-500/10 border-red-500/30 text-red-300',
    description: 'Aggressive setup. Drawdowns are possible — confirm intent.',
  },
};

function inferRiskFromRows(rows: RiskSummaryRow[]): 'Low' | 'Medium' | 'High' {
  const hasCritical = rows.some((r) => r.tone === 'critical');
  if (hasCritical) return 'High';
  const warnings = rows.filter((r) => r.tone === 'warning').length;
  if (warnings >= 2) return 'High';
  if (warnings === 1) return 'Medium';
  return 'Low';
}

/**
 * Pre-launch confirmation modal that surfaces every parameter the user is
 * about to commit capital to. Designed to satisfy the "confirmation
 * mechanisms" UX bonus without forcing each bot page to redesign its own
 * modal — pages just hand it a `rows` array.
 */
export const RiskSummaryModal: React.FC<RiskSummaryModalProps> = ({
  isOpen,
  title,
  subtitle,
  rows,
  risk,
  totalRisk,
  disclaimer,
  confirmLabel = 'Confirm & Start',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}) => {
  const [acknowledged, setAcknowledged] = useState(false);

  if (!isOpen) return null;

  const resolvedRisk = risk ?? inferRiskFromRows(rows);
  const banner = RISK_BANNER[resolvedRisk];
  const BannerIcon = banner.icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-backdrop p-4"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)' }}
    >
      <div
        className="glass-card w-full max-w-lg shadow-2xl animate-fade-in flex flex-col"
        style={{ border: '1px solid rgba(27,34,48,0.85)' }}
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-border">
          <div className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
            banner.className,
          )}>
            <BannerIcon size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-text-primary leading-tight">{title}</h3>
            {subtitle && (
              <p className="text-xs text-text-muted mt-1 leading-relaxed">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onCancel}
            className="text-text-muted hover:text-text-primary transition-colors rounded-lg p-1 hover:bg-surface-hover shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Risk banner */}
        <div className={cn(
          'mx-5 mt-4 px-3 py-2 rounded-lg border text-xs flex items-center gap-2',
          banner.className,
        )}>
          <BannerIcon size={13} className="shrink-0" />
          <span className="font-bold uppercase tracking-wide">{banner.text}</span>
          <span className="text-[11px] opacity-80 truncate">— {banner.description}</span>
        </div>

        {/* Rows */}
        <div className="px-5 py-4 flex flex-col gap-2 max-h-[55vh] overflow-y-auto">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-start justify-between gap-4 py-2 px-3 rounded-lg bg-white/[0.02] border border-white/5"
            >
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">
                  {row.label}
                </div>
                {row.hint && (
                  <div className="text-[10px] text-text-muted/80 mt-0.5">{row.hint}</div>
                )}
              </div>
              <div className={cn(
                'text-sm font-mono font-semibold text-right break-words max-w-[60%]',
                TONE_STYLES[row.tone ?? 'default'],
              )}>
                {row.value}
              </div>
            </div>
          ))}
        </div>

        {/* Total risk + acknowledgement */}
        {totalRisk && (
          <div className="px-5 pb-2">
            <div className="px-3 py-2.5 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-primary font-bold">
                Total capital at risk
              </span>
              <span className="text-base font-bold font-mono text-primary">
                {totalRisk}
              </span>
            </div>
          </div>
        )}

        {disclaimer && (
          <div className="px-5 pb-2">
            <p className="text-[10px] text-text-muted leading-relaxed">{disclaimer}</p>
          </div>
        )}

        <label className="px-5 pb-3 flex items-start gap-2 cursor-pointer text-xs text-text-secondary">
          <input
            type="checkbox"
            className="mt-0.5 accent-primary"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
          />
          <span>I have reviewed the parameters above and accept the associated risk.</span>
        </label>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-border bg-background/30">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!acknowledged}
            onClick={() => { onConfirm(); }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
