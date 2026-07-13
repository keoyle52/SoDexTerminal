import React, { useState, useCallback } from 'react';
import { cn } from '../lib/utils';
import { Search, Activity, ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';
import { MirrorWalletInput } from '../components/mirror/MirrorWalletInput';
import { MirrorRiskReport } from '../components/mirror/MirrorRiskReport';
import { MirrorCopySetup } from '../components/mirror/MirrorCopySetup';
import { MirrorDashboard } from '../components/mirror/MirrorDashboard';
import { MirrorHowItWorks } from '../components/mirror/MirrorHowItWorks';
import { resolveWalletAddress, analyzeMirrorWallet } from '../api/mirrorClient';
import { localAiDiagnoseWallet } from '../api/localAiEngine';
import { useSettingsStore } from '../store/settingsStore';

type MirrorView = 'input' | 'analyzing' | 'report' | 'dashboard';

const TABS = [
  { key: 'analyze' as const, label: 'Analyze', icon: Search },
  { key: 'dashboard' as const, label: 'Dashboard', icon: Activity },
  { key: 'how-it-works' as const, label: 'How it Works', icon: ShieldCheck },
];

export const MirrorTool: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'analyze' | 'dashboard' | 'how-it-works'>('analyze');
  const [view, setView] = useState<MirrorView>('input');
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);

  const geminiApiKey = useSettingsStore(s => s.sosoApiKey) || '';

  const handleAnalyze = useCallback(async (address: string, network: string) => {
    setLoading(true);
    setError(null);
    setView('analyzing');

    try {
      // Step 1: Resolve wallet address to SoDEX account ID
      const resolved = await resolveWalletAddress(address, network);
      console.log('[Mirror resolve response]:', resolved);
      if (!resolved || !resolved.accountId || resolved.accountId === 0) {
        throw new Error(`No active SoDEX account found for this wallet address. (Resolved payload: ${JSON.stringify(resolved)})`);
      }

      // Step 2: Run AI analysis
      let data;
      if (geminiApiKey) {
        try {
          data = await analyzeMirrorWallet(address, resolved.accountId, network, geminiApiKey);
        } catch (apiErr) {
          console.warn('External AI call failed, falling back to local quantitative AI engine:', apiErr);
          data = await localAiDiagnoseWallet(address, resolved.accountId, network);
        }
      } else {
        data = await localAiDiagnoseWallet(address, resolved.accountId, network);
      }
      setReportData(data);
      setView('report');
    } catch (err: any) {
      console.error('[Mirror resolve error]:', err);
      const detail = err.response?.data?.error ?? err.response?.data?.message ?? err.message ?? String(err);
      setError(`Error: ${detail}`);
      setView('input');
    } finally {
      setLoading(false);
    }
  }, [geminiApiKey]);

  const handleBack = () => {
    setView('input');
    setReportData(null);
    setError(null);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Tab bar */}
      <div className="shrink-0 border-b border-border bg-surface/60 backdrop-blur-sm px-4 md:px-6">
        <div className="flex items-center gap-1 py-2">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = (tab.key === 'analyze' && activeTab === 'analyze') ||
                             (tab.key === 'dashboard' && activeTab === 'dashboard') ||
                             (tab.key === 'how-it-works' && activeTab === 'how-it-works');
            return (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  if (tab.key === 'analyze' && view === 'input') setView('input');
                }}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all',
                  isActive
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-text-muted hover:text-text-primary hover:bg-white/[0.04]'
                )}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
              </button>
            );
          })}

          {/* Back button when viewing report */}
          {activeTab === 'analyze' && view === 'report' && (
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-text-muted hover:text-text-primary hover:bg-white/[0.04] transition-all ml-auto"
            >
              <ArrowLeft size={14} />
              New Analysis
            </button>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-6xl mx-auto">
          {activeTab === 'dashboard' ? (
            <MirrorDashboard />
          ) : activeTab === 'how-it-works' ? (
            <MirrorHowItWorks />
          ) : view === 'analyzing' ? (
            <AnalyzingState />
          ) : view === 'report' && reportData ? (
            <>
              <MirrorRiskReport data={reportData} onSetupCopy={() => setSetupOpen(true)} />
              {setupOpen && (
                <MirrorCopySetup
                  sourceAccountId={String(reportData.accountId)}
                  network={reportData.network}
                  suggested={reportData.report?.suggestedCopyConfig ?? {}}
                  onClose={() => setSetupOpen(false)}
                />
              )}
            </>
          ) : (
            <MirrorWalletInput onAnalyze={handleAnalyze} loading={loading} error={error} />
          )}
        </div>
      </div>
    </div>
  );
};

/** Premium multi-step loading animation */
function AnalyzingState() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center py-20 px-4 animate-fade-in">
      <div className="relative w-32 h-32 mb-10 group">
        <div className="absolute inset-0 rounded-full border-4 border-primary/20 border-t-primary animate-spin shadow-[0_0_30px_rgba(0,212,255,0.3)]" />
        <div className="absolute inset-4 rounded-full bg-gradient-to-br from-primary/10 to-info/10 border border-primary/30 animate-pulse flex items-center justify-center backdrop-blur-xl">
          <Activity className="text-primary w-8 h-8 drop-shadow-[0_0_8px_rgba(0,212,255,0.8)] animate-pulse" />
        </div>
      </div>
      <h2 className="font-extrabold text-2xl mb-4 text-center text-transparent bg-clip-text bg-gradient-to-r from-white to-primary/80">Conducting Neural Wallet Diagnostics</h2>
      <p className="text-text-muted text-sm text-center max-w-md mb-8 leading-relaxed">
        Evaluating cross-chain transactions, identifying edge vectors, and assessing risk metrics on SoDEX...
      </p>
      <div className="w-full max-w-sm space-y-3 glass-card p-6 border-primary/20 shadow-[0_10px_40px_-10px_rgba(0,212,255,0.15)] text-xs font-mono relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl animate-pulse" />
        <div className="flex items-center gap-3 text-success font-semibold relative z-10">
          <span className="w-2 h-2 rounded-full bg-success drop-shadow-[0_0_5px_rgba(16,185,129,0.8)]" />
          <span>Synchronizing historical trades (Perps & Spot)</span>
        </div>
        <div className="flex items-center gap-3 text-primary relative z-10">
          <span className="w-2 h-2 rounded-full bg-primary drop-shadow-[0_0_5px_rgba(0,212,255,0.8)] animate-pulse" />
          <span>Executing cognitive behavioral audit...</span>
        </div>
        <div className="flex items-center gap-3 text-text-muted relative z-10">
          <span className="w-2 h-2 rounded-full border border-text-muted" />
          <span>Compiling risk profile & optimal config...</span>
        </div>
      </div>
    </div>
  );
}
