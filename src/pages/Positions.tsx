import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { 
  Wallet, TrendingUp, BarChart3, Shield, X as XIcon, 
  AlertTriangle, ShieldCheck, Activity, Info, Cpu, Play, StopCircle, ShieldAlert 
} from 'lucide-react';
import { NumberDisplay } from '../components/common/NumberDisplay';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { StatCard, Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { useSettingsStore } from '../store/settingsStore';
import { useBotStore } from '../store/botStore';
import { useWave3Store } from '../store/wave3Store';
import {
  fetchPositions,
  fetchBalances,
  fetchMarkPrices,
  placeOrder,
  cancelAllOrders,
  fetchAccountFills,
} from '../api/services';
import { getErrorMessage, cn } from '../lib/utils';

interface PositionRow {
  symbol: string;
  side: string;
  size: number;
  entryPrice: number;
  markPrice: number;
  liquidationPrice: number;
  pnl: number;
  pnlPercent: number;
  margin: number;
  leverage: number;
  distanceToLiq: number; // %
  health: number; // 0..100
}

interface HistoricalFill {
  time: number;
  symbol: string;
  side: number; // 1=BUY, 2=SELL
  price: number;
  quantity: number;
  feeAmt: number;
  tradeID: number;
}

/** Collateral weight per coin — matches SoDEX cross-margin rules */
const COLLATERAL_WEIGHTS: Record<string, number> = {
  USD: 1.0,
  USDT: 1.0,
  USDC: 1.0,
  BTC: 0.95,
  ETH: 0.90,
  SOL: 0.85,
  SOSO: 0.50,
  WSOSO: 0.50,
  BNB: 0.85,
  ARB: 0.75,
  AVAX: 0.80,
  DOGE: 0.70,
  LINK: 0.80,
  MATIC: 0.75,
  OP: 0.75,
};

function getCollateralWeight(coin: string): number {
  const upper = coin.toUpperCase().replace(/^V/, '');
  return COLLATERAL_WEIGHTS[upper] ?? 0.70;
}

interface CollateralEntry {
  coin: string;
  amount: number;
  price: number;
  weight: number;
  rawValue: number;       // amount * price
  effectiveValue: number; // amount * price * weight
}

export const Positions: React.FC = () => {
  const store = useSettingsStore();
  const { confirmOrders } = store;

  const [searchParams, setSearchParams] = useSearchParams();
  const queryTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'open' | 'bots' | 'risk'>('open');

  useEffect(() => {
    if (queryTab === 'bots') {
      setActiveTab('bots');
    } else if (queryTab === 'risk') {
      setActiveTab('risk');
    } else {
      setActiveTab('open');
    }
  }, [queryTab]);

  const handleTabChange = (tab: 'open' | 'bots' | 'risk') => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [marginBalance, setMarginBalance] = useState(0);
  const [collateralBreakdown, setCollateralBreakdown] = useState<CollateralEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMessage, setConfirmMessage] = useState('');
  const confirmActionRef = useRef<() => void>(() => {});

  const loadData = useCallback(async () => {
    try {
      const [rawPositions, rawBalances, rawPrices, rawFills] = await Promise.all([
        fetchPositions(),
        fetchBalances('perps'),
        fetchMarkPrices(),
        fetchAccountFills('perps', 50),
      ]);

      // Parse prices
      const priceMap: Record<string, number> = {};
      const pricesArr = Array.isArray(rawPrices) ? rawPrices : [];
      for (const p of pricesArr) {
        priceMap[p.symbol] = parseFloat(p.markPrice ?? p.price ?? 0);
      }

      // Parse balance with weighted collateral calculation
      const balancesArr = Array.isArray(rawBalances) ? rawBalances : [];
      let totalWeightedCollateral = 0;
      const breakdown: CollateralEntry[] = [];
      
      for (const b of balancesArr) {
        const amt = parseFloat(b.total ?? b.balance ?? b.available ?? b.totalBalance ?? 0);
        if (amt <= 0) continue; // skip zero balances
        
        const coin = String(b.coin ?? b.asset ?? b.currency ?? b.symbol ?? 'USDT').toUpperCase();
        const baseCoin = coin.replace(/^V/, '');
        
        let price = parseFloat(b.price ?? 0);
        if (price <= 0) {
          if (['USD', 'USDT', 'USDC'].includes(baseCoin)) {
            price = 1.0;
          } else {
            // Look up mark price — try multiple key formats
            price = priceMap[`${baseCoin}-USD`] 
              ?? priceMap[`${baseCoin}USDT`] 
              ?? priceMap[baseCoin] 
              ?? 0;
          }
        }

        // Skip coins with no price data — don't use hardcoded fallbacks
        if (price <= 0) continue;

        const weight = getCollateralWeight(coin);
        const rawValue = amt * price;
        const effectiveValue = rawValue * weight;
        totalWeightedCollateral += effectiveValue;
        
        breakdown.push({
          coin: baseCoin,
          amount: amt,
          price,
          weight,
          rawValue,
          effectiveValue,
        });
      }
      
      // Sort by effective value descending
      breakdown.sort((a, b) => b.effectiveValue - a.effectiveValue);
      setCollateralBreakdown(breakdown);
      setMarginBalance(totalWeightedCollateral);

      // Parse history/fills
      // Parse positions
      const positionsArr = Array.isArray(rawPositions) ? rawPositions : [];
      const mapped: PositionRow[] = positionsArr.map((pos: Record<string, unknown>) => {
        const rawSize = parseFloat(String(pos.size ?? pos.quantity ?? 0));
        const size = Math.abs(rawSize);
        const entryPrice = parseFloat(String(pos.avgEntryPrice ?? pos.entryPrice ?? pos.avgPrice ?? 0));
        const symbol = String(pos.symbol ?? '');
        const markPrice = priceMap[symbol] ?? parseFloat(String(pos.markPrice ?? 0));
        const liquidationPrice = parseFloat(String(pos.liquidationPrice ?? pos.liqPrice ?? 0));
        const margin = parseFloat(String(pos.initialMargin ?? pos.margin ?? 0));
        const leverage = parseFloat(String(pos.leverage ?? 0));

        const side = (pos.side === 'LONG' || (pos.side !== 'SHORT' && rawSize >= 0))
          ? 'LONG' : 'SHORT';

        const direction = side === 'LONG' ? 1 : -1;
        const pnl = direction * size * (markPrice - entryPrice);
        const costBasis = size * entryPrice;
        const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

        // Risk math: distance to liquidation
        const distanceToLiq = markPrice > 0 
          ? (Math.abs(markPrice - liquidationPrice) / markPrice) * 100 
          : 0;

        // Health Score (0..100): entry distance vs liq distance
        let health = 100;
        if (side === 'LONG' && liquidationPrice > 0 && entryPrice > liquidationPrice) {
          health = Math.max(0, Math.min(100, ((markPrice - liquidationPrice) / (entryPrice - liquidationPrice)) * 100));
        } else if (side === 'SHORT' && liquidationPrice > 0 && liquidationPrice > entryPrice) {
          health = Math.max(0, Math.min(100, ((liquidationPrice - markPrice) / (liquidationPrice - entryPrice)) * 100));
        }

        return { 
          symbol, side, size, entryPrice, markPrice, liquidationPrice, 
          pnl, pnlPercent, margin, leverage, distanceToLiq, health 
        };
      });

      setPositions(mapped);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to load position data'));
    } finally {
      setLoading(false);
    }
  }, [store.isDemoMode]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Calculations
  const totalPnl = positions.reduce((s, p) => s + p.pnl, 0);
  const totalValue = positions.reduce((s, p) => s + p.size * p.markPrice, 0);
  const marginUsage = marginBalance > 0
    ? Math.min((positions.reduce((s, p) => s + p.margin, 0) / marginBalance) * 100, 100)
    : 0;

  // Portfolio Collateral Health & Risk Assessment
  const portfolioLeverage = totalValue > 0 && marginBalance > 0 ? totalValue / marginBalance : 0;
  
  // Health score decreases as margin usage increases and distance to liquidation shrinks
  const minDistanceToLiq = positions.length > 0 
    ? Math.min(...positions.map(p => p.distanceToLiq)) 
    : 100;
  const healthScore = Math.max(0, Math.min(100, Math.round(
    (100 - marginUsage) * 0.6 + Math.min(minDistanceToLiq, 30) * 1.33
  )));

  // Value at Risk (VaR): per-asset volatility-weighted estimate (95% confidence 1-day)
  const ASSET_DAILY_VOL: Record<string, number> = {
    BTC: 0.035, ETH: 0.045, SOL: 0.065, SOSO: 0.10,
    BNB: 0.04, ARB: 0.07, AVAX: 0.06, DOGE: 0.08,
    LINK: 0.055, OP: 0.07, MATIC: 0.065,
  };
  const var95_1Day = positions.reduce((sum, pos) => {
    const baseCoin = pos.symbol.replace(/-USD$/, '').replace(/USDT$/, '');
    const vol = ASSET_DAILY_VOL[baseCoin] ?? 0.05;
    return sum + (pos.size * pos.markPrice * vol * 1.645);
  }, 0);

  const executeClose = useCallback(async (pos: PositionRow) => {
    try {
      const closeSide = pos.side === 'LONG' ? 2 : 1;
      await cancelAllOrders(pos.symbol, 'perps');
      await placeOrder(
        { symbol: pos.symbol, side: closeSide as 1 | 2, type: 2, quantity: String(pos.size) },
        'perps',
      );
      toast.success(`${pos.symbol} position closed`);
      loadData();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to close position'));
    }
  }, [loadData]);

  const handleClose = useCallback((pos: PositionRow) => {
    if (confirmOrders) {
      setConfirmTitle('Close Position');
      setConfirmMessage(`Are you sure you want to close ${pos.symbol} ${pos.side} ${pos.size} position?`);
      confirmActionRef.current = () => executeClose(pos);
      setConfirmOpen(true);
    } else {
      executeClose(pos);
    }
  }, [confirmOrders, executeClose]);

  const executeCloseAll = useCallback(async () => {
    const results = await Promise.allSettled(positions.map((pos) => executeClose(pos)));
    const failures = results.filter((r) => r.status === 'rejected');
    if (failures.length > 0) {
      toast.error(`${failures.length} position(s) could not be closed`);
    }
  }, [positions, executeClose]);

  const handleCloseAll = useCallback(() => {
    if (positions.length === 0) return;
    if (confirmOrders) {
      setConfirmTitle('Close All Positions');
      setConfirmMessage(`Are you sure you want to close all ${positions.length} open positions?`);
      confirmActionRef.current = () => executeCloseAll();
      setConfirmOpen(true);
    } else {
      executeCloseAll();
    }
  }, [confirmOrders, positions, executeCloseAll]);

  // Stress tests simulator helper
  const getStressImpact = (btcChangePct: number) => {
    return positions.reduce((acc, pos) => {
      // Crude beta factor per asset
      let beta = 1.0;
      if (pos.symbol.includes('ETH')) beta = 1.15;
      else if (pos.symbol.includes('SOL')) beta = 1.45;
      else if (pos.symbol.includes('BNB')) beta = 0.85;

      const change = btcChangePct * beta;
      const direction = pos.side === 'LONG' ? 1 : -1;
      const sizeUsd = pos.size * pos.markPrice;
      const pnlImpact = sizeUsd * (change / 100) * direction;
      return acc + pnlImpact;
    }, 0);
  };




  return (
    <div className="p-4 flex flex-col gap-4 h-full overflow-y-auto select-none">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-bold text-text-primary">Positions & Risk Centre</h2>
          <p className="text-[10px] text-text-secondary">
            Live position tracking, EIP-712 collateral analysis, and portfolio stress testing
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-[#0B0E11] border border-border p-0.5 rounded-sm">
          {(['open', 'bots', 'risk'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={cn(
                'px-2.5 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer',
                activeTab === tab
                  ? 'bg-primary text-white'
                  : 'text-text-secondary hover:text-text-primary'
              )}
            >
              {tab === 'open' ? 'Open Positions' : tab === 'bots' ? 'Active Bots' : 'Risk Control'}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        <StatCard
          label="Margin Balance"
          value={<NumberDisplay value={marginBalance} prefix="$" />}
          icon={<Wallet size={14} />}
        />
        <StatCard
          label="Unrealized PnL"
          value={
            <NumberDisplay
              value={Math.abs(totalPnl)}
              prefix={totalPnl >= 0 ? '+$' : '-$'}
              trend={totalPnl >= 0 ? 'up' : 'down'}
            />
          }
          icon={<TrendingUp size={14} />}
          trend={totalPnl >= 0 ? 'up' : 'down'}
        />
        <StatCard
          label="Account Leverage"
          value={`${portfolioLeverage.toFixed(2)}x`}
          icon={<BarChart3 size={14} />}
        />
        
        {/* Collateral Health Card */}
        <div className="stat-card">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-medium text-text-secondary uppercase tracking-wider mb-2">
                Collateral Health
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-bold font-mono tabular-nums text-text-primary">{healthScore}%</span>
                {healthScore > 75 ? (
                  <ShieldCheck size={14} className="text-success shrink-0" />
                ) : healthScore > 40 ? (
                  <Info size={14} className="text-warning shrink-0" />
                ) : (
                  <AlertTriangle size={14} className="text-danger shrink-0" />
                )}
              </div>
            </div>
            <div className="w-8 h-8 rounded-sm bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Shield size={14} />
            </div>
          </div>
          <div className="mt-2.5 h-1 bg-[#0B0E11] rounded-sm overflow-hidden border border-border/20">
            <div
              className={cn(
                'h-full rounded-sm transition-all duration-500',
                healthScore > 75 ? 'bg-success' : healthScore > 40 ? 'bg-warning' : 'bg-danger'
              )}
              style={{ width: `${healthScore}%` }}
            />
          </div>
        </div>
      </div>

      {/* Collateral Breakdown */}
      {/* Collateral Breakdown */}
      {collateralBreakdown.length > 0 && (
        <div className="p-4 bg-surface border border-border rounded-sm shrink-0 flex flex-col md:flex-row gap-6">
          <div className="flex-1 overflow-x-auto min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <Info size={14} className="text-primary" />
              <span className="text-xs font-bold text-text-primary uppercase tracking-wider">Collateral Breakdown</span>
            </div>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-text-muted border-b border-border text-left">
                  <th className="py-1.5 font-medium">Asset</th>
                  <th className="text-right py-1.5 font-medium">Amount</th>
                  <th className="text-right py-1.5 font-medium">Price</th>
                  <th className="text-right py-1.5 font-medium">Weight</th>
                  <th className="text-right py-1.5 font-medium">Raw Value</th>
                  <th className="text-right py-1.5 font-medium">Effective Value</th>
                </tr>
              </thead>
              <tbody>
                {collateralBreakdown.map((entry) => (
                  <tr key={entry.coin} className="border-b border-border/40 hover:bg-surface-hover/30 transition-colors">
                    <td className="py-1.5 font-semibold text-text-primary">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full" style={{
                          backgroundColor: entry.weight >= 0.95 ? '#3fb950' : entry.weight >= 0.80 ? '#58a6ff' : entry.weight >= 0.70 ? '#d29922' : '#f85149'
                        }} />
                        {entry.coin}
                      </div>
                    </td>
                    <td className="text-right py-1.5 text-text-secondary font-mono">{entry.amount < 1 ? entry.amount.toFixed(6) : entry.amount.toFixed(4)}</td>
                    <td className="text-right py-1.5 text-text-secondary font-mono">${entry.price < 1 ? entry.price.toFixed(4) : entry.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td className="text-right py-1.5">
                      <span className={cn(
                        'px-1.5 py-0.5 rounded text-[10px] font-bold',
                        entry.weight >= 0.95 ? 'bg-emerald-500/15 text-emerald-400' :
                        entry.weight >= 0.80 ? 'bg-blue-500/15 text-blue-400' :
                        entry.weight >= 0.70 ? 'bg-amber-500/15 text-amber-300' :
                        'bg-red-500/15 text-red-400'
                      )}>
                        {(entry.weight * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="text-right py-1.5 text-text-secondary font-mono">${entry.rawValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td className="text-right py-1.5 text-text-primary font-mono font-semibold">${entry.effectiveValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border">
                  <td colSpan={4} className="py-2 text-text-muted font-semibold">Total Weighted Collateral</td>
                  <td className="text-right py-2 text-text-muted font-mono">
                    ${collateralBreakdown.reduce((s, e) => s + e.rawValue, 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className="text-right py-2 text-primary font-mono font-bold">
                    ${marginBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Asset Allocation Donut Chart Side Card */}
          <div className="w-full md:w-[260px] shrink-0 border border-border/80 rounded-sm bg-[#0B0E11] p-4 flex flex-col justify-between select-none">
            <div>
              <h4 className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-3">Asset Allocation</h4>
              <div className="flex items-center justify-between gap-4">
                {/* SVG Donut */}
                <div className="relative w-20 h-20 shrink-0">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="30" fill="transparent" stroke="#161A20" strokeWidth="8" />
                    {(() => {
                      const totalValue = collateralBreakdown.reduce((sum, entry) => sum + entry.rawValue, 0);
                      let cumulativeAngle = 0;
                      const colors = ['#F7931A', '#627EEA', '#14F195', '#F0B90B', '#58A6FF', '#D29922', '#F85149'];
                      
                      return collateralBreakdown.map((entry, idx) => {
                        const percentage = totalValue > 0 ? (entry.rawValue / totalValue) * 100 : 0;
                        const dashLength = (percentage / 100) * 188.5;
                        const rotateAngle = cumulativeAngle;
                        cumulativeAngle += (percentage / 100) * 360;
                        
                        const color = entry.coin === 'BTC' ? '#F7931A' :
                                      entry.coin === 'ETH' ? '#627EEA' :
                                      entry.coin === 'SOL' ? '#14F195' :
                                      entry.coin === 'SOSO' ? '#F0B90B' :
                                      colors[idx % colors.length];
                                      
                        return (
                          <circle
                            key={entry.coin}
                            cx="40"
                            cy="40"
                            r="30"
                            fill="transparent"
                            stroke={color}
                            strokeWidth="8"
                            strokeDasharray={`${dashLength} 188.5`}
                            strokeDashoffset="0"
                            transform={`rotate(${rotateAngle} 40 40)`}
                          />
                        );
                      });
                    })()}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center font-mono">
                    <span className="text-[7px] text-text-muted uppercase">Net Val</span>
                    <span className="text-[10px] font-black text-text-primary">
                      ${collateralBreakdown.reduce((s, e) => s + e.rawValue, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>

                {/* Legend list */}
                <div className="flex-1 flex flex-col gap-1.5 font-mono text-[9px] max-h-[90px] overflow-y-auto pr-1 scrollbar-none">
                  {(() => {
                    const totalValue = collateralBreakdown.reduce((sum, entry) => sum + entry.rawValue, 0);
                    const colors = ['#F7931A', '#627EEA', '#14F195', '#F0B90B', '#58A6FF', '#D29922', '#F85149'];
                    
                    return collateralBreakdown.map((entry, idx) => {
                      const percentage = totalValue > 0 ? (entry.rawValue / totalValue) * 100 : 0;
                      const color = entry.coin === 'BTC' ? '#F7931A' :
                                    entry.coin === 'ETH' ? '#627EEA' :
                                    entry.coin === 'SOL' ? '#14F195' :
                                    entry.coin === 'SOSO' ? '#F0B90B' :
                                    colors[idx % colors.length];
                      return (
                        <div key={entry.coin} className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1 min-w-0">
                            <span className="w-1.5 h-1.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                            <span className="text-text-secondary truncate">{entry.coin}</span>
                          </div>
                          <span className="text-text-primary font-bold">{percentage.toFixed(0)}%</span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
            <div className="text-[8px] text-text-muted leading-tight border-t border-border/30 pt-2 mt-2">
              Collateral allocation of active spot balances.
            </div>
          </div>
        </div>
      )}

      {/* Tabs Content */}
      <div className="flex-1 min-h-[350px] flex flex-col">
        {activeTab === 'open' && (
          <div className="flex-1 bg-surface border border-border rounded-sm flex flex-col p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-[#101317]">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-primary">
                  Active Positions
                </span>
                <span className="badge badge-primary">{positions.length}</span>
              </div>
              {positions.length > 0 && (
                <Button variant="danger" size="sm" icon={<XIcon size={12} />} onClick={handleCloseAll} className="h-7 text-xs rounded-sm">
                  Close All Positions
                </Button>
              )}
            </div>
            <div className="overflow-auto flex-1">
              <table className="data-table text-xs text-left whitespace-nowrap">
                <thead className="text-[10px] text-text-secondary uppercase tracking-wider border-b border-border bg-[#0B0E11]">
                  <tr>
                    <th className="px-4 py-2 font-medium">Symbol</th>
                    <th className="px-4 py-2 font-medium">Side</th>
                    <th className="px-4 py-2 font-medium text-right">Size</th>
                    <th className="px-4 py-2 font-medium text-right">Entry Price</th>
                    <th className="px-4 py-2 font-medium text-right">Mark Price</th>
                    <th className="px-4 py-2 font-medium text-right">Liquidation</th>
                    <th className="px-4 py-2 font-medium text-right">Dist. to Liq (%)</th>
                    <th className="px-4 py-2 font-medium text-right">Unrealized PnL</th>
                    <th className="px-4 py-2 font-medium text-right">Margin / Leverage</th>
                    <th className="px-4 py-2 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center gap-2 text-text-muted">
                          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          <span className="text-xs font-sans">Loading Positions…</span>
                        </div>
                      </td>
                    </tr>
                  ) : positions.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-text-muted text-xs font-sans">
                        No active open positions found on SoDEX exchange
                      </td>
                    </tr>
                  ) : (
                    positions.map((pos) => {
                      const pnlTrend = pos.pnl >= 0 ? 'up' : 'down';
                      const markVsEntry = pos.side === 'LONG'
                        ? (pos.markPrice >= pos.entryPrice ? 'text-success' : 'text-danger')
                        : (pos.markPrice <= pos.entryPrice ? 'text-success' : 'text-danger');

                      return (
                        <tr key={pos.symbol} className="hover:bg-surface-hover/30 transition-colors group">
                          <td className="px-4 py-2.5 font-sans font-semibold text-text-primary">{pos.symbol}</td>
                          <td className="px-4 py-2.5">
                            <span className={cn(
                              'px-1.5 py-0.2 rounded-sm text-[9px] font-bold border',
                              pos.side === 'LONG' 
                                ? 'bg-success/5 border-success/35 text-success' 
                                : 'bg-danger/5 border-danger/35 text-danger'
                            )}>
                              {pos.side}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-text-secondary">
                            <NumberDisplay value={pos.size} decimals={4} />
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-text-secondary">
                            <NumberDisplay value={pos.entryPrice} />
                          </td>
                          <td className={`px-4 py-2.5 text-right tabular-nums ${markVsEntry}`}>
                            <NumberDisplay value={pos.markPrice} />
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-text-muted">
                            <NumberDisplay value={pos.liquidationPrice} />
                          </td>
                          
                          {/* Distance to Liq */}
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            <span className={cn(
                              'font-bold',
                              pos.distanceToLiq > 20 
                                ? 'text-success' 
                                : pos.distanceToLiq > 10 
                                  ? 'text-warning' 
                                  : 'text-danger animate-pulse'
                            )}>
                              {pos.distanceToLiq.toFixed(1)}%
                            </span>
                          </td>

                          {/* PnL */}
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1 font-bold">
                              <NumberDisplay
                                value={Math.abs(pos.pnl)}
                                prefix={pos.pnl >= 0 ? '+' : '-'}
                                trend={pnlTrend}
                              />
                              <span className={cn(
                                'text-[10px]',
                                pnlTrend === 'up' ? 'text-success' : 'text-danger'
                              )}>
                                ({pos.pnlPercent.toFixed(1)}%)
                              </span>
                            </div>
                          </td>

                          <td className="px-4 py-2.5 text-right tabular-nums text-text-secondary">
                            <NumberDisplay value={pos.margin} />
                            <span className="text-text-muted text-[10px] ml-1.5 font-sans">({pos.leverage}x)</span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <button
                              onClick={() => handleClose(pos)}
                              className="px-2 py-1 bg-danger/10 border border-danger/30 text-danger hover:bg-danger/20 rounded-sm text-[10px] font-bold cursor-pointer transition-colors"
                            >
                              Close
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'bots' && (
          <div className="flex-1 bg-surface border border-border rounded-sm flex flex-col p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-[#101317] select-none">
              <div className="flex items-center gap-2">
                <Cpu size={14} className="text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wider text-text-primary">
                  Active Quant Bots
                </span>
              </div>
            </div>
            
            <div className="overflow-auto flex-1 p-4 space-y-4">
              {/* Bot Cards List */}
              {(() => {
                const botStore = useBotStore();
                const wave3Store = useWave3Store();
                
                const activeBotsList = [
                  {
                    name: 'Wave 3 Autonomous Agent',
                    type: 'WAVE3',
                    running: wave3Store.isAgentRunning,
                    symbol: wave3Store.targetCoin,
                    market: wave3Store.market,
                    budget: Number(wave3Store.investment || 0),
                    pnl: Number(wave3Store.activePosition?.pnl || 0),
                    pnlLabel: 'PnL',
                    stopAction: () => {
                      wave3Store.setAgentRunning(false);
                      wave3Store.setActivePosition(null);
                      wave3Store.addLog('Agent halted via Accounts Active Bots dashboard', 'WARNING');
                      toast.success('Wave 3 Agent halted.');
                    }
                  },
                  {
                    name: 'Grid Trading Bot',
                    type: 'GRID',
                    running: botStore.gridBot.status === 'RUNNING',
                    symbol: botStore.gridBot.symbol,
                    market: botStore.gridBot.isSpot ? 'spot' : 'perps',
                    budget: Number(parseFloat(botStore.gridBot.amountUsdt) || 0),
                    pnl: Number(botStore.gridBot.realizedPnl || 0),
                    pnlLabel: 'Realized PnL',
                    stopAction: () => {
                      botStore.gridBot.setField('status', 'STOPPED');
                      toast.success('Grid Bot halted.');
                    }
                  },
                  {
                    name: 'Consensus Signal Bot',
                    type: 'SIGNAL',
                    running: botStore.signalBot.status === 'RUNNING',
                    symbol: botStore.signalBot.symbol,
                    market: botStore.signalBot.isSpot ? 'spot' : 'perps',
                    budget: Number(parseFloat(botStore.signalBot.amountUsdt) || 0),
                    pnl: Number(botStore.signalBot.realizedPnl || 0),
                    pnlLabel: 'Realized PnL',
                    stopAction: () => {
                      botStore.signalBot.setField('status', 'STOPPED');
                      toast.success('Signal Bot halted.');
                    }
                  },
                  {
                    name: 'Market Maker Bot',
                    type: 'MM',
                    running: botStore.marketMakerBot.status === 'RUNNING',
                    symbol: botStore.marketMakerBot.symbol,
                    market: 'spot',
                    budget: Number(parseFloat(botStore.marketMakerBot.budgetUsdt) || 0),
                    pnl: Number(botStore.marketMakerBot.volumeUsdt || 0),
                    pnlLabel: 'Session Volume',
                    stopAction: () => {
                      botStore.marketMakerBot.setField('status', 'STOPPED');
                      toast.success('Market Maker Bot halted.');
                    }
                  }
                ];

                const runningCount = activeBotsList.filter(b => b.running).length;

                if (runningCount === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center text-center p-12 text-text-muted select-none">
                      <Cpu size={32} className="text-text-muted mb-2 opacity-50" />
                      <h4 className="text-xs font-bold text-text-secondary">No Bots Running</h4>
                      <p className="text-[10px] text-text-muted max-w-[240px] mt-1 leading-normal">
                        All quant execution engines are idle. Deploy a bot strategy from the Automated Bots studio to start trading.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeBotsList.map((bot, i) => {
                      if (!bot.running) return null;
                      return (
                        <div key={i} className="p-4 rounded-xl border border-border bg-[#101317]/50 flex flex-col justify-between space-y-4 hover:border-border-hover transition-colors relative overflow-hidden">
                          {/* Pulsing indicator */}
                          <div className="absolute top-4 right-4 flex items-center gap-1.5 select-none">
                            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                            <span className="text-[8px] font-black text-success uppercase tracking-wider">Running</span>
                          </div>
                          
                          <div className="space-y-1">
                            <h4 className="text-xs font-bold text-text-primary">{bot.name}</h4>
                            <p className="text-[10px] text-text-secondary font-mono">
                              Asset: <strong className="text-text-primary">{bot.symbol}</strong> • Market: <span className="uppercase">{bot.market}</span>
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono select-none">
                            <div className="p-2 rounded-lg bg-[#0B0E11] border border-border/40">
                              <span className="text-text-muted text-[8px] block uppercase font-sans font-bold">Invested</span>
                              <span className="text-text-primary font-bold">${bot.budget.toFixed(2)}</span>
                            </div>
                            <div className="p-2 rounded-lg bg-[#0B0E11] border border-border/40">
                              <span className="text-text-muted text-[8px] block uppercase font-sans font-bold">{bot.pnlLabel}</span>
                              <span className={cn("font-bold", bot.pnl >= 0 ? "text-success" : "text-danger")}>
                                {bot.pnl >= 0 ? '+' : ''}${bot.pnl.toFixed(2)}
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={bot.stopAction}
                            className="w-full py-2 rounded-lg border border-danger/20 hover:border-danger/40 bg-danger/5 hover:bg-danger/10 text-danger font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <StopCircle size={12} />
                            Stop Bot & Liquidate
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {activeTab === 'risk' && (
          <div className="flex flex-col gap-4 flex-1">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Risk Control Overview */}
              <div className="p-4 bg-surface border border-border rounded-sm flex flex-col gap-3.5">
                <div className="flex items-center gap-2 pb-2.5 border-b border-border">
                  <Shield className="text-primary" size={15} />
                  <span className="text-xs font-bold text-text-primary">Portfolio Risk Matrix</span>
                </div>

                <div className="grid grid-cols-2 gap-4 font-mono">
                  <div className="p-3 bg-[#0B0E11] border border-border rounded-sm">
                    <div className="text-[9px] text-text-secondary uppercase tracking-wider mb-1">Value at Risk (95% VaR)</div>
                    <div className="text-lg font-bold text-text-primary">${var95_1Day.toFixed(2)}</div>
                    <p className="text-[9px] text-text-muted mt-1 leading-normal font-sans">
                      Estimated max loss over 1 day at 95% confidence under normal volatility.
                    </p>
                  </div>

                  <div className="p-3 bg-[#0B0E11] border border-border rounded-sm">
                    <div className="text-[9px] text-text-secondary uppercase tracking-wider mb-1">Margin Call Buffer</div>
                    <div className="text-lg font-bold text-text-primary">
                      {positions.length > 0 ? `${(100 - marginUsage).toFixed(1)}%` : '100%'}
                    </div>
                    <p className="text-[9px] text-text-muted mt-1 leading-normal font-sans">
                      Margin left before a partial liquidation/forced closing occurs.
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-1">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-text-secondary">Collateral Safety Limit</span>
                      <span className="font-semibold text-text-primary font-mono">{healthScore}/100</span>
                    </div>
                    <div className="h-1.5 bg-[#0B0E11] border border-border/40 rounded-sm overflow-hidden">
                      <div 
                        className={cn(
                          'h-full rounded-sm transition-all',
                          healthScore > 75 ? 'bg-success' : healthScore > 40 ? 'bg-warning' : 'bg-danger'
                        )}
                        style={{ width: `${healthScore}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-primary-soft/5 border border-primary/20 rounded-sm flex items-start gap-2">
                    <Info size={14} className="text-primary shrink-0 mt-0.5" />
                    <div className="text-[10px] text-text-secondary leading-normal font-sans">
                      <strong>EIP-712 Signature Security:</strong> Every position is verified by cryptographically signed session tokens. Leverage is managed exchange-side for optimal collateral stability.
                    </div>
                  </div>
                </div>
              </div>

              {/* Stress Test Simulator */}
              <div className="p-4 bg-surface border border-border rounded-sm flex flex-col">
                <div className="flex items-center gap-2 pb-2.5 border-b border-border mb-3 select-none">
                  <Activity className="text-warning" size={15} />
                  <span className="text-xs font-bold text-text-primary">Portfolio Stress Testing</span>
                </div>

                <div className="overflow-auto flex-1">
                  <table className="data-table text-xs text-left whitespace-nowrap">
                    <thead className="text-[9px] text-text-secondary uppercase tracking-wider border-b border-border bg-[#0B0E11]">
                      <tr>
                        <th className="px-3 py-1.5 font-medium">Scenario</th>
                        <th className="px-3 py-1.5 font-medium">Market Shift</th>
                        <th className="px-3 py-1.5 font-medium text-right">Simulated PnL</th>
                        <th className="px-3 py-1.5 font-medium text-right">Impact Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-mono">
                      {[
                        { name: 'Extreme Bull Move', shift: 15, class: 'text-success' },
                        { name: 'Moderate Bull Move', shift: 5, class: 'text-success' },
                        { name: 'Moderate Bear Move', shift: -5, class: 'text-danger' },
                        { name: 'Extreme Bear Move', shift: -15, class: 'text-danger' },
                        { name: 'Systemic Flash Crash', shift: -30, class: 'text-danger font-bold' },
                      ].map((scenario) => {
                        const impact = getStressImpact(scenario.shift);
                        const isProfit = impact >= 0;
                        const status = isProfit 
                          ? (impact === 0 ? 'NEUTRAL' : 'PROFIT') 
                          : (Math.abs(impact) > marginBalance * 0.5 ? 'MARGIN CALL' : 'LOSS');

                        return (
                          <tr key={scenario.name} className="hover:bg-surface-hover/20">
                            <td className="px-3 py-2 font-semibold font-sans text-text-primary">{scenario.name}</td>
                            <td className={cn('px-3 py-2 font-bold', scenario.class)}>
                              {scenario.shift > 0 ? `+${scenario.shift}%` : `${scenario.shift}%`}
                            </td>
                            <td className={cn('px-3 py-2 text-right font-bold', isProfit ? 'text-success' : 'text-danger')}>
                              {isProfit ? '+' : '-'}${Math.abs(impact).toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <span className={cn(
                                'px-1.5 py-0.2 rounded-sm text-[8px] font-bold border',
                                status === 'PROFIT' ? 'bg-success/5 border-success/35 text-success' :
                                status === 'NEUTRAL' ? 'bg-white/5 border-white/10 text-text-secondary' :
                                status === 'LOSS' ? 'bg-danger/5 border-danger/35 text-danger' :
                                'bg-danger text-white border-danger animate-pulse'
                              )}>
                                {status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Failure-Case Analysis & Mitigation Panel */}
            <div className="p-4 bg-surface border border-border rounded-sm flex flex-col gap-3">
              <div className="flex items-center gap-2 pb-2 border-b border-border">
                <AlertTriangle className="text-danger" size={15} />
                <span className="text-xs font-bold text-text-primary">Failure-Case Analysis & Mitigation Protocols</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                {/* Sideways Regimes */}
                <div className="p-3 bg-[#0B0E11] border border-border/60 rounded-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-text-primary">Sideways Whipsaw</span>
                      <span className="px-1.5 py-0.2 rounded-sm bg-warning/10 text-warning text-[9px] font-bold uppercase border border-warning/20">Moderate Risk</span>
                    </div>
                    <p className="text-[10px] text-text-secondary leading-normal mb-3 font-sans">
                      <strong>Failure Mode:</strong> Trend-following algorithms execute entries on false breakouts, causing rapid whipsaws and consecutive SL triggers.
                    </p>
                  </div>
                  <div className="p-2 bg-success/5 border border-success/20 rounded-sm text-[10px] text-success leading-normal font-sans">
                    <strong>Mitigation:</strong> Score-margin threshold checks filter signals. Dynamic rotation to Grid Bot sweeps market-maker spreads.
                  </div>
                </div>

                {/* Trending Crashes */}
                <div className="p-3 bg-[#0B0E11] border border-border/60 rounded-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-text-primary">Flash Crashes</span>
                      <span className="px-1.5 py-0.2 rounded-sm bg-danger/10 text-danger text-[9px] font-bold uppercase border border-danger/20">High Risk</span>
                    </div>
                    <p className="text-[10px] text-text-secondary leading-normal mb-3 font-sans">
                      <strong>Failure Mode:</strong> Grid Bot accumulates long positions down to lower boundary, depleting margin and triggering liquidation.
                    </p>
                  </div>
                  <div className="p-2 bg-success/5 border border-success/20 rounded-sm text-[10px] text-success leading-normal font-sans">
                    <strong>Mitigation:</strong> Hard Stop-Loss exits close positions. Dynamic grid density expands lower boundary pricing, reducing risk.
                  </div>
                </div>

                {/* News Volatility */}
                <div className="p-3 bg-[#0B0E11] border border-border/60 rounded-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-text-primary">Toxic Flow & Slippage</span>
                      <span className="px-1.5 py-0.2 rounded-sm bg-primary/10 text-primary text-[9px] font-bold uppercase border border-primary/20">Low Risk</span>
                    </div>
                    <p className="text-[10px] text-text-secondary leading-normal mb-3 font-sans">
                      <strong>Failure Mode:</strong> High news volatility widens bid-ask spreads. MM bots fill toxic flows, and orders suffer severe slippage.
                    </p>
                  </div>
                  <div className="p-2 bg-success/5 border border-success/20 rounded-sm text-[10px] text-success leading-normal font-sans">
                    <strong>Mitigation:</strong> Latency checks halt order flow. Re-quote buffer offset widens bids to capture higher spreads.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}


      </div>

      <ConfirmModal
        isOpen={confirmOpen}
        title={confirmTitle}
        message={confirmMessage}
        onConfirm={() => confirmActionRef.current()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
};
