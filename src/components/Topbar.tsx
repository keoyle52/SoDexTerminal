import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useSettingsStore } from '../store/settingsStore';
import { Wifi, WifiOff, Settings } from 'lucide-react';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/volume-bot': 'Volume Bot',
  '/grid-bot': 'Grid Bot',
  '/twap-bot': 'TWAP Bot',
  '/dca-bot': 'DCA Bot',
  '/copy-trader': 'Copy Trader',
  '/positions': 'Position Monitor',
  '/funding': 'Funding Tracker',
  '/schedule-cancel': 'Schedule Cancel',
  '/alerts': 'Fiyat Alarmlari',
  '/backtesting': 'Backtesting',
  '/settings': 'Settings',
};

export const Topbar: React.FC = () => {
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname] ?? 'Terminal';
  const store = useSettingsStore();
  const isConnected = !!store.apiKeyName;

  return (
    <header className="h-[72px] border-b border-white/5 bg-[#0A0D14]/50 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-40">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold tracking-wide text-text-primary drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        {/* Network Badge */}
        <div className="flex items-center gap-2 text-xs bg-white/5 border border-white/10 rounded-full px-3 py-1.5 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]">
          <div className={`w-2 h-2 rounded-full ${store.isTestnet ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]' : 'bg-primary shadow-[0_0_8px_var(--color-primary)]'}`} />
          <span className="text-text-primary font-medium tracking-wide">
            {store.isTestnet ? 'Testnet' : 'Mainnet'}
          </span>
        </div>

        {/* API Connection Status */}
        <div className="flex items-center gap-2 text-xs bg-white/5 border border-white/10 rounded-full px-3 py-1.5 cursor-default transition-all shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]">
          {isConnected ? (
            <>
              <Wifi size={14} className="text-success drop-shadow-[0_0_5px_var(--color-success)]" />
              <span className="text-success font-medium tracking-wide">Online</span>
            </>
          ) : (
            <>
              <WifiOff size={14} className="text-text-secondary" />
              <span className="text-text-secondary font-medium tracking-wide">Offline</span>
            </>
          )}
        </div>

        {/* Settings / API Key Button */}
        {/* Settings / API Key Button */}
        <Link 
          to="/settings"
          className={cn(
            "hidden md:flex items-center gap-2 text-sm font-semibold px-5 py-2 rounded-xl transition-all active:scale-95",
            !isConnected 
              ? "bg-primary text-[#06090e] shadow-[0_0_15px_rgba(0,225,255,0.3)] hover:shadow-[0_0_20px_rgba(255,255,255,0.5)] hover:bg-white"
              : "bg-white/5 border border-white/10 text-text-primary hover:bg-white/10 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]"
          )}
        >
          <Settings size={16} className={isConnected ? "text-primary drop-shadow-[0_0_5px_var(--color-primary)]" : ""} />
          <span>Enter API Key</span>
        </Link>
      </div>
    </header>
  );
};

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}
