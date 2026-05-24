import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useSettingsStore } from '../store/settingsStore';
import { Wifi, WifiOff, Sun, Moon, FlaskConical, KeyRound, Wallet } from 'lucide-react';
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

export const Topbar: React.FC = () => {
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname] ?? 'Terminal';
  const store = useSettingsStore();
  const isConnected = !!store.privateKey || store.isWalletConnected;
  const isLight = store.theme === 'light';

  const handleConnectWallet = async () => {
    if (store.isWalletConnected) {
      store.disconnectWallet();
      toast.success('Wallet disconnected');
      return;
    }
    const win = window as any;
    if (!win.ethereum) {
      toast.error('MetaMask or another compatible browser wallet was not found.');
      return;
    }
    try {
      const accounts = await win.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts && accounts[0]) {
        store.connectWallet(accounts[0]);
        toast.success(`Wallet connected: ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to connect wallet');
    }
  };

  return (
    <header className="h-14 border-b border-border bg-surface flex items-center justify-between px-5 shrink-0 z-40">
      {/* Page title */}
      <h1 className="text-sm font-semibold text-text-primary tracking-tight">
        {title}
      </h1>

      <div className="flex items-center gap-2">
        {/* Wallet Connect — prominent browser wallet connection */}
        <button
          onClick={handleConnectWallet}
          title={store.isWalletConnected ? 'Disconnect Wallet' : 'Connect MetaMask / Browser Wallet'}
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
              : 'Connect Wallet'}
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
