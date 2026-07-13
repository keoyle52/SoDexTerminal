import { fetchKlines, normalizeSymbol } from './services';
import { evaluateSignals, resolveSignals, createDefaultSignals, type CandleData, type SignalConfig } from './signalEngine';

export interface BacktestTrade {
  time: string;
  side: 'BUY' | 'SELL';
  price: number;
  qty: number;
  pnl?: number;
  reason: string;
}

export interface BacktestResult {
  initialBalance: number;
  finalBalance: number;
  totalReturnPct: number;
  totalReturnUsd: number;
  totalTrades: number;
  winRatePct: number;
  maxDrawdownPct: number;
  equityCurve: { time: number; balance: number }[];
  trades: BacktestTrade[];
}

export async function runBacktest(
  symbol: string,
  market: 'spot' | 'perps',
  botType: 'GRID' | 'DCA' | 'TWAP' | 'MM' | 'SIGNAL',
  params: Record<string, any>,
  budgetUsdt: number
): Promise<BacktestResult> {
  // 1. Fetch historical kline data (e.g. 500 candles of 15m/1h intervals)
  const interval = botType === 'TWAP' || botType === 'DCA' ? '1h' : '15m';
  const limit = 500;
  
  let rawKlines: any[] = [];
  try {
    rawKlines = await fetchKlines(symbol, interval, limit, market, { bypassCache: true }) as any[];
  } catch (err) {
    console.error('Backtest fetchKlines failed, using simulated fallback klines', err);
  }

  // Fallback if network fails
  if (!Array.isArray(rawKlines) || rawKlines.length < 50) {
    let startPrice = 90000;
    rawKlines = [];
    for (let i = 0; i < limit; i++) {
      const noise = (Math.random() - 0.49) * 400;
      const o = startPrice;
      const c = startPrice + noise;
      const h = Math.max(o, c) + Math.random() * 200;
      const l = Math.min(o, c) - Math.random() * 200;
      rawKlines.push({ t: Date.now() - (limit - i) * 600000, o, h, l, c, v: 10 + Math.random() * 20 });
      startPrice = c;
    }
  }

  const klines: CandleData[] = rawKlines.map((raw: any) => {
    const pNum = (v: any) => parseFloat(String(v ?? 0));
    return {
      time: typeof raw.t === 'number' ? raw.t : pNum(raw.t),
      open: pNum(raw.o),
      high: pNum(raw.h),
      low: pNum(raw.l),
      close: pNum(raw.c),
      volume: pNum(raw.v)
    };
  }).filter(k => k.time > 0);

  // Initialize simulation variables
  let balance = budgetUsdt;
  const initialBalance = budgetUsdt;
  let positionSize = 0; // base asset
  let entryPrice = 0;
  let totalReturnUsd = 0;
  let totalReturnPct = 0;
  let maxDrawdownPct = 0;
  let peakBalance = budgetUsdt;
  
  const trades: BacktestTrade[] = [];
  const equityCurve: { time: number; balance: number }[] = [];

  // Helper for tracking trade win/loss
  let winningTrades = 0;
  let closingTradesCount = 0;

  const pushTrade = (side: 'BUY' | 'SELL', price: number, qty: number, reason: string, pnl?: number) => {
    const timeStr = new Date(klines[trades.length + 50]?.time || Date.now()).toLocaleTimeString();
    trades.push({ time: timeStr, side, price, qty, pnl, reason });
    if (pnl !== undefined) {
      closingTradesCount++;
      if (pnl > 0) winningTrades++;
    }
  };

  // 2. Perform tick-by-tick simulation based on botType
  if (botType === 'GRID') {
    const lowerPrice = parseFloat(params.lowerPrice) || (klines[0].close * 0.9);
    const upperPrice = parseFloat(params.upperPrice) || (klines[0].close * 1.1);
    const gridCount = parseInt(params.gridCount) || 10;
    const amountPerGrid = parseFloat(params.amountPerGrid) || (budgetUsdt / gridCount / klines[0].close);
    
    // Generate grid levels
    const levels: number[] = [];
    const step = (upperPrice - lowerPrice) / gridCount;
    for (let i = 0; i <= gridCount; i++) {
      levels.push(lowerPrice + step * i);
    }

    // Grid status tracking
    const activeBuys = new Set<number>();
    const activeSells = new Set<number>();

    // Initial configuration: place buy orders below start price, sell orders above
    const startPrice = klines[0].close;
    levels.forEach(level => {
      if (level < startPrice) activeBuys.add(level);
      else activeSells.add(level);
    });

    for (let i = 1; i < klines.length; i++) {
      const candle = klines[i];
      const prevCandle = klines[i - 1];

      // Check buy orders triggered
      levels.forEach(level => {
        if (activeBuys.has(level) && candle.low <= level) {
          const cost = amountPerGrid * level;
          if (balance >= cost) {
            balance -= cost;
            const prevSize = positionSize;
            const prevEntry = entryPrice;
            positionSize += amountPerGrid;
            entryPrice = (prevEntry * prevSize + level * amountPerGrid) / positionSize;
            
            activeBuys.delete(level);
            activeSells.add(level);
            pushTrade('BUY', level, amountPerGrid, 'Grid Buy Triggered');
          }
        }
      });

      // Check sell orders triggered
      levels.forEach(level => {
        if (activeSells.has(level) && candle.high >= level) {
          if (positionSize >= amountPerGrid) {
            const proceeds = amountPerGrid * level;
            balance += proceeds;
            positionSize -= amountPerGrid;
            
            const tradePnl = (level - entryPrice) * amountPerGrid;
            activeSells.delete(level);
            activeBuys.add(level);
            pushTrade('SELL', level, amountPerGrid, 'Grid Sell Triggered', tradePnl);
          }
        }
      });

      const currentEquity = balance + positionSize * candle.close;
      peakBalance = Math.max(peakBalance, currentEquity);
      const dd = ((peakBalance - currentEquity) / peakBalance) * 100;
      maxDrawdownPct = Math.max(maxDrawdownPct, dd);
      equityCurve.push({ time: candle.time, balance: parseFloat(currentEquity.toFixed(2)) });
    }

  } else if (botType === 'DCA') {
    const amountPerOrder = parseFloat(params.amountPerOrder) || (budgetUsdt * 0.05 / klines[0].close);
    const dipPct = parseFloat(params.dipPct) || 1.5;
    const maxOrders = parseInt(params.maxOrders) || 10;
    const tpPct = parseFloat(params.takeProfitPct) || 1.5;
    const slPct = parseFloat(params.stopLossPct) || 3.0;

    let ordersCount = 0;
    let lastBuyPrice = 0;

    for (let i = 1; i < klines.length; i++) {
      const candle = klines[i];
      const price = candle.close;

      // 1. Check TP/SL triggers first
      if (positionSize > 0) {
        const tpPrice = entryPrice * (1 + tpPct / 100);
        const slPrice = entryPrice * (1 - slPct / 100);

        if (candle.high >= tpPrice) {
          const proceeds = positionSize * tpPrice;
          balance += proceeds;
          const pnl = (tpPrice - entryPrice) * positionSize;
          pushTrade('SELL', tpPrice, positionSize, 'DCA Take Profit Hit', pnl);
          positionSize = 0;
          entryPrice = 0;
          ordersCount = 0;
        } else if (candle.low <= slPrice) {
          const proceeds = positionSize * slPrice;
          balance += proceeds;
          const pnl = (slPrice - entryPrice) * positionSize;
          pushTrade('SELL', slPrice, positionSize, 'DCA Stop Loss Hit', pnl);
          positionSize = 0;
          entryPrice = 0;
          ordersCount = 0;
        }
      }

      // 2. Buy decisions (Initial buy or Buy the Dip)
      if (ordersCount < maxOrders && balance >= amountPerOrder * price) {
        const shouldBuy = positionSize === 0 || (price <= lastBuyPrice * (1 - dipPct / 100));
        if (shouldBuy) {
          balance -= amountPerOrder * price;
          const prevSize = positionSize;
          const prevEntry = entryPrice;
          positionSize += amountPerOrder;
          entryPrice = (prevEntry * prevSize + price * amountPerOrder) / positionSize;
          lastBuyPrice = price;
          ordersCount++;
          pushTrade('BUY', price, amountPerOrder, positionSize === amountPerOrder ? 'DCA Initial Buy' : 'DCA Buy-the-dip');
        }
      }

      const currentEquity = balance + positionSize * price;
      peakBalance = Math.max(peakBalance, currentEquity);
      const dd = ((peakBalance - currentEquity) / peakBalance) * 100;
      maxDrawdownPct = Math.max(maxDrawdownPct, dd);
      equityCurve.push({ time: candle.time, balance: parseFloat(currentEquity.toFixed(2)) });
    }

  } else if (botType === 'TWAP') {
    const slices = parseInt(params.slices) || 10;
    const totalAmount = parseFloat(params.totalAmount) || (budgetUsdt / klines[0].close);
    const sliceQty = totalAmount / slices;
    const sliceInterval = Math.floor(klines.length / slices);

    for (let i = 1; i < klines.length; i++) {
      const candle = klines[i];
      const price = candle.close;

      if (i % sliceInterval === 0 && slices > trades.length && balance >= sliceQty * price) {
        balance -= sliceQty * price;
        const prevSize = positionSize;
        const prevEntry = entryPrice;
        positionSize += sliceQty;
        entryPrice = (prevEntry * prevSize + price * sliceQty) / positionSize;
        pushTrade('BUY', price, sliceQty, `TWAP Slice ${trades.length + 1}/${slices}`);
      }

      const currentEquity = balance + positionSize * price;
      peakBalance = Math.max(peakBalance, currentEquity);
      const dd = ((peakBalance - currentEquity) / peakBalance) * 100;
      maxDrawdownPct = Math.max(maxDrawdownPct, dd);
      equityCurve.push({ time: candle.time, balance: parseFloat(currentEquity.toFixed(2)) });
    }

    // Force sell at the end of TWAP
    if (positionSize > 0) {
      const exitPrice = klines[klines.length - 1].close;
      balance += positionSize * exitPrice;
      const pnl = (exitPrice - entryPrice) * positionSize;
      pushTrade('SELL', exitPrice, positionSize, 'TWAP Complete Exit', pnl);
      positionSize = 0;
    }

  } else if (botType === 'MM') {
    const spreadBps = parseFloat(params.spreadBps) || 5;
    const layers = parseInt(params.layers) || 3;
    const orderSizeUsdt = parseFloat(params.orderSizeUsdt) || (budgetUsdt * 0.1);

    for (let i = 1; i < klines.length; i++) {
      const candle = klines[i];
      const mid = candle.close;
      const spread = (spreadBps / 10000) * mid;

      // Simulated market maker trading:
      // High volatility matches bid/ask layers
      const isUp = candle.close > candle.open;
      const priceRange = candle.high - candle.low;

      for (let layer = 1; layer <= layers; layer++) {
        const bidPrice = mid - spread * layer;
        const askPrice = mid + spread * layer;
        const sizeBase = orderSizeUsdt / mid;

        // If candle low touched our bid
        if (candle.low <= bidPrice && balance >= orderSizeUsdt) {
          balance -= orderSizeUsdt;
          const prevSize = positionSize;
          const prevEntry = entryPrice;
          positionSize += sizeBase;
          entryPrice = (prevEntry * prevSize + bidPrice * sizeBase) / positionSize;
          pushTrade('BUY', bidPrice, sizeBase, `MM Bid Hit (Layer ${layer})`);
        }

        // If candle high touched our ask
        if (candle.high >= askPrice && positionSize >= sizeBase) {
          balance += sizeBase * askPrice;
          positionSize -= sizeBase;
          const pnl = (askPrice - entryPrice) * sizeBase;
          pushTrade('SELL', askPrice, sizeBase, `MM Ask Hit (Layer ${layer})`, pnl);
        }
      }

      const currentEquity = balance + positionSize * mid;
      peakBalance = Math.max(peakBalance, currentEquity);
      const dd = ((peakBalance - currentEquity) / peakBalance) * 100;
      maxDrawdownPct = Math.max(maxDrawdownPct, dd);
      equityCurve.push({ time: candle.time, balance: parseFloat(currentEquity.toFixed(2)) });
    }

  } else if (botType === 'SIGNAL') {
    // Technical Indicator consensus simulation
    const combineMode = params.combineMode || 'ANY';
    const tpPct = parseFloat(params.takeProfitPct) || 1.5;
    const slPct = parseFloat(params.stopLossPct) || 2.0;
    const signalsList = params.signals || createDefaultSignals();

    // Loop through historical data sliding indicators window
    for (let i = 31; i < klines.length; i++) {
      const windowKlines = klines.slice(i - 30, i);
      const candle = klines[i];
      const price = candle.close;

      // 1. Manage TP/SL checks for active position
      if (positionSize > 0) {
        const tpPrice = entryPrice * (1 + tpPct / 100);
        const slPrice = entryPrice * (1 - slPct / 100);

        if (candle.high >= tpPrice) {
          balance += positionSize * tpPrice;
          const pnl = (tpPrice - entryPrice) * positionSize;
          pushTrade('SELL', tpPrice, positionSize, 'Signal Take Profit Hit', pnl);
          positionSize = 0;
          entryPrice = 0;
        } else if (candle.low <= slPrice) {
          balance += positionSize * slPrice;
          const pnl = (slPrice - entryPrice) * positionSize;
          pushTrade('SELL', slPrice, positionSize, 'Signal Stop Loss Hit', pnl);
          positionSize = 0;
          entryPrice = 0;
        }
      }

      // 2. Evaluate Indicators
      const results = evaluateSignals(windowKlines, signalsList);
      const decision = resolveSignals(results, combineMode);

      if (decision.action === 'LONG' && positionSize === 0) {
        const buyAmt = balance * 0.95;
        const buyQty = buyAmt / price;
        balance -= buyAmt;
        positionSize = buyQty;
        entryPrice = price;
        pushTrade('BUY', price, buyQty, `Signal Trigger: ${decision.reasoning}`);
      } else if (decision.action === 'SHORT' && positionSize > 0) {
        // Close position
        balance += positionSize * price;
        const pnl = (price - entryPrice) * positionSize;
        pushTrade('SELL', price, positionSize, `Signal Reverse Trigger: ${decision.reasoning}`, pnl);
        positionSize = 0;
        entryPrice = 0;
      }

      const currentEquity = balance + positionSize * price;
      peakBalance = Math.max(peakBalance, currentEquity);
      const dd = ((peakBalance - currentEquity) / peakBalance) * 100;
      maxDrawdownPct = Math.max(maxDrawdownPct, dd);
      equityCurve.push({ time: candle.time, balance: parseFloat(currentEquity.toFixed(2)) });
    }
  }

  // Calculate final results
  const finalEquity = balance + positionSize * klines[klines.length - 1].close;
  totalReturnUsd = parseFloat((finalEquity - initialBalance).toFixed(2));
  totalReturnPct = parseFloat(((totalReturnUsd / initialBalance) * 100).toFixed(2));
  
  if (equityCurve.length === 0) {
    equityCurve.push({ time: Date.now(), balance: finalEquity });
  }

  const winRatePct = closingTradesCount > 0 ? parseFloat(((winningTrades / closingTradesCount) * 100).toFixed(1)) : 0;

  return {
    initialBalance,
    finalBalance: parseFloat(finalEquity.toFixed(2)),
    totalReturnPct,
    totalReturnUsd,
    totalTrades: trades.length,
    winRatePct,
    maxDrawdownPct: parseFloat(maxDrawdownPct.toFixed(2)),
    equityCurve,
    trades
  };
}
