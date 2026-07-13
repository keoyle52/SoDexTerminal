import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, ShieldAlert, AlertTriangle, Activity, Lock, Cpu, Search, Loader2, Play } from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import { resolveWalletAddress, analyzeMirrorWallet } from '../api/mirrorClient';
import { localAiDiagnoseWallet } from '../api/localAiEngine';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';

// Session-level memory cache for wallet diagnostics
let cachedReportData: any = null;
let cachedAddress: string = '';
let cachedNetwork: string = '';

export const RiskCentre: React.FC = () => {
  const store = useSettingsStore();
  const geminiApiKey = store.sosoApiKey || store.geminiApiKey || '';

  const [addressInput, setAddressInput] = useState(cachedAddress || store.walletAddress || '');
  const [network, setNetwork] = useState(cachedNetwork || 'ethereum');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<any>(cachedReportData);

  // Auto-run analysis on mount if a wallet address is connected and not cached yet
  useEffect(() => {
    if (store.walletAddress) {
      const isCached = cachedAddress.toLowerCase() === store.walletAddress.toLowerCase() && cachedReportData;
      if (!isCached && !reportData && !loading && !error) {
        handleAnalyze(store.walletAddress, network);
      }
    }
  }, [store.walletAddress]);

  // Sync addressInput and clear cache if store wallet address changes to a new one
  useEffect(() => {
    if (store.walletAddress && store.walletAddress.toLowerCase() !== cachedAddress.toLowerCase()) {
      setAddressInput(store.walletAddress);
      setReportData(null);
      cachedReportData = null;
      cachedAddress = '';
      cachedNetwork = '';
      handleAnalyze(store.walletAddress, network);
    }
  }, [store.walletAddress]);

  const handleAnalyze = useCallback(async (address: string, net: string) => {
    if (!address.trim()) {
      toast.error('Please enter a valid wallet address.');
      return;
    }
    setLoading(true);
    setError(null);
    setReportData(null);

    const toastId = toast.loading(`Resolving address on ${net}...`);

    try {
      // Step 1: Resolve address to SoDEX Account ID
      const resolved = await resolveWalletAddress(address, net);
      if (!resolved || !resolved.accountId || resolved.accountId === 0) {
        throw new Error(`No active SoDEX account found for this wallet address on ${net}.`);
      }

      // Step 2: Analyze wallet risk metrics via AI engine
      let data;
      if (geminiApiKey) {
        try {
          toast.loading(`Analyzing transaction history and calculating VaR...`, { id: toastId });
          data = await analyzeMirrorWallet(address, resolved.accountId, net, geminiApiKey);
        } catch (apiErr) {
          console.warn('External AI call failed, falling back to local quantitative AI engine:', apiErr);
          data = await localAiDiagnoseWallet(address, resolved.accountId, net);
        }
      } else {
        toast.loading(`Analyzing transaction history (Local AI Engine)...`, { id: toastId });
        data = await localAiDiagnoseWallet(address, resolved.accountId, net);
      }

      setReportData(data);
      cachedReportData = data;
      cachedAddress = address;
      cachedNetwork = net;
      toast.success('Risk diagnostics completed successfully!', { id: toastId });
    } catch (err: any) {
      console.error('[RiskCentre resolve error]:', err);
      const detail = err.response?.data?.error ?? err.response?.data?.message ?? err.message ?? String(err);
      setError(`Failed to perform diagnostics: ${detail}`);
      toast.error(`Diagnostics Failed: ${detail}`, { id: toastId });
    } finally {
      setLoading(false);
    }
  }, [geminiApiKey]);

  return (
    <div className="p-4 md:p-6 min-h-full flex flex-col gap-6 overflow-y-auto bg-background select-text">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-sm bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-text-primary flex items-center gap-2">
              Neural Risk Centre
              <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-sm bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                AI Diagnostics
              </span>
            </h2>
            <p className="text-[11px] text-text-secondary leading-normal">
              Real-time wallet risk calculations, Value-at-Risk modeling, and behavioral analytics.
            </p>
          </div>
        </div>

        {reportData && (
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-sm bg-surface border border-border">
            <span className={cn("w-2 h-2 rounded-full animate-pulse", reportData.report?.riskScore > 75 ? "bg-danger" : reportData.report?.riskScore > 40 ? "bg-warning" : "bg-success")} />
            <span className="text-[10px] font-semibold text-text-secondary uppercase">Risk Rating:</span>
            <span className={cn("text-[10px] font-bold uppercase", reportData.report?.riskScore > 75 ? "text-danger" : reportData.report?.riskScore > 40 ? "text-warning" : "text-success")}>
              {reportData.report?.riskScore ?? 0}/100 ({reportData.report?.style ?? 'Neutral'})
            </span>
          </div>
        )}
      </div>

      {/* Input Wallet Panel if not loaded or loading */}
      {!reportData && !loading && (
        <div className="p-5 rounded-sm bg-surface border border-border space-y-4 max-w-xl mx-auto w-full">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-text-primary">EVM Wallet Risk Diagnostics</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Analyze historic on-chain exposures, liquidation buffers, win rates, and behavioral patterns.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5 block">Network</label>
              <select 
                value={network}
                onChange={(e) => setNetwork(e.target.value)}
                className="w-full bg-[#0B0E11] border border-border rounded-sm h-9 px-3 text-xs font-bold text-text-primary focus:outline-none focus:border-primary transition-colors cursor-pointer"
              >
                <option value="ethereum">Ethereum Mainnet</option>
                <option value="arbitrum">Arbitrum One</option>
                <option value="optimism">Optimism</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5 block">EVM Wallet Address</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={addressInput} 
                  onChange={(e) => setAddressInput(e.target.value)}
                  placeholder="0x..."
                  className="w-full bg-[#0B0E11] border border-border rounded-sm h-9 pl-3 pr-10 text-xs font-bold text-text-primary font-mono focus:outline-none focus:border-primary transition-colors" 
                />
                <button 
                  onClick={() => handleAnalyze(addressInput, network)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 bg-primary text-background flex items-center justify-center rounded-sm hover:bg-primary/95 transition-colors cursor-pointer"
                >
                  <Search size={14} />
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-sm bg-danger/10 border border-danger/20 text-xs text-danger leading-relaxed font-sans">
              {error}
            </div>
          )}

          <div className="p-3 bg-[#0B0E11] border border-border/80 rounded-sm text-[10px] text-text-muted leading-relaxed font-mono">
            Note: Neural diagnostics evaluates transactions via EIP-712 standard models. Requires a valid SoDEX history on the chosen network.
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="p-10 rounded-sm bg-surface border border-border flex flex-col items-center justify-center gap-4 text-center max-w-md mx-auto w-full">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-text-primary">Calculating Neural Risk Matrix</h4>
            <p className="text-xs text-text-secondary leading-normal max-w-xs">
              Resolving cross-chain records, assessing liquidation safety buffers, and conducting neural diagnostics...
            </p>
          </div>
        </div>
      )}

      {/* Loaded Analysis Dashboard */}
      {reportData && (
        <div className="space-y-6">
          {/* Main Risk Score Meter and AI Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* SVG Risk Meter */}
            <div className="p-5 rounded-sm bg-surface border border-border flex flex-col items-center justify-center text-center">
              <h3 className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-4">Neural Risk Index</h3>
              
              <div className="relative w-32 h-32 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#161A20" strokeWidth="8" />
                  <circle 
                    cx="50" 
                    cy="50" 
                    r="42" 
                    fill="none" 
                    stroke={reportData.report?.riskScore > 75 ? "#EF454A" : reportData.report?.riskScore > 40 ? "#F0B90B" : "#00B574"} 
                    strokeWidth="8" 
                    strokeDasharray="263.89"
                    strokeDashoffset={263.89 - (Math.min(100, Math.max(0, reportData.report?.riskScore ?? 0)) / 100) * 263.89}
                    strokeLinecap="round"
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center font-mono">
                  <span className="text-2xl font-black text-text-primary">{reportData.report?.riskScore ?? 0}</span>
                  <span className="text-[8px] text-text-secondary uppercase tracking-wider">Score</span>
                </div>
              </div>

              <div className="mt-4 space-y-1">
                <div className="text-xs font-bold text-text-primary uppercase">{reportData.report?.style ?? 'Neutral'}</div>
                <div className="text-[10px] text-text-muted truncate max-w-[200px] font-mono">{reportData.address}</div>
              </div>
            </div>

            {/* Cognitive Summary */}
            <div className="p-5 rounded-sm bg-surface border border-border flex flex-col justify-between lg:col-span-2">
              <div>
                <h3 className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <Activity size={12} className="text-primary" /> AI Cognitive Assessment
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed bg-[#0B0E11] border border-border p-4 rounded-sm">
                  {reportData.report?.summary ?? 'Risk analysis summary could not be retrieved from the model.'}
                </p>
              </div>

              {/* Retry / Switch Wallet button */}
              <div className="flex justify-end gap-2 mt-4">
                <button 
                  onClick={() => {
                    setReportData(null);
                    setError(null);
                    cachedReportData = null;
                    cachedAddress = '';
                    cachedNetwork = '';
                  }}
                  className="px-3 py-1.5 border border-border bg-surface hover:bg-surface-hover rounded-sm text-xs font-bold text-text-primary transition-colors cursor-pointer"
                >
                  Analyze Different Wallet
                </button>
                <button 
                  onClick={() => handleAnalyze(reportData.address, reportData.network)}
                  className="px-3 py-1.5 bg-primary text-background hover:bg-primary/95 rounded-sm text-xs font-bold transition-colors cursor-pointer"
                >
                  Refresh Diagnostics
                </button>
              </div>
            </div>
          </div>

          {/* Performance stats cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-sm bg-surface border border-border space-y-1">
              <div className="text-[9px] text-text-secondary uppercase tracking-widest font-bold">Total Trades</div>
              <div className="text-lg font-black text-text-primary font-mono">{reportData.report?.stats?.totalTrades ?? '—'}</div>
            </div>
            <div className="p-4 rounded-sm bg-surface border border-border space-y-1">
              <div className="text-[9px] text-text-secondary uppercase tracking-widest font-bold">Win Rate</div>
              <div className="text-lg font-black text-success font-mono">
                {reportData.report?.stats?.winRatePct != null ? `${reportData.report?.stats?.winRatePct}%` : '—'}
              </div>
            </div>
            <div className="p-4 rounded-sm bg-surface border border-border space-y-1">
              <div className="text-[9px] text-text-secondary uppercase tracking-widest font-bold">Avg Hold Time</div>
              <div className="text-lg font-black text-text-primary font-mono">
                {reportData.report?.stats?.avgHoldTimeMinutes != null ? `${reportData.report?.stats?.avgHoldTimeMinutes}m` : '—'}
              </div>
            </div>
            <div className="p-4 rounded-sm bg-surface border border-border space-y-1">
              <div className="text-[9px] text-text-secondary uppercase tracking-widest font-bold">Max Observed Leverage</div>
              <div className="text-lg font-black text-warning font-mono">
                {reportData.report?.stats?.maxLeverageObserved != null ? `${reportData.report?.stats?.maxLeverageObserved}x` : '—'}
              </div>
            </div>
          </div>

          {/* Performance Edges and Risk Factors */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Edges */}
            <div className="p-5 rounded-sm bg-surface border border-border space-y-4">
              <h3 className="text-xs font-bold text-success uppercase tracking-wider border-b border-border/40 pb-2">
                ✓ Performance Strengths
              </h3>
              <div className="space-y-2">
                {(reportData.report?.performanceEdges?.positive ?? []).map((e: string, i: number) => (
                  <div key={i} className="p-2.5 bg-success/5 border border-success/15 rounded-sm text-[11px] text-text-secondary leading-normal">
                    {e}
                  </div>
                ))}
                {(!reportData.report?.performanceEdges?.positive || reportData.report?.performanceEdges?.positive.length === 0) && (
                  <div className="text-[11px] text-text-muted italic text-center py-4">No distinct positive edges found.</div>
                )}
              </div>
            </div>

            {/* Leakages */}
            <div className="p-5 rounded-sm bg-surface border border-border space-y-4">
              <h3 className="text-xs font-bold text-warning uppercase tracking-wider border-b border-border/40 pb-2">
                ✕ Anti-Patterns & Leakages
              </h3>
              <div className="space-y-2">
                {(reportData.report?.performanceEdges?.negative ?? []).map((e: string, i: number) => (
                  <div key={i} className="p-2.5 bg-warning/5 border border-warning/15 rounded-sm text-[11px] text-text-secondary leading-normal">
                    {e}
                  </div>
                ))}
                {(!reportData.report?.performanceEdges?.negative || reportData.report?.performanceEdges?.negative.length === 0) && (
                  <div className="text-[11px] text-text-muted italic text-center py-4">No distinct leakages observed.</div>
                )}
              </div>
            </div>

            {/* Risk Factors */}
            <div className="p-5 rounded-sm bg-surface border border-border space-y-4">
              <h3 className="text-xs font-bold text-danger uppercase tracking-wider border-b border-border/40 pb-2">
                ⚠ Critical Exposure Vectors
              </h3>
              <div className="space-y-2">
                {(reportData.report?.riskFactors ?? []).map((e: string, i: number) => (
                  <div key={i} className="p-2.5 bg-danger/5 border border-danger/15 rounded-sm text-[11px] text-text-secondary leading-normal flex gap-2">
                    <AlertTriangle size={14} className="text-danger shrink-0 mt-0.5" />
                    <span>{e}</span>
                  </div>
                ))}
                {(!reportData.report?.riskFactors || reportData.report?.riskFactors.length === 0) && (
                  <div className="text-[11px] text-text-muted italic text-center py-4">No critical exposure anomalies found.</div>
                )}
              </div>
            </div>
          </div>

          {/* Historical Wallet Order Intel */}
          <div className="bg-surface border border-border rounded-sm flex flex-col overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border bg-[#101317] flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-text-primary">
                EIP-712 Order Intel Log
              </span>
              <span className="text-[10px] font-mono font-bold text-text-muted bg-[#0B0E11] px-2 py-0.5 rounded-sm border border-border/60">
                {(reportData.trades ?? []).length} Records Resolved
              </span>
            </div>
            <div className="overflow-x-auto max-h-[300px]">
              <table className="w-full text-xs text-left whitespace-nowrap">
                <thead className="text-[9px] text-text-secondary uppercase tracking-wider border-b border-border bg-[#0B0E11] sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-2 font-medium">Asset</th>
                    <th className="px-4 py-2 font-medium">Side</th>
                    <th className="px-4 py-2 font-medium text-right">Price</th>
                    <th className="px-4 py-2 font-medium text-right">Quantity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {(reportData.trades ?? []).slice(0, 100).map((t: any, idx: number) => (
                    <tr key={idx} className="hover:bg-surface-hover/20 transition-colors">
                      <td className="px-4 py-2 font-semibold text-text-primary font-sans">
                        {String(t.s || t.symbol || '—').toUpperCase()}
                      </td>
                      <td className="px-4 py-2">
                        <span className={cn(
                          'px-1.5 py-0.2 rounded-sm text-[8px] font-bold border',
                          (t.S || t.side) === 'BUY' ? 'bg-success/5 border-success/35 text-success' : 'bg-danger/5 border-danger/35 text-danger'
                        )}>
                          {t.S || t.side || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right text-text-secondary">${t.p || t.price || '0.00'}</td>
                      <td className="px-4 py-2 text-right text-text-secondary">{t.q || t.quantity || '0.00'}</td>
                    </tr>
                  ))}
                  {(reportData.trades ?? []).length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-text-muted font-sans text-xs">
                        No trade history logs found for this wallet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
