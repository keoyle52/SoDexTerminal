import React, { useState, useCallback } from 'react';
import { cn } from '../lib/utils';
import { Search, Activity, ArrowLeft, Loader2 } from 'lucide-react';
import { MirrorWalletInput } from '../components/mirror/MirrorWalletInput';
import { MirrorRiskReport } from '../components/mirror/MirrorRiskReport';
import { MirrorCopySetup } from '../components/mirror/MirrorCopySetup';
import { MirrorDashboard } from '../components/mirror/MirrorDashboard';
import { resolveWalletAddress, analyzeMirrorWallet } from '../api/mirrorClient';
import { useSettingsStore } from '../store/settingsStore';

type MirrorView = 'input' | 'analyzing' | 'report' | 'dashboard';

const TABS = [
  { key: 'analyze' as const, label: 'Analyze', icon: Search },
  { key: 'dashboard' as const, label: 'Dashboard', icon: Activity },
];

export const MirrorTool: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'analyze' | 'dashboard'>('analyze');
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
      if (!resolved.accountId || resolved.accountId === 0) {
        throw new Error('No active SoDEX account found for this wallet address.');
      }

      // Step 2: Run AI analysis
      const data = await analyzeMirrorWallet(address, resolved.accountId, network, geminiApiKey);
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
                             (tab.key === 'dashboard' && activeTab === 'dashboard');
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
      <div className="relative w-20 h-20 mb-8">
        <div className="absolute inset-0 rounded-full border-4 border-primary/10 border-t-primary animate-spin" />
        <div className="absolute inset-4 rounded-full bg-primary/5 border border-primary/20 animate-pulse flex items-center justify-center">
          <span className="text-primary text-lg">⚡</span>
        </div>
      </div>
      <h2 className="font-bold text-xl mb-3 text-center text-text-primary">Conducting Wallet Diagnostics</h2>
      <p className="text-text-muted text-sm text-center max-w-sm mb-6 leading-relaxed">
        Evaluating transactions, inspecting historical performance edges, and checking trading metrics on SoDEX...
      </p>
      <div className="w-full max-w-xs space-y-2.5 bg-surface border border-border p-5 rounded-xl shadow-lg text-xs font-mono">
        <div className="flex items-center gap-2.5 text-text-secondary">
          <span className="text-success animate-pulse">●</span>
          <span>Fetching Spot & Perps trade history...</span>
        </div>
        <div className="flex items-center gap-2.5 text-text-secondary/60 animate-pulse">
          <span className="text-primary">○</span>
          <span>Running AI cognitive audit...</span>
        </div>
        <div className="flex items-center gap-2.5 text-text-muted">
          <span>◌</span>
          <span>Compiling risk profile & configs...</span>
        </div>
      </div>
    </div>
  );
}
