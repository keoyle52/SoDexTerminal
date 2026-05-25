import React, { useState, useEffect } from 'react';
import {
  BarChart2, Building2, Flame, Coins, Calendar, TrendingUp,
  Activity, AlertCircle, Bitcoin, Globe, Gauge, Users, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { cn } from '../lib/utils';

interface SSIData {
  symbol: string;
  longRatio: number;
  shortRatio: number;
  longUsers: number;
  shortUsers: number;
}

interface Treasury {
  name: string;
  ticker: string;
  btc: number;
  value: number;
  change: number;
}

interface Sector {
  name: string;
  change24h: number;
  topCoin: string;
  volume: string;
}

interface FundingRate {
  symbol: string;
  rate: number;
  annualized: number;
  nextFunding: string;
}

interface MacroEvent {
  title: string;
  date: string;
  impact: 'high' | 'medium' | 'low';
  icon: React.ElementType;
  description: string;
}

interface OverviewStat {
  label: string;
  value: string;
  sub?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon: React.ElementType;
  color: string;
}

export const MarketIntel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ssi' | 'treasuries' | 'sectors' | 'funding' | 'macro'>('ssi');
  const [loading, setLoading] = useState(true);

  const [ssiData, setSsiData] = useState<SSIData[]>([]);
  const [treasuries, setTreasuries] = useState<Treasury[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [fundingRates, setFundingRates] = useState<FundingRate[]>([]);
  const [macroEvents] = useState<MacroEvent[]>([
    { title: 'Fed Interest Rate Decision', date: 'Tomorrow · Jun 12', impact: 'high', icon: AlertCircle, description: 'FOMC meeting outcome; rate hold expected at 5.25–5.50%' },
    { title: 'US CPI Data Release', date: 'Jun 14', impact: 'high', icon: TrendingUp, description: 'Consumer Price Index — consensus +3.1% YoY' },
    { title: 'Bitcoin ETF Flows Report', date: 'Weekly', impact: 'medium', icon: Bitcoin, description: 'Aggregated spot ETF net flows from 11 issuers' },
    { title: 'ECB Rate Decision', date: 'Jun 20', impact: 'medium', icon: Globe, description: 'European Central Bank — 25 bps cut anticipated' },
    { title: 'US Non-Farm Payrolls', date: 'Jul 4', impact: 'high', icon: Users, description: 'Monthly employment change; consensus +185K' },
  ]);
  const [overviewStats] = useState<OverviewStat[]>([
    { label: 'Fear & Greed', value: '72', sub: 'Greed', trend: 'up', icon: Gauge, color: 'text-amber-400' },
    { label: 'BTC Dominance', value: '54.1%', sub: '+0.3% today', trend: 'up', icon: Bitcoin, color: 'text-orange-400' },
    { label: 'Market Cap', value: '$2.87T', sub: '+1.4% 24h', trend: 'up', icon: Globe, color: 'text-primary' },
    { label: 'Open Interest', value: '$28.4B', sub: 'Perps total', trend: 'neutral', icon: Activity, color: 'text-violet-400' },
  ]);

  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      setSsiData([
        { symbol: 'BTC', longRatio: 52.3, shortRatio: 47.7, longUsers: 1250, shortUsers: 1134 },
        { symbol: 'ETH', longRatio: 48.1, shortRatio: 51.9, longUsers: 890, shortUsers: 961 },
        { symbol: 'SOL', longRatio: 61.5, shortRatio: 38.5, longUsers: 567, shortUsers: 355 },
        { symbol: 'DOGE', longRatio: 67.2, shortRatio: 32.8, longUsers: 340, shortUsers: 166 },
        { symbol: 'XRP', longRatio: 44.8, shortRatio: 55.2, longUsers: 412, shortUsers: 508 },
      ]);
      setTreasuries([
        { name: 'Strategy (MSTR)', ticker: 'MSTR', btc: 214246, value: 14.2, change: 2.1 },
        { name: 'Marathon Digital', ticker: 'MARA', btc: 25300, value: 1.68, change: -0.4 },
        { name: 'Riot Platforms', ticker: 'RIOT', btc: 18000, value: 1.19, change: 0.8 },
        { name: 'CleanSpark', ticker: 'CLSK', btc: 10500, value: 0.70, change: 1.2 },
        { name: 'Galaxy Digital', ticker: 'GLXY', btc: 8100, value: 0.54, change: -0.2 },
      ]);
      setSectors([
        { name: 'DeFi', change24h: 5.2, topCoin: 'UNI', volume: '$4.1B' },
        { name: 'Layer 1', change24h: 3.8, topCoin: 'SOL', volume: '$18.2B' },
        { name: 'Layer 2', change24h: 2.1, topCoin: 'ARB', volume: '$2.9B' },
        { name: 'AI & Infra', change24h: 6.4, topCoin: 'FET', volume: '$1.7B' },
        { name: 'RWA', change24h: 1.3, topCoin: 'ONDO', volume: '$0.8B' },
        { name: 'Meme', change24h: -2.1, topCoin: 'PEPE', volume: '$3.3B' },
        { name: 'Gaming', change24h: -0.7, topCoin: 'IMX', volume: '$0.6B' },
        { name: 'Stablecoins', change24h: 0.0, topCoin: 'USDT', volume: '$52.1B' },
      ]);
      setFundingRates([
        { symbol: 'BTC', rate: 0.010, annualized: 10.95, nextFunding: '3h 22m' },
        { symbol: 'ETH', rate: 0.008, annualized: 8.76, nextFunding: '3h 22m' },
        { symbol: 'SOL', rate: 0.015, annualized: 16.43, nextFunding: '3h 22m' },
        { symbol: 'DOGE', rate: 0.023, annualized: 25.18, nextFunding: '3h 22m' },
        { symbol: 'XRP', rate: -0.004, annualized: -4.38, nextFunding: '3h 22m' },
        { symbol: 'AVAX', rate: 0.006, annualized: 6.57, nextFunding: '3h 22m' },
      ]);
      setLoading(false);
    }, 400);
  }, []);

  const tabs = [
    { id: 'ssi', label: 'Long/Short', icon: Activity },
    { id: 'treasuries', label: 'Treasuries', icon: Building2 },
    { id: 'sectors', label: 'Sectors', icon: Flame },
    { id: 'funding', label: 'Funding', icon: Coins },
    { id: 'macro', label: 'Macro Events', icon: Calendar },
  ] as const;

  const impactColors = {
    high: 'bg-danger/15 text-danger border-danger/30',
    medium: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    low: 'bg-success/15 text-success border-success/30',
  };

  return (
    <div className="p-4 md:p-6 h-full flex flex-col gap-5 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-primary flex items-center justify-center shadow-lg">
          <BarChart2 size={24} className="text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-text-primary">Market Intelligence</h2>
          <p className="text-[11px] text-text-muted">Aggregated on-chain & market data signals</p>
        </div>
      </div>

      {/* Overview Stats Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        {overviewStats.map((stat) => (
          <Card key={stat.label} className="p-3.5 flex items-center gap-3">
            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', 'bg-white/[0.05]')}>
              <stat.icon size={17} className={stat.color} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-medium text-text-muted uppercase tracking-wider">{stat.label}</div>
              <div className="text-base font-bold font-mono text-text-primary leading-tight">{stat.value}</div>
              {stat.sub && (
                <div className={cn(
                  'text-[10px] font-medium',
                  stat.trend === 'up' ? 'text-success' : stat.trend === 'down' ? 'text-danger' : 'text-text-muted'
                )}>
                  {stat.sub}
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 shrink-0 border-b border-border/50 pb-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium transition-all rounded-t-lg border-b-2 -mb-px',
              activeTab === tab.id
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-white/[0.03]'
            )}
          >
            <tab.icon size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-7 w-7 border-2 border-primary/30 border-t-primary" />
            <span className="text-xs text-text-muted">Loading market data…</span>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0">

          {/* ── SSI ── */}
          {activeTab === 'ssi' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-text-muted">Showing Speculative Sentiment Index across {ssiData.length} pairs</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">Live</span>
              </div>
              {ssiData.map((item) => {
                const sentiment = item.longRatio > 60 ? 'Bullish Extreme' : item.longRatio > 55 ? 'Bullish' : item.longRatio < 40 ? 'Bearish Extreme' : item.longRatio < 45 ? 'Bearish' : 'Neutral';
                const sentimentColor = item.longRatio > 55 ? 'text-success' : item.longRatio < 45 ? 'text-danger' : 'text-amber-400';
                return (
                  <Card key={item.symbol} className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-base text-text-primary">{item.symbol}/USD</span>
                        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', sentimentColor,
                          item.longRatio > 55 ? 'bg-success/10 border-success/20' : item.longRatio < 45 ? 'bg-danger/10 border-danger/20' : 'bg-amber-500/10 border-amber-500/20'
                        )}>
                          {sentiment}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-text-muted">
                        <span className="flex items-center gap-1"><Users size={11} />{(item.longUsers + item.shortUsers).toLocaleString()} traders</span>
                      </div>
                    </div>
                    {/* Ratio bar */}
                    <div className="flex rounded-full overflow-hidden h-2.5 mb-2.5 bg-surface-2">
                      <div
                        className="bg-gradient-to-r from-success/80 to-success transition-all duration-700"
                        style={{ width: `${item.longRatio}%` }}
                      />
                      <div
                        className="bg-gradient-to-r from-danger to-danger/80 transition-all duration-700"
                        style={{ width: `${item.shortRatio}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] font-medium">
                      <span className="text-success flex items-center gap-1"><ArrowUpRight size={11} />Long {item.longRatio.toFixed(1)}% <span className="text-text-muted font-normal">({item.longUsers.toLocaleString()})</span></span>
                      <span className="text-danger flex items-center gap-1">Short {item.shortRatio.toFixed(1)}% <span className="text-text-muted font-normal">({item.shortUsers.toLocaleString()})</span><ArrowDownRight size={11} /></span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* ── Treasuries ── */}
          {activeTab === 'treasuries' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-text-muted">Top corporate Bitcoin holders</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Total: {treasuries.reduce((s, t) => s + t.btc, 0).toLocaleString()} BTC
                </span>
              </div>
              {treasuries.map((item, idx) => {
                const maxBtc = treasuries[0].btc;
                const pct = (item.btc / maxBtc) * 100;
                return (
                  <Card key={item.name} className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-[11px] font-bold text-amber-400 border border-amber-500/20">
                          #{idx + 1}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-text-primary">{item.name}</div>
                          <div className="text-[10px] text-text-muted font-mono">{item.ticker}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-sm text-text-primary">{item.btc.toLocaleString()} <span className="text-amber-400 text-xs">BTC</span></div>
                        <div className="flex items-center gap-1.5 justify-end mt-0.5">
                          <span className="text-[11px] text-text-muted">${item.value}B</span>
                          <span className={cn('text-[10px] font-semibold', item.change >= 0 ? 'text-success' : 'text-danger')}>
                            {item.change >= 0 ? '+' : ''}{item.change}%
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500/60 to-amber-400 transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* ── Sectors ── */}
          {activeTab === 'sectors' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-text-muted">24h sector performance</span>
                <span className="text-[10px] text-text-muted">Sorted by change</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[...sectors].sort((a, b) => b.change24h - a.change24h).map((item) => {
                  const isPos = item.change24h >= 0;
                  const intensity = Math.min(Math.abs(item.change24h) / 8, 1);
                  return (
                    <Card key={item.name} className={cn(
                      'p-4 border transition-all',
                      isPos ? 'border-success/10 hover:border-success/25' : 'border-danger/10 hover:border-danger/25'
                    )}>
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-xs font-semibold text-text-primary">{item.name}</span>
                        <span className={cn(
                          'text-xs font-bold font-mono',
                          isPos ? 'text-success' : 'text-danger'
                        )}>
                          {isPos ? '+' : ''}{item.change24h.toFixed(1)}%
                        </span>
                      </div>
                      <div
                        className={cn('h-1 rounded-full mb-2', isPos ? 'bg-success/20' : 'bg-danger/20')}
                      >
                        <div
                          className={cn('h-full rounded-full', isPos ? 'bg-success' : 'bg-danger')}
                          style={{ width: `${intensity * 100}%`, opacity: 0.7 + intensity * 0.3 }}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-text-muted">Top: <span className="text-text-secondary font-mono">{item.topCoin}</span></span>
                        <span className="text-[10px] text-text-muted">{item.volume}</span>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Funding ── */}
          {activeTab === 'funding' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-text-muted">Perpetual funding rates · 8h interval</span>
                <span className="text-[10px] text-text-muted">Next funding: ~3h 22m</span>
              </div>
              <Card className="p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left text-[10px] font-semibold text-text-muted uppercase tracking-wider px-5 py-3">Asset</th>
                      <th className="text-right text-[10px] font-semibold text-text-muted uppercase tracking-wider px-5 py-3">Rate / 8h</th>
                      <th className="text-right text-[10px] font-semibold text-text-muted uppercase tracking-wider px-5 py-3 hidden md:table-cell">Annualized</th>
                      <th className="text-center text-[10px] font-semibold text-text-muted uppercase tracking-wider px-5 py-3 hidden md:table-cell">Signal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fundingRates.map((item, idx) => {
                      const isPos = item.rate >= 0;
                      const signal = Math.abs(item.annualized) > 20 ? 'Extreme' : Math.abs(item.annualized) > 10 ? 'Elevated' : 'Normal';
                      const signalColor = Math.abs(item.annualized) > 20 ? 'bg-danger/15 text-danger border-danger/30' : Math.abs(item.annualized) > 10 ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' : 'bg-surface-2 text-text-muted border-border/50';
                      return (
                        <tr key={item.symbol} className={cn('border-b border-border/30 transition-colors hover:bg-white/[0.02]', idx === fundingRates.length - 1 && 'border-0')}>
                          <td className="px-5 py-3.5">
                            <span className="font-mono font-bold text-text-primary">{item.symbol}</span>
                            <span className="text-text-muted font-mono text-xs">/USD</span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <span className={cn('font-mono font-semibold', isPos ? 'text-success' : 'text-danger')}>
                              {isPos ? '+' : ''}{item.rate.toFixed(3)}%
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right hidden md:table-cell">
                            <span className={cn('font-mono text-sm', isPos ? 'text-success/80' : 'text-danger/80')}>
                              {isPos ? '+' : ''}{item.annualized.toFixed(2)}%
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-center hidden md:table-cell">
                            <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', signalColor)}>
                              {signal}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
              <div className="flex gap-3 text-[10px] text-text-muted pt-1">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-success inline-block" />Positive = longs pay shorts</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-danger inline-block" />Negative = shorts pay longs</span>
              </div>
            </div>
          )}

          {/* ── Macro ── */}
          {activeTab === 'macro' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-text-muted">Upcoming high-impact economic events</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-2 text-text-muted border border-border/50">UTC</span>
              </div>
              {macroEvents.map((event) => (
                <Card key={event.title} className="p-4 flex items-start gap-4">
                  <div className={cn(
                    'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border',
                    event.impact === 'high' ? 'bg-danger/10 border-danger/20' : event.impact === 'medium' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-success/10 border-success/20'
                  )}>
                    <event.icon size={16} className={event.impact === 'high' ? 'text-danger' : event.impact === 'medium' ? 'text-amber-400' : 'text-success'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold text-text-primary leading-snug">{event.title}</span>
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 uppercase tracking-wide', impactColors[event.impact])}>
                        {event.impact}
                      </span>
                    </div>
                    <div className="text-xs text-primary font-medium mt-0.5 mb-1">{event.date}</div>
                    <div className="text-[11px] text-text-muted leading-relaxed">{event.description}</div>
                  </div>
                </Card>
              ))}
            </div>
          )}

        </div>
      )}
    </div>
  );
};
