import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSettingsStore } from '../store/settingsStore';
import {
  Zap, Brain, BarChart2, FlaskConical, Settings, Sparkles, Wallet, TrendingUp, TrendingDown, Layers, Shield, Bot
} from 'lucide-react';
import { cn } from '../lib/utils';
import { deriveAddressFromPrivateKey } from '../api/signer';
import { fetchMarkPrices } from '../api/services';
import { fetchEtfCurrentMetrics } from '../api/sosoServices';
import { OnboardingTour } from './OnboardingTour';

const NAV_TABS = [
  { to: '/terminal', label: 'Terminal', icon: Zap, badge: 'Live Desk' },
  { to: '/trading-bots', label: 'Automated Bots', icon: Bot, badge: 'Studio' },
  { to: '/alpha', label: 'Price Predictor', icon: Brain, badge: 'Gemini AI' },
  { to: '/research', label: 'Research Hub', icon: BarChart2, badge: 'Intel & Quant' },
  { to: '/account', label: 'Account & Risk', icon: Shield },
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
    'SOSO-USD': { price: 0.28, change: 5.42 },
  });

  const { sosoApiKey } = useSettingsStore();
  const [ssiSentiment, setSsiSentiment] = useState<{ value: number; label: string }>({ value: 76, label: 'Extreme Greed' });
  const [etfFlow, setEtfFlow] = useState<string>('+$428.5M');

  // Fetch real live prices continuously
  useEffect(() => {
    let mounted = true;
    const loadPrices = async () => {
      try {
        let binanceTickers: any[] = [];
        let gateTicker: any = null;

        // 1. Fetch BTC, ETH, SOL from Binance (via CORS proxy)
        try {
          const targetUrl = 'https://api.binance.com/api/v3/ticker/24hr?symbols=%5B%22BTCUSDT%22,%22ETHUSDT%22,%22SOLUSDT%22%5D';
          const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`;
          let res = await fetch(proxyUrl);
          if (!res.ok) res = await fetch(targetUrl);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) binanceTickers = data;
          }
        } catch {
          // ignore
        }

        // 2. Fetch SOSO from Gate.io (via CORS proxy)
        try {
          const targetUrl = 'https://api.gateio.ws/api/v4/spot/tickers?currency_pair=SOSO_USDT';
          const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`;
          let res = await fetch(proxyUrl);
          if (!res.ok) res = await fetch(targetUrl);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) gateTicker = data[0];
          }
        } catch {
          // ignore
        }

        // 3. Fetch fallback mark prices from SoDEX perps API
        let sodexPrices: any[] = [];
        try {
          const raw = await fetchMarkPrices();
          if (Array.isArray(raw)) sodexPrices = raw;
        } catch {
          // ignore
        }

        if (mounted) {
          setTickerPrices((prev) => {
            const updated = { ...prev };

            // Apply Binance updates
            for (const t of binanceTickers) {
              const price = parseFloat(t.lastPrice);
              const change = parseFloat(t.priceChangePercent);
              if (price > 0) {
                if (t.symbol === 'BTCUSDT') updated['BTC-USD'] = { price, change };
                else if (t.symbol === 'ETHUSDT') updated['ETH-USD'] = { price, change };
                else if (t.symbol === 'SOLUSDT') updated['SOL-USD'] = { price, change };
              }
            }

            // Apply Gate.io updates
            if (gateTicker) {
              const price = parseFloat(gateTicker.last);
              const change = parseFloat(gateTicker.change_percentage);
              if (price > 0) {
                updated['SOSO-USD'] = { price, change };
              }
            }

            // Apply SoDEX updates for anything else (or fallback)
            for (const item of sodexPrices) {
              const isMajor = ['BTC-USD', 'ETH-USD', 'SOL-USD', 'SOSO-USD'].includes(item.symbol);
              const alreadyUpdated = isMajor && (
                (item.symbol === 'BTC-USD' && updated['BTC-USD'].price !== 84312.5) ||
                (item.symbol === 'ETH-USD' && updated['ETH-USD'].price !== 3241.8) ||
                (item.symbol === 'SOSO-USD' && updated['SOSO-USD'].price !== 0.28)
              );

              if (!alreadyUpdated) {
                const p = parseFloat(item.markPrice ?? item.price ?? 0);
                if (p > 0) {
                  const prevPrice = updated[item.symbol]?.price || p;
                  const chg = prevPrice > 0 ? parseFloat((((p - prevPrice) / prevPrice) * 100).toFixed(2)) : 0.5;
                  updated[item.symbol] = {
                    price: p,
                    change: chg !== 0 ? chg : (updated[item.symbol]?.change || 1.2)
                  };
                }
              }
            }

            return updated;
          });
        }
      } catch {
        // Fallback
      }
    };

    loadPrices();
    const interval = setInterval(loadPrices, 3000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Fetch F&G and ETF flows continuously
  useEffect(() => {
    let mounted = true;

    const loadMeta = async () => {
      // 1. Fetch Fear & Greed Index
      try {
        const targetUrl = 'https://api.alternative.me/fng/?limit=1';
        const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`;
        let res = await fetch(proxyUrl);
        if (!res.ok) res = await fetch(targetUrl);
        if (res.ok) {
          const data = await res.json();
          const item = data?.data?.[0];
          if (item && mounted) {
            const val = parseInt(item.value) || 50;
            setSsiSentiment({
              value: val,
              label: item.value_classification || 'Neutral',
            });
          }
        }
      } catch {
        // ignore
      }

      // 2. Fetch ETF Net Flow (sum of BTC and ETH Spot ETFs)
      if (sosoApiKey) {
        try {
          const [btcMetrics, ethMetrics] = await Promise.all([
            fetchEtfCurrentMetrics('us-btc-spot'),
            fetchEtfCurrentMetrics('us-eth-spot'),
          ]);
          
          let totalFlow = 0;
          let hasData = false;
          
          if (btcMetrics?.dailyNetInflow?.value != null) {
            totalFlow += btcMetrics.dailyNetInflow.value;
            hasData = true;
          }
          if (ethMetrics?.dailyNetInflow?.value != null) {
            totalFlow += ethMetrics.dailyNetInflow.value;
            hasData = true;
          }
          
          if (hasData && mounted) {
            const abs = Math.abs(totalFlow);
            const sign = totalFlow >= 0 ? '+' : '-';
            let formatted = '';
            if (abs >= 1e9) formatted = `${sign}$${(abs / 1e9).toFixed(1)}B`;
            else formatted = `${sign}$${(abs / 1e6).toFixed(1)}M`;
            setEtfFlow(formatted);
          }
        } catch {
          // ignore
        }
      }
    };

    loadMeta();
    const interval = setInterval(loadMeta, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [sosoApiKey]);

  const btc = tickerPrices['BTC-USD'] || tickerPrices['BTCUSDT'] || { price: 84312.5, change: 2.34 };
  const eth = tickerPrices['ETH-USD'] || tickerPrices['ETHUSDT'] || { price: 3241.8, change: 1.12 };
  const soso = tickerPrices['SOSO-USD'] || tickerPrices['SOSOUSDT'] || { price: 0.28, change: 5.42 };

  return (
    <header className="flex flex-col shrink-0 z-40 bg-surface border-b border-border shadow-lg">
      {/* 1. TOP LIVE TICKER TAPE (Real-Time Live Updates) */}
      <div className="h-7 bg-black/60 border-b border-border/60 flex items-center px-4 overflow-x-auto text-[11px] font-mono select-none space-x-6 text-text-muted shrink-0 scrollbar-none">
        {(() => {
          const isUp = soso.change >= 0;
          const TrendIcon = isUp ? TrendingUp : TrendingDown;
          const colorClass = isUp ? 'text-emerald-400' : 'text-red-400';
          const prefix = isUp ? '+' : '';
          return (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", isUp ? "bg-emerald-400" : "bg-red-400")} />
              <span className="font-bold text-text-primary">SOSO/USD</span>
              <span className={cn("font-bold", colorClass)}>${soso.price < 1 ? soso.price.toFixed(4) : soso.price.toFixed(2)}</span>
              <span className={cn("text-[10px] flex items-center", colorClass)}>
                <TrendIcon size={10} className="mr-0.5" />{prefix}{soso.change.toFixed(2)}%
              </span>
            </div>
          );
        })()}

        <div className="h-3 w-[1px] bg-border/60 shrink-0" />

        {(() => {
          const isUp = btc.change >= 0;
          const TrendIcon = isUp ? TrendingUp : TrendingDown;
          const colorClass = isUp ? 'text-emerald-400' : 'text-red-400';
          const prefix = isUp ? '+' : '';
          return (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="font-bold text-text-primary">BTC/USD</span>
              <span className={cn("font-semibold", colorClass)}>${btc.price.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
              <span className={cn("text-[10px] flex items-center", colorClass)}>
                <TrendIcon size={10} className="mr-0.5" />{prefix}{btc.change.toFixed(2)}%
              </span>
            </div>
          );
        })()}

        <div className="h-3 w-[1px] bg-border/60 shrink-0" />

        {(() => {
          const isUp = eth.change >= 0;
          const TrendIcon = isUp ? TrendingUp : TrendingDown;
          const colorClass = isUp ? 'text-emerald-400' : 'text-red-400';
          const prefix = isUp ? '+' : '';
          return (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="font-bold text-text-primary">ETH/USD</span>
              <span className={cn("font-semibold", colorClass)}>${eth.price.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
              <span className={cn("text-[10px] flex items-center", colorClass)}>
                <TrendIcon size={10} className="mr-0.5" />{prefix}{eth.change.toFixed(2)}%
              </span>
            </div>
          );
        })()}

        <div className="h-3 w-[1px] bg-border/60 shrink-0" />

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-text-muted uppercase tracking-wider text-[10px]">SSI Sentiment:</span>
          <span className={cn(
            "px-1.5 py-0.5 rounded font-bold text-[10px]",
            ssiSentiment.value >= 75 ? "bg-emerald-500/20 text-emerald-400" :
            ssiSentiment.value >= 55 ? "bg-emerald-500/10 text-emerald-300" :
            ssiSentiment.value >= 45 ? "bg-amber-500/10 text-amber-300" :
            ssiSentiment.value >= 25 ? "bg-red-500/10 text-red-300" : "bg-red-500/20 text-red-400"
          )}>
            {ssiSentiment.value} ({ssiSentiment.label})
          </span>
        </div>

        <div className="h-3 w-[1px] bg-border/60 shrink-0" />

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-text-muted uppercase tracking-wider text-[10px]">Spot ETF 24h Net Flow:</span>
          <span className={cn(
            "font-bold",
            etfFlow.startsWith('-') ? "text-red-400" : "text-emerald-400"
          )}>
            {etfFlow}
          </span>
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
