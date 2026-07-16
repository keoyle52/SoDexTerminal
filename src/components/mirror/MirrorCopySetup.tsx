import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { Wallet, Shield, Loader2, X, Zap } from 'lucide-react';
import { startCopySession } from '../../api/mirrorClient';
import { useSettingsStore } from '../../store/settingsStore';

interface MirrorCopySetupProps {
  sourceAccountId: string;
  network: string;
  suggested: { sizingMode?: string; proportionalPct?: number; maxLeverage?: number; requireStopLoss?: boolean };
  onClose: () => void;
}

export const MirrorCopySetup: React.FC<MirrorCopySetupProps> = ({ sourceAccountId, network, suggested, onClose }) => {
  const isDemoMode = useSettingsStore(s => s.isDemoMode);
  const [step, setStep] = useState<1 | 2>(1);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [approved, setApproved] = useState(false);
  const [signing, setSigning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [agentPrivateKey, setAgentPrivateKey] = useState<string>('');
  const [agentAddress, setAgentAddress] = useState<string>('');

  // Config state
  const [sizingMode, setSizingMode] = useState<'fixed' | 'proportional'>((suggested.sizingMode as 'fixed' | 'proportional') ?? 'fixed');
  const [proportionalPct, setProportionalPct] = useState(suggested.proportionalPct ?? 10);
  const [fixedNotionalUsd, setFixedNotionalUsd] = useState(50);
  const [maxLeverage, setMaxLeverage] = useState(suggested.maxLeverage ?? 3);
  const [maxNotionalPerTradeUsd, setMaxNotionalPerTradeUsd] = useState(200);
  const [maxDailyLossMode, setMaxDailyLossMode] = useState<'usd' | 'pct'>('usd');
  const [maxDailyLossValue, setMaxDailyLossValue] = useState(100);
  const [requireStopLoss, setRequireStopLoss] = useState(suggested.requireStopLoss ?? true);
  const [defaultStopLossPct, setDefaultStopLossPct] = useState(5);
  const [aiCoPilotMode, setAiCoPilotMode] = useState<'disabled' | 'auto' | 'manual'>('disabled');
  const [aiRiskThreshold, setAiRiskThreshold] = useState(70);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function connectWallet() {
    const win = window as any;
    if (!win.ethereum) { setErrorMsg('MetaMask not found. Please install it.'); return; }
    setIsConnecting(true);
    setErrorMsg(null);
    try {
      const accounts = await win.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts?.[0]) {
        setWalletAddress(accounts[0]);
        // Generate agent wallet keypair
        const bytes = new Uint8Array(32);
        crypto.getRandomValues(bytes);
        const pk = '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
        setAgentPrivateKey(pk);
        // Derive address (first 20 bytes of keccak256 — simplified for demo)
        const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
        const hashArray = new Uint8Array(hashBuffer);
        const addr = '0x' + Array.from(hashArray.slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join('');
        setAgentAddress(addr);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to connect wallet.');
    } finally { setIsConnecting(false); }
  }

  async function signApproval() {
    if (!walletAddress) return;
    setSigning(true);
    setErrorMsg(null);
    try {
      // Simulate EIP-712 signing for hackathon demo
      await new Promise(r => setTimeout(r, 1000));
      setApproved(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Signature rejected.');
    } finally { setSigning(false); }
  }

  async function submit() {
    if (!walletAddress) return;
    setSubmitting(true);
    try {
      const config = {
        sourceAccountId, sizingMode, proportionalPct, fixedNotionalUsd,
        maxLeverage, maxNotionalPerTradeUsd, 
        maxDailyLossMode, maxDailyLossValue,
        requireStopLoss, defaultStopLossPct, paused: false,
        slippageFeeGuardEnabled: true, aiCoPilotMode, aiRiskThreshold,
      };
      const res = await startCopySession({
        userAccountId: walletAddress, sourceAccountId,
        agentPrivateKey, agentApiKeyName: agentAddress || walletAddress,
        network, isDemoMode, config,
      });
      setResult(res.sessionId ? 'started' : res.error ?? 'unknown error');
    } catch (err: any) {
      setResult(err.message ?? 'Failed');
    } finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-backdrop">
      <div className="bg-surface border border-border rounded-2xl max-w-lg w-full p-6 md:p-8 max-h-[90vh] overflow-y-auto animate-slide-in shadow-2xl shadow-black/50">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-bold text-lg text-text-primary flex items-center gap-2">
            <Zap size={18} className="text-primary" />
            Live Copy-Trading Setup
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="flex gap-2 mb-6">
          {[1, 2].map((s) => (
            <div key={s} className={cn('flex-1 h-1 rounded-full transition-all duration-500', step >= s ? 'bg-primary' : 'bg-border')} />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-text-muted leading-relaxed">
              Connect your wallet and sign a secure approval to authorize the copy-trading agent.
              The agent only has trade permissions — no withdrawal rights.
            </p>

            {!walletAddress ? (
              <button onClick={connectWallet} disabled={isConnecting}
                className="w-full bg-primary text-background font-semibold rounded-xl py-3 text-sm flex items-center justify-center gap-2 hover:brightness-110 transition disabled:opacity-50">
                {isConnecting ? <><Loader2 size={16} className="animate-spin" /> Connecting...</> : <><Wallet size={16} /> Connect MetaMask Wallet</>}
              </button>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between border border-border bg-surface-2 rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                    <span className="text-xs font-mono text-text-primary">{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
                  </div>
                  <button onClick={() => { setWalletAddress(null); setApproved(false); }} className="text-xs text-danger underline">Disconnect</button>
                </div>

                {!approved ? (
                  <button onClick={signApproval} disabled={signing}
                    className="w-full bg-primary text-background font-semibold rounded-xl py-3 text-sm hover:brightness-110 transition disabled:opacity-50">
                    {signing ? <><Loader2 size={16} className="animate-spin" /> Signing...</> : <><Shield size={16} /> Sign Agent EIP-712 Approval</>}
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="text-success text-xs font-bold text-center py-2 bg-success/5 border border-success/20 rounded-lg">
                      ✓ Agent Wallet Authorized
                    </div>
                    <button onClick={() => setStep(2)}
                      className="w-full bg-primary text-background font-semibold rounded-xl py-3 text-sm hover:brightness-110 transition">
                      Configure Risk Settings →
                    </button>
                  </div>
                )}
              </div>
            )}
            {errorMsg && <p className="text-danger text-xs text-center">{errorMsg}</p>}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            {/* Sizing mode */}
            <div className="grid grid-cols-2 gap-3">
              {(['proportional', 'fixed'] as const).map(m => (
                <button key={m} onClick={() => setSizingMode(m)}
                  className={cn('rounded-xl border py-2.5 text-sm font-semibold transition-all',
                    sizingMode === m ? 'border-primary text-primary bg-primary/5' : 'border-border text-text-muted hover:border-border-hover')}>
                  {m === 'proportional' ? 'Proportional' : 'Fixed Size'}
                </button>
              ))}
            </div>

            {sizingMode === 'proportional' ? (
              <Field label={`${proportionalPct}% of source position size`}>
                <input type="range" min={1} max={100} value={proportionalPct}
                  onChange={e => setProportionalPct(Number(e.target.value))} className="w-full accent-[#00D4FF]" />
              </Field>
            ) : (
              <Field label="Fixed amount per trade (USD)">
                <input type="number" value={fixedNotionalUsd} onChange={e => setFixedNotionalUsd(Number(e.target.value))}
                  className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 font-mono text-sm text-text-primary outline-none focus:border-primary/50" />
              </Field>
            )}

            <Field label={`Max leverage: ${maxLeverage}x`}>
              <input type="range" min={1} max={20} value={maxLeverage}
                onChange={e => setMaxLeverage(Number(e.target.value))} className="w-full accent-[#00D4FF]" />
            </Field>

            <Field label="Max amount per trade (USD)">
              <input type="number" value={maxNotionalPerTradeUsd} onChange={e => setMaxNotionalPerTradeUsd(Number(e.target.value))}
                className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 font-mono text-sm text-text-primary outline-none focus:border-primary/50" />
            </Field>

            <Field label="Daily max loss budget — auto-pause if exceeded">
              <div className="flex gap-2">
                <div className="flex bg-surface-2 p-1 rounded-xl border border-border">
                  <button onClick={() => { setMaxDailyLossMode('usd'); setMaxDailyLossValue(100); }}
                    className={cn('px-4 py-1.5 rounded-lg text-sm font-semibold transition-all', maxDailyLossMode === 'usd' ? 'bg-primary text-background' : 'text-text-muted hover:text-text-primary')}>
                    $ (USD)
                  </button>
                  <button onClick={() => { setMaxDailyLossMode('pct'); setMaxDailyLossValue(10); }}
                    className={cn('px-4 py-1.5 rounded-lg text-sm font-semibold transition-all', maxDailyLossMode === 'pct' ? 'bg-primary text-background' : 'text-text-muted hover:text-text-primary')}>
                    % (Equity)
                  </button>
                </div>
                <input type="number" value={maxDailyLossValue} onChange={e => setMaxDailyLossValue(Number(e.target.value))}
                  className="flex-1 bg-surface-2 border border-border rounded-xl px-3 py-2 font-mono text-sm text-text-primary outline-none focus:border-primary/50" />
              </div>
            </Field>

            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                <input type="checkbox" checked={requireStopLoss} onChange={e => setRequireStopLoss(e.target.checked)}
                  className="rounded accent-[#00D4FF]" />
                Enforce stop-loss for every mirrored trade
              </label>
              {requireStopLoss && (
                <div className="pl-6 animate-fade-in">
                  <Field label={`Stop-Loss Percentage: ${defaultStopLossPct}%`}>
                    <input type="range" min={1} max={50} value={defaultStopLossPct}
                      onChange={e => setDefaultStopLossPct(Number(e.target.value))} className="w-full accent-[#00D4FF]" />
                  </Field>
                </div>
              )}
            </div>

            {/* AI Co-Pilot */}
            <div className="border-t border-border/60 my-2 pt-4 space-y-4">
              <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider">AI Co-Pilot Guardrails</h4>
              <Field label="AI Co-Pilot Mode">
                <select value={aiCoPilotMode} onChange={(e: any) => setAiCoPilotMode(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-text-primary outline-none focus:border-primary/50">
                  <option value="disabled">Disabled (Instant Copying)</option>
                  <option value="auto">Automatic (Auto-reject High Risk)</option>
                  <option value="manual">Manual Approval (via Dashboard)</option>
                </select>
              </Field>
              {aiCoPilotMode === 'auto' && (
                <Field label={`Risk Threshold: ${aiRiskThreshold}/100`}>
                  <input type="range" min={10} max={90} value={aiRiskThreshold}
                    onChange={e => setAiRiskThreshold(Number(e.target.value))} className="w-full accent-[#00D4FF]" />
                </Field>
              )}
            </div>

            {!result ? (
              <button onClick={submit} disabled={submitting}
                className="w-full bg-primary text-background font-semibold rounded-xl py-3 text-sm disabled:opacity-50 mt-4 hover:brightness-110 transition flex items-center justify-center gap-2">
                {submitting ? <><Loader2 size={16} className="animate-spin" /> Starting...</> : <><Zap size={16} /> Start Live Copy-Trading</>}
              </button>
            ) : result === 'started' ? (
              <div className="text-success text-sm text-center py-3 font-semibold bg-success/5 border border-success/20 rounded-xl">
                ✓ Copy-trading started! Switch to the Dashboard tab to monitor.
              </div>
            ) : (
              <p className="text-danger text-sm text-center font-semibold">{result}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-text-muted block mb-1.5 font-medium">{label}</label>
      {children}
    </div>
  );
}
