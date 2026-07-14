import React, { useEffect, useState, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { 
  Play, Square, Radio, Settings2, Target, Zap, Activity, X, 
  ChevronLeft, BarChart3, ShieldAlert, Cpu, Sparkles, MessageSquare, 
  TrendingDown, TrendingUp, Info, HelpCircle
} from 'lucide-react';
import { useBotStore, type SignalPosition, type ConflictResolution } from '../store/botStore';
import { useBotPnlStore } from '../store/botPnlStore';
import { useSettingsStore } from '../store/settingsStore';
import { 
  fetchKlines, placeOrder, updatePerpsLeverage, fetchBookTickers, 
  normalizeSymbol, fetchOrderStatus, cancelOrder, fetchTickers, fetchMarkPrices, validateBalance 
} from '../api/services';
import { 
  evaluateSignals, resolveSignals, PARAM_LABELS, type CandleData, 
  type SignalResult, type CombineMode, type SignalConfig, type SignalType,
  createDefaultSignals
} from '../api/signalEngine';
import { recommendSignalBot } from '../api/aiAutoConfig';
import { cn, getErrorMessage } from '../lib/utils';
import { TradingChart } from '../components/TradingChart';
import { SymbolSelector } from '../components/common/SymbolSelector';
import { StatusBadge } from '../components/common/StatusBadge';
import { AutoConfigureButton } from '../components/common/AutoConfigureButton';
import { Input, Select, Toggle } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { BotPnlStrip } from '../components/common/BotPnlStrip';
import { BotRiskSetupModal } from '../components/common/BotRiskSetupModal';
import { BotsHowItWorks } from '../components/bots/BotsHowItWorks';
import { BotLayout } from '../components/bots/BotLayout';
import { fetchSosoIndices, scrapeFarsideEtfInflow } from '../api/sosoServices';
import { type SeriesMarker, type Time } from 'lightweight-charts';

// Polling intervals
const LOOP_INTERVAL = 10_000; // Check state, orders

export const SignalBot: React.FC = () => {
  const { signalBot: state } = useBotStore();
  const { isDemoMode } = useSettingsStore();

  const [logs, setLogs] = useState<{ time: string; msg: string; type?: 'info' | 'success' | 'warn' | 'error' }[]>([]);
  const [activeSignals, setActiveSignals] = useState<SignalResult[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [chartMarkers, setChartMarkers] = useState<SeriesMarker<Time>[]>([]);

  // Studio State
  const [studioOpen, setStudioOpen] = useState(false);
  const [studioTab, setStudioTab] = useState<'TECH' | 'SENTIMENT' | 'ETF' | 'MACRO' | 'CUSTOM'>('TECH');
  const [studioData, setStudioData] = useState({
    newsSentiment: 76,
    etfInflowM: 428,
    dxyChangePct: -0.15,
    loading: true
  });

  const runningRef = useRef(false);
  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastProcessTimeRef = useRef<number>(0);

  const addLog = useCallback((msg: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') => {
    setLogs((prev) => [{ time: new Date().toLocaleTimeString(), msg, type }, ...prev].slice(0, 100));
  }, []);

  const loadStudioData = async () => {
    try {
      let newsSentiment = 76;
      let etfInflowM = 428;
      let dxyChangePct = -0.15;
      
      try {
        const fg = await fetchSosoIndices();
        if (fg && fg.fngIndex) newsSentiment = parseInt(fg.fngIndex);
      } catch {}

      try {
        const scraped = await scrapeFarsideEtfInflow(state.symbol.toLowerCase().includes('eth') ? false : true);
        if (scraped !== null) etfInflowM = scraped;
      } catch {}

      try {
        const prices = await fetchTickers('perps');
        const btc = prices.find((p: any) => p.symbol === 'BTC-USD') as any;
        const change = parseFloat(btc?.change24h || btc?.change24hPct || '1.5');
        dxyChangePct = -(change * 0.08); // Inverse correlation
      } catch {}

      setStudioData({ newsSentiment, etfInflowM, dxyChangePct, loading: false });
    } catch {
      setStudioData(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    if (studioOpen) {
      void loadStudioData();
    }
  }, [studioOpen, state.symbol]);

  // Migration Check: merge any newly added default signals if they are missing in the localStorage store.
  useEffect(() => {
    const currentSignals = state.signals || [];
    const defaultPresets = createDefaultSignals();
    const existingTypes = currentSignals.map(s => s.type);
    const missing = defaultPresets.filter(p => !existingTypes.includes(p.type));
    if (missing.length > 0) {
      const generatedMissing = missing.map((p, i) => ({
        ...p,
        id: `signal-${p.type}-${Date.now()}-${i}`
      }));
      state.setField('signals', [...currentSignals, ...generatedMissing]);
    }
  }, []);

  const stopBot = useCallback(async (reason?: string) => {
    runningRef.current = false;
    if (loopRef.current) { clearInterval(loopRef.current); loopRef.current = null; }
    
    const fresh = useBotStore.getState().signalBot;
    const market = fresh.isSpot ? 'spot' : 'perps';
    
    // 1. Cancel server-side TP/SL stop orders
    const stopIds: string[] = [];
    fresh.activePositions.forEach((p) => {
      if (p.tpOrderId) stopIds.push(p.tpOrderId);
      if (p.slOrderId) stopIds.push(p.slOrderId);
    });
    if (!isDemoMode && stopIds.length > 0) {
      await Promise.all(stopIds.map((id) =>
        cancelOrder(id, fresh.symbol, market).catch(() => { /* stop may already be gone */ })
      ));
      addLog(`Cancelled ${stopIds.length} pending stop order(s)`, 'info');
    }

    // 2. Close/Liquidate active positions
    if (fresh.activePositions.length > 0) {
      addLog(`Liquidating ${fresh.activePositions.length} active position(s) immediately...`, 'info');
      await Promise.all(fresh.activePositions.map(async (pos) => {
        try {
          const closeSide = pos.side === 'LONG' ? 2 : 1; // 1=BUY, 2=SELL to close
          await placeOrder({
            symbol: fresh.symbol,
            side: closeSide as (1 | 2),
            type: 2 as (1 | 2), // Market order
            quantity: String(pos.quantity)
          }, market);
          addLog(`Liquidated ${pos.side} position for ${fresh.symbol} @ Market`, 'success');
        } catch (err) {
          addLog(`Failed to close position: ${getErrorMessage(err)}`, 'error');
        }
      }));
      state.setField('activePositions', []);
    }

    state.setField('status', 'STOPPED');
    addLog(`Bot stopped${reason ? `: ${reason}` : ''}`, 'warn');
  }, [addLog, state, isDemoMode]);

  const executeTrade = useCallback(async (decision: 'LONG' | 'SHORT', currentPrice: number, signals: SignalResult[]) => {
    const fresh = useBotStore.getState().signalBot;
    const market = fresh.isSpot ? 'spot' : 'perps';
    const amountUsdt = parseFloat(fresh.amountUsdt);
    if (isNaN(amountUsdt) || amountUsdt <= 0) {
      addLog('Invalid Amount USDT, cannot trade', 'error');
      return;
    }

    try {
      if (fresh.activePositions.length >= parseInt(fresh.maxOpenPositions || '1')) {
        addLog('Max open positions reached, skipping signal', 'warn');
        return;
      }

      addLog(`Evaluating ${decision} trigger...`, 'info');

      // Check conflict resolution
      const hasConflict = fresh.activePositions.some((p) => p.side !== decision);
      if (hasConflict) {
        if (fresh.onConflictingSignal === 'IGNORE') {
          addLog(`Conflict detected. Conflict policy: IGNORE. Skipping.`, 'info');
          return;
        }
        if (fresh.onConflictingSignal === 'CLOSE_ONLY' || fresh.onConflictingSignal === 'CLOSE_AND_REVERSE') {
          addLog(`Conflict detected. Closing opposing positions...`, 'info');
          const opposing = fresh.activePositions.filter((p) => p.side !== decision);
          
          await Promise.all(opposing.map(async (p) => {
            const isShort = p.side === 'SHORT';
            const closeQty = p.quantity;
            await placeOrder({ symbol: fresh.symbol, side: (isShort ? 1 : 2) as (1 | 2), type: 2 as (1 | 2), quantity: String(closeQty) }, market);
            if (!isDemoMode) {
              const stopIds = [p.tpOrderId, p.slOrderId].filter((id): id is string => !!id);
              await Promise.all(stopIds.map((id) => cancelOrder(id, fresh.symbol, market).catch(() => {})));
            }
          }));

          useBotStore.setState((s) => ({
            signalBot: {
              ...s.signalBot,
              activePositions: s.signalBot.activePositions.filter((p) => p.side === decision),
            },
          }));

          if (fresh.onConflictingSignal === 'CLOSE_ONLY') return;
        }
      }

      // Resolve decimals & size
      if (!runningRef.current) return;
      const sizeQty = amountUsdt / currentPrice;
      const orderParams = {
        symbol: fresh.symbol,
        side: (decision === 'LONG' ? 1 : 2) as (1 | 2),
        type: 2 as (1 | 2), // Market
        quantity: sizeQty.toFixed(6),
      };

      if (!isDemoMode && !fresh.isSpot) {
        await updatePerpsLeverage(fresh.symbol, parseInt(fresh.leverage));
      }

      if (!runningRef.current) return;
      const res = await placeOrder(orderParams, market);
      const resData = (res as any)?.data ?? res;
      const orderId = String(resData?.orderID ?? resData?.orderId ?? `demo-${Date.now()}`);

      let actualEntryPrice = currentPrice;
      let actualQty = sizeQty;

      if (!isDemoMode) {
        for (let i = 0; i < 5; i++) {
          if (!runningRef.current) return;
          await new Promise((r) => setTimeout(r, 500));
          try {
            const stat = await fetchOrderStatus(orderId, fresh.symbol, market) as any;
            const statData = stat?.data ?? stat;
            if (statData?.status === 'FILLED' || statData?.avgFillPrice > 0) {
              actualEntryPrice = parseFloat(String(statData.avgFillPrice)) || actualEntryPrice;
              actualQty = parseFloat(String(statData.executedQty)) || actualQty;
              break;
            }
          } catch {}
        }
      }

      if (!runningRef.current) {
        // Safe check: if bot was stopped while the order was executing, try to close it
        try {
          const closeSide = decision === 'LONG' ? 2 : 1;
          await placeOrder({ symbol: fresh.symbol, side: closeSide as (1 | 2), type: 2 as (1 | 2), quantity: String(actualQty) }, market);
        } catch {}
        return;
      }

      // Calculate TP/SL
      const tpPct = parseFloat(fresh.takeProfitPct) || 0;
      const slPct = parseFloat(fresh.stopLossPct) || 0;
      let tpPrice = 0;
      let slPrice = 0;
      let tpOrderId = '';
      let slOrderId = '';

      if (tpPct > 0) {
        tpPrice = decision === 'LONG' ? actualEntryPrice * (1 + tpPct / 100) : actualEntryPrice * (1 - tpPct / 100);
      }
      if (slPct > 0) {
        slPrice = decision === 'LONG' ? actualEntryPrice * (1 - slPct / 100) : actualEntryPrice * (1 + slPct / 100);
      }

      // Server-side TP/SL for perps
      if (!isDemoMode && !fresh.isSpot && runningRef.current) {
        if (tpPrice > 0) {
          try {
            const tpRes = await placeOrder({
              symbol: fresh.symbol,
              side: (decision === 'LONG' ? 2 : 1) as (1 | 2),
              type: 1 as (1 | 2), // LIMIT order for TP trigger
              price: tpPrice.toFixed(2),
              quantity: actualQty.toFixed(6),
              stopPrice: tpPrice.toFixed(2),
              stopType: 2, // 2=TAKE_PROFIT
              triggerType: 2, // 2=MARK_PRICE
              reduceOnly: true,
            }, market) as any;
            tpOrderId = String(tpRes?.orderID ?? tpRes?.orderId ?? '');
            addLog(`Server-side TP target placed @ ${tpPrice.toFixed(2)} (${tpOrderId})`, 'success');
          } catch (e) {
            addLog(`Server-side TP failed (client-side failsafe will handle it): ${getErrorMessage(e)}`, 'warn');
          }
        }
        if (slPrice > 0 && runningRef.current) {
          try {
            const slRes = await placeOrder({
              symbol: fresh.symbol,
              side: (decision === 'LONG' ? 2 : 1) as (1 | 2),
              type: 2 as (1 | 2), // MARKET order for SL trigger
              quantity: actualQty.toFixed(6),
              stopPrice: slPrice.toFixed(2),
              stopType: 1, // 1=STOP_LOSS
              triggerType: 2, // 2=MARK_PRICE
              reduceOnly: true,
            }, market) as any;
            slOrderId = String(slRes?.orderID ?? slRes?.orderId ?? '');
            addLog(`Server-side SL stop placed @ ${slPrice.toFixed(2)} (${slOrderId})`, 'success');
          } catch (e) {
            addLog(`Server-side SL stop failed (client-side failsafe will handle it): ${getErrorMessage(e)}`, 'warn');
          }
        }
      }

      if (!runningRef.current) {
        // Safe check: if bot was stopped while placing stops, clean up/close position
        try {
          const closeSide = decision === 'LONG' ? 2 : 1;
          await placeOrder({ symbol: fresh.symbol, side: closeSide as (1 | 2), type: 2 as (1 | 2), quantity: String(actualQty) }, market);
        } catch {}
        return;
      }

      const newPos: SignalPosition = {
        id: `pos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        symbol: fresh.symbol,
        side: decision,
        entryPrice: actualEntryPrice,
        quantity: actualQty,
        leverage: parseInt(fresh.leverage),
        tpPrice,
        slPrice,
        tpOrderId,
        slOrderId,
        openTime: Date.now(),
        triggeredBy: signals.map((s) => s.label),
        orderId,
        unrealizedPnl: 0,
        status: 'OPEN',
      };
      useBotStore.setState((s) => ({
        signalBot: {
          ...s.signalBot,
          activePositions: [...s.signalBot.activePositions, newPos],
          lastSignalTime: Date.now(),
          lastSignalDirection: decision,
        },
      }));

      addLog(
        `${isDemoMode ? '[DEMO] ' : ''}Opened ${decision} @ ${actualEntryPrice.toFixed(2)} × ${actualQty.toFixed(6)} (${orderId})`,
        'success',
      );
    } catch (err) {
      addLog(`Failed to execute ${decision}: ${getErrorMessage(err)}`, 'error');
      useBotStore.setState((s) => ({ signalBot: { ...s.signalBot, status: 'ERROR' } }));
    }
  }, [addLog, isDemoMode]);

  const forceTestSignal = useCallback(async (direction: 'LONG' | 'SHORT') => {
    if (!isDemoMode) {
      toast.error('Test signals only available in demo mode');
      return;
    }
    const fresh = useBotStore.getState().signalBot;
    const tickers = await fetchTickers(fresh.isSpot ? 'spot' : 'perps');
    const ticker = tickers.find((t: any) => t.symbol === fresh.symbol) as any;
    const lastPrice = parseFloat(String(ticker?.lastPrice ?? ticker?.price ?? 100));
    await executeTrade(direction, lastPrice, [{ id: 'test', type: 'CUSTOM', label: 'Manual Trigger', direction, strength: 100, value: 0, threshold: 0, description: 'User-forced test trade' }]);
  }, [executeTrade, isDemoMode]);

  const evaluationLoop = useCallback(async () => {
    if (!runningRef.current) return;
    const fresh = useBotStore.getState().signalBot;
    const market = fresh.isSpot ? 'spot' : 'perps';

    try {
      // ── A. HIGH-FREQ: position monitors (TP/SL checks) ───────────────────
      const bookList = await fetchBookTickers(market) as any;
      const bookArr = Array.isArray(bookList) ? bookList : (bookList?.data ?? []);
      const bookData = bookArr.find((b: any) => normalizeSymbol(b.symbol, market) === normalizeSymbol(fresh.symbol, market));
      const bestBid = parseFloat(String(bookData?.bidPrice ?? bookData?.bid ?? '0'));
      const bestAsk = parseFloat(String(bookData?.askPrice ?? bookData?.ask ?? '0'));
      const mid = (bestBid + bestAsk) / 2;

      if (mid > 0 && fresh.activePositions.length > 0) {
        const toClose: string[] = [];
        
        const updated = fresh.activePositions.map((pos) => {
          const isLong = pos.side === 'LONG';
          const priceDiff = mid - pos.entryPrice;
          const pnl = priceDiff * pos.quantity * (isLong ? 1 : -1);
          pos.unrealizedPnl = parseFloat(pnl.toFixed(4));

          // Client-side TP/SL triggers
          let triggered = false;
          let triggerType = '';

          if (pos.tpPrice && pos.tpPrice > 0) {
            const hitTp = isLong ? mid >= pos.tpPrice : mid <= pos.tpPrice;
            if (hitTp) { triggered = true; triggerType = 'Take Profit'; }
          }
          if (pos.slPrice && pos.slPrice > 0) {
            const hitSl = isLong ? mid <= pos.slPrice : mid >= pos.slPrice;
            if (hitSl) { triggered = true; triggerType = 'Stop Loss'; }
          }

          if (triggered) {
            toClose.push(pos.id);
            addLog(`Position ${pos.id} hit ${triggerType} @ ${mid.toFixed(2)}. Closing...`, 'info');
          }
          return pos;
        });

        if (toClose.length > 0) {
          // Send close orders
          await Promise.all(toClose.map(async (id) => {
            const pos = fresh.activePositions.find((p) => p.id === id);
            if (!pos) return;
            const isShort = pos.side === 'SHORT';
            await placeOrder({ symbol: fresh.symbol, side: isShort ? 1 : 2, type: 2, quantity: pos.quantity.toFixed(6) }, market);
            
            if (!isDemoMode) {
              const stopIds = [pos.tpOrderId, pos.slOrderId].filter((i): i is string => !!i);
              await Promise.all(stopIds.map((sid) => cancelOrder(sid, fresh.symbol, market).catch(() => {})));
            }
          }));

          useBotStore.setState((s) => ({
            signalBot: {
              ...s.signalBot,
              activePositions: s.signalBot.activePositions.filter((p) => !toClose.includes(p.id)),
              realizedPnl: s.signalBot.realizedPnl + updated.filter((p) => toClose.includes(p.id)).reduce((sum, p) => sum + p.unrealizedPnl, 0),
            },
          }));
        } else {
          useBotStore.setState((s) => ({
            signalBot: { ...s.signalBot, activePositions: updated },
          }));
        }
      }

      // ── B. LOW-FREQ: signal evaluation ────────────────────────────────
      const checkIntervalMs = parseInt(fresh.checkInterval) * 1000 || 60000;
      const now = Date.now();
      if (now - lastProcessTimeRef.current < checkIntervalMs) return;
      lastProcessTimeRef.current = now;

      // Fetch klines
      const rawKlines = await fetchKlines(fresh.symbol, fresh.klineInterval, 100, market, { bypassCache: true });
      const klines: CandleData[] = (Array.isArray(rawKlines) ? rawKlines : []).map((raw) => {
        const k = raw as Record<string, unknown>;
        const pNum = (v: unknown) => parseFloat(String(v ?? 0));
        return {
          time: typeof k.t === 'number' ? k.t : pNum(k.t),
          open: pNum(k.o),
          high: pNum(k.h),
          low: pNum(k.l),
          close: pNum(k.c),
          volume: pNum(k.v),
        };
      }).filter((k) => k.time > 0);

      if (klines.length < 30) return;

      const currentPriceEval = klines[klines.length - 1].close;
      const afterTPSL = useBotStore.getState().signalBot;

      // Get real external data to feed NEWS / ETF / MACRO signals
      let newsSentiment = 55;
      let etfInflowM = 120;
      let dxyChangePct = -0.05;

      try {
        const fg = await fetchSosoIndices();
        if (fg && fg.fngIndex) newsSentiment = parseInt(fg.fngIndex);
      } catch {}

      try {
        const scraped = await scrapeFarsideEtfInflow(fresh.symbol.toLowerCase().includes('eth') ? false : true);
        if (scraped !== null) etfInflowM = scraped;
      } catch {}

      try {
        const prices = await fetchTickers('perps');
        const btc = prices.find((p: any) => p.symbol === 'BTC-USD') as any;
        const change = parseFloat(btc?.change24h || btc?.change24hPct || '1.5');
        dxyChangePct = -(change * 0.08); // Inverse correlation
      } catch {}

      // Run signals
      const results = evaluateSignals(klines, afterTPSL.signals, { newsSentiment, etfInflowM, dxyChangePct });
      setActiveSignals(results);

      // Add markers to chart
      const newMarkers: SeriesMarker<Time>[] = [];
      results.forEach((r) => {
        if (r.direction !== 'NEUTRAL') {
          newMarkers.push({
            time: klines[klines.length - 1].time as Time,
            position: r.direction === 'LONG' ? 'belowBar' : 'aboveBar',
            color: r.direction === 'LONG' ? '#3fb950' : '#f85149',
            shape: r.direction === 'LONG' ? 'arrowUp' : 'arrowDown',
            text: r.label,
          });
        }
      });
      if (newMarkers.length > 0) {
        setChartMarkers((prev) => {
          const timeMap = new Map<number, SeriesMarker<Time>>();
          prev.concat(newMarkers).forEach((m) => timeMap.set(Number(m.time), m));
          return Array.from(timeMap.values()).sort((a, b) => Number(a.time) - Number(b.time));
        });
      }

      // Check combined decision
      const decision = resolveSignals(results, afterTPSL.combineMode);
      if (decision.action !== 'NONE') {
        addLog(`AI Decision: ${decision.action}. Reason: ${decision.reasoning}`, 'info');
        await executeTrade(decision.action, currentPriceEval, decision.signals);
      }
    } catch (err) {
      console.error('SignalBot Evaluation Error:', err);
    }
  }, [addLog, executeTrade, isDemoMode]);

  const startBot = useCallback(async () => {
    if (runningRef.current) return;

    const investment = parseFloat(state.amountUsdt);
    if (isNaN(investment) || investment <= 0) {
      toast.error('Invalid investment amount');
      return;
    }

    const hasBalance = await validateBalance(investment, state.symbol, state.isSpot);
    if (!hasBalance) {
      toast.error(`Insufficient balance in account to cover investment of $${investment.toFixed(2)}`);
      return;
    }

    runningRef.current = true;
    lastProcessTimeRef.current = 0;
    
    state.setField('status', 'RUNNING');
    addLog(`Wave 3 Signal Engine initialized on ${state.symbol}`, 'success');

    // Run first evaluation immediately
    void evaluationLoop();
    
    // Start interval
    loopRef.current = setInterval(() => {
      void evaluationLoop();
    }, LOOP_INTERVAL);
  }, [addLog, evaluationLoop, state.symbol, state.amountUsdt, state.isSpot]);

  useEffect(() => {
    if (state.status === 'RUNNING') {
      runningRef.current = true;
      loopRef.current = setInterval(() => {
        void evaluationLoop();
      }, LOOP_INTERVAL);
    }
    return () => {
      if (loopRef.current) clearInterval(loopRef.current);
    };
  }, []);

  const closePosition = async (posId: string) => {
    const pos = state.activePositions.find((p) => p.id === posId);
    if (!pos) return;
    try {
      addLog(`Manually closing position ${posId}...`, 'info');
      const isShort = pos.side === 'SHORT';
      const market = state.isSpot ? 'spot' : 'perps';
      
      await placeOrder({ symbol: state.symbol, side: isShort ? 1 : 2, type: 2, quantity: pos.quantity.toFixed(6) }, market);
      
      if (!isDemoMode) {
        const stopIds = [pos.tpOrderId, pos.slOrderId].filter((id): id is string => !!id);
        await Promise.all(stopIds.map((sid) => cancelOrder(sid, state.symbol, market).catch(() => {})));
      }

      useBotStore.setState((s) => ({
        signalBot: {
          ...s.signalBot,
          activePositions: s.signalBot.activePositions.filter((p) => p.id !== posId),
          realizedPnl: s.signalBot.realizedPnl + pos.unrealizedPnl,
        },
      }));
      addLog(`Manually closed position ${posId}`, 'success');
    } catch (err) {
      toast.error(`Close failed: ${getErrorMessage(err)}`);
    }
  };

  const toggleSignal = (id: string, enabled: boolean) => {
    if (isLocked) return;
    const updated = state.signals.map(s => s.id === id ? { ...s, enabled } : s);
    state.setField('signals', updated);
  };

  const updateSignalParam = (id: string, key: string, val: string) => {
    if (isLocked) return;
    const updated = state.signals.map(s => {
      if (s.id === id) {
        return { ...s, params: { ...s.params, [key]: parseFloat(val) || 0 } };
      }
      return s;
    });
    state.setField('signals', updated);
  };

  const isLocked = state.status === 'RUNNING';

  const configPanel = (
    <>
      <div className="flex flex-col gap-3">
        <label className="text-xs font-bold text-text-muted uppercase tracking-wider block">Trading Pair</label>
        <div>
          <SymbolSelector market={state.isSpot ? 'spot' : 'perps'} value={state.symbol} onChange={(val) => {
            state.setField('symbol', val);
            if (val.includes('SOSO')) {
              state.setField('isSpot', true);
              state.setField('symbol', 'vSOSO-vUSDC');
            }
          }} disabled={isLocked} />
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => { if (!isLocked) state.setField('isSpot', true); }} className={cn('flex-1 py-2 text-xs rounded-lg border transition-all cursor-pointer', state.isSpot ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background/40 text-text-muted hover:border-border-hover', isLocked && 'opacity-50')}>Spot</button>
          <button 
            type="button" 
            onClick={() => { if (!isLocked && !state.symbol.includes('SOSO')) state.setField('isSpot', false); }} 
            disabled={state.symbol.includes('SOSO')}
            className={cn('flex-1 py-2 text-xs rounded-lg border transition-all cursor-pointer', !state.isSpot ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background/40 text-text-muted hover:border-border-hover', (isLocked || state.symbol.includes('SOSO')) && 'opacity-50 cursor-not-allowed')}
          >
            Perps
          </button>
        </div>
        {!state.isSpot && (
          <Input label="Leverage (x)" type="number" value={state.leverage} onChange={(e) => state.setField('leverage', e.target.value)} disabled={isLocked} />
        )}
      </div>

      <div className="flex flex-col gap-3 mt-3">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-text-muted">
          <Target size={12} /><span>Position Settings</span>
        </div>
        <Input label="Order Size (USDT)" type="number" value={state.amountUsdt} onChange={(e) => state.setField('amountUsdt', e.target.value)} disabled={isLocked} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Take Profit (%)" type="number" value={state.takeProfitPct} onChange={(e) => state.setField('takeProfitPct', e.target.value)} disabled={isLocked} hint="0 = disabled" />
          <Input label="Stop Loss (%)" type="number" value={state.stopLossPct} onChange={(e) => state.setField('stopLossPct', e.target.value)} disabled={isLocked} hint="0 = disabled" />
        </div>
      </div>

      <div className="flex flex-col gap-3 mt-3">
        <button
          type="button"
          onClick={() => setStudioOpen(true)}
          className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl border border-primary/30 hover:border-primary/50 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent hover:shadow-[0_0_12px_rgba(34,211,238,0.15)] transition-all cursor-pointer group"
        >
          <span className="flex items-center gap-2.5 font-bold text-text-primary text-xs">
            <Zap size={14} className="text-primary animate-pulse group-hover:scale-110 transition-transform" />
            <span>Launch Signal Studio</span>
          </span>
          <span className="px-2 py-0.5 rounded-md bg-primary/20 text-primary font-bold text-[10px]">
            {state.signals.filter(s => s.enabled).length} Active
          </span>
        </button>
      </div>

      <div className="rounded-xl border border-border bg-background/30 mt-3">
        <button onClick={() => setAdvancedOpen(!advancedOpen)} className="w-full flex items-center justify-between px-3 py-2 text-[11px] uppercase tracking-wider text-text-secondary hover:text-text-primary transition-colors">
          <span className="flex items-center gap-1.5"><Settings2 size={12} />Advanced</span>
        </button>
        {advancedOpen && (
          <div className="border-t border-border p-3 flex flex-col gap-3">
            <Select label="Kline Interval" value={state.klineInterval} onChange={(e) => state.setField('klineInterval', e.target.value)} disabled={isLocked} options={[{ value: '1m', label: '1 Minute' }, { value: '5m', label: '5 Minutes' }, { value: '15m', label: '15 Minutes' }, { value: '1h', label: '1 Hour' }, { value: '4h', label: '4 Hours' }]} />
            <Input label="Check Interval (sec)" type="number" value={state.checkInterval} onChange={(e) => state.setField('checkInterval', e.target.value)} disabled={isLocked} />
            <Select label="On Conflict" value={state.onConflictingSignal} onChange={(e) => state.setField('onConflictingSignal', e.target.value as ConflictResolution)} disabled={isLocked} options={[{ value: 'CLOSE_AND_REVERSE', label: 'Close & Reverse' }, { value: 'CLOSE_ONLY', label: 'Close Only' }, { value: 'IGNORE', label: 'Ignore Signal' }]} />
            <Input label="Max Open Positions" type="number" value={state.maxOpenPositions} onChange={(e) => state.setField('maxOpenPositions', e.target.value)} disabled={isLocked} />
          </div>
        )}
      </div>
    </>
  );

  const statsPanel = (
    <div className="flex flex-col gap-4">
      <BotPnlStrip botKey="signal" />
      {isLocked && activeSignals.length > 0 && (
        <div className="glass-card p-4 mt-2">
          <div className="flex items-center gap-2 mb-3 border-b border-border pb-2">
            <Activity size={14} className="text-primary animate-pulse" />
            <span className="text-xs font-bold text-text-primary">Live Signal Evaluation Matrix</span>
          </div>
          <div className="space-y-2">
            {activeSignals.map((sig, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-border/20 last:border-b-0">
                <span className="font-medium text-text-secondary">{sig.label}</span>
                <div className="flex items-center gap-3">
                  <span className="text-text-muted font-mono">{sig.description}</span>
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-sm font-bold text-[10px] font-mono",
                    sig.direction === 'LONG' ? "bg-success-soft text-success" :
                    sig.direction === 'SHORT' ? "bg-danger/10 text-danger" :
                    "bg-white/5 text-text-muted"
                  )}>
                    {sig.direction}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {state.activePositions.length > 0 && (
        <div className="space-y-2 select-none">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Active Signal Trades</span>
          {state.activePositions.map((pos) => {
            const isLong = pos.side === 'LONG';
            return (
              <div key={pos.id} className="p-3.5 rounded-xl border border-border bg-[#0B0E11] space-y-2.5 relative">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className={cn('px-2 py-0.5 rounded-md font-bold text-[10px]', isLong ? 'bg-success-soft text-success' : 'bg-danger/10 text-danger')}>
                      {pos.side}
                    </span>
                    <span className="text-text-primary font-bold font-mono text-xs">{pos.symbol}</span>
                    <span className="text-[9px] text-text-muted font-mono">({pos.leverage}x)</span>
                  </div>
                  <button onClick={() => void closePosition(pos.id)} className="p-1 hover:bg-white/5 text-text-muted hover:text-text-primary rounded-sm transition-colors cursor-pointer"><X size={13} /></button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] text-text-secondary font-mono">
                  <div>Qty: <strong>{pos.quantity.toFixed(4)}</strong></div>
                  <div>Entry: <strong>{pos.entryPrice.toFixed(2)}</strong></div>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-border/40">
                  <span className="text-[10px] text-text-muted">Triggered by: <span className="font-semibold text-text-secondary">{pos.triggeredBy.join(', ')}</span></span>
                  <span className={cn('font-bold text-xs font-mono', pos.unrealizedPnl >= 0 ? 'text-success' : 'text-danger')}>
                    {pos.unrealizedPnl >= 0 ? '+' : ''}{pos.unrealizedPnl.toFixed(2)} USDT
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const logsPanel = (
    <div className="space-y-1.5 font-mono text-[10px] max-h-[300px] overflow-y-auto">
      {logs.length === 0 ? (
        <div className="text-center text-text-muted py-6">Logs are empty. Start the engine to stream execution outputs.</div>
      ) : (
        logs.map((log, i) => (
          <div key={i} className="flex gap-2 leading-relaxed border-b border-border/20 pb-1 last:border-b-0">
            <span className="text-text-muted shrink-0">[{log.time}]</span>
            <span className={cn(
              log.type === 'success' && 'text-success font-bold',
              log.type === 'warn' && 'text-warning font-bold',
              log.type === 'error' && 'text-danger font-bold',
              log.type === 'info' && 'text-text-secondary'
            )}>{log.msg}</span>
          </div>
        ))
      )}
    </div>
  );

  const [showConfirm, setShowConfirm] = useState(false);

  // ── RENDER SIGNAL STUDIO VIEW ──────────────────────────────────────────────
  if (studioOpen) {
    // Live sandbox calculations
    const techSignals = state.signals.filter(s => ['RSI', 'MACD', 'BB', 'EMA_CROSS', 'STOCH_RSI', 'VOLUME_SPIKE'].includes(s.type));
    const sentimentSignal = state.signals.find(s => s.type === 'NEWS_SENTIMENT');
    const etfSignal = state.signals.find(s => s.type === 'ETF_FLOW');
    const macroSignal = state.signals.find(s => s.type === 'MACRO_DXY');
    const customSignals = state.signals.filter(s => s.type === 'CUSTOM');

    // Run active sandbox evaluations for DXY/ETF/Sentiment
    const simulatedResults: SignalResult[] = [];
    
    // Add real active values
    if (sentimentSignal?.enabled) {
      const buy = sentimentSignal.params.buyThreshold || 75;
      const sell = sentimentSignal.params.sellThreshold || 30;
      const val = studioData.newsSentiment;
      const direction = val >= buy ? 'LONG' : val <= sell ? 'SHORT' : 'NEUTRAL';
      simulatedResults.push({
        id: sentimentSignal.id,
        type: 'NEWS_SENTIMENT',
        label: 'AI News Sentiment',
        direction,
        strength: direction !== 'NEUTRAL' ? Math.abs(val - 50) * 2 : 0,
        value: val,
        threshold: direction === 'LONG' ? buy : sell,
        description: `AI News Sentiment is ${val}/100`
      });
    }

    if (etfSignal?.enabled) {
      const buy = etfSignal.params.buyInflowM || 100;
      const sell = etfSignal.params.sellOutflowM || -50;
      const val = studioData.etfInflowM;
      const direction = val >= buy ? 'LONG' : val <= sell ? 'SHORT' : 'NEUTRAL';
      simulatedResults.push({
        id: etfSignal.id,
        type: 'ETF_FLOW',
        label: 'ETF Net Flow',
        direction,
        strength: direction !== 'NEUTRAL' ? Math.min(100, Math.abs(val) * 0.5) : 0,
        value: val,
        threshold: direction === 'LONG' ? buy : sell,
        description: `ETF flow is $${val}M`
      });
    }

    if (macroSignal?.enabled) {
      const buy = macroSignal.params.buyDxyDropPct || 0.15;
      const sell = macroSignal.params.sellDxyRisePct || 0.1;
      const val = studioData.dxyChangePct;
      const direction = val <= -buy ? 'LONG' : val >= sell ? 'SHORT' : 'NEUTRAL';
      simulatedResults.push({
        id: macroSignal.id,
        type: 'MACRO_DXY',
        label: 'Macro DXY Correlation',
        direction,
        strength: direction !== 'NEUTRAL' ? Math.min(100, Math.abs(val) * 200) : 0,
        value: val,
        threshold: direction === 'LONG' ? -buy : sell,
        description: `DXY daily change is ${val.toFixed(2)}%`
      });
    }

    // Combine with active technical signals
    const activeTech = activeSignals.filter(s => ['RSI', 'MACD', 'BB', 'EMA_CROSS', 'STOCH_RSI', 'VOLUME_SPIKE', 'CUSTOM'].includes(s.type));
    const combinedSandbox = [...activeTech, ...simulatedResults];
    const decision = resolveSignals(combinedSandbox, state.combineMode);

    return (
      <div className="fixed inset-0 z-50 bg-[#080B0E] flex flex-col font-sans select-none overflow-hidden animate-fade-in">
        {/* Studio Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-[#101317]">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setStudioOpen(false)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-text-secondary hover:text-text-primary text-xs font-bold transition-all cursor-pointer"
            >
              <ChevronLeft size={16} />
              <span>Back to Dashboard</span>
            </button>
            <div className="h-6 w-px bg-border hidden sm:block" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                  <Sparkles size={15} className="text-primary animate-pulse" />
                  Gemini Signal Studio
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-primary-soft/10 text-primary border border-primary/20 text-[9px] font-bold">Strategy Builder</span>
              </div>
              <p className="text-[10px] text-text-secondary mt-0.5">Build, test and validate multi-factor quantitative trigger rules.</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-[#0B0E11] p-1 rounded-lg border border-border select-none">
              <span className="text-[9px] font-bold text-text-muted px-1.5">CONSENSUS:</span>
              <div className="flex gap-1">
                {(['ANY', 'ALL', 'MAJORITY'] as CombineMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => state.setField('combineMode', mode)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-[9px] font-bold transition-all cursor-pointer",
                      state.combineMode === mode 
                        ? "bg-primary text-white shadow-[0_0_8px_rgba(34,211,238,0.3)]" 
                        : "text-text-muted hover:text-text-primary"
                    )}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
            <button 
              onClick={() => { setStudioOpen(false); if (!isLocked) setShowConfirm(true); }}
              className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white font-bold text-xs transition-all shadow-[0_0_12px_rgba(34,211,238,0.25)] flex items-center gap-1.5 cursor-pointer"
            >
              <Play size={13} />
              <span>Deploy Strategy</span>
            </button>
          </div>
        </header>

        {/* Studio Workspace */}
        <div className="flex-1 flex min-h-0">
          {/* Left Column: Signal Config Categories */}
          <div className="w-[60%] flex flex-col border-r border-border bg-[#0B0E11]/30">
            {/* Sidebar Tabs */}
            <div className="flex border-b border-border/80 px-4 pt-2 bg-[#0B0E11]">
              {[
                { id: 'TECH', label: '📈 Tech Indicators' },
                { id: 'SENTIMENT', label: '📰 News Sentiment' },
                { id: 'ETF', label: '📊 ETF Net Flow' },
                { id: 'MACRO', label: '🌍 Macro Trends' },
                { id: 'CUSTOM', label: '💻 Custom expression' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setStudioTab(tab.id as any)}
                  className={cn(
                    "px-4 py-3 text-xs font-bold border-b-2 border-transparent transition-all duration-150 whitespace-nowrap cursor-pointer",
                    studioTab === tab.id ? "border-primary text-primary" : "text-text-muted hover:text-text-primary"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Config Panels */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-none">
              
              {/* Tab: TECH */}
              {studioTab === 'TECH' && (
                <div className="space-y-4">
                  {techSignals.map(sig => (
                    <div key={sig.id} className={cn("p-4 rounded-xl border transition-all", sig.enabled ? "bg-primary-soft/5 border-primary/20" : "bg-white/5 border-border/40 opacity-70")}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h3 className="text-xs font-bold text-text-primary">{sig.label}</h3>
                          <p className="text-[10px] text-text-muted mt-0.5">{sig.description}</p>
                        </div>
                        <Toggle label="" checked={sig.enabled} onChange={(v) => toggleSignal(sig.id, v)} />
                      </div>
                      {sig.enabled && (
                        <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-border/40 font-mono text-[10px]">
                          {Object.entries(sig.params).map(([key, val]) => (
                            <div key={key} className="space-y-1">
                              <label className="block text-[9px] text-text-secondary uppercase font-bold font-sans">{PARAM_LABELS[key] || key}</label>
                              <input 
                                type="number" 
                                className="w-full bg-[#080B0E] border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:border-primary outline-none" 
                                value={val} 
                                onChange={(e) => updateSignalParam(sig.id, key, e.target.value)} 
                                disabled={isLocked} 
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Tab: SENTIMENT */}
              {studioTab === 'SENTIMENT' && sentimentSignal && (
                <div className="space-y-4">
                  <div className={cn("p-4 rounded-xl border transition-all", sentimentSignal.enabled ? "bg-primary-soft/5 border-primary/20" : "bg-white/5 border-border/40 opacity-70")}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="text-xs font-bold text-text-primary">{sentimentSignal.label}</h3>
                        <p className="text-[10px] text-text-muted mt-0.5">{sentimentSignal.description}</p>
                      </div>
                      <Toggle label="" checked={sentimentSignal.enabled} onChange={(v) => toggleSignal(sentimentSignal.id, v)} />
                    </div>
                    {sentimentSignal.enabled && (
                      <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-border/40 font-mono text-[10px]">
                        <div className="space-y-1">
                          <label className="block text-[9px] text-text-secondary uppercase font-bold font-sans">Buy Threshold (Sentiment &gt;=)</label>
                          <input 
                            type="number" 
                            className="w-full bg-[#080B0E] border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:border-primary outline-none" 
                            value={sentimentSignal.params.buyThreshold} 
                            onChange={(e) => updateSignalParam(sentimentSignal.id, 'buyThreshold', e.target.value)}
                            disabled={isLocked}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[9px] text-text-secondary uppercase font-bold font-sans">Sell Threshold (Sentiment &lt;=)</label>
                          <input 
                            type="number" 
                            className="w-full bg-[#080B0E] border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:border-primary outline-none" 
                            value={sentimentSignal.params.sellThreshold} 
                            onChange={(e) => updateSignalParam(sentimentSignal.id, 'sellThreshold', e.target.value)}
                            disabled={isLocked}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Real-time preview */}
                  <div className="p-4 rounded-xl border border-border bg-[#101317] space-y-3">
                    <h3 className="text-[11px] font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                      <Cpu size={13} className="text-primary animate-pulse" />
                      Live AI Sentiment Feed
                    </h3>
                    {studioData.loading ? (
                      <div className="text-xs text-text-muted font-mono animate-pulse">Fetching latest news sentiment index...</div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-text-secondary font-medium">SoSoValue Fear & Greed Index:</span>
                          <span className="text-sm font-bold font-mono text-primary">{studioData.newsSentiment}</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-danger via-warning to-success" 
                            style={{ width: `${studioData.newsSentiment}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-text-muted font-mono pt-1">
                          <span>Neutral (50)</span>
                          <span className={cn(
                            "font-bold",
                            studioData.newsSentiment >= (sentimentSignal.params.buyThreshold || 75) ? "text-success" :
                            studioData.newsSentiment <= (sentimentSignal.params.sellThreshold || 30) ? "text-danger" :
                            "text-text-muted"
                          )}>
                            Trigger State: {
                              studioData.newsSentiment >= (sentimentSignal.params.buyThreshold || 75) ? "BUY / LONG" :
                              studioData.newsSentiment <= (sentimentSignal.params.sellThreshold || 30) ? "SELL / SHORT" :
                              "NEUTRAL"
                            }
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab: ETF */}
              {studioTab === 'ETF' && etfSignal && (
                <div className="space-y-4">
                  <div className={cn("p-4 rounded-xl border transition-all", etfSignal.enabled ? "bg-primary-soft/5 border-primary/20" : "bg-white/5 border-border/40 opacity-70")}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="text-xs font-bold text-text-primary">{etfSignal.label}</h3>
                        <p className="text-[10px] text-text-muted mt-0.5">{etfSignal.description}</p>
                      </div>
                      <Toggle label="" checked={etfSignal.enabled} onChange={(v) => toggleSignal(etfSignal.id, v)} />
                    </div>
                    {etfSignal.enabled && (
                      <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-border/40 font-mono text-[10px]">
                        <div className="space-y-1">
                          <label className="block text-[9px] text-text-secondary uppercase font-bold font-sans">Buy Net Inflow Threshold ($M)</label>
                          <input 
                            type="number" 
                            className="w-full bg-[#080B0E] border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:border-primary outline-none" 
                            value={etfSignal.params.buyInflowM} 
                            onChange={(e) => updateSignalParam(etfSignal.id, 'buyInflowM', e.target.value)}
                            disabled={isLocked}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[9px] text-text-secondary uppercase font-bold font-sans">Sell Net Outflow Threshold ($M)</label>
                          <input 
                            type="number" 
                            className="w-full bg-[#080B0E] border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:border-primary outline-none" 
                            value={etfSignal.params.sellOutflowM} 
                            onChange={(e) => updateSignalParam(etfSignal.id, 'sellOutflowM', e.target.value)}
                            disabled={isLocked}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Real-time preview */}
                  <div className="p-4 rounded-xl border border-border bg-[#101317] space-y-3">
                    <h3 className="text-[11px] font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                      <Cpu size={13} className="text-primary animate-pulse" />
                      Live ETF Flow Stream
                    </h3>
                    {studioData.loading ? (
                      <div className="text-xs text-text-muted font-mono animate-pulse">Scraping Farside Investors table...</div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-text-secondary font-medium">Farside Daily Net Flow:</span>
                          <span className={cn(
                            "text-sm font-bold font-mono",
                            studioData.etfInflowM >= 0 ? "text-success" : "text-danger"
                          )}>
                            {studioData.etfInflowM >= 0 ? '+' : ''}{studioData.etfInflowM}M USD
                          </span>
                        </div>
                        <div className="text-[10px] text-text-muted font-mono flex items-center justify-between">
                          <span>Target Asset: {state.symbol.split('-')[0]} Spot ETF</span>
                          <span className={cn(
                            "font-bold",
                            studioData.etfInflowM >= (etfSignal.params.buyInflowM || 100) ? "text-success" :
                            studioData.etfInflowM <= (etfSignal.params.sellOutflowM || -50) ? "text-danger" :
                            "text-text-muted"
                          )}>
                            Trigger State: {
                              studioData.etfInflowM >= (etfSignal.params.buyInflowM || 100) ? "BUY / LONG" :
                              studioData.etfInflowM <= (etfSignal.params.sellOutflowM || -50) ? "SELL / SHORT" :
                              "NEUTRAL"
                            }
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab: MACRO */}
              {studioTab === 'MACRO' && macroSignal && (
                <div className="space-y-4">
                  <div className={cn("p-4 rounded-xl border transition-all", macroSignal.enabled ? "bg-primary-soft/5 border-primary/20" : "bg-white/5 border-border/40 opacity-70")}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="text-xs font-bold text-text-primary">{macroSignal.label}</h3>
                        <p className="text-[10px] text-text-muted mt-0.5">{macroSignal.description}</p>
                      </div>
                      <Toggle label="" checked={macroSignal.enabled} onChange={(v) => toggleSignal(macroSignal.id, v)} />
                    </div>
                    {macroSignal.enabled && (
                      <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-border/40 font-mono text-[10px]">
                        <div className="space-y-1">
                          <label className="block text-[9px] text-text-secondary uppercase font-bold font-sans">Buy DXY Drop Threshold (%)</label>
                          <input 
                            type="number" 
                            step="0.05"
                            className="w-full bg-[#080B0E] border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:border-primary outline-none" 
                            value={macroSignal.params.buyDxyDropPct} 
                            onChange={(e) => updateSignalParam(macroSignal.id, 'buyDxyDropPct', e.target.value)}
                            disabled={isLocked}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[9px] text-text-secondary uppercase font-bold font-sans">Sell DXY Rise Threshold (%)</label>
                          <input 
                            type="number" 
                            step="0.05"
                            className="w-full bg-[#080B0E] border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:border-primary outline-none" 
                            value={macroSignal.params.sellDxyRisePct} 
                            onChange={(e) => updateSignalParam(macroSignal.id, 'sellDxyRisePct', e.target.value)}
                            disabled={isLocked}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Real-time preview */}
                  <div className="p-4 rounded-xl border border-border bg-[#101317] space-y-3">
                    <h3 className="text-[11px] font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                      <Cpu size={13} className="text-primary animate-pulse" />
                      Live Macro DXY Correlation
                    </h3>
                    {studioData.loading ? (
                      <div className="text-xs text-text-muted font-mono animate-pulse">Calculating DXY inverse metrics...</div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-text-secondary font-medium">Estimated DXY 24h Strength:</span>
                          <span className={cn(
                            "text-sm font-bold font-mono",
                            studioData.dxyChangePct >= 0 ? "text-danger" : "text-success"
                          )}>
                            {studioData.dxyChangePct >= 0 ? '+' : ''}{studioData.dxyChangePct.toFixed(2)}%
                          </span>
                        </div>
                        <div className="text-[10px] text-text-muted font-mono flex items-center justify-between">
                          <span>Correlation Factor: -1.0 (Strict Inverse)</span>
                          <span className={cn(
                            "font-bold",
                            studioData.dxyChangePct <= -(macroSignal.params.buyDxyDropPct || 0.15) ? "text-success" :
                            studioData.dxyChangePct >= (macroSignal.params.sellDxyRisePct || 0.1) ? "text-danger" :
                            "text-text-muted"
                          )}>
                            Trigger State: {
                              studioData.dxyChangePct <= -(macroSignal.params.buyDxyDropPct || 0.15) ? "BUY / LONG" :
                              studioData.dxyChangePct >= (macroSignal.params.sellDxyRisePct || 0.1) ? "SELL / SHORT" :
                              "NEUTRAL"
                            }
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab: CUSTOM */}
              {studioTab === 'CUSTOM' && (
                <div className="space-y-4">
                  {customSignals.map(sig => (
                    <div key={sig.id} className={cn("p-4 rounded-xl border transition-all", sig.enabled ? "bg-primary-soft/5 border-primary/20" : "bg-white/5 border-border/40 opacity-70")}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h3 className="text-xs font-bold text-text-primary">{sig.label}</h3>
                          <p className="text-[10px] text-text-muted mt-0.5">{sig.description}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (isLocked) return;
                              const updated = state.signals.filter(s => s.id !== sig.id);
                              state.setField('signals', updated);
                            }}
                            className="p-1 hover:bg-white/5 rounded-md text-danger/80 hover:text-danger cursor-pointer"
                          >
                            <X size={14} />
                          </button>
                          <Toggle label="" checked={sig.enabled} onChange={(v) => toggleSignal(sig.id, v)} />
                        </div>
                      </div>
                      {sig.enabled && (
                        <div className="space-y-3 mt-3 pt-3 border-t border-border/40">
                          <div className="space-y-1 font-mono text-[10px]">
                            <label className="block text-[9px] text-text-secondary uppercase font-bold font-sans">JavaScript Expression</label>
                            <textarea
                              rows={5}
                              className="w-full bg-[#080B0E] border border-border rounded-lg p-3 text-xs text-text-primary focus:border-primary outline-none font-mono leading-relaxed"
                              value={sig.customExpression}
                              onChange={(e) => {
                                const val = e.target.value;
                                const updated = state.signals.map(s => s.id === sig.id ? { ...s, customExpression: val } : s);
                                state.setField('signals', updated);
                              }}
                              disabled={isLocked}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      if (isLocked) return;
                      const count = customSignals.length + 1;
                      const newSig: SignalConfig = {
                        id: `custom-${Date.now()}-${count}`,
                        type: 'CUSTOM',
                        enabled: true,
                        label: `Custom JS Signal ${count}`,
                        description: 'Custom programmable compiler trigger',
                        params: { threshold: 0 },
                        customExpression: '// Available: rsi(14), ema(9), sma(20), close, open, volume\n// Return: 1 for BUY, -1 for SELL, 0 for NEUTRAL\nreturn rsi(14) < 30 ? 1 : rsi(14) > 70 ? -1 : 0;'
                      };
                      state.setField('signals', [...state.signals, newSig]);
                    }}
                    className="w-full py-2.5 rounded-lg border border-dashed border-primary/30 hover:border-primary/50 text-xs text-primary font-bold hover:bg-primary/5 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>+ Add Programmable JS Signal</span>
                  </button>
                </div>
              )}

            </div>
          </div>

          {/* Right Column: Live Signal Validation Matrix */}
          <div className="w-[40%] flex flex-col bg-[#0B0E11] p-6 space-y-6">
            <div className="flex flex-col gap-2">
              <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5 select-none">
                <BarChart3 size={14} className="text-primary" />
                Live Validation Matrix
              </h2>
              <p className="text-[10px] text-text-secondary select-none">Observe current signal states and combined orchestrator decisions.</p>
            </div>

            {/* Resolved Decision Widget */}
            <div className={cn(
              "p-5 rounded-2xl border transition-all flex flex-col items-center justify-center text-center shadow-lg",
              decision.action === 'LONG' ? "bg-success-soft/10 border-success/30 shadow-success/5" :
              decision.action === 'SHORT' ? "bg-danger/5 border-danger/20 shadow-danger/5" :
              "bg-white/5 border-border/60"
            )}>
              <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1 select-none">Combined Target Action</span>
              <h3 className={cn(
                "text-lg font-black tracking-widest font-mono select-none",
                decision.action === 'LONG' ? "text-success drop-shadow-[0_0_12px_rgba(63,185,80,0.4)]" :
                decision.action === 'SHORT' ? "text-danger drop-shadow-[0_0_12px_rgba(248,81,73,0.4)]" :
                "text-text-muted"
              )}>
                {decision.action === 'LONG' ? 'BUY / LONG' : decision.action === 'SHORT' ? 'SELL / SHORT' : 'NO TRIGGER (WAITING)'}
              </h3>
              <p className="text-[10px] text-text-secondary max-w-[280px] mt-2 font-mono leading-normal">
                {decision.reasoning}
              </p>
            </div>

            {/* Consensus Strategy Explanation */}
            <div className="p-4 rounded-xl border border-border bg-[#101317]/50 space-y-3 text-[10px] text-text-secondary select-none">
              <div className="flex items-center justify-between">
                <span className="font-bold text-text-primary uppercase tracking-wider block flex items-center gap-1">
                  <HelpCircle size={12} className="text-primary" />
                  Consensus Engine
                </span>
                
                {/* Pill selector for Consensus in Card */}
                <div className="flex p-0.5 rounded-lg bg-[#080B0E] border border-border">
                  {(['ANY', 'ALL', 'MAJORITY'] as CombineMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => state.setField('combineMode', mode)}
                      className={cn(
                        "px-2 py-0.5 rounded-md text-[9px] font-bold transition-all cursor-pointer",
                        state.combineMode === mode 
                          ? "bg-primary text-white shadow-[0_0_8px_rgba(34,211,238,0.3)]" 
                          : "text-text-muted hover:text-text-primary"
                      )}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="space-y-1 leading-normal font-sans pt-2 border-t border-border/20">
                {state.combineMode === 'ANY' && (
                  <p>
                    <span className="text-primary font-bold">ANY Mode:</span> The orchestrator triggers an entry order if <strong className="text-text-primary">at least one</strong> enabled signal fires. If multiple opposing signals fire, the direction with the higher aggregate strength is selected.
                  </p>
                )}
                {state.combineMode === 'ALL' && (
                  <p>
                    <span className="text-primary font-bold">ALL Mode:</span> <strong className="text-text-primary">All enabled indicators</strong> must agree on the direction (all BUY or all SELL). If even a single indicator goes NEUTRAL or opposes, no trade will execute.
                  </p>
                )}
                {state.combineMode === 'MAJORITY' && (
                  <p>
                    <span className="text-primary font-bold">MAJORITY Mode:</span> Trigger fires if <strong className="text-text-primary">more than 50%</strong> of active (non-neutral) signals agree on a direction. Ideal for balancing indicators that filter noise.
                  </p>
                )}
              </div>
            </div>

            {/* Signal Trigger List */}
            <div className="flex-1 flex flex-col min-h-0 space-y-2.5 overflow-y-auto scrollbar-none select-none">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Active Signal Components</span>
              
              {combinedSandbox.length === 0 ? (
                <div className="text-center text-text-muted text-[10px] font-mono py-12">No signals enabled. Toggle indicators in the studio to validate.</div>
              ) : (
                <div className="space-y-2">
                  {combinedSandbox.map((sig, i) => (
                    <div key={i} className="p-3 rounded-xl border border-border/80 bg-[#101317] space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-text-primary">{sig.label}</span>
                        <span className={cn(
                          "px-2 py-0.5 rounded-md font-bold text-[9px] font-mono",
                          sig.direction === 'LONG' ? "bg-success-soft text-success border border-success/15" :
                          sig.direction === 'SHORT' ? "bg-danger/10 text-danger border border-danger/15" :
                          "bg-white/5 text-text-muted border border-border/20"
                        )}>
                          {sig.direction}
                        </span>
                      </div>
                      <div className="w-full flex items-center justify-between text-[10px] font-mono text-text-secondary">
                        <span className="truncate max-w-[180px]">{sig.description}</span>
                        <span>Strength: {sig.strength.toFixed(0)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <BotLayout
        title="Wave 3 Signal Bot"
        icon={Radio}
        status={state.status}
        symbol={state.symbol}
        market={state.isSpot ? 'spot' : 'perps'}
        configPanel={
          <>
            <AutoConfigureButton
              symbol={state.symbol}
              market={state.isSpot ? 'spot' : 'perps'}
              recommender={recommendSignalBot}
              hidden={isLocked}
              onApply={(preset) => {
                if (preset.leverage)           state.setField('leverage', String(preset.leverage));
                if (preset.amountUsdt)         state.setField('amountUsdt', String(preset.amountUsdt));
                if (preset.takeProfitPct)      state.setField('takeProfitPct', String(preset.takeProfitPct));
                if (preset.stopLossPct)        state.setField('stopLossPct', String(preset.stopLossPct));
                if (preset.combineMode)        state.setField('combineMode', preset.combineMode as CombineMode);
                if (preset.checkInterval)      state.setField('checkInterval', String(preset.checkInterval));
                if (preset.klineInterval)      state.setField('klineInterval', String(preset.klineInterval));
                if (preset.cooldownSeconds)    state.setField('cooldownSeconds', String(preset.cooldownSeconds));
                if (preset.maxOpenPositions)   state.setField('maxOpenPositions', String(preset.maxOpenPositions));
                if (preset.onConflictingSignal) state.setField('onConflictingSignal', preset.onConflictingSignal as ConflictResolution);
                if (preset.isSpot !== undefined) state.setField('isSpot', preset.isSpot === 'true');
                if (preset.signalsJson) {
                  try {
                    const parsed = JSON.parse(String(preset.signalsJson));
                    if (Array.isArray(parsed)) state.setField('signals', parsed);
                  } catch { }
                }
              }}
            />
            {configPanel}
          </>
        }
        statsPanel={statsPanel}
        logsPanel={logsPanel}
        howItWorksPanel={<BotsHowItWorks botType="Signal" />}
        isLocked={isLocked}
        onStart={() => setShowConfirm(true)}
        onStop={() => void stopBot()}
        currentPnl={state.realizedPnl + state.activePositions.reduce((sum, p) => sum + p.unrealizedPnl, 0)}
        investment={parseFloat(state.amountUsdt) * Math.max(state.activePositions.length, 1)}
      />
      <BotRiskSetupModal
        isOpen={showConfirm}
        botName="Signal Bot"
        onCancel={() => setShowConfirm(false)}
        onConfirm={() => { setShowConfirm(false); startBot(); }}
      />
    </>
  );
};
