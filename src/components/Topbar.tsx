import React, { useState, useRef, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useSettingsStore } from '../store/settingsStore';
import { Wifi, WifiOff, Sun, Moon, FlaskConical, KeyRound, Wallet, X, ChevronRight, CheckCircle2, AlertCircle, Globe } from 'lucide-react';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';

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
  const [connecting, setConnecting] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleConnect = async () => {
    const win = window as any;
    if (!win.ethereum) {
      toast.error('MetaMask or Web3 wallet not found. Install MetaMask first.');
      return;
    }
    setConnecting(true);
    try {
      const accounts = await win.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts?.[0]) {
        store.connectWallet(accounts[0]);
        toast.success(`Connected: ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to connect wallet');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    store.disconnectWallet();
    store.setWalletApiKeyName('');
    toast.success('Wallet disconnected');
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[200] flex items-start justify-end pt-14 pr-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-96 max-h-[calc(100vh-72px)] overflow-y-auto rounded-2xl border border-border bg-surface shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
              <Wallet size={14} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-text-primary">Wallet Setup</p>
              <p className="text-[10px] text-text-muted">EIP-712 signed trading on SoDEX</p>
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
            {!store.isTestnet && (
              <p className="mt-2 text-[10px] text-warning flex items-center gap-1">
                <AlertCircle size={10} />
                Mainnet uses real assets. Make sure you know what you're doing.
              </p>
            )}
          </div>

          {/* Wallet connection */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary flex items-center gap-1.5 mb-2">
              <Wallet size={11} />
              Browser Wallet (MetaMask / EIP-1193)
            </label>
            {store.isWalletConnected ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-success/30 bg-success/5">
                  <CheckCircle2 size={13} className="text-success shrink-0" />
                  <span className="text-xs font-mono text-success truncate">{store.walletAddress}</span>
                </div>
                <button
                  onClick={handleDisconnect}
                  className="w-full py-2 text-xs font-semibold rounded-lg border border-danger/30 text-danger hover:bg-danger/5 transition-colors"
                >
                  Disconnect Wallet
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                <Wallet size={13} />
                {connecting ? 'Connecting…' : 'Connect Wallet'}
              </button>
            )}
          </div>

          {/* SoDEX API Key Name (required to avoid "api key not found") */}
          {store.isWalletConnected && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary flex items-center gap-1.5 mb-1.5">
                <KeyRound size={11} />
                SoDEX API Key Name
              </label>
              <input
                type="text"
                value={store.walletApiKeyName}
                onChange={(e) => store.setWalletApiKeyName(e.target.value)}
                placeholder={store.walletAddress.toLowerCase() || '0x...'}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background/60 text-text-primary text-xs font-mono focus:outline-none focus:border-primary/50 placeholder:text-text-muted/50"
              />
              <p className="mt-1.5 text-[10px] text-text-muted leading-relaxed">
                The name you used when registering your API key on SoDEX
                ({store.isTestnet ? 'testnet' : 'mainnet'} → Settings → API Keys).
                Leave blank to use your wallet address directly
                {' '}—{' '}
                <span className="text-warning">if SoDEX returns "api key not found", register your address as an API key first.</span>
              </p>
              <div className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-primary/5 border border-primary/20">
                <ChevronRight size={10} className="text-primary shrink-0" />
                <span className="text-[10px] text-primary">
                  Active X-API-Key:{' '}
                  <span className="font-mono font-bold">
                    {store.walletApiKeyName.trim() || store.walletAddress.toLowerCase() || '—'}
                  </span>
                </span>
              </div>
            </div>
          )}

          {/* Without wallet: hint */}
          {!store.isWalletConnected && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-white/[0.03] border border-border">
              <AlertCircle size={13} className="text-text-muted shrink-0 mt-0.5" />
              <p className="text-[10px] text-text-muted leading-relaxed">
                No wallet detected yet. Connect MetaMask above, then enter the API key name you registered on SoDEX.
                If you prefer private-key signing, go to{' '}
                <Link to="/settings" onClick={onClose} className="text-primary underline">Settings → API Connection</Link>.
              </p>
            </div>
          )}
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
  const isConnected = !!store.privateKey || store.isWalletConnected;
  const isLight = store.theme === 'light';
  const [showWalletModal, setShowWalletModal] = useState(false);

  return (
    <header className="h-14 border-b border-border bg-surface flex items-center justify-between px-5 shrink-0 z-40">
      {/* Page title */}
      <h1 className="text-sm font-semibold text-text-primary tracking-tight">
        {title}
      </h1>

      {showWalletModal && <WalletSetupModal onClose={() => setShowWalletModal(false)} />}

      <div className="flex items-center gap-2">
        {/* Wallet Setup — opens dropdown modal with network + connect + API key */}
        <button
          onClick={() => setShowWalletModal((v) => !v)}
          title="Wallet Setup"
          className={cn(
            'flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md border transition-all duration-150',
            store.isWalletConnected
              ? 'bg-primary/15 border-primary/40 text-primary hover:bg-primary/20'
              : 'bg-white/[0.04] border-border text-text-muted hover:text-text-primary hover:bg-white/[0.07]'
          )}
        >
          <Wallet size={13} className={cn(store.isWalletConnected && 'animate-pulse')} />
          <span>
            {store.isWalletConnected
              ? `${store.walletAddress.slice(0, 6)}...${store.walletAddress.slice(-4)}`
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
        <div className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border bg-white/[0.03]">
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
        <div className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border bg-white/[0.03]">
          {store.isWalletConnected ? (
            <>
              <Wifi size={12} className="text-primary shrink-0" />
              <span className="text-primary font-medium">Wallet Active</span>
            </>
          ) : isConnected ? (
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
