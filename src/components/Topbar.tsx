import React, { useState, useRef, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useSettingsStore } from '../store/settingsStore';
import { Wifi, WifiOff, Sun, Moon, FlaskConical, KeyRound, Wallet, X, AlertCircle, Globe } from 'lucide-react';
import { cn } from '../lib/utils';
import { deriveAddressFromPrivateKey } from '../api/signer';
import WalletConnect from './WalletConnect';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':        'Dashboard',
  '/grid-bot':         'Grid Bot',
  '/twap-bot':         'TWAP Bot',
  '/dca-bot':          'DCA Bot',
  '/market-maker':     'Market Maker',
  '/news-bot':         'News Bot',
  '/copy-trader':      'Copy Trader',
  '/positions':        'Positions',
  '/funding':          'Funding Rates',
  '/schedule-cancel':  'Scheduler',
  '/alerts':           'Price Alerts',
  '/backtesting':      'Backtesting',
  '/etf-tracker':      'ETF Tracker',
  '/btc-predictor':    'BTC Predictor',
  '/ai-console':       'AI Console',
  '/macro':            'Macro Calendar',
  '/ssi-indices':      'SSI Indices',
  '/btc-treasuries':   'BTC Treasuries',
  '/sector-spotlight': 'Sector Spotlight',
  '/fundraising':      'Fundraising',
  '/crypto-stocks':    'Crypto Stocks',
  '/settings':         'Settings',
  '/trading-bots':     'Trading Bots',
  '/marketplace':      'Strategy Marketplace',
  '/telegram':         'Telegram Bot',
};

// ─── Wallet Setup Modal ───────────────────────────────────────────────────────
const WalletSetupModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const store = useSettingsStore();
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[200] flex items-start justify-end pt-14 pr-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-[calc(100vw-32px)] sm:w-96 max-h-[calc(100vh-72px)] overflow-y-auto rounded-2xl border border-border bg-surface shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
              <KeyRound size={14} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-text-primary">Wallet Setup</p>
              <p className="text-[10px] text-text-muted">EIP-712 credentials for SoDEX</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/[0.06] transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Web3 Wallet Connect (Recommended) */}
          <div className="p-3.5 bg-primary/10 border border-primary/30 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-primary">
                <Wallet size={14} />
                <span className="text-xs font-bold uppercase tracking-wider">Web3 Wallet (Non-Custodial)</span>
              </div>
              <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-bold uppercase">Recommended</span>
            </div>
            <p className="text-[11px] text-text-secondary leading-relaxed">
              Connect your Web3 Wallet (MetaMask) for non-custodial EIP-712 transaction signing on SoDEX. No private keys stored.
            </p>
            <div className="pt-1">
              <WalletConnect />
            </div>
          </div>

          {/* Security & Technical Notice */}
          <div className="p-3 bg-white/[0.03] border border-border rounded-xl space-y-1.5">
            <div className="flex items-center gap-2 text-text-secondary">
              <KeyRound size={13} className="shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Automated Bot Key (Optional)</span>
            </div>
            <p className="text-[10px] text-text-muted leading-relaxed">
              If running 24/7 automated bots without browser popups, you can optionally provide an isolated bot private key below.
            </p>
          </div>

          {/* Network */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary flex items-center gap-1.5 mb-2">
              <Globe size={11} />
              Network
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['Mainnet', 'Testnet'] as const).map((net) => {
                const isTestnet = net === 'Testnet';
                const active = store.isTestnet === isTestnet;
                return (
                  <button
                    key={net}
                    onClick={() => store.setIsTestnet(isTestnet)}
                    className={cn(
                      'py-2.5 text-xs font-semibold rounded-lg border transition-all',
                      active
                        ? 'bg-primary/10 border-primary/40 text-primary'
                        : 'bg-background/40 border-border text-text-muted hover:border-border-hover hover:text-text-secondary',
                    )}
                  >
                    {net}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form Fields depending on network */}
          {!store.isTestnet ? (
            // Mainnet credentials
            <div className="space-y-3.5">
              <div className="flex items-start gap-2 p-2.5 bg-warning/5 border border-warning/20 rounded-lg">
                <AlertCircle size={12} className="text-warning shrink-0 mt-0.5" />
                <p className="text-[10px] text-warning leading-relaxed">
                  Mainnet: Enter Agent Key and Master Address. Real assets are used.
                </p>
              </div>

              {/* API Key Name */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary block mb-1">
                  API Key Name (X-API-Key) <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={store.mainnetApiKeyName}
                  onChange={(e) => store.setMainnetApiKeyName(e.target.value)}
                  placeholder="e.g. EVM address of Agent"
                  className={cn(
                    "w-full px-3 py-2 rounded-lg border bg-background/60 text-text-primary text-xs font-mono focus:outline-none placeholder:text-text-muted/50 transition-colors",
                    !store.mainnetApiKeyName.trim()
                      ? "border-danger/50 focus:border-danger/70 focus:ring-1 focus:ring-danger/20"
                      : "border-border focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                  )}
                />
              </div>

              {/* Agent Private Key */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary block mb-1">
                  Agent Private Key <span className="text-danger">*</span>
                </label>
                <input
                  type="password"
                  value={store.mainnetPrivateKey}
                  onChange={(e) => store.setMainnetPrivateKey(e.target.value)}
                  placeholder="0x..."
                  className={cn(
                    "w-full px-3 py-2 rounded-lg border bg-background/60 text-text-primary text-xs font-mono focus:outline-none placeholder:text-text-muted/50 transition-colors",
                    !store.mainnetPrivateKey.trim()
                      ? "border-danger/50 focus:border-danger/70 focus:ring-1 focus:ring-danger/20"
                      : "border-border focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                  )}
                />
              </div>

              {/* Master EVM Address */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary block mb-1">
                  Master EVM Address <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={store.mainnetEvmAddress}
                  onChange={(e) => store.setMainnetEvmAddress(e.target.value)}
                  placeholder="0x..."
                  className={cn(
                    "w-full px-3 py-2 rounded-lg border bg-background/60 text-text-primary text-xs font-mono focus:outline-none placeholder:text-text-muted/50 transition-colors",
                    !store.mainnetEvmAddress.trim()
                      ? "border-danger/50 focus:border-danger/70 focus:ring-1 focus:ring-danger/20"
                      : "border-border focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                  )}
                />
              </div>
            </div>
          ) : (
            // Testnet credentials
            <div className="space-y-3.5">
              <div className="flex items-start gap-2 p-2.5 bg-primary/5 border border-primary/20 rounded-lg">
                <AlertCircle size={12} className="text-primary shrink-0 mt-0.5" />
                <p className="text-[10px] text-primary leading-relaxed">
                  Testnet: Master Private Key is required. Other fields are optional.
                </p>
              </div>

              {/* Master Private Key */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary block mb-1">
                  Master Private Key <span className="text-danger">*</span>
                </label>
                <input
                  type="password"
                  value={store.testnetPrivateKey}
                  onChange={(e) => store.setTestnetPrivateKey(e.target.value)}
                  placeholder="0x..."
                  className={cn(
                    "w-full px-3 py-2 rounded-lg border bg-background/60 text-text-primary text-xs font-mono focus:outline-none placeholder:text-text-muted/50 transition-colors",
                    !store.testnetPrivateKey.trim()
                      ? "border-danger/50 focus:border-danger/70 focus:ring-1 focus:ring-danger/20"
                      : "border-border focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                  )}
                />
              </div>

              {/* API Key Name (optional) */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary block mb-1">
                  API Key Name (Optional)
                </label>
                <input
                  type="text"
                  value={store.testnetApiKeyName}
                  onChange={(e) => store.setTestnetApiKeyName(e.target.value)}
                  placeholder="Defaults to derived address"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background/60 text-text-primary text-xs font-mono focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 placeholder:text-text-muted/50 transition-colors"
                />
              </div>

              {/* Master EVM Address (optional) */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary block mb-1">
                  Master EVM Address (Optional)
                </label>
                <input
                  type="text"
                  value={store.testnetEvmAddress}
                  onChange={(e) => store.setTestnetEvmAddress(e.target.value)}
                  placeholder="Defaults to derived address"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background/60 text-text-primary text-xs font-mono focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 placeholder:text-text-muted/50 transition-colors"
                />
              </div>
            </div>
          )}

          {/* Done Button */}
          <div className="pt-2">
            <button
              onClick={onClose}
              className="w-full py-2.5 text-xs font-bold rounded-lg bg-primary text-black hover:bg-primary/95 transition-all text-center"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Topbar ───────────────────────────────────────────────────────────────────
export const Topbar: React.FC = () => {
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname] ?? 'Terminal';
  const store = useSettingsStore();
  const isConnected = store.isWalletConnected || !!store.privateKey;
  const activeAddress = store.walletAddress || store.evmAddress || (store.privateKey ? deriveAddressFromPrivateKey(store.privateKey) : '');
  const isLight = store.theme === 'light';
  const [showWalletModal, setShowWalletModal] = useState(false);

  return (
    <header className="h-14 border-b border-border bg-surface flex items-center justify-between pl-16 pr-5 md:px-5 shrink-0 z-40">
      {/* Page title */}
      <h1 className="text-sm font-semibold text-text-primary tracking-tight">
        {title}
      </h1>

      {showWalletModal && <WalletSetupModal onClose={() => setShowWalletModal(false)} />}

      <div className="flex items-center gap-2">
        {/* Wallet Setup — opens dropdown modal with network + credentials */}
        <button
          onClick={() => setShowWalletModal((v) => !v)}
          title="Wallet Setup"
          className={cn(
            'flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md border transition-all duration-150',
            isConnected
              ? 'bg-primary/15 border-primary/40 text-primary hover:bg-primary/20'
              : 'bg-white/[0.04] border-border text-text-muted hover:text-text-primary hover:bg-white/[0.07]'
          )}
        >
          <Wallet size={13} />
          <span>
            {isConnected && activeAddress
              ? `${activeAddress.slice(0, 6)}...${activeAddress.slice(-4)}`
              : 'Wallet Setup'}
          </span>
        </button>

        {/* Demo Mode — prominent CTA for judges */}
        <button
          onClick={() => store.setIsDemoMode(!store.isDemoMode)}
          title={store.isDemoMode ? 'Exit Demo Mode' : 'Try without API keys'}
          className={cn(
            'flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md border transition-all duration-150',
            store.isDemoMode
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/20'
              : !isConnected
                ? 'bg-primary/15 border-primary/40 text-primary hover:bg-primary/20 animate-pulse-dot'
                : 'bg-white/[0.04] border-border text-text-muted hover:text-text-primary hover:bg-white/[0.07]',
          )}
        >
          <FlaskConical size={13} />
          <span className="hidden sm:inline">
            {store.isDemoMode ? 'Demo On' : 'Try Demo'}
          </span>
        </button>

        {/* Network badge */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border bg-white/[0.03]">
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full shrink-0',
              store.isTestnet ? 'bg-amber-400' : 'bg-success',
            )}
          />
          <span className="text-text-secondary font-medium">
            {store.isTestnet ? 'Testnet' : 'Mainnet'}
          </span>
        </div>

        {/* Connection status */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border bg-white/[0.03]">
          {isConnected ? (
            <>
              <Wifi size={12} className="text-success shrink-0" />
              <span className="text-success font-medium">Connected</span>
            </>
          ) : store.isDemoMode ? (
            <>
              <FlaskConical size={12} className="text-amber-400 shrink-0" />
              <span className="text-amber-400 font-medium">Demo</span>
            </>
          ) : (
            <>
              <WifiOff size={12} className="text-text-muted shrink-0" />
              <span className="text-text-muted font-medium">No key</span>
            </>
          )}
        </div>

        {/* Theme toggle */}
        <button
          onClick={() => store.setTheme(isLight ? 'dark' : 'light')}
          title={isLight ? 'Dark mode' : 'Light mode'}
          className="flex items-center justify-center w-8 h-8 rounded-md border border-border bg-white/[0.03] text-text-muted hover:text-text-primary hover:bg-white/[0.07] transition-colors duration-150"
        >
          {isLight ? <Moon size={13} /> : <Sun size={13} />}
        </button>

        {/* API key CTA — only when not connected */}
        {!isConnected && !store.isDemoMode ? (
          <Link
            to="/settings"
            className="hidden sm:flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-primary text-white hover:opacity-90 transition-opacity duration-150"
          >
            <KeyRound size={12} />
            <span>Add API Key</span>
          </Link>
        ) : null}
      </div>
    </header>
  );
};
