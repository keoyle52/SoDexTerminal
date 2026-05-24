import React, { useState, useEffect } from 'react';
import { BarChart2, Building2, Flame, Coins, Calendar, TrendingUp, Activity } from 'lucide-react';
import { Card } from '../components/common/Card';
import { cn } from '../lib/utils';

// Types for different intel data
interface SSIData {
  symbol: string;
  longRatio: number;
  shortRatio: number;
  longUsers: number;
  shortUsers: number;
}

interface Treasury {
  name: string;
  btc: number;
  value: number;
}

interface Sector {
  name: string;
  change24h: number;
  topCoin: string;
}

interface FundingRate {
  symbol: string;
  rate: number;
  annualized: number;
}

export const MarketIntel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ssi' | 'treasuries' | 'sectors' | 'funding' | 'macro'>('ssi');
  const [loading, setLoading] = useState(true);
  
  // Mock data - replace with real API calls
  const [ssiData, setSsiData] = useState<SSIData[]>([]);
  const [treasuries, setTreasuries] = useState<Treasury[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [fundingRates, setFundingRates] = useState<FundingRate[]>([]);

  useEffect(() => {
    // Simulate data loading
    setLoading(true);
    setTimeout(() => {
      setSsiData([
        { symbol: 'BTC', longRatio: 52.3, shortRatio: 47.7, longUsers: 1250, shortUsers: 1134 },
        { symbol: 'ETH', longRatio: 48.1, shortRatio: 51.9, longUsers: 890, shortUsers: 961 },
        { symbol: 'SOL', longRatio: 61.5, shortRatio: 38.5, longUsers: 567, shortUsers: 355 },
      ]);
      setTreasuries([
        { name: 'Strategy', btc: 152000, value: 6.5 },
        { name: 'Marathon', btc: 25300, value: 1.1 },
        { name: 'CleanSpark', btc: 10500, value: 0.45 },
      ]);
      setSectors([
        { name: 'DeFi', change24h: 5.2, topCoin: 'UNI' },
        { name: 'Layer 1', change24h: 3.8, topCoin: 'SOL' },
        { name: 'Meme', change24h: -2.1, topCoin: 'PEPE' },
      ]);
      setFundingRates([
        { symbol: 'BTC', rate: 0.01, annualized: 10.95 },
        { symbol: 'ETH', rate: 0.008, annualized: 8.76 },
        { symbol: 'SOL', rate: 0.015, annualized: 16.43 },
      ]);
      setLoading(false);
    }, 500);
  }, []);

  const tabs = [
    { id: 'ssi', label: 'SSI', icon: Activity },
    { id: 'treasuries', label: 'Treasuries', icon: Building2 },
    { id: 'sectors', label: 'Sectors', icon: Flame },
    { id: 'funding', label: 'Funding', icon: Coins },
    { id: 'macro', label: 'Macro', icon: Calendar },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <BarChart2 size={24} className="text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Market Intelligence</h1>
          <p className="text-text-muted text-sm">Real-time market data and analytics</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              activeTab === tab.id
                ? 'bg-primary/10 text-primary'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-2'
            )}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <div className="space-y-4">
          {activeTab === 'ssi' && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Long/Short Ratio (SSI)</h3>
              <div className="space-y-4">
                {ssiData.map((item) => (
                  <div key={item.symbol} className="flex items-center justify-between p-4 bg-surface-2 rounded-lg">
                    <div className="flex items-center gap-4">
                      <span className="font-mono font-bold text-lg">{item.symbol}</span>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-success">Long {item.longRatio}%</span>
                        <span className="text-danger">Short {item.shortRatio}%</span>
                      </div>
                    </div>
                    <div className="text-sm text-text-muted">
                      {item.longUsers.toLocaleString()} vs {item.shortUsers.toLocaleString()} users
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {activeTab === 'treasuries' && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Bitcoin Treasuries</h3>
              <div className="space-y-4">
                {treasuries.map((item) => (
                  <div key={item.name} className="flex items-center justify-between p-4 bg-surface-2 rounded-lg">
                    <span className="font-medium">{item.name}</span>
                    <div className="text-right">
                      <div className="font-mono">{item.btc.toLocaleString()} BTC</div>
                      <div className="text-sm text-text-muted">${item.value}B</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {activeTab === 'sectors' && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Sector Performance</h3>
              <div className="grid gap-4">
                {sectors.map((item) => (
                  <div key={item.name} className="flex items-center justify-between p-4 bg-surface-2 rounded-lg">
                    <div>
                      <span className="font-medium">{item.name}</span>
                      <span className="text-text-muted text-sm ml-2">Top: {item.topCoin}</span>
                    </div>
                    <span className={cn(
                      'font-mono font-bold',
                      item.change24h >= 0 ? 'text-success' : 'text-danger'
                    )}>
                      {item.change24h >= 0 ? '+' : ''}{item.change24h}%
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {activeTab === 'funding' && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Funding Rates</h3>
              <div className="space-y-4">
                {fundingRates.map((item) => (
                  <div key={item.symbol} className="flex items-center justify-between p-4 bg-surface-2 rounded-lg">
                    <span className="font-mono font-bold">{item.symbol}</span>
                    <div className="text-right">
                      <div className="font-mono">{item.rate}% / 8h</div>
                      <div className="text-sm text-text-muted">~{item.annualized}% APR</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {activeTab === 'macro' && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Macro Calendar</h3>
              <div className="space-y-3 text-text-secondary">
                <div className="flex items-center gap-3 p-3 bg-surface-2 rounded-lg">
                  <Calendar size={16} className="text-primary" />
                  <div>
                    <div className="font-medium">Fed Interest Rate Decision</div>
                    <div className="text-sm text-text-muted">Tomorrow • High Impact</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-surface-2 rounded-lg">
                  <TrendingUp size={16} className="text-success" />
                  <div>
                    <div className="font-medium">CPI Data Release</div>
                    <div className="text-sm text-text-muted">Next Week • High Impact</div>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};
