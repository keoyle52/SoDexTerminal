import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSettingsStore } from '../store/settingsStore';
import {
  Zap, Brain, BarChart2, FlaskConical, Settings, Sparkles, Wallet, TrendingUp, TrendingDown, Layers, Shield, Bot, Copy
} from 'lucide-react';
import { cn } from '../lib/utils';
import { deriveAddressFromPrivateKey } from '../api/signer';
import { fetchSosoIndices, fetchRealMainnetPrices } from '../api/sosoServices';
import { OnboardingTour } from './OnboardingTour';
import { useTickers } from '../api/queries';

const NAV_TABS = [
  { to: '/terminal', label: 'Terminal', icon: Zap, badge: 'Live Desk' },
  { to: '/trading-bots', label: 'Automated Bots', icon: Bot, badge: 'Studio' },
  { to: '/backtest', label: 'Backtest Studio', icon: BarChart2 },
  { to: '/mirror', label: 'Mirror', icon: Copy, badge: 'AI Copy' },
  { to: '/account', label: 'Account & Risk', icon: Shield },
];

export const HeaderDock: React.FC = () => {
  const location = useLocation();
  const store = useSettingsStore();
  const isConnected = store.isWalletConnected || !!store.privateKey;
  const activeAddress = store.walletAddress || store.evmAddress || (store.privateKey ? deriveAddressFromPrivateKey(store.privateKey) : '');
  
  const [showTour, setShowTour] = useState(false);
  const [tickerPrices, setTickerPrices] = useState<Record<string, { price: number; change: number }>>({
    'BTC-USD': { price: 0, change: 0 },
    'ETH-USD': { price: 0, change: 0 },
    'SOL-USD': { price: 0, change: 0 },
    'SOSO-USD': { price: 0, change: 0 },
  });

  const { sosoApiKey } = useSettingsStore();
  const [ssiSentiment, setSsiSentiment] = useState<{ value: number; label: string }>({ value: 76, label: 'Extreme Greed' });
  


  const { data: rawTickers } = useTickers('spot');

  // Fetch real mainnet prices from CoinGecko for marquee tape to align with real life
  useEffect(() => {
    let mounted = true;
    const updatePrices = async () => {
      try {
        const prices = await fetchRealMainnetPrices();
        if (mounted) {
          setTickerPrices((prev) => ({
            ...prev,
            'BTC-USD': { price: prices.btc.price, change: prices.btc.change24h },
            'ETH-USD': { price: prices.eth.price, change: prices.eth.change24h },
            'SOL-USD': { price: prices.sol.price, change: prices.sol.change24h },
            'SOSO-USD': { price: prices.soso.price, change: prices.soso.change24h },
            'BTC_USDC': { price: prices.btc.price, change: prices.btc.change24h },
            'vBTC_vUSDC': { price: prices.btc.price, change: prices.btc.change24h },
            'ETH_USDC': { price: prices.eth.price, change: prices.eth.change24h },
            'vETH_vUSDC': { price: prices.eth.price, change: prices.eth.change24h },
            'SOL_USDC': { price: prices.sol.price, change: prices.sol.change24h },
            'vSOL_vUSDC': { price: prices.sol.price, change: prices.sol.change24h },
            'WSOSO_vUSDC': { price: prices.soso.price, change: prices.soso.change24h },
            'WSOSO_USDC': { price: prices.soso.price, change: prices.soso.change24h },
          }));
        }
      } catch (err) {
        console.warn('Header marquee mainnet price update failed:', err);
      }
    };
    void updatePrices();
    const interval = setInterval(updatePrices, 10000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Fallback continually update ticker prices based on react-query response
  useEffect(() => {
    if (!rawTickers || !Array.isArray(rawTickers) || rawTickers.length === 0) return;
    
    setTickerPrices((prev) => {
      const updated = { ...prev };
      for (const t of rawTickers as any[]) {
        const p = parseFloat(t.markPrice ?? t.lastPrice ?? 0);
        if (p > 0) {
          const sym = String(t.symbol ?? '');
          // Do not overwrite if we already got it from fetchRealMainnetPrices
          if (sym.includes('BTC') || sym.includes('ETH') || sym.includes('SOL') || sym.includes('SOSO')) {
            continue;
          }
          const prevEntry = updated[sym];
          const prevPrice = prevEntry?.price || 0;
          const change = prevPrice > 0 && prevPrice !== p
            ? parseFloat((((p - prevPrice) / prevPrice) * 100).toFixed(2))
            : (prevEntry?.change || 0);
          updated[sym] = { price: p, change };
        }
      }
      return updated;
    });
  }, [rawTickers]);

  // Fetch F&G and ETF flows continuously
  useEffect(() => {
    let mounted = true;

    const loadMeta = async () => {
      // 1. Fetch Fear & Greed Index from SoSoValue (or fallback API)
      try {
        let val = 50;
        let label = 'Neutral';
        
        const indices = await fetchSosoIndices();
        if (indices?.fngIndex) {
          val = parseInt(indices.fngIndex);
          label = indices.fngClass || 'Neutral';
        } else {
          // Fallback to alternative.me if SoSoValue fails
          const targetUrl = 'https://api.alternative.me/fng/?limit=1';
          const res = await fetch(targetUrl);
          if (res.ok) {
            const data = await res.json();
            const item = data?.data?.[0];
            if (item) {
              val = parseInt(item.value) || 50;
              label = item.value_classification || 'Neutral';
            }
          }
        }
        if (mounted) {
          setSsiSentiment({ value: val, label });
        }
      } catch {
        // ignore
      }


    };

    loadMeta();
    const interval = setInterval(loadMeta, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [sosoApiKey]);

  const fmtPrice = (p: number, minDecimals = 1) => 
    p > 0 ? `$${p < 1 ? p.toFixed(4) : p.toLocaleString(undefined, { minimumFractionDigits: minDecimals, maximumFractionDigits: minDecimals })}` : '—';
  const fmtChange = (c: number, price: number) => price > 0 ? `${c >= 0 ? '+' : ''}${c.toFixed(2)}%` : '';

  const btc = tickerPrices['BTC_USDC'] || tickerPrices['vBTC_vUSDC'] || tickerPrices['BTC-USD'] || tickerPrices['BTCUSDT'] || { price: 0, change: 0 };
  const eth = tickerPrices['ETH_USDC'] || tickerPrices['vETH_vUSDC'] || tickerPrices['ETH-USD'] || tickerPrices['ETHUSDT'] || { price: 0, change: 0 };
  const sol = tickerPrices['SOL_USDC'] || tickerPrices['vSOL_vUSDC'] || tickerPrices['SOL-USD'] || tickerPrices['SOLUSDT'] || { price: 0, change: 0 };
  const soso = tickerPrices['WSOSO_vUSDC'] || tickerPrices['WSOSO_USDC'] || tickerPrices['SOSO-USD'] || { price: 0, change: 0 };

  return (
    <header className="flex flex-col shrink-0 z-40 bg-surface/30 backdrop-blur-md border-b border-border/50">
      {/* 1. TOP LIVE TICKER TAPE (Real-Time Live Updates) */}
      <div className="h-7 bg-black/20 border-b border-border/30 flex items-center px-4 overflow-x-auto text-[10px] font-mono select-none space-x-6 text-text-secondary shrink-0 scrollbar-none">
        {(() => {
          const isUp = soso.change >= 0;
          const TrendIcon = isUp ? TrendingUp : TrendingDown;
          const colorClass = isUp ? 'text-success' : 'text-danger';

          return (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse-dot", isUp ? "bg-success" : "bg-danger")} />
              <span className="font-bold text-text-primary">SOSO/USD</span>
              <span className={cn("font-bold font-mono tabular-nums", colorClass)}>{fmtPrice(soso.price)}</span>
              {soso.price > 0 && (
                <span className={cn("flex items-center font-mono tabular-nums", colorClass)}>
                  <TrendIcon size={10} className="mr-0.5" />{fmtChange(soso.change, soso.price)}
                </span>
              )}
            </div>
          );
        })()}

        <div className="h-3 w-[1px] bg-border shrink-0" />

        {(() => {
          const isUp = btc.change >= 0;
          const TrendIcon = isUp ? TrendingUp : TrendingDown;
          const colorClass = isUp ? 'text-success' : 'text-danger';

          return (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="font-bold text-text-primary">BTC/USD</span>
              <span className={cn("font-semibold font-mono tabular-nums", colorClass)}>{fmtPrice(btc.price)}</span>
              {btc.price > 0 && (
                <span className={cn("flex items-center font-mono tabular-nums", colorClass)}>
                  <TrendIcon size={10} className="mr-0.5" />{fmtChange(btc.change, btc.price)}
                </span>
              )}
            </div>
          );
        })()}

        <div className="h-3 w-[1px] bg-border shrink-0" />

        {(() => {
          const isUp = eth.change >= 0;
          const TrendIcon = isUp ? TrendingUp : TrendingDown;
          const colorClass = isUp ? 'text-success' : 'text-danger';

          return (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="font-bold text-text-primary">ETH/USD</span>
              <span className={cn("font-semibold font-mono tabular-nums", colorClass)}>{fmtPrice(eth.price)}</span>
              {eth.price > 0 && (
                <span className={cn("flex items-center font-mono tabular-nums", colorClass)}>
                  <TrendIcon size={10} className="mr-0.5" />{fmtChange(eth.change, eth.price)}
                </span>
              )}
            </div>
          );
        })()}

        <div className="h-3 w-[1px] bg-border shrink-0" />

        {(() => {
          const isUp = sol.change >= 0;
          const TrendIcon = isUp ? TrendingUp : TrendingDown;
          const colorClass = isUp ? 'text-success' : 'text-danger';
          return (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="font-bold text-text-primary">SOL/USD</span>
              <span className={cn("font-semibold font-mono tabular-nums", colorClass)}>{fmtPrice(sol.price)}</span>
              {sol.price > 0 && (
                <span className={cn("flex items-center font-mono tabular-nums", colorClass)}>
                  <TrendIcon size={10} className="mr-0.5" />{fmtChange(sol.change, sol.price)}
                </span>
              )}
            </div>
          );
        })()}

        <div className="h-3 w-[1px] bg-border shrink-0" />

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-text-muted uppercase tracking-wider text-[9px]">SSI Sentiment:</span>
          <span className={cn(
            "px-1 py-0.2 rounded-sm font-bold text-[9px]",
            ssiSentiment.value >= 75 ? "bg-success/10 text-success border border-success/25" :
            ssiSentiment.value >= 55 ? "bg-success/5 text-success/80 border border-success/15" :
            ssiSentiment.value >= 45 ? "bg-warning/5 text-warning/80 border border-warning/15" :
            ssiSentiment.value >= 25 ? "bg-danger/5 text-danger/80 border border-danger/15" : "bg-danger/10 text-danger border border-danger/25"
          )}>
            {ssiSentiment.value} ({ssiSentiment.label})
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          <span className="text-text-muted uppercase tracking-wider text-[9px]">Portfolio 95% VaR:</span>
          <span className="text-primary font-bold font-mono">—</span>
        </div>
      </div>

      {/* 2. MAIN HEADER NAVIGATION DOCK */}
      <div className="h-14 px-4 flex items-center justify-between gap-4">
        {/* Brand Logo & Nav Tabs */}
        <div className="flex items-center h-full">
          <div className="flex items-center gap-2 mr-6 shrink-0">
            <div className="w-6 h-6 flex items-center justify-center">
              <img src="/favicon.svg" alt="SoDEX Logo" className="w-full h-full object-contain" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold tracking-tight text-text-primary">SoDEX</span>
              <span className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.2 rounded-sm bg-primary/10 text-primary border border-primary/25">
                PRO
              </span>
            </div>
          </div>

          {/* Navigation Tabs (Top Dock Navigation) */}
          <nav className="flex items-center h-full gap-1 shrink-0 overflow-x-auto scrollbar-none">
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
                      'flex items-center gap-1.5 px-4 h-14 border-b-2 border-transparent text-xs font-semibold transition-all duration-150 whitespace-nowrap rounded-none',
                      active
                        ? 'border-primary text-text-primary bg-primary-soft/10'
                        : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.01]'
                    );
                  }}
                >
                  <Icon size={13} />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span className="text-[8px] font-extrabold px-1 rounded-sm bg-white/5 text-text-muted uppercase tracking-widest scale-90">
                      {tab.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Quick Tour */}
          <button
            onClick={() => setShowTour(true)}
            title="Platform Tour"
            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-sm border border-border text-text-secondary hover:text-text-primary hover:bg-white/[0.02] transition-all"
          >
            <Sparkles size={12} />
            <span className="hidden md:inline">Tour</span>
          </button>

          {/* Wallet Setup */}
          <NavLink
            to="/settings"
            title="Wallet Setup & EIP-712 Delegation"
            className={cn(
              'flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-sm border transition-all duration-150',
              isConnected
                ? 'bg-success/5 border-success/35 text-success hover:bg-success/10'
                : 'bg-white/[0.02] border-border text-text-secondary hover:text-text-primary hover:bg-white/[0.04]'
            )}
          >
            <Wallet size={12} />
            <span className="font-mono">
              {isConnected && activeAddress
                ? `${activeAddress.slice(0, 6)}...${activeAddress.slice(-4)}`
                : 'Connect'}
            </span>
          </NavLink>

          {/* Demo Mode */}
          <button
            onClick={() => store.setIsDemoMode(!store.isDemoMode)}
            title={store.isDemoMode ? 'Exit Demo' : 'Try Demo Engine'}
            className={cn(
              'flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-sm border transition-all duration-150',
              store.isDemoMode
                ? 'bg-warning/5 border-warning/35 text-warning hover:bg-warning/10'
                : 'bg-white/[0.02] border-border text-text-secondary hover:text-text-primary hover:bg-white/[0.04]'
            )}
          >
            <FlaskConical size={12} />
            <span className="hidden sm:inline">{store.isDemoMode ? 'Demo On' : 'Demo'}</span>
          </button>

          {/* Settings NavLink */}
          <NavLink
            to="/settings"
            title="Settings"
            className={({ isActive }) =>
              cn(
                'p-2 rounded-sm border border-border bg-white/[0.01] text-text-secondary hover:text-text-primary hover:bg-white/[0.03] transition-colors',
                isActive && 'bg-primary-soft/10 text-primary border-primary/20'
              )
            }
          >
            <Settings size={13} />
          </NavLink>
        </div>
      </div>

      {/* Tour Modal */}
      <OnboardingTour isOpen={showTour} onClose={() => setShowTour(false)} />
    </header>
  );
};
