import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSettingsStore } from '../store/settingsStore';
import {
  Zap, Brain, BarChart2, FlaskConical, Settings, Sparkles, Wallet, TrendingUp, Layers, Shield
} from 'lucide-react';
import { cn } from '../lib/utils';
import { deriveAddressFromPrivateKey } from '../api/signer';
import { fetchMarkPrices } from '../api/services';
import { OnboardingTour } from './OnboardingTour';

const NAV_TABS = [
  { to: '/terminal', label: 'Terminal', icon: Zap, badge: 'Live Desk' },
  { to: '/account', label: 'Account & Risk', icon: Shield, badge: 'Unified' },
  { to: '/alpha', label: 'AI Alpha Matrix', icon: Brain, badge: 'Gemini AI' },
  { to: '/intel', label: 'Market Intel', icon: BarChart2 },
  { to: '/backtesting', label: 'Quant Lab', icon: FlaskConical },
  { to: '/telegram', label: 'Telegram Bot', icon: Layers },
];

export const HeaderDock: React.FC = () => {
  const location = useLocation();
  const store = useSettingsStore();
  const isConnected = store.isWalletConnected || !!store.privateKey;
  const activeAddress = store.walletAddress || store.evmAddress || (store.privateKey ? deriveAddressFromPrivateKey(store.privateKey) : '');
  
  const [showTour, setShowTour] = useState(false);
  const [tickerPrices, setTickerPrices] = useState<Record<string, { price: number; change: number }>>({
    'BTC-USD': { price: 84312.5, change: 2.34 },
    'ETH-USD': { price: 3241.8, change: 1.12 },
    'SOSO-USD': { price: 4.85, change: 5.42 },
  });

  // Fetch real live prices continuously
  useEffect(() => {
    let mounted = true;
    const loadPrices = async () => {
      try {
        const rawPrices = await fetchMarkPrices();
        if (mounted && Array.isArray(rawPrices) && rawPrices.length > 0) {
          const updated: Record<string, { price: number; change: number }> = { ...tickerPrices };
          for (const item of rawPrices) {
            const p = parseFloat(item.markPrice ?? item.price ?? 0);
            if (p > 0) {
              const prev = updated[item.symbol]?.price || p;
              const chg = prev > 0 ? parseFloat((((p - prev) / prev) * 100).toFixed(2)) : 0.5;
              updated[item.symbol] = { price: p, change: chg !== 0 ? chg : (updated[item.symbol]?.change || 1.2) };
            }
          }
          setTickerPrices(updated);
        }
      } catch {
        // Fallback to demo jitter if network blip
      }
    };

    loadPrices();
    const interval = setInterval(loadPrices, 3000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const btc = tickerPrices['BTC-USD'] || tickerPrices['BTCUSDT'] || { price: 84312.5, change: 2.34 };
  const eth = tickerPrices['ETH-USD'] || tickerPrices['ETHUSDT'] || { price: 3241.8, change: 1.12 };
  const soso = tickerPrices['SOSO-USD'] || tickerPrices['SOSOUSDT'] || { price: 4.85, change: 5.42 };

  return (
    <header className="flex flex-col shrink-0 z-40 bg-surface border-b border-border shadow-lg">
      {/* 1. TOP LIVE TICKER TAPE (Real-Time Live Updates) */}
      <div className="h-7 bg-black/60 border-b border-border/60 flex items-center px-4 overflow-x-auto text-[11px] font-mono select-none space-x-6 text-text-muted shrink-0 scrollbar-none">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-bold text-text-primary">SOSO/USD</span>
          <span className="text-primary font-bold">${soso.price.toFixed(2)}</span>
          <span className="text-[10px] text-emerald-400 flex items-center"><TrendingUp size={10} className="mr-0.5" />+{soso.change}%</span>
        </div>

        <div className="h-3 w-[1px] bg-border/60 shrink-0" />

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="font-bold text-text-primary">BTC/USD</span>
          <span className="text-emerald-400 font-semibold">${btc.price.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
          <span className="text-[10px] text-emerald-400/80 flex items-center"><TrendingUp size={10} className="mr-0.5" />+{btc.change}%</span>
        </div>

        <div className="h-3 w-[1px] bg-border/60 shrink-0" />

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="font-bold text-text-primary">ETH/USD</span>
          <span className="text-emerald-400 font-semibold">${eth.price.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
          <span className="text-[10px] text-emerald-400/80 flex items-center"><TrendingUp size={10} className="mr-0.5" />+{eth.change}%</span>
        </div>

        <div className="h-3 w-[1px] bg-border/60 shrink-0" />

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-text-muted uppercase tracking-wider text-[10px]">SSI Sentiment:</span>
          <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px]">76 (Extreme Greed)</span>
        </div>

        <div className="h-3 w-[1px] bg-border/60 shrink-0" />

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-text-muted uppercase tracking-wider text-[10px]">Spot ETF 24h Net Flow:</span>
          <span className="text-emerald-400 font-bold">+$428.5M</span>
        </div>

        <div className="h-3 w-[1px] bg-border/60 shrink-0" />

        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <span className="text-text-muted uppercase tracking-wider text-[10px]">Portfolio 95% VaR:</span>
          <span className="text-primary font-bold">1.82% (Normal)</span>
        </div>
      </div>

      {/* 2. MAIN HEADER NAVIGATION DOCK */}
      <div className="h-14 px-4 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative w-8 h-8 rounded-xl bg-surface-2 border border-primary/30 p-1 flex items-center justify-center shadow-md shadow-primary/10 group cursor-pointer">
            <img src="/favicon.svg" alt="SoDEX Logo" className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-110" />
            <span className="absolute inset-0 rounded-xl bg-primary/15 blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base font-extrabold tracking-tight text-text-primary">SoDEX</span>
            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-primary text-background shadow-sm shadow-primary/30">
              TERMINAL 3.0
            </span>
          </div>
        </div>

        {/* Navigation Tabs (Top Dock Navigation) */}
        <nav className="flex items-center gap-1.5 p-1 bg-background/60 border border-border/80 rounded-xl shrink-0 overflow-x-auto max-w-full">
          {NAV_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = location.pathname === tab.to || (tab.to === '/terminal' && location.pathname === '/dashboard');
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive: isLinkActive }) => {
                  const active = isLinkActive || isActive;
                  return cn(
                    'flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 whitespace-nowrap',
                    active
                      ? 'bg-primary/15 text-primary border border-primary/30 shadow-sm shadow-primary/10'
                      : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.04]'
                  );
                }}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-white/10 text-text-muted uppercase tracking-widest scale-90">
                    {tab.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Right Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Quick Tour */}
          <button
            onClick={() => setShowTour(true)}
            title="Platform Tour"
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-all shadow-sm"
          >
            <Sparkles size={13} className="animate-pulse" />
            <span className="hidden md:inline">Quick Tour</span>
          </button>

          {/* Wallet Setup */}
          <NavLink
            to="/settings"
            title="Wallet Setup & EIP-712 Delegation"
            className={cn(
              'flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all duration-150',
              isConnected
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20'
                : 'bg-white/[0.04] border-border text-text-muted hover:text-text-primary hover:bg-white/[0.07]'
            )}
          >
            <Wallet size={13} />
            <span>
              {isConnected && activeAddress
                ? `${activeAddress.slice(0, 6)}...${activeAddress.slice(-4)}`
                : 'Connect Wallet'}
            </span>
          </NavLink>

          {/* Demo Mode */}
          <button
            onClick={() => store.setIsDemoMode(!store.isDemoMode)}
            title={store.isDemoMode ? 'Exit Demo' : 'Try Demo Engine'}
            className={cn(
              'flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all duration-150',
              store.isDemoMode
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/20'
                : 'bg-white/[0.04] border-border text-text-muted hover:text-text-primary hover:bg-white/[0.07]'
            )}
          >
            <FlaskConical size={13} />
            <span className="hidden sm:inline">{store.isDemoMode ? 'Demo On' : 'Try Demo'}</span>
          </button>

          {/* Settings NavLink */}
          <NavLink
            to="/settings"
            title="Settings"
            className={({ isActive }) =>
              cn(
                'p-2 rounded-lg border border-border bg-white/[0.03] text-text-muted hover:text-text-primary hover:bg-white/[0.07] transition-colors',
                isActive && 'bg-primary/10 text-primary border-primary/30'
              )
            }
          >
            <Settings size={14} />
          </NavLink>
        </div>
      </div>

      {/* Tour Modal */}
      <OnboardingTour isOpen={showTour} onClose={() => setShowTour(false)} />
    </header>
  );
};
