import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Grid2X2 } from 'lucide-react';
import { useBotStore } from '../store/botStore';
import {
  placeOrder,
  cancelAllOrders,
  fetchBookTickers,
  fetchOpenOrders,
  fetchOrderStatus,
  normalizeSymbol,
  updatePerpsLeverage,
  getPerpsSymbolMeta,
  type PerpsSymbolMeta,
  fetchPositions,
  validateBalance,
} from '../api/services';
import { recommendGridBot } from '../api/aiAutoConfig';
import { AutoConfigureButton } from '../components/common/AutoConfigureButton';
import { cn, getErrorMessage } from '../lib/utils';
import { NumberDisplay } from '../components/common/NumberDisplay';
import { SymbolSelector } from '../components/common/SymbolSelector';
import { BotRiskSetupModal } from '../components/common/BotRiskSetupModal';
import { BotLayout } from '../components/bots/BotLayout';
import { StatCard } from '../components/common/Card';
import { Input } from '../components/common/Input';
import { useBotPnlStore } from '../store/botPnlStore';
import { BotsHowItWorks } from '../components/bots/BotsHowItWorks';
import { useRiskStore } from '../store/riskStore';
import { localAiComputeTrailingStop } from '../api/localAiEngine';

interface GridLevel {
  price: number;
  orderId?: string;
  side?: 'BUY' | 'SELL';
  status: 'EMPTY' | 'ACTIVE' | 'FILLED';
}

interface LogEntry {
  time: string;
  side?: 'BUY' | 'SELL';
  message?: string;
}

const POLL_INTERVAL = 10_000;
const ROUND_TRIP_FEE_PCT = 0.08;
const MAX_CONSECUTIVE_ERRORS = 4;

function buildGridLevels(
  lower: number,
  upper: number,
  count: number,
  spacing: 'ARITHMETIC' | 'GEOMETRIC',
): number[] {
  if (lower <= 0 || upper <= 0 || count < 2 || lower >= upper) return [];
  const levels: number[] = [];
  if (spacing === 'GEOMETRIC') {
    const ratio = Math.pow(upper / lower, 1 / count);
    for (let i = 0; i <= count; i++) levels.push(lower * Math.pow(ratio, i));
  } else {
    const step = (upper - lower) / count;
    for (let i = 0; i <= count; i++) levels.push(lower + step * i);
  }
  return levels;
}

function profitPerGridPct(
  lower: number,
  upper: number,
  count: number,
  spacing: 'ARITHMETIC' | 'GEOMETRIC',
): number {
  if (lower <= 0 || upper <= 0 || count < 2 || lower >= upper) return 0;
  if (spacing === 'GEOMETRIC') {
    const ratio = Math.pow(upper / lower, 1 / count);
    return (ratio - 1) * 100;
  }
  const step = (upper - lower) / count;
  return (step / lower) * 100;
}

export const GridBot: React.FC = () => {
  const { gridBot: state } = useBotStore();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const armWatcherRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runningRef = useRef(false);
  const armedRef = useRef(false);
  const pollBusyRef = useRef(false);
  const consecutiveErrorsRef = useRef(0);
  const highestPriceRef = useRef<number>(0);
  const lowestPriceRef = useRef<number>(999999999);
  const initialPriceRef = useRef<number>(0);
  const [gridLevels, setGridLevels] = useState<GridLevel[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  
  const [executionMode, setExecutionMode] = useState<'SESSION' | 'SINGLE'>('SESSION');
  const gridLevelsRef = useRef<GridLevel[]>([]);
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [perpsMetaErr, setPerpsMetaErr] = useState('');
  
  
  const prevPriceForCrossRef = useRef<number | null>(null);

  const [perpsMeta, setPerpsMeta] = useState<PerpsSymbolMeta | null>(null);

  useEffect(() => {
    if (state.isSpot) { setPerpsMeta(null); setPerpsMetaErr(''); return; }
    let cancelled = false;
    setPerpsMetaErr('');
    const ticker = state.symbol.split(/[-_/]/)[0];
    void (async () => {
      const meta = await getPerpsSymbolMeta(ticker).catch(() => null);
      if (cancelled) return;
      setPerpsMeta(meta);
      if (!meta) {
        setPerpsMetaErr(`No live cap for ${ticker} — using 25× default`);
        return;
      }
      const userLev = parseInt(state.leverage) || 1;
      if (userLev > meta.maxLeverage) state.setField('leverage', String(meta.maxLeverage));
    })();
    return () => { cancelled = true; };
  }, [state.symbol, state.isSpot, state.leverage]);

  const addLog = useCallback((entry: Omit<LogEntry, 'time'>) => {
    setLogs((prev) =>
      [{ time: new Date().toLocaleTimeString(), ...entry }, ...prev].slice(0, 50),
    );
  }, []);

  const placeGridOrder = useCallback(
    async (price: number, side: 'BUY' | 'SELL', orderType: 'LIMIT' | 'MARKET' = 'LIMIT'): Promise<string | null> => {
      const { gridBot: s } = useBotStore.getState();
      const market: 'spot' | 'perps' = s.isSpot ? 'spot' : 'perps';

      try {
        const rawQty = parseFloat(s.amountPerGrid);
        if (isNaN(rawQty) || rawQty <= 0) throw new Error('Invalid quantity — check Amount/Grid');

        const payload: any = {
          symbol: s.symbol,
          side: side === 'BUY' ? 1 : 2,
          type: orderType === 'LIMIT' ? 1 : 2,
          quantity: String(rawQty),
        };
        
        if (orderType === 'LIMIT') {
          payload.price = String(price);
          payload.timeInForce = 1;
        }

        const result = await placeOrder(payload, market);

        const res = result as Record<string, unknown> | undefined;
        const orderId: string | null = String(res?.orderID ?? res?.orderId ?? res?.id ?? '') || null;
        if (orderId) {
          addLog({ message: `${side} ${orderType} @ ${price.toFixed(2)} placed (${orderId})`, side });
        }
        return orderId;
      } catch (err: unknown) {
        const msg = getErrorMessage(err);
        addLog({ message: `ERROR placing ${side} @ ${price.toFixed(2)}: ${msg}` });
        toast.error(`Grid Bot: ${msg}`);
        return null;
      }
    },
    [addLog],
  );

  const fetchLastPrice = useCallback(async (): Promise<number | null> => {
    const { gridBot: s } = useBotStore.getState();
    const market: 'spot' | 'perps' = s.isSpot ? 'spot' : 'perps';
    try {
      const tickers = await fetchBookTickers(market);
      const arr = Array.isArray(tickers) ? tickers : [];
      const normalizedSym = normalizeSymbol(s.symbol, market);
      const ticker = arr.find((t) => (t as Record<string, unknown>).symbol === normalizedSym) as Record<string, unknown> | undefined;
      if (!ticker) return null;
      const bid = parseFloat(String(ticker.bidPrice ?? ticker.bid ?? '0'));
      const ask = parseFloat(String(ticker.askPrice ?? ticker.ask ?? '0'));
      const mid = (bid + ask) / 2;
      lastPriceRef.current = mid;
      setLastPrice(mid);
      return mid;
    } catch (err: unknown) {
      addLog({ message: `ERROR fetching price: ${getErrorMessage(err)}` });
      return null;
    }
  }, [addLog]);

  const stopBotRef = useRef<((reason?: string) => Promise<void>) | null>(null);

  const pollOrders = useCallback(async () => {
    if (!runningRef.current) return;
    if (pollBusyRef.current) return;
    pollBusyRef.current = true;
    const { gridBot: s } = useBotStore.getState();
    const market: 'spot' | 'perps' = s.isSpot ? 'spot' : 'perps';

    try {
      const mid = await fetchLastPrice();
      const sl = parseFloat(s.stopLossPrice);
      const tp = parseFloat(s.takeProfitPrice);
      const trail = parseFloat(s.trailingProfitUsd);
      const fresh = useBotStore.getState().gridBot;
      if (mid !== null) {
        if (mid > highestPriceRef.current) highestPriceRef.current = mid;
        if (mid < lowestPriceRef.current) lowestPriceRef.current = mid;

        const { useAiTrailingStop } = useRiskStore.getState();
        let activeSl = sl;
        if (useAiTrailingStop && initialPriceRef.current > 0) {
          activeSl = localAiComputeTrailingStop(
            'BUY',
            initialPriceRef.current,
            mid,
            highestPriceRef.current,
            lowestPriceRef.current
          );
        }

        if (Number.isFinite(activeSl) && activeSl > 0 && mid <= activeSl) {
          await stopBotRef.current?.(useAiTrailingStop ? `AI SL @ ${activeSl.toFixed(2)}` : `SL @ ${activeSl}`);
          return;
        }
        if (Number.isFinite(tp) && tp > 0 && mid >= tp) {
          await stopBotRef.current?.(`TP @ ${tp}`);
          return;
        }
      }
      if (Number.isFinite(trail) && trail > 0 && fresh.realizedPnl >= trail) {
        await stopBotRef.current?.(`Profit @ $${trail}`);
        return;
      }

      const openOrders = await fetchOpenOrders(market);
      const openOrderIds = new Set(
        (Array.isArray(openOrders) ? openOrders : []).map(
          (o) => { const r = o as Record<string, unknown>; return String(r.orderID ?? r.orderId ?? r.id ?? ''); },
        ),
      );

      const levels = gridLevelsRef.current;
      const missingIndices: number[] = [];

      // DYNAMIC execution trigger
      if (s.executionMode === 'DYNAMIC' && mid !== null && prevPriceForCrossRef.current !== null) {
        const prev = prevPriceForCrossRef.current;
        for (let i = 0; i < levels.length; i++) {
          const level = levels[i];
          if (level.status === 'ACTIVE' && !level.orderId) {
            const crossedDown = prev > level.price && mid <= level.price;
            const crossedUp   = prev < level.price && mid >= level.price;
            
            if (level.side === 'BUY' && crossedDown) {
              const orderId = await placeGridOrder(level.price, 'BUY', 'MARKET');
              if (orderId) levels[i] = { ...level, orderId };
            } else if (level.side === 'SELL' && crossedUp) {
              const orderId = await placeGridOrder(level.price, 'SELL', 'MARKET');
              if (orderId) levels[i] = { ...level, orderId };
            }
          }
        }
      }
      prevPriceForCrossRef.current = mid;

      for (let i = 0; i < levels.length; i++) {
        const level = levels[i];
        if (level.status === 'ACTIVE' && level.orderId && !openOrderIds.has(level.orderId)) {
          missingIndices.push(i);
        }
      }

      if (missingIndices.length > 0) {
        const verifications = await Promise.all(missingIndices.map(async (i) => {
          const lvl = levels[i];
          try {
            const status = await fetchOrderStatus(lvl.orderId!, s.symbol, market);
            return { idx: i, status };
          } catch {
            return { idx: i, status: null };
          }
        }));

        for (const { idx, status } of verifications) {
          const level = levels[idx];
          const filledSide = level.side!;
          const isCancelled = status ? status.status === 'EXPIRED' : false;

          if (isCancelled) {
            levels[idx] = { ...level, status: 'EMPTY', orderId: undefined, side: undefined };
            continue;
          }

          levels[idx] = { ...level, status: 'FILLED', orderId: undefined };
          const neighbourPrice =
            filledSide === 'BUY'  && idx + 1 < levels.length ? levels[idx + 1].price :
            filledSide === 'SELL' && idx - 1 >= 0           ? levels[idx - 1].price :
            level.price;
          const realQty = status && status.filledQty > 0 ? status.filledQty : parseFloat(s.amountPerGrid);
          const pnlPerGrid = Math.abs(neighbourPrice - level.price) * realQty;

          useBotStore.getState().gridBot.bumpField('completedGrids', 1);
          useBotStore.getState().gridBot.bumpField('realizedPnl', pnlPerGrid);
          useBotPnlStore.getState().recordTrade('grid', {
            pnlUsdt: pnlPerGrid,
            ts: Date.now(),
            note: `${filledSide} grid filled @ ${level.price.toFixed(2)}`,
          });

          if (filledSide === 'BUY' && idx + 1 < levels.length) {
            const nextSide = 'SELL';
            if (s.executionMode === 'STATIC') {
              const orderId = await placeGridOrder(levels[idx + 1].price, nextSide, 'LIMIT');
              if (orderId) levels[idx + 1] = { ...levels[idx + 1], orderId, side: nextSide, status: 'ACTIVE' };
            } else {
              levels[idx + 1] = { ...levels[idx + 1], side: nextSide, status: 'ACTIVE' };
            }
          } else if (filledSide === 'SELL' && idx - 1 >= 0) {
            const nextSide = 'BUY';
            if (s.executionMode === 'STATIC') {
              const orderId = await placeGridOrder(levels[idx - 1].price, nextSide, 'LIMIT');
              if (orderId) levels[idx - 1] = { ...levels[idx - 1], orderId, side: nextSide, status: 'ACTIVE' };
            } else {
              levels[idx - 1] = { ...levels[idx - 1], side: nextSide, status: 'ACTIVE' };
            }
          }
        }
      }

      const activeCount = levels.filter((l) => l.status === 'ACTIVE').length;
      useBotStore.getState().gridBot.setField('activeOrders', activeCount);

      gridLevelsRef.current = [...levels];
      setGridLevels([...levels]);
      consecutiveErrorsRef.current = 0;
    } catch (err: unknown) {
      consecutiveErrorsRef.current += 1;
      if (consecutiveErrorsRef.current >= MAX_CONSECUTIVE_ERRORS) {
        void stopBotRef.current?.('ERROR — too many consecutive failures');
      }
    } finally {
      pollBusyRef.current = false;
    }
  }, [addLog, placeGridOrder, fetchLastPrice]);

  const lastPriceRef = useRef<number | null>(null);

  const launchGrid = useCallback(async () => {
    const { gridBot: s } = useBotStore.getState();
    const lower = parseFloat(s.lowerPrice);
    const upper = parseFloat(s.upperPrice);
    const count = parseInt(s.gridCount);
    const amount = parseFloat(s.amountPerGrid);

    runningRef.current = true;
    armedRef.current = false;
    s.setField('status', 'RUNNING');

    const currentPrice = lastPriceRef.current ?? (await fetchLastPrice());
    if (!currentPrice) {
      runningRef.current = false;
      s.setField('status', 'ERROR');
      return;
    }

    highestPriceRef.current = currentPrice;
    lowestPriceRef.current = currentPrice;
    initialPriceRef.current = currentPrice;

    if (!s.isSpot) {
      let lev = parseInt(s.leverage);
      if (!Number.isFinite(lev) || lev < 1) lev = 1;
      const liveMeta = perpsMeta ?? await getPerpsSymbolMeta(s.symbol.split(/[-_/]/)[0]).catch(() => null);
      const cap = liveMeta?.maxLeverage ?? 25;
      if (lev > cap) { lev = cap; s.setField('leverage', String(cap)); }
      if (lev > 0) {
        try { await updatePerpsLeverage(s.symbol, lev, 2); } catch {}
      }
    }

    const priceLevels = buildGridLevels(lower, upper, count, s.spacing);
    const levels: GridLevel[] = priceLevels.map((price) => ({ price, status: 'EMPTY' as const }));

    let totalInvested = 0;
    let activeCount = 0;
    for (let i = 0; i < levels.length; i++) {
      if (!runningRef.current) break;
      let side: 'BUY' | 'SELL' | null = null;
      if (s.mode === 'NEUTRAL') {
        if (levels[i].price < currentPrice) side = 'BUY';
        else if (levels[i].price > currentPrice) side = 'SELL';
      } else if (s.mode === 'LONG') {
        if (levels[i].price < currentPrice) side = 'BUY';
      } else if (s.mode === 'SHORT') {
        if (levels[i].price > currentPrice) side = 'SELL';
      }

      if (side) {
        if (s.executionMode === 'STATIC') {
          const orderId = await placeGridOrder(levels[i].price, side, 'LIMIT');
          if (orderId) {
            levels[i] = { ...levels[i], orderId, side, status: 'ACTIVE' };
            activeCount++;
            if (side === 'BUY') totalInvested += levels[i].price * amount;
          }
        } else {
          // Dynamic execution: don't place anything yet, just arm the grid level
          levels[i] = { ...levels[i], side, status: 'ACTIVE' };
          activeCount++;
          if (side === 'BUY') totalInvested += levels[i].price * amount;
        }
      }
    }

    gridLevelsRef.current = levels;
    setGridLevels([...levels]);

    s.setField('activeOrders', activeCount);
    s.setField('totalInvestment', totalInvested);
    pollRef.current = setInterval(pollOrders, POLL_INTERVAL);
  }, [addLog, fetchLastPrice, placeGridOrder, pollOrders, perpsMeta]);

  const startArmWatcher = useCallback(() => {
    armedRef.current = true;
    const { gridBot: s } = useBotStore.getState();
    s.setField('status', 'ARMED');

    const tick = async () => {
      if (!armedRef.current) return;
      const fresh = useBotStore.getState().gridBot;
      const trigger = parseFloat(fresh.triggerPrice);
      if (!Number.isFinite(trigger) || trigger <= 0) return;
      const mid = await fetchLastPrice();
      if (mid === null) return;
      const prev = prevPriceForCrossRef.current;
      prevPriceForCrossRef.current = mid;
      if (prev === null) return;
      const crossedUp   = prev <  trigger && mid >= trigger;
      const crossedDown = prev >  trigger && mid <= trigger;
      const fired = (fresh.triggerDirection === 'CROSS_UP' && crossedUp) || (fresh.triggerDirection === 'CROSS_DOWN' && crossedDown);
      if (fired) {
        if (armWatcherRef.current) clearInterval(armWatcherRef.current);
        armWatcherRef.current = null;
        await launchGrid();
      }
    };
    void tick();
    armWatcherRef.current = setInterval(() => { void tick(); }, POLL_INTERVAL);
  }, [addLog, fetchLastPrice, launchGrid]);

  const doStart = useCallback(async () => {
    if (runningRef.current || armedRef.current) return;
    const { gridBot: s } = useBotStore.getState();
    const lower = parseFloat(s.lowerPrice);
    const upper = parseFloat(s.upperPrice);
    const count = parseInt(s.gridCount);
    const amount = parseFloat(s.amountPerGrid);

    if (isNaN(lower) || isNaN(upper) || isNaN(count) || isNaN(amount) || lower >= upper || count < 2 || amount <= 0) {
      toast.error('Invalid grid parameters');
      return;
    }

    const investment = parseFloat(s.amountUsdt);
    if (isNaN(investment) || investment <= 0) {
      toast.error('Invalid investment amount');
      return;
    }

    const hasBalance = await validateBalance(investment, s.symbol, s.isSpot);
    if (!hasBalance) {
      toast.error(`Insufficient balance in account to cover investment of $${investment.toFixed(2)}`);
      return;
    }

    s.resetStats();
    setLogs([]);
    prevPriceForCrossRef.current = null;
    consecutiveErrorsRef.current = 0;
    pollBusyRef.current = false;

    const trigger = parseFloat(s.triggerPrice);
    if (Number.isFinite(trigger) && trigger > 0) {
      startArmWatcher();
    } else {
      await launchGrid();
    }
  }, [addLog, launchGrid, startArmWatcher]);

  const stopBot = useCallback(async (reason?: string) => {
    runningRef.current = false;
    armedRef.current = false;
    if (pollRef.current)       { clearInterval(pollRef.current); pollRef.current = null; }
    if (armWatcherRef.current) { clearInterval(armWatcherRef.current); armWatcherRef.current = null; }
    consecutiveErrorsRef.current = 0;

    const { gridBot: s } = useBotStore.getState();
    const market: 'spot' | 'perps' = s.isSpot ? 'spot' : 'perps';

    try {
      await cancelAllOrders(s.symbol, market);
      addLog({ message: 'Cancelled all grid limit orders' });
    } catch {}

    // Close any active perp positions opened by this bot
    if (market === 'perps') {
      try {
        const activePositions = await fetchPositions();
        const pos = activePositions.find((p: any) => p.symbol === s.symbol);
        const posSize = parseFloat(pos?.size ?? pos?.quantity ?? '0');
        if (posSize !== 0) {
          addLog({ message: `Liquidating active perp position of size ${posSize} @ Market...` });
          const closeSide = posSize > 0 ? 2 : 1; // 1=BUY, 2=SELL to close
          await placeOrder({
            symbol: s.symbol,
            side: closeSide as (1 | 2),
            type: 2 as (1 | 2), // MARKET order
            quantity: String(Math.abs(posSize))
          }, 'perps');
          addLog({ message: `Grid Bot position successfully liquidated @ Market` });
        }
      } catch (err) {
        addLog({ message: `Failed to liquidate grid position: ${getErrorMessage(err)}` });
      }
    }

    const isErrorStop = typeof reason === 'string' && reason.startsWith('ERROR');
    s.setField('status', isErrorStop ? 'ERROR' : 'STOPPED');
    s.setField('activeOrders', 0);

    gridLevelsRef.current = gridLevelsRef.current.map((l) => ({
      ...l, status: 'EMPTY' as const, orderId: undefined, side: undefined,
    }));
    setGridLevels([...gridLevelsRef.current]);
  }, [addLog]);

  useEffect(() => { stopBotRef.current = stopBot; }, [stopBot]);

  useEffect(() => () => {
    runningRef.current = false;
    armedRef.current = false;
    if (pollRef.current)       clearInterval(pollRef.current);
    if (armWatcherRef.current) clearInterval(armWatcherRef.current);
  }, []);

  const isRunning = state.status === 'RUNNING';
  const isArmed = state.status === 'ARMED';
  const isLocked = isRunning || isArmed;



  const lower = parseFloat(state.lowerPrice) || 0;
  const upper = parseFloat(state.upperPrice) || 0;
  const count = parseInt(state.gridCount) || 0;
  const amount = parseFloat(state.amountPerGrid) || 0;
  const profitPct = useMemo(() => profitPerGridPct(lower, upper, count, state.spacing), [lower, upper, count, state.spacing]);
  const profitClearsFee = profitPct >= ROUND_TRIP_FEE_PCT * 1.5;
  const rangePct = lower > 0 && upper > 0 ? ((upper - lower) / ((lower + upper) / 2)) * 100 : 0;



  const configPanel = (
    <>
      <AutoConfigureButton
        symbol={state.symbol}
        market={state.isSpot ? 'spot' : 'perps'}
        recommender={(ctx) => recommendGridBot(ctx, parseFloat(String(state.totalInvestment)) || 200)}
        hidden={isRunning}
        onApply={(preset) => {
          if (preset.upperPrice) state.setField('upperPrice', String(preset.upperPrice));
          if (preset.lowerPrice) state.setField('lowerPrice', String(preset.lowerPrice));
          if (preset.gridLevels) state.setField('gridCount', String(preset.gridLevels));
          if (preset.gridCount) state.setField('gridCount', String(preset.gridCount));
          if (preset.amountPerGrid) state.setField('amountPerGrid', String(preset.amountPerGrid));
          if (preset.spacing) state.setField('spacing', preset.spacing as 'ARITHMETIC' | 'GEOMETRIC');
          if (preset.mode) state.setField('mode', preset.mode as 'NEUTRAL' | 'LONG' | 'SHORT');
          if (preset.leverage && !state.isSpot) state.setField('leverage', String(preset.leverage));
        }}
      />
      <div>
        <label className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2 block">Trading Pair</label>
        <SymbolSelector market={state.isSpot ? 'spot' : 'perps'} value={state.symbol} onChange={(c: string) => state.setField('symbol', c)} disabled={isRunning} />
      </div>
      
      <div className="space-y-4 pt-4 border-t border-border/40">
        <div>
          <label className="text-xs font-bold text-text-muted mb-2 block uppercase tracking-wider">Execution Mode</label>
          <div className="flex bg-surface-2 p-1 rounded-xl border border-border">
            <button
              onClick={() => state.setField('executionMode', 'STATIC')}
              className={cn("flex-1 py-2 text-xs font-bold rounded-lg transition-all", state.executionMode === 'STATIC' ? 'bg-primary text-background shadow-lg shadow-primary/20' : 'text-text-muted hover:text-text-primary')}
            >
              Static (Limits)
            </button>
            <button
              onClick={() => state.setField('executionMode', 'DYNAMIC')}
              className={cn("flex-1 py-2 text-xs font-bold rounded-lg transition-all", state.executionMode === 'DYNAMIC' ? 'bg-primary text-background shadow-lg shadow-primary/20' : 'text-text-muted hover:text-text-primary')}
            >
              Dynamic (Virtual)
            </button>
          </div>
        </div>
      </div>
      
      <Input label="Investment (USDT)" value={state.amountUsdt} onChange={(e) => state.setField('amountUsdt', e.target.value)} type="number" placeholder="1000" />
      
        <div className="grid grid-cols-2 gap-3">
          <Input label="Lower Price" value={state.lowerPrice} onChange={(e) => state.setField('lowerPrice', e.target.value)} type="number" />
          <Input label="Upper Price" value={state.upperPrice} onChange={(e) => state.setField('upperPrice', e.target.value)} type="number" />
        </div>
        <Input label="Grid Count" value={state.gridCount} onChange={(e) => state.setField('gridCount', e.target.value)} type="number" />
        <Input label="Amount per Grid" value={state.amountPerGrid} onChange={(e) => state.setField('amountPerGrid', e.target.value)} type="number" />
    </>
  );

  const statsPanel = (
    <div className="grid grid-cols-2 gap-3">
      <StatCard label="Realized PnL" value={<NumberDisplay value={state.realizedPnl} prefix="$" trend={state.realizedPnl >= 0 ? 'up' : 'down'} />} />
      <StatCard label="Active Orders" value={state.activeOrders} />
    </div>
  );

  const logsPanel = (
    <div className="h-full overflow-y-auto custom-scrollbar p-3 space-y-2">
      {logs.length === 0 ? (
        <div className="h-full flex items-center justify-center text-text-muted text-xs">Waiting for execution...</div>
      ) : (
        logs.map((log, i) => (
          <div key={i} className="flex gap-3 text-xs font-mono">
            <span className="text-text-muted/50">{log.time}</span>
            <span className={cn(log.side === 'BUY' ? 'text-emerald-400' : 'text-red-400')}>{log.side}</span>
            <span>{log.message}</span>
          </div>
        ))
      )}
    </div>
  );

  return (
    <>
      <BotLayout
        title="Grid Bot"
        icon={Grid2X2}
        status={state.status}
        symbol={state.symbol}
        market={state.isSpot ? 'spot' : 'perps'}
        configPanel={configPanel}
        statsPanel={statsPanel}
        logsPanel={logsPanel}
        howItWorksPanel={<BotsHowItWorks botType="Grid" />}
        isLocked={isLocked}
        onStart={() => setShowConfirm(true)}
        onStop={() => void stopBot()}
        currentPnl={state.realizedPnl}
        investment={state.totalInvestment}
      />
      <BotRiskSetupModal
        isOpen={showConfirm}
        botName="Grid Bot"
        onCancel={() => setShowConfirm(false)}
        onConfirm={() => { setShowConfirm(false); void doStart(); }}
      />
    </>
  );
};
