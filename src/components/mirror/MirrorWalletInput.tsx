import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { Search, Loader2, ChevronRight, Zap } from 'lucide-react';

const EXAMPLE_WALLETS = [
  { label: 'Active Spot & Perps Trader', address: '0x9f8a3dc88568ccd58f89ed7b32d8329c6e037a45', tag: 'Mainnet Active' },
  { label: 'Grid Trader — fixed size', address: '0x3f2A2144b09e2101036329c6e037a451036329c6', tag: 'Mainnet Balanced' },
  { label: 'Long-term — low frequency', address: '0x9a0Dc7f171C79e2101036329c6e037a451036329', tag: 'Mainnet Conservative' },
];

interface MirrorWalletInputProps {
  onAnalyze: (address: string, network: string) => void;
  loading: boolean;
  error: string | null;
}

export const MirrorWalletInput: React.FC<MirrorWalletInputProps> = ({ onAnalyze, loading, error }) => {
  const [address, setAddress] = useState('');
  const [network, setNetwork] = useState<'mainnet' | 'testnet'>('mainnet');

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-8 md:p-10">
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-primary/3 rounded-full blur-2xl pointer-events-none" />

        <div className="relative">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={14} className="text-primary" />
            <span className="text-primary font-mono text-xs tracking-widest uppercase font-bold">Mirror · AI Wallet Intelligence</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-text-primary mb-2 leading-tight">
            Analyze any wallet.<br />
            Understand its risk.<br />
            <span className="text-primary">Mirror it</span> on your own terms.
          </h2>
          <p className="text-text-muted text-sm max-w-lg leading-relaxed mt-4">
            Mirror uses AI to analyze the history and live activity of any SoDEX trading account.
            It produces a detailed risk report and can automatically mirror its future trades within your guardrails.
          </p>
        </div>
      </div>

      {/* Input Section */}
      <div className="rounded-2xl border border-border bg-surface p-6 md:p-8 transition-all hover:border-border-hover">
        <h3 className="font-bold text-lg text-text-primary mb-1">Start Wallet Analysis</h3>
        <p className="text-text-muted text-sm mb-6">Examine a SoDEX account — either your own or one you want to mirror.</p>

        <div className="grid md:grid-cols-[3fr_1.2fr_auto] gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="0x... wallet address"
              className={cn(
                'w-full bg-surface-2 border border-border rounded-xl pl-10 pr-4 py-3',
                'font-mono text-sm outline-none transition-all duration-200',
                'focus:border-primary/50 focus:shadow-[0_0_0_3px_rgba(0,212,255,0.08)]',
                'placeholder:text-text-muted/50'
              )}
            />
          </div>
          <select
            value={network}
            onChange={(e) => setNetwork(e.target.value as 'mainnet' | 'testnet')}
            className="bg-surface-2 border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary/50 transition-colors text-text-primary"
          >
            <option value="mainnet">Mainnet</option>
            <option value="testnet">Testnet</option>
          </select>
          <button
            onClick={() => onAnalyze(address, network)}
            disabled={loading || !address}
            className={cn(
              'flex items-center justify-center gap-2 bg-primary text-background font-semibold rounded-xl px-8 py-3 text-sm',
              'hover:brightness-110 active:scale-[0.98] transition-all duration-150',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100'
            )}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Analyzing...</span>
              </>
            ) : (
              'Analyze'
            )}
          </button>
        </div>
        {error && (
          <p className="text-danger text-sm mt-3 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-danger" />
            {error}
          </p>
        )}
      </div>

      {/* Example Wallets */}
      <div>
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="font-bold text-lg text-text-primary">Example Wallets</h3>
          <p className="text-text-muted text-sm">For demo purposes on SoDEX Mainnet</p>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {EXAMPLE_WALLETS.map((w) => (
            <button
              key={w.address}
              onClick={() => { setAddress(w.address); onAnalyze(w.address, 'mainnet'); }}
              className={cn(
                'text-left rounded-xl border border-border bg-surface p-5 group',
                'hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5',
                'transition-all duration-200 active:scale-[0.98]'
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono px-2 py-1 rounded-md bg-surface-2 text-text-muted border border-border uppercase tracking-wider font-bold">
                  {w.tag}
                </span>
                <ChevronRight size={14} className="text-text-muted group-hover:text-primary transition-colors" />
              </div>
              <p className="font-medium text-text-primary mb-1.5">{w.label}</p>
              <p className="text-text-muted text-xs font-mono truncate">{w.address}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
