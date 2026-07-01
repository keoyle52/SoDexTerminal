import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSettingsStore } from '../store/settingsStore';
import {
  Zap, Brain, BarChart2, FlaskConical, Settings, Sparkles, Wallet, TrendingUp, TrendingDown, Layers, Shield, Bot
} from 'lucide-react';
import { cn } from '../lib/utils';
import { deriveAddressFromPrivateKey } from '../api/signer';
import { fetchEtfCurrentMetrics, fetchSosoIndices } from '../api/sosoServices';
import { OnboardingTour } from './OnboardingTour';
import { useTickers } from '../api/queries';

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
    'BTC-USD': { price: 0, change: 0 },
    'ETH-USD': { price: 0, change: 0 },
    'SOL-USD': { price: 0, change: 0 },
    'SOSO-USD': { price: 0, change: 0 },
  });

  const { sosoApiKey } = useSettingsStore();
  const [ssiSentiment, setSsiSentiment] = useState<{ value: number; label: string }>({ value: 76, label: 'Extreme Greed' });
  
  const [etfFlow, setEtfFlow] = useState<string>(() => {
    const cached = localStorage.getItem('sodex_last_etf_flow');
    if (cached && !cached.includes('NaN')) return cached;
    return '—';
  });

  const { data: rawTickers } = useTickers('perps');

  // Continually update ticker prices based on react-query response
  useEffect(() => {
    if (!rawTickers || !Array.isArray(rawTickers)) return;
    
    setTickerPrices((prev) => {
      const updated = { ...prev };
      for (const t of rawTickers as any[]) {
        const p = parseFloat(t.markPrice ?? t.lastPrice ?? 0);
        if (p > 0) {
          const sym = String(t.symbol ?? '');
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
          // Fallback to allorigins proxy of alternative.me if SoSoValue fails
          const targetUrl = 'https://api.alternative.me/fng/?limit=1';
          const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
          const res = await fetch(proxyUrl);
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

      // 2. Fetch ETF Net Flow (sum of BTC and ETH Spot ETFs)
      let hasData = false;
      try {
        const [btcMetrics, ethMetrics] = await Promise.all([
          fetchEtfCurrentMetrics('us-btc-spot'),
          fetchEtfCurrentMetrics('us-eth-spot'),
        ]);
        
        let totalFlow = 0;
        
        if (btcMetrics?.dailyNetInflow?.value != null) {
          totalFlow += btcMetrics.dailyNetInflow.value;
          hasData = true;
        }
        if (ethMetrics?.dailyNetInflow?.value != null) {
          totalFlow += ethMetrics.dailyNetInflow.value;
          hasData = true;
        }
        
        if (hasData && !isNaN(totalFlow) && mounted) {
          const abs = Math.abs(totalFlow);
          const sign = totalFlow >= 0 ? '+' : '-';
          let formatted = '';
          if (abs >= 1e9) formatted = `${sign}$${(abs / 1e9).toFixed(1)}B`;
          else formatted = `${sign}$${(abs / 1e6).toFixed(1)}M`;
          
          if (!formatted.includes('NaN')) {
            setEtfFlow(formatted);
            localStorage.setItem('sodex_last_etf_flow', formatted);
          }
        }
      } catch {
        // ignore
      }

      if (!hasData && mounted) {
        const cached = localStorage.getItem('sodex_last_etf_flow');
        if (cached && !cached.includes('NaN')) {
          setEtfFlow(cached);
        } else {
          setEtfFlow('—');
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

  const fmtPrice = (p: number, minDecimals = 1) => 
    p > 0 ? `$${p < 1 ? p.toFixed(4) : p.toLocaleString(undefined, { minimumFractionDigits: minDecimals, maximumFractionDigits: minDecimals })}` : '—';
  const fmtChange = (c: number, price: number) => price > 0 ? `${c >= 0 ? '+' : ''}${c.toFixed(2)}%` : '';

  const btc = tickerPrices['BTC-USD'] || tickerPrices['BTCUSDT'] || { price: 0, change: 0 };
  const eth = tickerPrices['ETH-USD'] || tickerPrices['ETHUSDT'] || { price: 0, change: 0 };
  const sol = tickerPrices['SOL-USD'] || tickerPrices['SOLUSDT'] || { price: 0, change: 0 };
  const soso = tickerPrices['SOSO-USD'] || tickerPrices['SOSOUSDT'] || { price: 0, change: 0 };

  return (
    <header className="flex flex-col shrink-0 z-40 bg-surface border-b border-border shadow-lg">
      {/* 1. TOP LIVE TICKER TAPE (Real-Time Live Updates) */}
      <div className="h-7 bg-black/60 border-b border-border/60 flex items-center px-4 overflow-x-auto text-[11px] font-mono select-none space-x-6 text-text-muted shrink-0 scrollbar-none">
        {(() => {
          const isUp = soso.change >= 0;
          const TrendIcon = isUp ? TrendingUp : TrendingDown;
          const colorClass = isUp ? 'text-emerald-400' : 'text-red-400';

          return (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", isUp ? "bg-emerald-400" : "bg-red-400")} />
              <span className="font-bold text-text-primary">SOSO/USD</span>
              <span className={cn("font-bold", colorClass)}>{fmtPrice(soso.price)}</span>
              {soso.price > 0 && (
                <span className={cn("text-[10px] flex items-center", colorClass)}>
                  <TrendIcon size={10} className="mr-0.5" />{fmtChange(soso.change, soso.price)}
                </span>
              )}
            </div>
          );
        })()}

        <div className="h-3 w-[1px] bg-border/60 shrink-0" />

        {(() => {
          const isUp = btc.change >= 0;
          const TrendIcon = isUp ? TrendingUp : TrendingDown;
          const colorClass = isUp ? 'text-emerald-400' : 'text-red-400';

          return (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="font-bold text-text-primary">BTC/USD</span>
              <span className={cn("font-semibold", colorClass)}>{fmtPrice(btc.price)}</span>
              {btc.price > 0 && (
                <span className={cn("text-[10px] flex items-center", colorClass)}>
                  <TrendIcon size={10} className="mr-0.5" />{fmtChange(btc.change, btc.price)}
                </span>
              )}
            </div>
          );
        })()}

        <div className="h-3 w-[1px] bg-border/60 shrink-0" />

        {(() => {
          const isUp = eth.change >= 0;
          const TrendIcon = isUp ? TrendingUp : TrendingDown;
          const colorClass = isUp ? 'text-emerald-400' : 'text-red-400';

          return (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="font-bold text-text-primary">ETH/USD</span>
              <span className={cn("font-semibold", colorClass)}>{fmtPrice(eth.price)}</span>
              {eth.price > 0 && (
                <span className={cn("text-[10px] flex items-center", colorClass)}>
                  <TrendIcon size={10} className="mr-0.5" />{fmtChange(eth.change, eth.price)}
                </span>
              )}
            </div>
          );
        })()}

        <div className="h-3 w-[1px] bg-border/60 shrink-0" />

        {(() => {
          const isUp = sol.change >= 0;
          const TrendIcon = isUp ? TrendingUp : TrendingDown;
          const colorClass = isUp ? 'text-emerald-400' : 'text-red-400';
          return (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="font-bold text-text-primary">SOL/USD</span>
              <span className={cn("font-semibold", colorClass)}>{fmtPrice(sol.price)}</span>
              {sol.price > 0 && (
                <span className={cn("text-[10px] flex items-center", colorClass)}>
                  <TrendIcon size={10} className="mr-0.5" />{fmtChange(sol.change, sol.price)}
                </span>
              )}
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
          <span className="text-primary font-bold">—</span>
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
