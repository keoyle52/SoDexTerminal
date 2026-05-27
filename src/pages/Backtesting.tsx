import React, { useState, useCallback } from 'react';
import {
  FlaskConical, Play, BarChart3, TrendingUp, TrendingDown,
  Target, AlertTriangle, Zap, Layers,
  CheckCircle2, Award, TrendingUp as TrendingUpIcon, Download,
  X, Sparkles
} from 'lucide-react';
import { NumberDisplay } from '../components/common/NumberDisplay';
import { Card, StatCard } from '../components/common/Card';
import { Input, Select } from '../components/common/Input';
import { SymbolSelector } from '../components/common/SymbolSelector';
import { Button } from '../components/common/Button';
import { fetchKlines } from '../api/services';
import { getErrorMessage, cn } from '../lib/utils';
import toast from 'react-hot-toast';
import { fetchSosoNews, extractCoinFromNews } from '../api/sosoServices';


// ─── Types & Interfaces ───────────────────────────────────────────────────

interface BacktestResult {
  totalTrades: number;
  winTrades: number;
  lossTrades: number;
  winRate: number;
  totalPnl: number;
  maxDrawdown: number;
  sharpeRatio: number;
  profitFactor: number;
  expectancy: number;
  avgWin: number;
  avgLoss: number;
  avgTrade: number;
  bestTrade: number;
  worstTrade: number;
  equityCurve: EquityPoint[];
  drawdownCurve: number[];
  daysCovered: number;
  trades: TradeEntry[];
  marketRegime: 'BULL' | 'BEAR' | 'SIDEWAYS';
}

interface EquityPoint {
  trade: number;
  equity: number;
  drawdown: number;
  timestamp: string;
}

interface TradeEntry {
  entryTime: string;
  exitTime: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  pnlPercent: number;
  exitReason: 'SIGNAL' | 'STOP' | 'TARGET' | 'END';
  quantity?: number;
}

type BotType = 'GRID' | 'DCA' | 'TWAP' | 'MARKET_MAKER' | 'SIGNAL';
type TimeframeType = '5m' | '15m' | '1h' | '4h' | '1d';

interface BotConfig {
  type: BotType;
  name: string;
  description: string;
  defaultParams: Record<string, number>;
  paramLabels: Record<string, string>;
}

// ─── Bot Configurations ───────────────────────────────────────────────────

const BOT_CONFIGS: Record<BotType, BotConfig> = {
  GRID: {
    type: 'GRID',
    name: 'Grid Bot',
    description: 'Range-bound volatility capture with multiple limit orders',
    defaultParams: { gridCount: 10, gridSize: 1.5, investment: 1000 },
    paramLabels: { gridCount: 'Grid Count', gridSize: 'Grid Size (%)', investment: 'Investment (USDT)' },
  },
  DCA: {
    type: 'DCA',
    name: 'DCA Bot',
    description: 'Dollar-cost averaging for systematic accumulation',
    defaultParams: { interval: 12, amount: 100, totalOrders: 10 },
    paramLabels: { interval: 'Interval (hours)', amount: 'Order Amount', totalOrders: 'Total Orders' },
  },
  TWAP: {
    type: 'TWAP',
    name: 'TWAP Bot',
    description: 'Time-weighted average price execution for large orders',
    defaultParams: { slices: 10, duration: 4, slippage: 0.05, investment: 1000 },
    paramLabels: { slices: 'Slices', duration: 'Duration (hours)', slippage: 'Max Slippage (%)', investment: 'Investment (USDT)' },
  },
  MARKET_MAKER: {
    type: 'MARKET_MAKER',
    name: 'Market Maker',
    description: 'Liquidity provisioning with bid-ask spread capture',
    defaultParams: { spread: 0.5, inventory: 1000, rebalance: 5.0 },
    paramLabels: { spread: 'Spread (%)', inventory: 'Inventory (USDT)', rebalance: 'Rebalance (%)' },
  },
  SIGNAL: {
    type: 'SIGNAL',
    name: 'Signal Bot',
    description: 'Technical indicator-driven automated trading',
    defaultParams: { rsiPeriod: 14, rsiOverbought: 70, rsiOversold: 30, investment: 1000 },
    paramLabels: { rsiPeriod: 'RSI Period', rsiOverbought: 'Overbought', rsiOversold: 'Oversold', investment: 'Investment (USDT)' },
  },
};

// ─── Technical Indicators ─────────────────────────────────────────────────

function calculateRSI(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(data.length).fill(null);
  if (data.length < period + 1) return result;

  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = data[i] - data[i - 1];
    if (diff > 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;

  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i] - data[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}

function calculateEMA(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [data[0]];
  for (let i = 1; i < data.length; i++) {
    result.push(data[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

function calculateATR(highs: number[], lows: number[], closes: number[], period: number): number[] {
  const tr: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i === 0) {
      tr.push(highs[i] - lows[i]);
    } else {
      const tr1 = highs[i] - lows[i];
      const tr2 = Math.abs(highs[i] - closes[i - 1]);
      const tr3 = Math.abs(lows[i] - closes[i - 1]);
      tr.push(Math.max(tr1, tr2, tr3));
    }
  }
  return calculateEMA(tr, period);
}

// ─── Backtest Engine ─────────────────────────────────────────────────────

function runSignalBacktest(
  closes: number[],
  highs: number[],
  lows: number[],
  times: string[],
  params: { rsiPeriod: number; rsiOverbought: number; rsiOversold: number; investment?: number }
): TradeEntry[] {
  const trades: TradeEntry[] = [];
  let position: 'LONG' | 'SHORT' | null = null;
  let entryPrice = 0;
  let entryTime = '';
  let slPrice = 0;
  let tpPrice = 0;
  let quantity = 0;
  let cooldown = 0;

  const rsi = calculateRSI(closes, params.rsiPeriod);
  const atr = calculateATR(highs, lows, closes, params.rsiPeriod);

  for (let i = 1; i < closes.length; i++) {
    const prevRsi = rsi[i - 1];
    const curRsi = rsi[i];

    if (cooldown > 0) {
      cooldown--;
    }

    if (prevRsi == null || curRsi == null) continue;

    if (position === 'LONG') {
      if (lows[i] <= slPrice) {
        const pnl = (slPrice - entryPrice) * quantity;
        trades.push({
          entryTime,
          exitTime: times[i],
          side: 'LONG',
          entryPrice,
          exitPrice: slPrice,
          pnl,
          pnlPercent: ((slPrice - entryPrice) / entryPrice) * 100,
          exitReason: 'STOP',
          quantity,
        });
        position = null;
        cooldown = 8; // Halt entries for 8 candles after a loss
      } else if (highs[i] >= tpPrice) {
        const pnl = (tpPrice - entryPrice) * quantity;
        trades.push({
          entryTime,
          exitTime: times[i],
          side: 'LONG',
          entryPrice,
          exitPrice: tpPrice,
          pnl,
          pnlPercent: ((tpPrice - entryPrice) / entryPrice) * 100,
          exitReason: 'TARGET',
          quantity,
        });
        position = null;
      } else if (curRsi >= params.rsiOverbought || (prevRsi >= 50 && curRsi < 50)) {
        const pnl = (closes[i] - entryPrice) * quantity;
        trades.push({
          entryTime,
          exitTime: times[i],
          side: 'LONG',
          entryPrice,
          exitPrice: closes[i],
          pnl,
          pnlPercent: ((closes[i] - entryPrice) / entryPrice) * 100,
          exitReason: 'SIGNAL',
          quantity,
        });
        position = null;
      }
    } else if (position === 'SHORT') {
      if (highs[i] >= slPrice) {
        const pnl = (entryPrice - slPrice) * quantity;
        trades.push({
          entryTime,
          exitTime: times[i],
          side: 'SHORT',
          entryPrice,
          exitPrice: slPrice,
          pnl,
          pnlPercent: ((entryPrice - slPrice) / entryPrice) * 100,
          exitReason: 'STOP',
          quantity,
        });
        position = null;
        cooldown = 8; // Halt entries for 8 candles after a loss
      } else if (lows[i] <= tpPrice) {
        const pnl = (entryPrice - tpPrice) * quantity;
        trades.push({
          entryTime,
          exitTime: times[i],
          side: 'SHORT',
          entryPrice,
          exitPrice: tpPrice,
          pnl,
          pnlPercent: ((entryPrice - tpPrice) / entryPrice) * 100,
          exitReason: 'TARGET',
          quantity,
        });
        position = null;
      } else if (curRsi <= params.rsiOversold || (prevRsi <= 50 && curRsi > 50)) {
        const pnl = (entryPrice - closes[i]) * quantity;
        trades.push({
          entryTime,
          exitTime: times[i],
          side: 'SHORT',
          entryPrice,
          exitPrice: closes[i],
          pnl,
          pnlPercent: ((entryPrice - closes[i]) / entryPrice) * 100,
          exitReason: 'SIGNAL',
          quantity,
        });
        position = null;
      }
    }

    if (!position && cooldown === 0) {
      if (prevRsi <= params.rsiOversold && curRsi > params.rsiOversold) {
        position = 'LONG';
        entryPrice = closes[i];
        entryTime = times[i];
        const atrVal = atr[i] || (closes[i] * 0.001);
        slPrice = entryPrice - atrVal * 2.0; // 2x ATR stop loss
        tpPrice = entryPrice + atrVal * 3.0; // 3x ATR take profit
        quantity = (params.investment || 1000) / entryPrice;
      } else if (prevRsi >= params.rsiOverbought && curRsi < params.rsiOverbought) {
        position = 'SHORT';
        entryPrice = closes[i];
        entryTime = times[i];
        const atrVal = atr[i] || (closes[i] * 0.001);
        slPrice = entryPrice + atrVal * 2.0; // 2x ATR stop loss
        tpPrice = entryPrice - atrVal * 3.0; // 3x ATR take profit
        quantity = (params.investment || 1000) / entryPrice;
      }
    }
  }

  // Close remaining position at end
  if (position === 'LONG') {
    const pnl = (closes[closes.length - 1] - entryPrice) * quantity;
    trades.push({
      entryTime,
      exitTime: times[times.length - 1],
      side: 'LONG',
      entryPrice,
      exitPrice: closes[closes.length - 1],
      pnl,
      pnlPercent: ((closes[closes.length - 1] - entryPrice) / entryPrice) * 100,
      exitReason: 'END',
      quantity,
    });
  } else if (position === 'SHORT') {
    const pnl = (entryPrice - closes[closes.length - 1]) * quantity;
    trades.push({
      entryTime,
      exitTime: times[times.length - 1],
      side: 'SHORT',
      entryPrice,
      exitPrice: closes[closes.length - 1],
      pnl,
      pnlPercent: ((entryPrice - closes[closes.length - 1]) / entryPrice) * 100,
      exitReason: 'END',
      quantity,
    });
  }

  return trades;
}

function runGridBacktest(
  closes: number[],
  _highs: number[],
  _lows: number[],
  times: string[],
  params: { gridCount: number; gridSize: number; investment: number }
): TradeEntry[] {
  const trades: TradeEntry[] = [];
  const startPrice = closes[0];
  const gridSizePct = params.gridSize || 1.5;
  const step = startPrice * (gridSizePct / 100);
  const gridCount = Math.max(2, Math.min(50, params.gridCount || 10));
  
  const lowerBound = startPrice - (gridCount / 2) * step;
  const upperBound = startPrice + (gridCount / 2) * step;

  // Generate grid levels
  const gridLevels: number[] = [];
  for (let i = 0; i <= gridCount; i++) {
    gridLevels.push(lowerBound + i * step);
  }

  // Active bought levels. If levelsBought[g] !== null, we hold a long position bought at gridLevels[g]
  const levelsBought: (number | null)[] = new Array(gridLevels.length).fill(null);
  const qtyPerGrid = (params.investment / gridCount) / startPrice;

  for (let i = 1; i < closes.length; i++) {
    const price = closes[i];
    const prevPrice = closes[i - 1];
    const minP = Math.min(prevPrice, price);
    const maxP = Math.max(prevPrice, price);

    // Stop out if price leaves the grid bounds completely
    if (price < lowerBound || price > upperBound) {
      // Close all active grid levels at current price
      for (let g = 0; g < levelsBought.length; g++) {
        if (levelsBought[g] !== null) {
          const buyPrice = levelsBought[g]!;
          const pnl = (price - buyPrice) * qtyPerGrid;
          trades.push({
            entryTime: times[i - 1],
            exitTime: times[i],
            side: 'LONG',
            entryPrice: buyPrice,
            exitPrice: price,
            pnl,
            pnlPercent: ((price - buyPrice) / buyPrice) * 100,
            exitReason: 'STOP',
            quantity: qtyPerGrid,
          });
          levelsBought[g] = null;
        }
      }
      continue;
    }

    // Check level crossings
    for (let g = 0; g < gridLevels.length; g++) {
      const lvlPrice = gridLevels[g];
      if (lvlPrice >= minP && lvlPrice <= maxP) {
        const goingDown = price < prevPrice;

        if (goingDown) {
          // BUY: Price crossed level downwards, place buy order
          if (levelsBought[g] === null) {
            levelsBought[g] = lvlPrice;
          }
        } else {
          // SELL: Price crossed level upwards, match with highest bought level below it
          let matchIdx = -1;
          for (let b = g - 1; b >= 0; b--) {
            if (levelsBought[b] !== null) {
              matchIdx = b;
              break;
            }
          }

          if (matchIdx !== -1) {
            const buyPrice = levelsBought[matchIdx]!;
            const sellPrice = lvlPrice;
            const pnl = (sellPrice - buyPrice) * qtyPerGrid;
            trades.push({
              entryTime: times[i - 1],
              exitTime: times[i],
              side: 'LONG',
              entryPrice: buyPrice,
              exitPrice: sellPrice,
              pnl,
              pnlPercent: ((sellPrice - buyPrice) / buyPrice) * 100,
              exitReason: 'TARGET',
              quantity: qtyPerGrid,
            });
            levelsBought[matchIdx] = null;
          }
        }
      }
    }
  }

  // Close remaining unclosed grid levels at the final price to represent final equity honestly
  const finalPrice = closes[closes.length - 1];
  for (let g = 0; g < levelsBought.length; g++) {
    if (levelsBought[g] !== null) {
      const buyPrice = levelsBought[g]!;
      const pnl = (finalPrice - buyPrice) * qtyPerGrid;
      trades.push({
        entryTime: times[closes.length - 2] || times[0],
        exitTime: times[closes.length - 1],
        side: 'LONG',
        entryPrice: buyPrice,
        exitPrice: finalPrice,
        pnl,
        pnlPercent: ((finalPrice - buyPrice) / buyPrice) * 100,
        exitReason: 'END',
        quantity: qtyPerGrid,
      });
    }
  }

  return trades;
}

function runDcaBacktest(
  closes: number[],
  _highs: number[],
  _lows: number[],
  times: string[],
  params: { interval: number; amount: number; totalOrders: number }
): TradeEntry[] {
  const trades: TradeEntry[] = [];
  const intervalHours = params.interval || 24;
  const buyAmount = params.amount || 100;
  
  let barsPerHour = 1;
  if (closes.length > 1) {
    const t0 = new Date(times[0]).getTime();
    const t1 = new Date(times[1]).getTime();
    const diffMin = Math.abs(t1 - t0) / (1000 * 60);
    if (diffMin > 0) barsPerHour = 60 / diffMin;
  }
  const barsPerInterval = Math.max(1, Math.round(intervalHours * barsPerHour));

  let totalCost = 0;
  let totalQty = 0;
  let entryTime = '';
  let activeDca = false;
  let buysCount = 0;

  for (let i = 0; i < closes.length; i++) {
    if (i % barsPerInterval === 0 && buysCount < params.totalOrders) {
      if (!activeDca) {
        entryTime = times[i];
        activeDca = true;
      }
      const price = closes[i];
      const qty = buyAmount / price;
      totalCost += buyAmount;
      totalQty += qty;
      buysCount++;
    }

    if (activeDca) {
      const avgPrice = totalCost / totalQty;
      const currentPrice = closes[i];
      const move = (currentPrice - avgPrice) / avgPrice;

      if (move >= 0.05) {
        const pnl = (currentPrice - avgPrice) * totalQty;
        trades.push({
          entryTime,
          exitTime: times[i],
          side: 'LONG',
          entryPrice: avgPrice,
          exitPrice: currentPrice,
          pnl,
          pnlPercent: move * 100,
          exitReason: 'TARGET',
          quantity: totalQty,
        });
        totalCost = 0;
        totalQty = 0;
        activeDca = false;
        buysCount = 0;
      } else if (move <= -0.15) {
        const pnl = (currentPrice - avgPrice) * totalQty;
        trades.push({
          entryTime,
          exitTime: times[i],
          side: 'LONG',
          entryPrice: avgPrice,
          exitPrice: currentPrice,
          pnl,
          pnlPercent: move * 100,
          exitReason: 'STOP',
          quantity: totalQty,
        });
        totalCost = 0;
        totalQty = 0;
        activeDca = false;
        buysCount = 0;
      }
    }
  }

  if (activeDca && totalQty > 0) {
    const avgPrice = totalCost / totalQty;
    const exitPrice = closes[closes.length - 1];
    const pnl = (exitPrice - avgPrice) * totalQty;
    trades.push({
      entryTime,
      exitTime: times[times.length - 1],
      side: 'LONG',
      entryPrice: avgPrice,
      exitPrice,
      pnl,
      pnlPercent: ((exitPrice - avgPrice) / avgPrice) * 100,
      exitReason: 'END',
      quantity: totalQty,
    });
  }

  return trades;
}

function runTwapBacktest(
  closes: number[],
  _highs: number[],
  _lows: number[],
  times: string[],
  params: { slices: number; duration: number; slippage: number; investment?: number }
): TradeEntry[] {
  const trades: TradeEntry[] = [];
  const slices = params.slices || 12;
  const durationHours = params.duration || 4;
  const investment = params.investment || 1000;
  const sliceAmount = investment / slices;
  
  let barsPerHour = 1;
  if (closes.length > 1) {
    const t0 = new Date(times[0]).getTime();
    const t1 = new Date(times[1]).getTime();
    const diffMin = Math.abs(t1 - t0) / (1000 * 60);
    if (diffMin > 0) barsPerHour = 60 / diffMin;
  }
  const durationBars = Math.max(12, Math.round(durationHours * barsPerHour));
  const barsPerSlice = Math.max(1, Math.round(durationBars / slices));

  let i = 0;
  while (i < closes.length - durationBars) {
    const ema9 = calculateEMA(closes.slice(0, i + 1), 9);
    const ema21 = calculateEMA(closes.slice(0, i + 1), 21);
    const emaDiff = ema9[ema9.length - 1] - ema21[ema21.length - 1];

    if (emaDiff > 0) {
      const entryTime = times[i];
      let totalSpent = 0;
      let totalQty = 0;
      
      for (let s = 0; s < slices; s++) {
        const sliceIdx = i + s * barsPerSlice;
        if (sliceIdx >= closes.length) break;
        const price = closes[sliceIdx];
        const executionPrice = price * (1 + (params.slippage || 0.05) / 100);
        totalSpent += sliceAmount;
        totalQty += sliceAmount / executionPrice;
      }
      
      const avgEntryPrice = totalSpent / totalQty;
      
      let exitIdx = i + durationBars;
      let exitPrice = closes[exitIdx] || closes[closes.length - 1];
      let exitReason: 'TARGET' | 'STOP' | 'END' = 'END';

      for (let j = i + durationBars; j < closes.length; j++) {
        const price = closes[j];
        const move = (price - avgEntryPrice) / avgEntryPrice;
        if (move >= 0.035) {
          exitPrice = price;
          exitIdx = j;
          exitReason = 'TARGET';
          break;
        } else if (move <= -0.02) {
          exitPrice = price;
          exitIdx = j;
          exitReason = 'STOP';
          break;
        }
      }
      
      const pnl = (exitPrice - avgEntryPrice) * totalQty;
      trades.push({
        entryTime,
        exitTime: times[exitIdx] || times[times.length - 1],
        side: 'LONG',
        entryPrice: avgEntryPrice,
        exitPrice,
        pnl,
        pnlPercent: ((exitPrice - avgEntryPrice) / avgEntryPrice) * 100,
        exitReason,
        quantity: totalQty,
      });

      i = exitIdx + 1;
    } else {
      i += 5;
    }
  }

  return trades;
}

function runMarketMakerBacktest(
  closes: number[],
  highs: number[],
  lows: number[],
  times: string[],
  params: { spread: number; inventory: number; rebalance: number }
): TradeEntry[] {
  const trades: TradeEntry[] = [];
  const spreadPct = params.spread || 0.25;
  const maxInventory = params.inventory || 5000;
  
  let position: 'LONG' | 'SHORT' | null = null;
  let entryPrice = 0;
  let entryTime = '';
  let inventory = 0;
  let cooldown = 0;

  for (let i = 1; i < closes.length; i++) {
    const prevPrice = closes[i - 1];

    if (cooldown > 0) {
      cooldown--;
    }

    if (!position && cooldown === 0) {
      const bid = prevPrice * (1 - spreadPct / 200);
      const ask = prevPrice * (1 + spreadPct / 200);

      if (lows[i] <= bid && highs[i] >= ask) {
        const profit = maxInventory * (spreadPct / 100);
        trades.push({
          entryTime: times[i - 1],
          exitTime: times[i],
          side: 'LONG',
          entryPrice: bid,
          exitPrice: ask,
          pnl: profit,
          pnlPercent: spreadPct,
          exitReason: 'TARGET',
          quantity: maxInventory / bid,
        });
      } else if (lows[i] <= bid) {
        position = 'LONG';
        entryPrice = bid;
        entryTime = times[i];
        inventory = maxInventory;
      } else if (highs[i] >= ask) {
        position = 'SHORT';
        entryPrice = ask;
        entryTime = times[i];
        inventory = maxInventory;
      }
    } else if (position === 'LONG') {
      const targetSell = entryPrice * (1 + spreadPct / 100);
      const stopLoss = entryPrice * (1 - (params.rebalance || 2.5) / 100);

      if (highs[i] >= targetSell) {
        const pnl = (targetSell - entryPrice) * (inventory / entryPrice);
        trades.push({
          entryTime,
          exitTime: times[i],
          side: 'LONG',
          entryPrice,
          exitPrice: targetSell,
          pnl,
          pnlPercent: spreadPct,
          exitReason: 'TARGET',
          quantity: inventory / entryPrice,
        });
        position = null;
        inventory = 0;
      } else if (lows[i] <= stopLoss) {
        const pnl = (stopLoss - entryPrice) * (inventory / entryPrice);
        trades.push({
          entryTime,
          exitTime: times[i],
          side: 'LONG',
          entryPrice,
          exitPrice: stopLoss,
          pnl,
          pnlPercent: -(params.rebalance || 2.5),
          exitReason: 'STOP',
          quantity: inventory / entryPrice,
        });
        position = null;
        inventory = 0;
        cooldown = 10; // Halt entries for 10 candles after a loss
      }
    } else if (position === 'SHORT') {
      const targetBuy = entryPrice * (1 - spreadPct / 100);
      const stopLoss = entryPrice * (1 + (params.rebalance || 2.5) / 100);

      if (lows[i] <= targetBuy) {
        const pnl = (entryPrice - targetBuy) * (inventory / entryPrice);
        trades.push({
          entryTime,
          exitTime: times[i],
          side: 'SHORT',
          entryPrice,
          exitPrice: targetBuy,
          pnl,
          pnlPercent: spreadPct,
          exitReason: 'TARGET',
          quantity: inventory / entryPrice,
        });
        position = null;
        inventory = 0;
      } else if (highs[i] >= stopLoss) {
        const pnl = (entryPrice - stopLoss) * (inventory / entryPrice);
        trades.push({
          entryTime,
          exitTime: times[i],
          side: 'SHORT',
          entryPrice,
          exitPrice: stopLoss,
          pnl,
          pnlPercent: -(params.rebalance || 2.5),
          exitReason: 'STOP',
          quantity: inventory / entryPrice,
        });
        position = null;
        inventory = 0;
        cooldown = 10; // Halt entries for 10 candles after a loss
      }
    }
  }

  return trades;
}

// ─── Main Component ────────────────────────────────────────────────────────

export const Backtesting: React.FC = () => {
  // Configuration state
  const [selectedBot, setSelectedBot] = useState<BotType>('SIGNAL');
  const [symbol, setSymbol] = useState('BTC-USD');
  const [timeframe, setTimeframe] = useState<TimeframeType>('1h');
  const [candleCount, setCandleCount] = useState('720'); // 30 days of hourly
  const [takerFee, setTakerFee] = useState('0.04');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);

  // Bot-specific parameters
  const [params, setParams] = useState<Record<BotType, Record<string, string>>>({
    SIGNAL: { rsiPeriod: '14', rsiOverbought: '70', rsiOversold: '30', investment: '1000' },
    GRID: { gridCount: '10', gridSize: '1.5', investment: '1000' },
    DCA: { interval: '12', amount: '100', totalOrders: '10' },
    TWAP: { slices: '10', duration: '4', slippage: '0.05', investment: '1000' },
    MARKET_MAKER: { spread: '0.5', inventory: '1000', rebalance: '5.0' },
  });

  const currentBot = BOT_CONFIGS[selectedBot];

  const updateParam = (key: string, value: string) => {
    setParams(prev => ({
      ...prev,
      [selectedBot]: {
        ...prev[selectedBot],
        [key]: value,
      },
    }));
  };

  const [comparing, setComparing] = useState(false);
  const [compareResults, setCompareResults] = useState<Record<string, any> | null>(null);
  const [compareModalOpen, setCompareModalOpen] = useState(false);

  const [analyzingNews, setAnalyzingNews] = useState(false);
  const [newsCorrelationResults, setNewsCorrelationResults] = useState<any[] | null>(null);
  const [newsStats, setNewsStats] = useState<any | null>(null);
  const [newsModalOpen, setNewsModalOpen] = useState(false);

  const runComparison = useCallback(async () => {
    setComparing(true);
    setCompareResults(null);
    setCompareModalOpen(true);
    try {
      const rawKlines = await fetchKlines(symbol, timeframe, parseInt(candleCount) || 720, 'perps');
      const klines = Array.isArray(rawKlines) ? rawKlines : [];

      if (klines.length < 100) {
        toast.error('Not enough data. Minimum 100 candles required.');
        setCompareModalOpen(false);
        return;
      }

      // Parse klines
      const klineVal = (k: Record<string, unknown>, field: string, arrIdx: number): number =>
        parseFloat(String(k[field] ?? (Array.isArray(k) ? (k as unknown as unknown[])[arrIdx] : 0)));

      const closes: number[] = klines.map((k) => klineVal(k, 'close', 4));
      const highs: number[] = klines.map((k) => klineVal(k, 'high', 2));
      const lows: number[] = klines.map((k) => klineVal(k, 'low', 3));
      const times: string[] = klines.map((k) => {
        const t = k.time ?? k.openTime ?? (Array.isArray(k) ? (k as unknown as unknown[])[0] : 0);
        return typeof t === 'number' ? new Date(t).toLocaleString() : String(t);
      });

      const feeRate = parseFloat(takerFee) / 100;
      const resultsMap: Record<string, any> = {};

      const botTypes: BotType[] = ['GRID', 'DCA', 'TWAP', 'MARKET_MAKER', 'SIGNAL'];
      
      for (const bot of botTypes) {
        let trades: TradeEntry[] = [];
        const numericParams = Object.fromEntries(
          Object.entries(params[bot]).map(([k, v]) => [k, parseFloat(v) || 0])
        );

        if (bot === 'SIGNAL') {
          trades = runSignalBacktest(closes, highs, lows, times, numericParams as any);
        } else if (bot === 'GRID') {
          trades = runGridBacktest(closes, highs, lows, times, numericParams as any);
        } else if (bot === 'DCA') {
          trades = runDcaBacktest(closes, highs, lows, times, numericParams as any);
        } else if (bot === 'TWAP') {
          trades = runTwapBacktest(closes, highs, lows, times, numericParams as any);
        } else if (bot === 'MARKET_MAKER') {
          trades = runMarketMakerBacktest(closes, highs, lows, times, numericParams as any);
        }

        // Apply taker fees
        const processedTrades = trades.map(t => {
          const qty = t.quantity ?? 1;
          const entryFee = t.entryPrice * feeRate * qty;
          const exitFee = t.exitPrice * feeRate * qty;
          const totalFee = entryFee + exitFee;
          const feePercent = (totalFee / (t.entryPrice * qty)) * 100;
          return {
            ...t,
            pnl: t.pnl - totalFee,
            pnlPercent: t.pnlPercent - feePercent,
          };
        });

        // Calculate comprehensive stats
        const totalPnl = processedTrades.reduce((s, t) => s + t.pnl, 0);
        const winTrades = processedTrades.filter(t => t.pnl > 0).length;
        const lossTrades = processedTrades.filter(t => t.pnl <= 0).length;
        const winRate = processedTrades.length > 0 ? (winTrades / processedTrades.length) * 100 : 0;
        const grossProfit = processedTrades.filter(t => t.pnl > 0).reduce((s, t) => s + t.pnl, 0);
        const grossLoss = Math.abs(processedTrades.filter(t => t.pnl <= 0).reduce((s, t) => s + t.pnl, 0));
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

        let peak = 0;
        let maxDD = 0;
        let equity = 0;
        const equityCurve: EquityPoint[] = [];

        for (let i = 0; i < processedTrades.length; i++) {
          equity += processedTrades[i].pnl;
          if (equity > peak) peak = equity;
          const dd = peak - equity;
          if (dd > maxDD) maxDD = dd;
          equityCurve.push({
            trade: i + 1,
            equity,
            drawdown: dd,
            timestamp: processedTrades[i].exitTime,
          });
        }

        const pnlPcts = processedTrades.map(t => t.pnlPercent);
        const avgReturn = pnlPcts.length > 0 ? pnlPcts.reduce((s, p) => s + p, 0) / pnlPcts.length : 0;
        const stdDev = pnlPcts.length > 1
          ? Math.sqrt(pnlPcts.reduce((s, p) => s + (p - avgReturn) ** 2, 0) / (pnlPcts.length - 1))
          : 0;
        const sharpeRatio = stdDev > 0 ? avgReturn / stdDev * Math.sqrt(365 * 24 / (timeframe === '1h' ? 1 : timeframe === '4h' ? 4 : 24)) : 0;

        resultsMap[bot] = {
          bot,
          botName: BOT_CONFIGS[bot].name,
          totalTrades: processedTrades.length,
          winTrades,
          lossTrades,
          winRate,
          totalPnl,
          maxDrawdown: maxDD,
          sharpeRatio,
          profitFactor,
          equityCurve,
        };
      }
      setCompareResults(resultsMap);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Comparison error'));
      setCompareModalOpen(false);
    } finally {
      setComparing(false);
    }
  }, [symbol, timeframe, candleCount, params, takerFee]);

  const runNewsCorrelation = useCallback(async () => {
    setAnalyzingNews(true);
    setNewsCorrelationResults(null);
    setNewsStats(null);
    setNewsModalOpen(true);
    try {
      const rawKlines = await fetchKlines(symbol, '1h', 1000, 'perps');
      const klines = Array.isArray(rawKlines) ? rawKlines : [];
      if (klines.length === 0) {
        toast.error('Could not fetch historical data for news correlation.');
        setNewsModalOpen(false);
        return;
      }

      const klineVal = (k: Record<string, unknown>, field: string, arrIdx: number): number =>
        parseFloat(String(k[field] ?? (Array.isArray(k) ? (k as unknown as unknown[])[arrIdx] : 0)));

      const priceHistory = klines.map((k) => {
        const t = k.time ?? k.openTime ?? (Array.isArray(k) ? (k as unknown as unknown[])[0] : 0);
        const timeMs = typeof t === 'number' ? t : new Date(t).getTime();
        return {
          time: timeMs,
          close: klineVal(k, 'close', 4),
        };
      }).sort((a, b) => a.time - b.time);

      const newsRes = await fetchSosoNews(1, 25);
      const newsList = newsRes?.list ?? [];

      const correlationPoints: any[] = [];
      const positiveMoves = { '1h': 0, '4h': 0, '12h': 0, count: 0 };
      const negativeMoves = { '1h': 0, '4h': 0, '12h': 0, count: 0 };
      const neutralMoves = { '1h': 0, '4h': 0, '12h': 0, count: 0 };

      const posWords = ['up', 'bullish', 'gain', 'inflow', 'approve', 'buy', 'rise', 'highest', 'accumulate', 'positive', 'growth', 'rally', 'breakout', 'surge', 'success', 'support', 'strength'];
      const negWords = ['down', 'bearish', 'drop', 'outflow', 'decline', 'sell', 'fall', 'lowest', 'dump', 'negative', 'crash', 'fear', 'panic', 'fud', 'hack', 'crackdown', 'sec', 'lawsuit', 'selloff', 'weakness'];

      const classifySentiment = (titleText: string): 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' => {
        const clean = titleText.toLowerCase();
        let posCount = 0;
        let negCount = 0;
        posWords.forEach(w => {
          if (new RegExp(`\\b${w}\\b`).test(clean)) posCount++;
        });
        negWords.forEach(w => {
          if (new RegExp(`\\b${w}\\b`).test(clean)) negCount++;
        });
        if (posCount > negCount) return 'POSITIVE';
        if (negCount > posCount) return 'NEGATIVE';
        return 'NEUTRAL';
      };

      for (const item of newsList) {
        const title = item.multilanguageContent?.[0]?.title ?? item.author ?? '';
        const coin = extractCoinFromNews(title, symbol.split(/[-_/]/)[0]);
        const sentiment = classifySentiment(title);
        const releaseTime = item.releaseTime;

        let closestIdx = -1;
        let minDiff = Infinity;
        for (let i = 0; i < priceHistory.length; i++) {
          const diff = Math.abs(priceHistory[i].time - releaseTime);
          if (diff < minDiff) {
            minDiff = diff;
            closestIdx = i;
          }
        }

        if (closestIdx !== -1 && minDiff < 4 * 60 * 60 * 1000) {
          const p0 = priceHistory[closestIdx].close;
          
          const getPctChange = (offset: number) => {
            const idx = closestIdx + offset;
            if (idx < priceHistory.length) {
              const p = priceHistory[idx].close;
              return ((p - p0) / p0) * 100;
            }
            return null;
          };

          const ch1h = getPctChange(1);
          const ch4h = getPctChange(4);
          const ch12h = getPctChange(12);

          correlationPoints.push({
            id: item.id,
            title,
            coin,
            sentiment,
            releaseTime,
            priceAtRelease: p0,
            ch1h,
            ch4h,
            ch12h,
          });

          const bucket = sentiment === 'POSITIVE' ? positiveMoves : sentiment === 'NEGATIVE' ? negativeMoves : neutralMoves;
          if (ch1h !== null) { bucket['1h'] += ch1h; }
          if (ch4h !== null) { bucket['4h'] += ch4h; }
          if (ch12h !== null) { bucket['12h'] += ch12h; }
          bucket.count++;
        }
      }

      const getAvg = (bucket: typeof positiveMoves, key: '1h' | '4h' | '12h') => {
        return bucket.count > 0 ? bucket[key] / bucket.count : 0;
      };

      setNewsCorrelationResults(correlationPoints);
      setNewsStats({
        posCount: positiveMoves.count,
        negCount: negativeMoves.count,
        neuCount: neutralMoves.count,
        posAvg1h: getAvg(positiveMoves, '1h'),
        posAvg4h: getAvg(positiveMoves, '4h'),
        posAvg12h: getAvg(positiveMoves, '12h'),
        negAvg1h: getAvg(negativeMoves, '1h'),
        negAvg4h: getAvg(negativeMoves, '4h'),
        negAvg12h: getAvg(negativeMoves, '12h'),
        neuAvg1h: getAvg(neutralMoves, '1h'),
        neuAvg4h: getAvg(neutralMoves, '4h'),
        neuAvg12h: getAvg(neutralMoves, '12h'),
      });
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'News correlation error'));
      setNewsModalOpen(false);
    } finally {
      setAnalyzingNews(false);
    }
  }, [symbol]);


  const runBacktest = useCallback(async () => {
    setLoading(true);
    setResult(null);

    try {
      const rawKlines = await fetchKlines(symbol, timeframe, parseInt(candleCount) || 720, 'perps');
      const klines = Array.isArray(rawKlines) ? rawKlines : [];

      if (klines.length < 100) {
        toast.error('Not enough data. Minimum 100 candles required.');
        setLoading(false);
        return;
      }

      // Parse klines
      const klineVal = (k: Record<string, unknown>, field: string, arrIdx: number): number =>
        parseFloat(String(k[field] ?? (Array.isArray(k) ? (k as unknown as unknown[])[arrIdx] : 0)));

      const closes: number[] = klines.map((k) => klineVal(k, 'close', 4));
      const highs: number[] = klines.map((k) => klineVal(k, 'high', 2));
      const lows: number[] = klines.map((k) => klineVal(k, 'low', 3));
      const times: string[] = klines.map((k) => {
        const t = k.time ?? k.openTime ?? (Array.isArray(k) ? (k as unknown as unknown[])[0] : 0);
        return typeof t === 'number' ? new Date(t).toLocaleString() : String(t);
      });

      // Determine market regime
      const firstPrice = closes[0];
      const lastPrice = closes[closes.length - 1];
      const change = ((lastPrice - firstPrice) / firstPrice) * 100;
      const volatility = calculateATR(highs, lows, closes, 14);
      const avgVolatility = volatility.reduce((a, b) => a + b, 0) / volatility.length;
      const volPct = (avgVolatility / firstPrice) * 100;

      let marketRegime: 'BULL' | 'BEAR' | 'SIDEWAYS' = 'SIDEWAYS';
      if (change > volPct * 2) marketRegime = 'BULL';
      else if (change < -volPct * 2) marketRegime = 'BEAR';

      // Run backtest based on bot type
      let trades: TradeEntry[] = [];
      const numericParams = Object.fromEntries(
        Object.entries(params[selectedBot]).map(([k, v]) => [k, parseFloat(v) || 0])
      );

      switch (selectedBot) {
        case 'SIGNAL':
          trades = runSignalBacktest(closes, highs, lows, times, numericParams as any);
          break;
        case 'GRID':
          trades = runGridBacktest(closes, highs, lows, times, numericParams as any);
          break;
        case 'DCA':
          trades = runDcaBacktest(closes, highs, lows, times, numericParams as any);
          break;
        case 'TWAP':
          trades = runTwapBacktest(closes, highs, lows, times, numericParams as any);
          break;
        case 'MARKET_MAKER':
          trades = runMarketMakerBacktest(closes, highs, lows, times, numericParams as any);
          break;
        default:
          trades = runSignalBacktest(closes, highs, lows, times, { rsiPeriod: 14, rsiOverbought: 70, rsiOversold: 30 });
      }

      // Apply taker fees
      const feeRate = parseFloat(takerFee) / 100;
      trades = trades.map(t => {
        const qty = t.quantity ?? 1;
        const entryFee = t.entryPrice * feeRate * qty;
        const exitFee = t.exitPrice * feeRate * qty;
        const totalFee = entryFee + exitFee;
        const feePercent = (totalFee / (t.entryPrice * qty)) * 100;
        return {
          ...t,
          pnl: t.pnl - totalFee,
          pnlPercent: t.pnlPercent - feePercent,
        };
      });

      // Calculate comprehensive stats
      const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
      const winTrades = trades.filter(t => t.pnl > 0).length;
      const lossTrades = trades.filter(t => t.pnl <= 0).length;
      const winRate = trades.length > 0 ? (winTrades / trades.length) * 100 : 0;

      const grossProfit = trades.filter(t => t.pnl > 0).reduce((s, t) => s + t.pnl, 0);
      const grossLoss = Math.abs(trades.filter(t => t.pnl <= 0).reduce((s, t) => s + t.pnl, 0));
      const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
      const avgWin = winTrades > 0 ? grossProfit / winTrades : 0;
      const avgLoss = lossTrades > 0 ? grossLoss / lossTrades : 0;
      const expectancy = (winRate / 100) * avgWin - ((100 - winRate) / 100) * avgLoss;
      const avgTrade = trades.length > 0 ? totalPnl / trades.length : 0;

      const pnls = trades.map(t => t.pnl);
      const bestTrade = Math.max(...pnls, 0);
      const worstTrade = Math.min(...pnls, 0);

      // Equity curve
      let peak = 0;
      let maxDD = 0;
      let equity = 0;
      const equityCurve: EquityPoint[] = [];
      const drawdownCurve: number[] = [];

      for (let i = 0; i < trades.length; i++) {
        equity += trades[i].pnl;
        if (equity > peak) peak = equity;
        const dd = peak - equity;
        if (dd > maxDD) maxDD = dd;
        equityCurve.push({
          trade: i + 1,
          equity,
          drawdown: dd,
          timestamp: trades[i].exitTime,
        });
        drawdownCurve.push(dd);
      }

      // Sharpe ratio
      const pnlPcts = trades.map(t => t.pnlPercent);
      const avgReturn = pnlPcts.length > 0 ? pnlPcts.reduce((s, p) => s + p, 0) / pnlPcts.length : 0;
      const stdDev = pnlPcts.length > 1
        ? Math.sqrt(pnlPcts.reduce((s, p) => s + (p - avgReturn) ** 2, 0) / (pnlPcts.length - 1))
        : 0;
      const sharpeRatio = stdDev > 0 ? avgReturn / stdDev * Math.sqrt(365 * 24 / (timeframe === '1h' ? 1 : timeframe === '4h' ? 4 : 24)) : 0;

      // Days covered
      const firstTime = klines.length > 0 ? klineVal(klines[0], 'time', 0) : 0;
      const lastTime = klines.length > 0 ? klineVal(klines[klines.length - 1], 'time', 0) : 0;
      const daysCovered = (lastTime - firstTime) / (1000 * 60 * 60 * 24);

      setResult({
        totalTrades: trades.length,
        winTrades,
        lossTrades,
        winRate,
        totalPnl,
        maxDrawdown: maxDD,
        sharpeRatio,
        profitFactor,
        expectancy,
        avgWin,
        avgLoss,
        avgTrade,
        bestTrade,
        worstTrade,
        equityCurve,
        drawdownCurve,
        daysCovered,
        trades,
        marketRegime,
      });

      toast.success(`Backtest completed: ${trades.length} trades over ${daysCovered.toFixed(1)} days`);
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Backtest error');
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [symbol, timeframe, candleCount, selectedBot, params, takerFee]);

  const handleDownloadPDF = useCallback(() => {
    if (!result) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Pop-up blocked. Please allow pop-ups to download the Report Card.');
      return;
    }

    const botName = BOT_CONFIGS[selectedBot].name;
    const validationText = result.daysCovered >= 30 ? 'VALIDATED ✓' : 'INSUFFICIENT DATA';
    const validationColor = result.daysCovered >= 30 ? '#10B981' : '#F59E0B';

    // Build equity curve SVG points
    const minEq = Math.min(...result.equityCurve.map(e => e.equity), 0);
    const maxEq = Math.max(...result.equityCurve.map(e => e.equity), 0);
    const range = maxEq - minEq || 1;
    const svgWidth = 800;
    const svgHeight = 250;

    const points = result.equityCurve.map((p, i) => {
      const x = (i / (result.equityCurve.length - 1)) * (svgWidth - 40) + 20;
      const y = svgHeight - 20 - ((p.equity - minEq) / range) * (svgHeight - 40);
      return `${x},${y}`;
    }).join(' ');

    const fillPoints = `20,${svgHeight - 20} ${points} ${svgWidth - 20},${svgHeight - 20}`;

    const paramEntries = Object.entries(params[selectedBot])
      .map(([k, v]) => `<div><strong>${BOT_CONFIGS[selectedBot].paramLabels[k] || k}:</strong> ${v}</div>`)
      .join('');

    const tradeRows = result.trades.slice(0, 100).map((t, i) => `
      <tr style="border-bottom: 1px solid #E5E7EB;">
        <td style="padding: 8px; font-family: monospace;">${i + 1}</td>
        <td style="padding: 8px; font-family: monospace;">${t.entryTime}</td>
        <td style="padding: 8px; font-family: monospace;">${t.exitTime}</td>
        <td style="padding: 8px;">
          <span style="padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; background: ${t.side === 'LONG' ? '#DEF7EC' : '#FDE8E8'}; color: ${t.side === 'LONG' ? '#03543F' : '#9B1C1C'};">
            ${t.side}
          </span>
        </td>
        <td style="padding: 8px; text-align: right; font-family: monospace;">$${t.entryPrice.toFixed(2)}</td>
        <td style="padding: 8px; text-align: right; font-family: monospace;">$${t.exitPrice.toFixed(2)}</td>
        <td style="padding: 8px; text-align: right; font-family: monospace; color: ${t.pnl >= 0 ? '#10B981' : '#EF4444'}; font-weight: bold;">
          ${t.pnl >= 0 ? '+' : ''}$${t.pnl.toFixed(2)}
        </td>
        <td style="padding: 8px;">
          <span style="font-size: 10px; background: #F3F4F6; padding: 2px 6px; border-radius: 4px;">${t.exitReason}</span>
        </td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Strategy Report Card - ${botName} (${symbol})</title>
        <style>
          body { font-family: 'Inter', -apple-system, sans-serif; color: #1F2937; line-height: 1.5; padding: 40px; margin: 0; background: #FFFFFF; }
          header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #E5E7EB; padding-bottom: 20px; margin-bottom: 30px; }
          .title h1 { margin: 0; font-size: 24px; font-weight: 800; color: #111827; }
          .title p { margin: 5px 0 0 0; font-size: 12px; color: #6B7280; }
          .validation-badge { background: ${validationColor}; color: white; font-weight: bold; padding: 8px 16px; border-radius: 8px; font-size: 13px; }
          .section-title { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #4B5563; margin-bottom: 15px; border-bottom: 1px solid #F3F4F6; padding-bottom: 5px; }
          .grid-info { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
          .info-card { background: #F9FAFB; border: 1px solid #E5E7EB; padding: 15px; border-radius: 8px; }
          .info-card .label { font-size: 10px; font-weight: 600; color: #6B7280; text-transform: uppercase; margin-bottom: 5px; }
          .info-card .value { font-size: 18px; font-weight: 700; color: #111827; }
          .metrics-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          .metrics-table th, .metrics-table td { border: 1px solid #E5E7EB; padding: 10px; text-align: left; font-size: 12px; }
          .metrics-table th { background: #F3F4F6; font-weight: 600; }
          .chart-container { margin-bottom: 35px; text-align: center; }
          table.trades-list { width: 100%; border-collapse: collapse; font-size: 11px; }
          table.trades-list th { background: #F9FAFB; border-bottom: 2px solid #E5E7EB; padding: 8px; text-align: left; }
          .footer { margin-top: 50px; font-size: 10px; color: #9CA3AF; text-align: center; border-top: 1px solid #E5E7EB; padding-top: 20px; }
          @media print { body { padding: 0; } .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="no-print" style="background: #F3F4F6; padding: 15px; text-align: center; margin-bottom: 20px; border-radius: 8px;">
          <button onclick="window.print()" style="background: #6366F1; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 12px;">Print or Save as PDF</button>
        </div>
        <header>
          <div class="title">
            <h1>SoDEX PowerOps Strategy Report Card</h1>
            <p>Generated on ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()} | Platform: SoDEX Terminal</p>
          </div>
          <div class="validation-badge">${validationText}</div>
        </header>
        <div class="section-title">Backtest Settings & Context</div>
        <div class="grid-info">
          <div class="info-card"><div class="label">Strategy Name</div><div class="value">${botName}</div></div>
          <div class="info-card"><div class="label">Market Instrument</div><div class="value">${symbol}</div></div>
          <div class="info-card"><div class="label">Timeframe</div><div class="value">${timeframe}</div></div>
          <div class="info-card"><div class="label">Historical Period</div><div class="value">${result.daysCovered.toFixed(1)} Days</div></div>
        </div>
        <div style="display: flex; gap: 20px; margin-bottom: 30px;">
          <div style="flex: 2;">
            <div class="section-title">Bot Configuration Parameters</div>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; font-size: 12px; background: #F9FAFB; padding: 15px; border-radius: 8px; border: 1px solid #E5E7EB;">${paramEntries}</div>
          </div>
          <div style="flex: 1;">
            <div class="section-title">Validation Details</div>
            <div style="font-size: 12px; background: #F9FAFB; padding: 15px; border-radius: 8px; border: 1px solid #E5E7EB;">
              <div><strong>Status:</strong> <span style="color: ${validationColor}; font-weight: bold;">${validationText}</span></div>
              <div style="margin-top: 8px;"><strong>Market Regime:</strong> ${result.marketRegime}</div>
              <div style="margin-top: 8px;"><strong>Round-Trip Taker Fee:</strong> ${takerFee}%</div>
            </div>
          </div>
        </div>
        <div class="section-title">Performance Summary</div>
        <table class="metrics-table">
          <thead><tr><th>Net Profit / Loss</th><th>Win Rate</th><th>Sharpe Ratio</th><th>Profit Factor</th><th>Max Drawdown</th><th>Expectancy</th></tr></thead>
          <tbody>
            <tr>
              <td style="font-size: 16px; font-weight: bold; color: ${result.totalPnl >= 0 ? '#10B981' : '#EF4444'};">${result.totalPnl >= 0 ? '+' : ''}$${result.totalPnl.toFixed(2)}</td>
              <td style="font-size: 16px; font-weight: bold;">${result.winRate.toFixed(1)}%</td>
              <td style="font-size: 16px; font-weight: bold;">${result.sharpeRatio.toFixed(2)}</td>
              <td style="font-size: 16px; font-weight: bold;">${result.profitFactor === Infinity ? '∞' : result.profitFactor.toFixed(2)}</td>
              <td style="font-size: 16px; font-weight: bold; color: #EF4444;">$${result.maxDrawdown.toFixed(2)}</td>
              <td style="font-size: 16px; font-weight: bold; color: ${result.expectancy >= 0 ? '#10B981' : '#EF4444'};">${result.expectancy >= 0 ? '+' : ''}$${result.expectancy.toFixed(2)}</td>
            </tr>
            <tr><td colspan="2"><strong>Trades Count:</strong> ${result.totalTrades} (${result.winTrades} W / ${result.lossTrades} L)</td><td colspan="2"><strong>Avg Trade:</strong> ${result.avgTrade >= 0 ? '+' : ''}$${result.avgTrade.toFixed(2)}</td><td colspan="2"><strong>Best / Worst Trade:</strong> <span style="color: #10B981;">+$${result.bestTrade.toFixed(2)}</span> / <span style="color: #EF4444;">$${result.worstTrade.toFixed(2)}</span></td></tr>
          </tbody>
        </table>
        <div class="section-title">Performance Curve (Equity Growth)</div>
        <div class="chart-container">
          <svg width="${svgWidth}" height="${svgHeight}" style="background: #FAFAFA; border: 1px solid #E5E7EB; border-radius: 8px;">
            <polygon points="${fillPoints}" fill="#EEF2FF" />
            <polyline points="${points}" fill="none" stroke="#4F46E5" stroke-width="2.5" stroke-linejoin="round" />
            <line x1="20" y1="${svgHeight - 20}" x2="${svgWidth - 20}" y2="${svgHeight - 20}" stroke="#E5E7EB" stroke-width="1.5" />
            <line x1="20" y1="${(svgHeight - 20) / 2 + 10}" x2="${svgWidth - 20}" y2="${(svgHeight - 20) / 2 + 10}" stroke="#F3F4F6" stroke-dasharray="4" />
            <line x1="20" y1="20" x2="${svgWidth - 20}" y2="20" stroke="#F3F4F6" stroke-dasharray="4" />
            <text x="25" y="35" font-family="sans-serif" font-size="10" fill="#6B7280" font-weight="bold">Peak: $${maxEq.toFixed(2)}</text>
            <text x="25" y="${svgHeight - 28}" font-family="sans-serif" font-size="10" fill="#6B7280" font-weight="bold">Min: $${minEq.toFixed(2)}</text>
          </svg>
        </div>
        <div class="section-title">Detailed Trade History (Last 100 Trades)</div>
        <table class="trades-list"><thead><tr><th>#</th><th>Entry Time</th><th>Exit Time</th><th>Side</th><th style="text-align: right;">Entry Price</th><th style="text-align: right;">Exit Price</th><th style="text-align: right;">PnL</th><th>Exit Reason</th></tr></thead><tbody>${tradeRows}</tbody></table>
        <div class="footer"><p>Confidential Strategy Evaluation Report • Powered by SoDEX PowerOps Engine • Wave 2 Compliance Document</p></div>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }, [result, selectedBot, symbol, timeframe, params, takerFee]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 h-full flex flex-col gap-5 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 shrink-0 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-primary flex items-center justify-center shadow-lg">
            <FlaskConical size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-text-primary">Professional Backtesting</h2>
            <p className="text-[11px] text-text-muted">
              Historical strategy validation with real market data (Wave 2)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-primary/20 hover:border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-semibold"
            icon={<Sparkles size={14} />}
            onClick={runComparison}
            disabled={loading || comparing || analyzingNews}
          >
            Compare Bots
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-primary/20 hover:border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-semibold"
            icon={<TrendingUpIcon size={14} />}
            onClick={runNewsCorrelation}
            disabled={loading || comparing || analyzingNews}
          >
            News Sentiment Analysis
          </Button>
        </div>
      </div>

      {/* Configuration Panel */}
      <Card className="shrink-0 p-5">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/50">
          <Layers size={16} className="text-primary" />
          <span className="text-sm font-semibold text-text-primary">Strategy Configuration</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {/* Bot Selection */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-text-secondary uppercase tracking-wider">
              Trading Bot
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(BOT_CONFIGS) as BotType[]).map(bot => (
                <button
                  key={bot}
                  onClick={() => setSelectedBot(bot)}
                  className={cn(
                    'px-3 py-2 rounded-lg text-xs font-medium transition-all text-left',
                    selectedBot === bot
                      ? 'bg-primary/20 text-primary border border-primary/30'
                      : 'bg-surface border border-border text-text-secondary hover:text-text-primary'
                  )}
                >
                  {BOT_CONFIGS[bot].name}
                </button>
              ))}
            </div>
          </div>

          {/* Market Settings */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-text-secondary uppercase tracking-wider">
              Market Settings
            </label>
            <div className="space-y-2">
              <SymbolSelector
                value={symbol}
                onChange={setSymbol}
                market="perps"
                label=""
              />
              <Select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value as TimeframeType)}
                options={[
                  { value: '5m', label: '5 Minutes' },
                  { value: '15m', label: '15 Minutes' },
                  { value: '1h', label: '1 Hour' },
                  { value: '4h', label: '4 Hours' },
                  { value: '1d', label: '1 Day' },
                ]}
              />
            </div>
          </div>

          {/* Data Range */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-text-secondary uppercase tracking-wider">
              Data Range
            </label>
            <div className="space-y-2">
              <Input
                type="number"
                value={candleCount}
                onChange={(e) => setCandleCount(e.target.value)}
                placeholder="720 (30 days @ 1h)"
                className="text-sm"
              />
              <div className="text-[10px] text-text-muted">
                {timeframe === '1h' && `≈ ${(parseInt(candleCount) / 24).toFixed(1)} days`}
                {timeframe === '4h' && `≈ ${(parseInt(candleCount) / 6).toFixed(1)} days`}
                {timeframe === '1d' && `≈ ${parseInt(candleCount)} days`}
              </div>
            </div>
          </div>

          {/* Fee Settings */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-text-secondary uppercase tracking-wider">
              Fee Model
            </label>
            <div className="space-y-2">
              <Input
                type="number"
                value={takerFee}
                onChange={(e) => setTakerFee(e.target.value)}
                placeholder="0.04"
                className="text-sm"
              />
              <div className="text-[10px] text-text-muted">
                Per-trade fee % (round-trip ×2)
              </div>
            </div>
          </div>
        </div>

        {/* Bot Parameters */}
        <div className="pt-4 border-t border-border/50">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={14} className="text-amber-400" />
            <span className="text-xs font-medium text-text-secondary">
              {currentBot.name} Parameters
            </span>
            <span className="text-[10px] text-text-muted ml-auto">
              {currentBot.description}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Object.entries(currentBot.paramLabels).map(([key, label]) => (
              <div key={key} className="space-y-1">
                <label className="text-[10px] text-text-muted">{label}</label>
                <Input
                  type="number"
                  value={params[selectedBot][key]}
                  onChange={(e) => updateParam(key, e.target.value)}
                  className="text-sm"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Run Button */}
        <div className="mt-4 pt-4 border-t border-border/50">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            icon={<Play size={18} />}
            onClick={runBacktest}
            loading={loading}
          >
            Run Professional Backtest
          </Button>
        </div>
      </Card>

      {/* Results */}
      {result && (
        <>
          {/* Validation Banner */}
          <Card className={cn(
            'p-4 shrink-0 border-l-4',
            result.daysCovered >= 30
              ? 'border-l-emerald-500 bg-emerald-500/5'
              : 'border-l-amber-500 bg-amber-500/5'
          )}>
            <div className="flex items-start gap-3">
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                result.daysCovered >= 30 ? 'bg-emerald-500/20' : 'bg-amber-500/20'
              )}>
                {result.daysCovered >= 30 ? (
                  <CheckCircle2 size={20} className="text-emerald-400" />
                ) : (
                  <AlertTriangle size={20} className="text-amber-400" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-text-primary">
                    Wave 2 Validation Status
                  </span>
                  <span className={cn(
                    'px-2 py-0.5 rounded-full text-[10px] font-bold',
                    result.daysCovered >= 30
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-amber-500/20 text-amber-400'
                  )}>
                    {result.daysCovered >= 30 ? 'VALIDATED ✓' : 'INSUFFICIENT DATA'}
                  </span>
                </div>
                <p className="text-[11px] text-text-muted mt-1">
                  {result.daysCovered >= 30
                    ? `${result.daysCovered.toFixed(1)} days of historical data analyzed. ` +
                      `Market regime: ${result.marketRegime}. ` +
                      `Results are statistically significant for Wave 2 submission.`
                    : `Only ${result.daysCovered.toFixed(1)} days of data. ` +
                      `Increase candle count to reach 30-day minimum for valid backtest.`}
                </p>
              </div>
              <div className="shrink-0 self-center">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleDownloadPDF}
                  icon={<Download size={14} />}
                >
                  Download Report Card
                </Button>
              </div>
            </div>
          </Card>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
            <StatCard
              label="Total Trades"
              value={<NumberDisplay value={result.totalTrades} decimals={0} />}
              icon={<BarChart3 size={16} />}
            />
            <StatCard
              label="Win Rate"
              value={<NumberDisplay value={result.winRate} suffix="%" trend={result.winRate >= 50 ? 'up' : 'down'} />}
              icon={<Target size={16} />}
              trend={result.winRate >= 50 ? 'up' : 'down'}
            />
            <StatCard
              label="Net PnL"
              value={
                <NumberDisplay
                  value={Math.abs(result.totalPnl)}
                  prefix={result.totalPnl >= 0 ? '+$' : '-$'}
                  trend={result.totalPnl >= 0 ? 'up' : 'down'}
                />
              }
              icon={<TrendingUp size={16} />}
              trend={result.totalPnl >= 0 ? 'up' : 'down'}
            />
            <StatCard
              label="Sharpe Ratio"
              value={
                <span className={cn(
                  'font-mono font-bold',
                  result.sharpeRatio >= 1 ? 'text-emerald-400' : result.sharpeRatio >= 0.5 ? 'text-primary' : 'text-amber-400'
                )}>
                  {result.sharpeRatio.toFixed(2)}
                </span>
              }
              icon={<Award size={16} />}
              trend={result.sharpeRatio >= 1 ? 'up' : 'neutral'}
            />
          </div>

          {/* Advanced Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 shrink-0">
            <div className="bg-surface border border-border rounded-xl p-3 text-center">
              <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Profit Factor</div>
              <div className={cn(
                'text-lg font-bold font-mono',
                result.profitFactor >= 1.5 ? 'text-emerald-400' : result.profitFactor >= 1 ? 'text-primary' : 'text-amber-400'
              )}>
                {result.profitFactor === Infinity ? '∞' : result.profitFactor.toFixed(2)}
              </div>
            </div>
            <div className="bg-surface border border-border rounded-xl p-3 text-center">
              <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Expectancy</div>
              <div className={cn(
                'text-lg font-bold font-mono',
                result.expectancy >= 0 ? 'text-emerald-400' : 'text-red-400'
              )}>
                {result.expectancy >= 0 ? '+' : ''}${result.expectancy.toFixed(2)}
              </div>
            </div>
            <div className="bg-surface border border-border rounded-xl p-3 text-center">
              <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Max Drawdown</div>
              <div className="text-lg font-bold font-mono text-red-400">
                ${result.maxDrawdown.toFixed(2)}
              </div>
            </div>
            <div className="bg-surface border border-border rounded-xl p-3 text-center">
              <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Avg Trade</div>
              <div className={cn(
                'text-lg font-bold font-mono',
                result.avgTrade >= 0 ? 'text-emerald-400' : 'text-red-400'
              )}>
                {result.avgTrade >= 0 ? '+' : ''}${result.avgTrade.toFixed(2)}
              </div>
            </div>
            <div className="bg-surface border border-border rounded-xl p-3 text-center">
              <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Best Trade</div>
              <div className="text-lg font-bold font-mono text-emerald-400">
                +${result.bestTrade.toFixed(2)}
              </div>
            </div>
            <div className="bg-surface border border-border rounded-xl p-3 text-center">
              <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Worst Trade</div>
              <div className="text-lg font-bold font-mono text-red-400">
                ${result.worstTrade.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 shrink-0">
            {/* Equity Curve */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <TrendingUpIcon size={16} className="text-primary" />
                  <span className="text-sm font-semibold text-text-primary">Equity Curve</span>
                </div>
                <span className="text-[10px] text-text-muted">
                  Peak: ${Math.max(...result.equityCurve.map(e => e.equity), 0).toFixed(2)}
                </span>
              </div>
              <div className="h-40 bg-background/50 border border-border/50 rounded-xl relative overflow-hidden">
                <svg className="absolute inset-0 w-full h-full p-3" preserveAspectRatio="none" viewBox={`0 0 ${Math.max(result.equityCurve.length, 1)} 100`}>
                  <defs>
                    <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366F1" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#6366F1" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {result.equityCurve.length > 0 && (
                    <>
                      <polygon
                        points={`0,100 ${result.equityCurve.map((p, i) => {
                          const minEq = Math.min(...result.equityCurve.map(e => e.equity), 0);
                          const maxEq = Math.max(...result.equityCurve.map(e => e.equity), 0);
                          const range = maxEq - minEq || 1;
                          const y = 95 - ((p.equity - minEq) / range) * 90;
                          return `${i},${y}`;
                        }).join(' ')} ${result.equityCurve.length - 1},100`}
                        fill="url(#equityGrad)"
                      />
                      <polyline
                        points={result.equityCurve.map((p, i) => {
                          const minEq = Math.min(...result.equityCurve.map(e => e.equity), 0);
                          const maxEq = Math.max(...result.equityCurve.map(e => e.equity), 0);
                          const range = maxEq - minEq || 1;
                          const y = 95 - ((p.equity - minEq) / range) * 90;
                          return `${i},${y}`;
                        }).join(' ')}
                        fill="none"
                        stroke="#6366F1"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </>
                  )}
                </svg>
              </div>
            </Card>

            {/* Drawdown Chart */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <TrendingDown size={16} className="text-red-400" />
                  <span className="text-sm font-semibold text-text-primary">Drawdown Curve</span>
                </div>
                <span className="text-[10px] text-text-muted">
                  Max: ${result.maxDrawdown.toFixed(2)}
                </span>
              </div>
              <div className="h-40 bg-background/50 border border-border/50 rounded-xl relative overflow-hidden">
                <svg className="absolute inset-0 w-full h-full p-3" preserveAspectRatio="none" viewBox={`0 0 ${Math.max(result.drawdownCurve.length, 1)} 100`}>
                  {result.drawdownCurve.length > 0 && (
                    <polyline
                      points={result.drawdownCurve.map((dd, i) => {
                        const maxDD = Math.max(...result.drawdownCurve, 0.01);
                        const y = 5 + (dd / maxDD) * 90;
                        return `${i},${y}`;
                      }).join(' ')}
                      fill="none"
                      stroke="#F87171"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                </svg>
              </div>
            </Card>
          </div>

          {/* Trade History */}
          <div className="flex-1 min-h-0 glass-card flex flex-col overflow-hidden p-0">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <BarChart3 size={16} className="text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Detailed Trade History
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-text-muted">
                  <span className="text-emerald-400 font-bold">{result.winTrades}</span> wins
                </span>
                <span className="text-[10px] text-text-muted">
                  <span className="text-red-400 font-bold">{result.lossTrades}</span> losses
                </span>
                <span className="badge badge-primary">{result.trades.length} trades</span>
              </div>
            </div>
            <div className="overflow-auto flex-1">
              <table className="data-table text-sm text-left whitespace-nowrap">
                <thead className="text-[11px] text-text-muted uppercase tracking-wider border-b border-border">
                  <tr>
                    <th className="px-5 py-3 font-medium">#</th>
                    <th className="px-5 py-3 font-medium">Entry Time</th>
                    <th className="px-5 py-3 font-medium">Exit Time</th>
                    <th className="px-5 py-3 font-medium">Side</th>
                    <th className="px-5 py-3 font-medium text-right">Entry</th>
                    <th className="px-5 py-3 font-medium text-right">Exit</th>
                    <th className="px-5 py-3 font-medium text-right">PnL</th>
                    <th className="px-5 py-3 font-medium">Exit Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {result.trades.map((t, i) => (
                    <tr key={i} className="hover:bg-surface-hover/30 transition-colors">
                      <td className="px-5 py-2.5 text-[10px] text-text-muted font-mono">{i + 1}</td>
                      <td className="px-5 py-2.5 text-[11px] text-text-muted font-mono">{t.entryTime}</td>
                      <td className="px-5 py-2.5 text-[11px] text-text-muted font-mono">{t.exitTime}</td>
                      <td className="px-5 py-2.5">
                        <span className={cn(
                          'text-[10px] px-2 py-0.5 rounded-full font-semibold',
                          t.side === 'LONG'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-red-500/15 text-red-400'
                        )}>
                          {t.side}
                        </span>
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums font-mono text-text-secondary">
                        ${t.entryPrice.toFixed(2)}
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums font-mono text-text-secondary">
                        ${t.exitPrice.toFixed(2)}
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <NumberDisplay
                          value={Math.abs(t.pnl)}
                          prefix={t.pnl >= 0 ? '+$' : '-$'}
                          trend={t.pnl >= 0 ? 'up' : 'down'}
                          className="text-xs"
                        />
                      </td>
                      <td className="px-5 py-2.5">
                        <span className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded',
                          t.exitReason === 'TARGET' && 'bg-emerald-500/10 text-emerald-400',
                          t.exitReason === 'STOP' && 'bg-red-500/10 text-red-400',
                          t.exitReason === 'SIGNAL' && 'bg-primary/10 text-primary',
                          t.exitReason === 'END' && 'bg-text-muted/10 text-text-muted'
                        )}>
                          {t.exitReason}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Empty State */}
      {!result && !loading && (
        <div className="flex-1 flex items-center justify-center text-text-muted">
          <div className="text-center">
            <div className="w-20 h-20 rounded-2xl bg-surface border border-border flex items-center justify-center mx-auto mb-4">
              <FlaskConical size={40} className="text-text-muted/30" />
            </div>
            <h3 className="text-sm font-semibold text-text-primary mb-1">Ready to Backtest</h3>
            <p className="text-xs text-text-muted max-w-sm">
              Configure your trading bot parameters, select timeframe, and run a professional backtest.
              <br />
              <span className="text-primary">Minimum 30 days of data required for Wave 2 validation.</span>
            </p>
          </div>
        </div>
      )}
      <CompareBotsModal
        isOpen={compareModalOpen}
        onClose={() => setCompareModalOpen(false)}
        results={compareResults}
        loading={comparing}
        symbol={symbol}
        timeframe={timeframe}
      />
      <NewsSentimentCorrelationModal
        isOpen={newsModalOpen}
        onClose={() => setNewsModalOpen(false)}
        results={newsCorrelationResults}
        stats={newsStats}
        loading={analyzingNews}
        symbol={symbol}
      />
    </div>
  );
};

// ─── Bot Colors for Comparison ─────────────────────────────────────────────
const BOT_COLORS: Record<string, string> = {
  GRID: '#10B981',         // Emerald
  DCA: '#3B82F6',          // Blue
  TWAP: '#F59E0B',         // Amber
  MARKET_MAKER: '#8B5CF6',  // Violet
  SIGNAL: '#EC4899',       // Pink
};

// ─── Bot Comparison Modal ──────────────────────────────────────────────────
interface CompareBotsModalProps {
  isOpen: boolean;
  onClose: () => void;
  results: Record<string, any> | null;
  loading: boolean;
  symbol: string;
  timeframe: string;
}

const CompareBotsModal: React.FC<CompareBotsModalProps> = ({
  isOpen,
  onClose,
  results,
  loading,
  symbol,
  timeframe,
}) => {
  if (!isOpen) return null;

  // Find the top bot based on total PnL
  let topBot: any = null;
  if (results) {
    let maxPnl = -Infinity;
    Object.values(results).forEach((r: any) => {
      if (r.totalPnl > maxPnl) {
        maxPnl = r.totalPnl;
        topBot = r;
      }
    });
  }

  // Pre-calculate SVG dimensions
  const svgWidth = 800;
  const svgHeight = 250;

  // Determine global min and max equity across all bots for SVG scaling
  let globalMin = 0;
  let globalMax = 0;
  let hasValidCurve = false;

  if (results) {
    Object.values(results).forEach((botRes: any) => {
      if (botRes.equityCurve && botRes.equityCurve.length > 0) {
        hasValidCurve = true;
        botRes.equityCurve.forEach((p: any) => {
          if (p.equity < globalMin) globalMin = p.equity;
          if (p.equity > globalMax) globalMax = p.equity;
        });
      }
    });
  }

  const range = globalMax - globalMin || 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-backdrop p-4 bg-black/60 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="glass-card w-full max-w-4xl shadow-2xl animate-fade-in flex flex-col max-h-[85vh] overflow-hidden"
        style={{ border: '1px solid rgba(27,34,48,0.85)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Sparkles size={18} className="text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-text-primary leading-tight">
                Bot Performance Comparison Suite
              </h3>
              <p className="text-xs text-text-muted mt-1 leading-relaxed">
                Comparative strategy simulation for <span className="font-mono text-text-primary">{symbol}</span> on <span className="font-mono text-text-primary">{timeframe}</span> timeframe
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors rounded-lg p-1 hover:bg-surface-hover"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
          {loading && (
            <div className="flex-1 flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <div className="text-center">
                <h4 className="text-sm font-semibold text-text-primary">Running Multi-Strategy Simulation</h4>
                <p className="text-xs text-text-muted mt-1">Concurrently backtesting all 5 bot variants over historical klines...</p>
              </div>
            </div>
          )}

          {!loading && results && (
            <>
              {/* Winner Banner */}
              {topBot && (
                <div className={cn(
                  'p-4 rounded-xl border flex items-center gap-3',
                  topBot.totalPnl >= 0
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                )}>
                  <Award size={20} className="shrink-0" />
                  <div className="text-xs leading-normal">
                    {topBot.totalPnl >= 0 ? (
                      <span>
                        🏆 <strong>{topBot.botName}</strong> outperforms all strategies, generating <strong>+${topBot.totalPnl.toFixed(2)}</strong> in net returns (Win Rate: <strong>{topBot.winRate.toFixed(1)}%</strong>)!
                      </span>
                    ) : (
                      <span>
                        ⚠️ All strategies suffered drawdowns in this regime. <strong>{topBot.botName}</strong> was the most defensive, losing only <strong>${Math.abs(topBot.totalPnl).toFixed(2)}</strong>.
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Comparison Table */}
              <div>
                <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Performance Metrics Matrix</h4>
                <div className="overflow-x-auto border border-border/50 rounded-xl">
                  <table className="w-full text-sm text-left">
                    <thead className="text-[10px] text-text-muted uppercase bg-surface/50 border-b border-border">
                      <tr>
                        <th className="px-4 py-3">Strategy</th>
                        <th className="px-4 py-3 text-right">Net Profit ($)</th>
                        <th className="px-4 py-3 text-right">Win Rate</th>
                        <th className="px-4 py-3 text-right">Trades</th>
                        <th className="px-4 py-3 text-right">Profit Factor</th>
                        <th className="px-4 py-3 text-right">Sharpe Ratio</th>
                        <th className="px-4 py-3 text-right">Max Drawdown</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50 font-mono">
                      {Object.values(results).map((r: any) => {
                        const isWinner = topBot && topBot.bot === r.bot;
                        const isPnlUp = r.totalPnl >= 0;
                        return (
                          <tr
                            key={r.bot}
                            className={cn(
                              'hover:bg-surface-hover/30 transition-colors',
                              isWinner && 'bg-primary/5 font-semibold'
                            )}
                          >
                            <td className="px-4 py-3 font-sans font-medium text-text-primary flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: BOT_COLORS[r.bot] }}
                              />
                              {r.botName}
                              {isWinner && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-sans font-bold">TOP</span>}
                            </td>
                            <td className={cn('px-4 py-3 text-right tabular-nums', isPnlUp ? 'text-success font-bold' : 'text-danger')}>
                              {isPnlUp ? '+' : ''}${r.totalPnl.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-text-secondary">
                              {r.winRate.toFixed(1)}%
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-text-secondary">
                              {r.totalTrades}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-text-secondary">
                              {r.profitFactor === Infinity ? '∞' : r.profitFactor.toFixed(2)}
                            </td>
                            <td className={cn(
                              'px-4 py-3 text-right tabular-nums',
                              r.sharpeRatio >= 1 ? 'text-emerald-400 font-bold' : r.sharpeRatio >= 0.5 ? 'text-primary' : 'text-text-secondary'
                            )}>
                              {r.sharpeRatio.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-danger">
                              -${r.maxDrawdown.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Combined Equity Chart */}
              <div>
                <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Combined Strategy Equity Curves</h4>
                <div className="bg-surface/30 p-4 border border-border/50 rounded-xl flex flex-col items-center">
                  {hasValidCurve ? (
                    <svg width={svgWidth} height={svgHeight} className="overflow-visible max-w-full">
                      {/* Zero baseline */}
                      <line
                        x1="20"
                        y1={svgHeight - 20 - ((0 - globalMin) / range) * (svgHeight - 40)}
                        x2={svgWidth - 20}
                        y2={svgHeight - 20 - ((0 - globalMin) / range) * (svgHeight - 40)}
                        stroke="rgba(255,255,255,0.15)"
                        strokeWidth="1.5"
                        strokeDasharray="2 3"
                      />
                      {/* Curves */}
                      {Object.values(results).map((botRes: any) => {
                        const N = botRes.equityCurve.length;
                        if (N < 2) return null;
                        const points = botRes.equityCurve.map((p: any, i: number) => {
                          const x = (i / (N - 1)) * (svgWidth - 40) + 20;
                          const y = svgHeight - 20 - ((p.equity - globalMin) / range) * (svgHeight - 40);
                          return `${x},${y}`;
                        }).join(' ');
                        return (
                          <polyline
                            key={botRes.bot}
                            points={points}
                            fill="none"
                            stroke={BOT_COLORS[botRes.bot]}
                            strokeWidth="2.5"
                            strokeLinejoin="round"
                            className="transition-all duration-300 hover:stroke-[3.5px] cursor-pointer"
                          />
                        );
                      })}
                      {/* Border Lines */}
                      <line x1="20" y1={svgHeight - 20} x2={svgWidth - 20} y2={svgHeight - 20} stroke="#2E374A" strokeWidth="1" />
                      
                      {/* Labels */}
                      <text x="25" y="25" fontFamily="monospace" fontSize="9" fill="#9CA3AF" fontWeight="bold">Global Peak: +${globalMax.toFixed(2)}</text>
                      <text x="25" y={svgHeight - 25} fontFamily="monospace" fontSize="9" fill="#EF4444" fontWeight="bold">Global Min: -${Math.abs(globalMin).toFixed(2)}</text>
                    </svg>
                  ) : (
                    <div className="py-12 text-center text-xs text-text-muted">No historical trades triggered to map equity curve</div>
                  )}

                  {/* Chart Legend */}
                  <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 justify-center">
                    {Object.values(results).map((botRes: any) => (
                      <div key={botRes.bot} className="flex items-center gap-1.5 text-xs text-text-secondary">
                        <span
                          className="w-3 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: BOT_COLORS[botRes.bot] }}
                        />
                        <span>{botRes.botName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Simulation Note & Disclaimer Alert */}
              <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-start gap-3">
                <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h5 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Simulation Notes & Risk Disclaimer</h5>
                  <p className="text-[11px] text-text-muted leading-relaxed">
                    All bot simulations are calculated using a default baseline balance of <strong>1000 USDT</strong>. Grid and DCA bots carry inherent inventory and price-drawdown risk. To mitigate consecutive trend-following losses, risk protection cooldowns are active: <strong>8 bars</strong> for the Signal Bot and <strong>10 bars</strong> for the Market Maker bot.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-border bg-background/30">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close Matrix
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── News Sentiment Correlation Modal ──────────────────────────────────────
interface NewsCorrelationModalProps {
  isOpen: boolean;
  onClose: () => void;
  results: any[] | null;
  stats: any | null;
  loading: boolean;
  symbol: string;
}

const NewsSentimentCorrelationModal: React.FC<NewsCorrelationModalProps> = ({
  isOpen,
  onClose,
  results,
  stats,
  loading,
  symbol,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-backdrop p-4 bg-black/60 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="glass-card w-full max-w-4xl shadow-2xl animate-fade-in flex flex-col max-h-[85vh] overflow-hidden"
        style={{ border: '1px solid rgba(27,34,48,0.85)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <TrendingUpIcon size={18} className="text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-text-primary leading-tight">
                SoSoValue News Sentiment Correlation Analysis
              </h3>
              <p className="text-xs text-text-muted mt-1 leading-relaxed">
                Analyzing price reaction of <span className="font-mono text-text-primary">{symbol.split(/[-_/]/)[0]}</span> following headlines
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors rounded-lg p-1 hover:bg-surface-hover"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-5">
          {loading && (
            <div className="flex-1 flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <div className="text-center">
                <h4 className="text-sm font-semibold text-text-primary">Performing Correlation Analysis</h4>
                <p className="text-xs text-text-muted mt-1">Fetching latest SoSoValue news and mapping timeline to historical klines...</p>
              </div>
            </div>
          )}

          {!loading && results && stats && (
            <>
              {/* Correlation Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wide">
                    <TrendingUpIcon size={14} />
                    Positive Sentiment Correlation ({stats.posCount} items)
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3 font-mono text-center">
                    <div>
                      <div className="text-[9px] text-text-muted uppercase">1h Avg</div>
                      <div className={cn('text-sm font-bold mt-0.5', stats.posAvg1h >= 0 ? 'text-success' : 'text-danger')}>
                        {stats.posAvg1h >= 0 ? '+' : ''}{stats.posAvg1h.toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] text-text-muted uppercase">4h Avg</div>
                      <div className={cn('text-sm font-bold mt-0.5', stats.posAvg4h >= 0 ? 'text-success' : 'text-danger')}>
                        {stats.posAvg4h >= 0 ? '+' : ''}{stats.posAvg4h.toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] text-text-muted uppercase">12h Avg</div>
                      <div className={cn('text-sm font-bold mt-0.5', stats.posAvg12h >= 0 ? 'text-success' : 'text-danger')}>
                        {stats.posAvg12h >= 0 ? '+' : ''}{stats.posAvg12h.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5">
                  <div className="flex items-center gap-2 text-xs font-bold text-red-400 uppercase tracking-wide">
                    <TrendingDown size={14} />
                    Negative Sentiment Correlation ({stats.negCount} items)
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3 font-mono text-center">
                    <div>
                      <div className="text-[9px] text-text-muted uppercase">1h Avg</div>
                      <div className={cn('text-sm font-bold mt-0.5', stats.negAvg1h >= 0 ? 'text-success' : 'text-danger')}>
                        {stats.negAvg1h >= 0 ? '+' : ''}{stats.negAvg1h.toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] text-text-muted uppercase">4h Avg</div>
                      <div className={cn('text-sm font-bold mt-0.5', stats.negAvg4h >= 0 ? 'text-success' : 'text-danger')}>
                        {stats.negAvg4h >= 0 ? '+' : ''}{stats.negAvg4h.toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] text-text-muted uppercase">12h Avg</div>
                      <div className={cn('text-sm font-bold mt-0.5', stats.negAvg12h >= 0 ? 'text-success' : 'text-danger')}>
                        {stats.negAvg12h >= 0 ? '+' : ''}{stats.negAvg12h.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Timeline Cards */}
              <div>
                <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Headline Correlation Feed</h4>
                <div className="flex flex-col gap-3">
                  {results.length === 0 ? (
                    <div className="text-center py-8 text-xs text-text-muted border border-dashed border-border rounded-xl">
                      No matching news headlines correlated with available historical price klines.
                    </div>
                  ) : (
                    results.map((r) => {
                      const isPositive = r.sentiment === 'POSITIVE';
                      const isNegative = r.sentiment === 'NEGATIVE';
                      return (
                        <div
                          key={r.id}
                          className="p-4 rounded-xl bg-surface border border-border/50 flex flex-col md:flex-row justify-between gap-4"
                        >
                          <div className="flex-1 space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold">
                                {r.coin}
                              </span>
                              <span className={cn(
                                'text-[9px] px-1.5 py-0.5 rounded font-bold uppercase',
                                isPositive && 'bg-emerald-500/10 text-emerald-400',
                                isNegative && 'bg-red-500/10 text-red-400',
                                !isPositive && !isNegative && 'bg-white/5 text-text-muted'
                              )}>
                                {r.sentiment}
                              </span>
                              <span className="text-[10px] text-text-muted">
                                {new Date(r.releaseTime).toLocaleString()}
                              </span>
                            </div>
                            <h5 className="text-xs font-semibold text-text-primary leading-snug">
                              {r.title}
                            </h5>
                          </div>

                          <div className="shrink-0 flex items-center gap-4 font-mono text-xs border-t md:border-t-0 border-border/50 pt-2.5 md:pt-0">
                            <div className="text-right">
                              <div className="text-[8px] text-text-muted uppercase">1h React</div>
                              <div className={cn('font-bold mt-0.5', r.ch1h === null ? 'text-text-muted' : r.ch1h >= 0 ? 'text-success' : 'text-danger')}>
                                {r.ch1h === null ? '—' : `${r.ch1h >= 0 ? '+' : ''}${r.ch1h.toFixed(2)}%`}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[8px] text-text-muted uppercase">4h React</div>
                              <div className={cn('font-bold mt-0.5', r.ch4h === null ? 'text-text-muted' : r.ch4h >= 0 ? 'text-success' : 'text-danger')}>
                                {r.ch4h === null ? '—' : `${r.ch4h >= 0 ? '+' : ''}${r.ch4h.toFixed(2)}%`}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[8px] text-text-muted uppercase">12h React</div>
                              <div className={cn('font-bold mt-0.5', r.ch12h === null ? 'text-text-muted' : r.ch12h >= 0 ? 'text-success' : 'text-danger')}>
                                {r.ch12h === null ? '—' : `${r.ch12h >= 0 ? '+' : ''}${r.ch12h.toFixed(2)}%`}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-border bg-background/30">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close Analysis
          </Button>
        </div>
      </div>
    </div>
  );
};


