import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity, TrendingUp, Zap, Target, Wallet, BookOpen, CheckCircle2, Layers
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Input } from '../components/common/Input';
import { StatCard } from '../components/common/Card';
import { NumberDisplay } from '../components/common/NumberDisplay';
import { SymbolSelector } from '../components/common/SymbolSelector';
import { cn, getErrorMessage } from '../lib/utils';
import {
  fetchOrderbook,
  fetchOpenOrders,
  fetchSymbolTradingRules,
  fetchBookTickers,
  fetchOrderStatus,
  placeOrder,
  batchCancelOrders,
} from '../api/services';
import { useBotStore } from '../store/botStore';
import { useSettingsStore } from '../store/settingsStore';
import { useBotPnlStore } from '../store/botPnlStore';
import { recommendMarketMakerBot } from '../api/aiAutoConfig';
import { AutoConfigureButton } from '../components/common/AutoConfigureButton';
import { BotRiskSetupModal } from '../components/common/BotRiskSetupModal';
import { BotsHowItWorks } from '../components/bots/BotsHowItWorks';
import { BotLayout } from '../components/bots/BotLayout';

/**
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ Market Maker Bot                                                    │
 * │ High-volume, low-fee maker farming for SoDEX airdrop eligibility.   │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * The mechanic, in plain English:
 *   1. We post a small ladder of paired buy + sell limit orders at
 *      (or just outside) the inside of the book, with `timeInForce =
 *      GTX` (post-only). The exchange GUARANTEES every fill is a
 *      MAKER fill — no taker fees, ever.
 *   2. As price wiggles, the book takes our orders one side at a time.
 *      We immediately re-quote so the ladder stays full.
 *   3. If price drifts more than `requoteBps` away from one of our
 *      resting orders, we cancel + replace at the new BBO so we don't
 *      sit too far back from the queue.
 *   4. Cumulative volume, estimated fees, and inventory drift are
 *      tracked live in the right-hand stats panel. Hard caps stop the
 *      bot when budget / volume / fee limits are hit.
 *
 * Key fee math (workshop tweet evidence): a real account showed
 *  $3.20 fee on $15k volume → ~2.1 bps avg → consistent with ~50%
 *  maker fills + 30 SOSO stake giving 5% fee discount. Our bot
 *  pushes that to ~100% maker fills, so 1bp default is a fair upper
 *  bound on fee cost relative to volume.
 *
 * Order identification: every order we place gets a clOrdID prefixed
 * with `mm_<sessionId>_<seq>`. We rely on this prefix on the
 * reconciliation loop to recognise our own orders vs the user's other
 * activity on the same pair.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const RECONCILE_INTERVAL_MS = 5_000;     // poll cadence
const MAX_LOG_ENTRIES = 80;
const CLOID_PREFIX = 'mm_';
// Bps → fraction multiplier. 1 bp = 0.0001 = 0.01%.
const BPS = 1 / 10_000;
// Consecutive reconcile failures that flip the bot into ERROR state and
// auto-stop. Tuned for the 5s poll cadence — 4 × 5s = 20s of hard-failing
// before giving up, which covers transient network blips while still
// surfacing genuine auth / permission failures promptly.
const MAX_CONSECUTIVE_ERRORS = 4;

interface LogEntry {
  ts: number;
  type: 'info' | 'order' | 'fill' | 'cancel' | 'error';
  message: string;
}

interface ManagedOrder {
  /** Client order ID assigned at placement — used to identify our orders. */
  clOrdID: string;
  /** Server-side orderID returned (or echoed) by SoDEX. May be empty until first poll. */
  orderID?: string;
  side: 'BUY' | 'SELL';
  /** Limit price posted. */
  price: number;
  /** Order quantity in base asset units. */
  quantity: number;
  /** Wall-clock at placement — used for staleness checks. */
  postedAt: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nowMs(): number { return Date.now(); }

/** Lightweight client order ID generator. Sufficient uniqueness for an
 *  in-session ladder; the exchange enforces global uniqueness anyway. */
function makeCloid(sessionId: string, seq: number): string {
  return `${CLOID_PREFIX}${sessionId}_${seq.toString(36)}`;
}

// ─── The page ─────────────────────────────────────────────────────────────────

export const MarketMakerBot: React.FC = () => {
  const { privateKey, isDemoMode } = useSettingsStore();
  const mm = useBotStore((s) => s.marketMakerBot);
  const setField = useBotStore((s) => s.marketMakerBot.setField);
  const bumpField = useBotStore((s) => s.marketMakerBot.bumpField);
  const recordTrade = useBotPnlStore((s) => s.recordTrade);

  // ── Local state for things we don't want to persist in the global
  // bot store (logs, live BBO, open-orders snapshot, etc.). All of
  // these are session-local and discarded on a remount. */
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [bestBid, setBestBid] = useState(0);
  const [bestAsk, setBestAsk] = useState(0);
  const [isBusy, setBusy] = useState(false);
  const [stepSize, setStepSize] = useState(0);
  // Decimal precision for the symbol currently selected — pulled from
  // exchange metadata at start so we round prices/quantities to valid
  // multiples. Falls back to safe defaults until resolved.
  const [tickSize, setTickSize] = useState(0.01);
  const [pricePrec, setPricePrec] = useState(2);
  const [qtyPrec, setQtyPrec] = useState(2);
  const [executionMode, setExecutionMode] = useState<'SESSION' | 'SINGLE'>('SESSION');

  // Refs so the polling closure always reads the latest config without
  // re-creating itself (which would reset the interval).
  const sessionIdRef = useRef<string>('');
  const seqRef = useRef(0);
  const managedRef = useRef<Map<string, ManagedOrder>>(new Map());
  const isRunningRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Re-entrancy guard for the reconcile loop.
  const reconcileBusyRef = useRef(false);
  // Wall-clock of the last successful cancel — used to give the
  // exchange a tick to propagate the cancellation before we re-place
  // into the same slot.
  const lastCancelAtRef = useRef(0);
  // Consecutive reconcile failures.
  const consecutiveErrorsRef = useRef(0);
  // Forward ref to stopBotInternal so reconcile can invoke it without
  // a circular dependency between the two useCallbacks.
  const stopBotInternalRef = useRef<(reason?: 'STOPPED' | 'ERROR') => Promise<void>>(async () => {});

  // ── Logging helper. Bounded to MAX_LOG_ENTRIES. Newest first. ─────
  const pushLog = useCallback((type: LogEntry['type'], message: string) => {
    setLogs((prev) => [{ ts: nowMs(), type, message }, ...prev].slice(0, MAX_LOG_ENTRIES));
  }, []);

  // ── Whenever the user picks a different pair, refresh the metadata
  //    so subsequent orders use the right tick / step sizes. */
  useEffect(() => {
    if (!mm.symbol) return;
    let cancelled = false;
    void (async () => {
      try {
        const rules = await fetchSymbolTradingRules(mm.symbol, 'spot');
        if (cancelled) return;
        setTickSize(rules.tickSize || 0.01);
        setStepSize(rules.stepSize || 0.0001);
        setPricePrec(rules.pricePrecision ?? 2);
        setQtyPrec(rules.quantityPrecision ?? 4);
      } catch {
        // metadata fetch optional — bot still works with defaults
      }
    })();
    return () => { cancelled = true; };
  }, [mm.symbol]);

  // ── Derived values for display + sanity prompts ───────────────────
  const budget = parseFloat(mm.budgetUsdt) || 0;
  const orderSize = parseFloat(mm.orderSizeUsdt) || 0;
  const layers = Math.max(1, Math.min(5, parseInt(mm.layers || '1', 10) || 1));
  const totalCommitment = orderSize * layers * 2;     // buy + sell ladder
  const overBudget = totalCommitment > budget;

  // Estimated fee per filled $1 of volume given the user's maker rate.
  const feeRate = parseFloat(mm.makerFeeRate) || 0.0001;

  // Fee / volume target progress
  const volTarget = parseFloat(mm.volumeTargetUsdt) || 0;
  const feeBudget = parseFloat(mm.feeBudgetUsdt) || 0;

  // ── Order placement helper. Wraps placeOrder + side → numeric +
  //    GTX time-in-force so callers don't have to think about it. */
  const placeMakerOrder = useCallback(async (side: 'BUY' | 'SELL', price: number, qtyBase: number): Promise<ManagedOrder | null> => {
    seqRef.current += 1;
    const cloid = makeCloid(sessionIdRef.current, seqRef.current);
    try {
      const res = await placeOrder({
        symbol: mm.symbol,
        side: side === 'BUY' ? 1 : 2,
        type: 1,                       // LIMIT
        quantity: qtyBase.toFixed(qtyPrec),
        price: price.toFixed(pricePrec),
        timeInForce: 4,                // GTX = post-only — guarantees maker
        clOrdID: cloid,
      }, 'spot') as Record<string, unknown>;
      const orderID = String(res?.orderID ?? res?.orderId ?? cloid);
      const order: ManagedOrder = {
        clOrdID: cloid,
        orderID,
        side,
        price,
        quantity: qtyBase,
        postedAt: nowMs(),
      };
      managedRef.current.set(cloid, order);
      bumpField('ordersPlaced', 1);
      pushLog('order', `${side === 'BUY' ? '↗' : '↘'} ${side} ${qtyBase.toFixed(qtyPrec)} @ ${price.toFixed(pricePrec)} (${cloid.slice(-8)})`);
      return order;
    } catch (err) {
      const msg = getErrorMessage(err);
      const isPostOnlyReject = /post.?only|would.?cross|GTX|takeR|liquidity/i.test(msg);
      if (isPostOnlyReject) {
        pushLog('info', `Post-only ${side} skipped (would cross spread) — will retry next cycle`);
      } else {
        pushLog('error', `Place ${side} failed: ${msg}`);
      }
      return null;
    }
  }, [mm.symbol, qtyPrec, pricePrec, bumpField, pushLog]);

  // ── Reconciliation tick.
  const reconcile = useCallback(async () => {
    if (!isRunningRef.current) return;
    if (reconcileBusyRef.current) return;
    reconcileBusyRef.current = true;
    setBusy(true);
    try {
      const ob = await fetchOrderbook(mm.symbol, 'spot', 5) as {
        bids?: [string, string][]; asks?: [string, string][];
      };
      let topBid = parseFloat(String(ob?.bids?.[0]?.[0] ?? 0));
      let topAsk = parseFloat(String(ob?.asks?.[0]?.[0] ?? 0));
      
      if (!Number.isFinite(topBid) || !Number.isFinite(topAsk) || topBid <= 0 || topAsk <= topBid) {
        try {
          const bts = await fetchBookTickers('spot') as Array<Record<string, unknown>>;
          const row = bts.find((t) => String(t.symbol) === mm.symbol);
          const fbBid = parseFloat(String(row?.bidPrice ?? row?.bid ?? row?.bidPx ?? 0));
          const fbAsk = parseFloat(String(row?.askPrice ?? row?.ask ?? row?.askPx ?? 0));
          if (Number.isFinite(fbBid) && Number.isFinite(fbAsk) && fbBid > 0 && fbAsk > fbBid) {
            topBid = fbBid;
            topAsk = fbAsk;
          }
        } catch { /* ... */ }
      }
      if (!Number.isFinite(topBid) || !Number.isFinite(topAsk) || topBid <= 0 || topAsk <= topBid) {
        pushLog('error', `Order book unavailable for ${mm.symbol}`);
        return;
      }
      setBestBid(topBid);
      setBestAsk(topAsk);

      const openOrders = await fetchOpenOrders('spot', mm.symbol) as Array<Record<string, unknown>>;
      const openByCloid = new Map<string, Record<string, unknown>>();
      for (const o of openOrders ?? []) {
        const cl = String(o.clOrdID ?? o.clientOrderId ?? '');
        if (cl.startsWith(CLOID_PREFIX)) openByCloid.set(cl, o);
      }

      const missingEntries: [string, ManagedOrder][] = [];
      const stillOpen = new Map<string, ManagedOrder>();
      for (const [cloid, mo] of managedRef.current.entries()) {
        if (openByCloid.has(cloid)) stillOpen.set(cloid, mo);
        else missingEntries.push([cloid, mo]);
      }
      managedRef.current = stillOpen;

      if (missingEntries.length > 0) {
        const verifications = await Promise.all(missingEntries.map(async ([cloid, mo]) => {
          const id = mo.orderID ?? cloid;
          try {
            const status = await fetchOrderStatus(id, mm.symbol, 'spot');
            return { cloid, mo, status };
          } catch {
            return { cloid, mo, status: null };
          }
        }));

        for (const { mo, status } of verifications) {
          if (status && status.status === 'FILLED' && status.filledQty > 0) {
            const realQty = status.filledQty;
            const realPrice = status.avgFillPrice > 0 ? status.avgFillPrice : mo.price;
            const realNotional = status.filledValue > 0 ? status.filledValue : realQty * realPrice;
            const realFee = status.totalFee > 0 ? status.totalFee : realNotional * feeRate;

            bumpField('ordersFilled', 1);
            bumpField('volumeUsdt', realNotional);
            bumpField('feesUsdt', realFee);
            bumpField('inventoryBase', mo.side === 'BUY' ? realQty : -realQty);

            recordTrade('marketmaker', {
              pnlUsdt: -realFee,
              ts: nowMs(),
              note: `${mo.side} fill ${realQty.toFixed(qtyPrec)} ${mm.symbol} @ ${realPrice.toFixed(pricePrec)}`,
            });
            pushLog('fill', `✓ ${mo.side} filled — vol +$${realNotional.toFixed(2)}, fee $${realFee.toFixed(4)}`);
          } else if (status && status.status === 'EXPIRED') {
            bumpField('ordersCancelled', 1);
            pushLog('cancel', `✗ ${mo.side} cancelled by exchange (no fills)`);
          } else {
            const filledNotional = mo.price * mo.quantity;
            const fee = filledNotional * feeRate;
            bumpField('ordersFilled', 1);
            bumpField('volumeUsdt', filledNotional);
            bumpField('feesUsdt', fee);
            bumpField('inventoryBase', mo.side === 'BUY' ? mo.quantity : -mo.quantity);
            recordTrade('marketmaker', { pnlUsdt: -fee, ts: nowMs(), note: `${mo.side} fill (unverified)` });
            pushLog('fill', `~ ${mo.side} (unverified) vol +$${filledNotional.toFixed(2)}`);
          }
        }
      }

      const postFillMm = useBotStore.getState().marketMakerBot;
      if (volTarget > 0 && postFillMm.volumeUsdt >= volTarget) {
        await stopBotInternalRef.current();
        return;
      }

      const requoteThreshold = (parseFloat(mm.requoteBps) || 5) * BPS;
      const toCancel: { id: string; cloid: string }[] = [];
      for (const [cloid, mo] of managedRef.current.entries()) {
        const ref = mo.side === 'BUY' ? topBid : topAsk;
        if (Math.abs(mo.price - ref) / ref > requoteThreshold) {
          toCancel.push({ id: mo.orderID ?? cloid, cloid });
        }
      }
      if (toCancel.length > 0) {
        try {
          await batchCancelOrders(toCancel.map((c) => c.id), mm.symbol, 'spot');
          for (const { cloid } of toCancel) managedRef.current.delete(cloid);
          bumpField('ordersCancelled', toCancel.length);
          lastCancelAtRef.current = nowMs();
        } catch (err) { pushLog('error', `Cancel failed: ${getErrorMessage(err)}`); }
      }

      if (nowMs() - lastCancelAtRef.current < RECONCILE_INTERVAL_MS) return;

      const liveBuys = [...openByCloid.values()].filter((o) => String(o.side) === '1' || String(o.side) === 'BUY');
      const liveSells = [...openByCloid.values()].filter((o) => String(o.side) === '2' || String(o.side) === 'SELL');
      const offsetMul = (parseFloat(mm.spreadBps) || 0) * BPS;
      const qtyPerOrder = orderSize / topBid;

      const buyTargetLayers = Math.min(layers, liveBuys.length + Math.floor(Math.max(0, budget) / orderSize));
      for (let i = liveBuys.length; i < buyTargetLayers; i++) {
        const px = topBid * (1 - offsetMul) - i * tickSize;
        if (px <= 0) break;
        const placed = await placeMakerOrder('BUY', px, qtyPerOrder);
        if (!placed) break;
      }

      const reservedSellQty = liveSells.reduce((acc, o) => acc + (parseFloat(String(o.quantity ?? o.sz ?? 0)) || 0), 0);
      const availableInventory = Math.max(0, useBotStore.getState().marketMakerBot.inventoryBase - reservedSellQty);
      const sellTargetLayers = Math.min(layers, liveSells.length + Math.floor(availableInventory / qtyPerOrder));
      for (let i = liveSells.length; i < sellTargetLayers; i++) {
        const px = topAsk * (1 + offsetMul) + i * tickSize;
        const placed = await placeMakerOrder('SELL', px, qtyPerOrder);
        if (!placed) break;
      }
      consecutiveErrorsRef.current = 0;
    } catch (err) {
      consecutiveErrorsRef.current += 1;
      pushLog('error', `Reconcile error: ${getErrorMessage(err)}`);
      if (consecutiveErrorsRef.current >= MAX_CONSECUTIVE_ERRORS) {
        void stopBotInternalRef.current('ERROR');
      }
    } finally {
      setBusy(false);
      reconcileBusyRef.current = false;
    }
  }, [mm.symbol, mm.requoteBps, mm.spreadBps, tickSize, qtyPrec, pricePrec, layers, orderSize, feeRate, budget, volTarget, feeBudget, placeMakerOrder, pushLog, bumpField, recordTrade]);

  const reconcileRef = useRef(reconcile);
  useEffect(() => { reconcileRef.current = reconcile; }, [reconcile]);

  const stopBotInternal = useCallback(async (finalStatus: 'STOPPED' | 'ERROR' = 'STOPPED'): Promise<void> => {
    isRunningRef.current = false;
    if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
    setField('status', finalStatus);
    const open = [...managedRef.current.values()];
    if (open.length > 0) {
      try { await batchCancelOrders(open.map((o) => o.orderID ?? o.clOrdID), mm.symbol, 'spot'); }
      catch (err) { /* ... */ }
      managedRef.current.clear();
    }
  }, [mm.symbol, setField]);

  useEffect(() => { stopBotInternalRef.current = stopBotInternal; }, [stopBotInternal]);

  const [showConfirm, setShowConfirm] = useState(false);

  const startBot = useCallback(async () => {
    if (mm.status === 'RUNNING') return;
    
    sessionIdRef.current = Math.random().toString(36).slice(2, 8);
    setField('status', 'RUNNING');
    setField('sessionStartedAt', nowMs());
    isRunningRef.current = true;
    void reconcileRef.current();
    pollTimerRef.current = setInterval(() => { void reconcileRef.current(); }, RECONCILE_INTERVAL_MS);
  }, [mm.status, isDemoMode, privateKey, budget, orderSize, overBudget, setField]);

  // Auto-cleanup if the page unmounts while the bot is running.
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      isRunningRef.current = false;
    };
  }, []);

  const isRunning = mm.status === 'RUNNING';

  const configPanel = (
    <>
      <AutoConfigureButton
        symbol={mm.symbol}
        market="spot"
        recommender={(ctx) => recommendMarketMakerBot(ctx, parseFloat(mm.budgetUsdt) || 100)}
        hidden={isRunning}
        onApply={(preset) => {
          if (preset.layers)        setField('layers',        String(preset.layers));
          if (preset.spreadBps)     setField('spreadBps',     String(preset.spreadBps));
          if (preset.requoteBps)    setField('requoteBps',    String(preset.requoteBps));
          if (preset.orderSizeUsdt) setField('orderSizeUsdt', String(preset.orderSizeUsdt));
          if (preset.makerFeeRate)  setField('makerFeeRate',  String(preset.makerFeeRate));
        }}
      />
      <div>
        <label className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2 block">Trading Pair</label>
        <SymbolSelector market="spot" value={mm.symbol} onChange={(val) => setField('symbol', val)} disabled={isRunning} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Budget (USDT)" type="number" min="1" step="1" value={mm.budgetUsdt} onChange={(e) => setField('budgetUsdt', e.target.value)} disabled={isRunning} />
        <Input label="Order Size (USDT)" type="number" min="1" step="1" value={mm.orderSizeUsdt} onChange={(e) => setField('orderSizeUsdt', e.target.value)} disabled={isRunning} />
      </div>

      <div className="mb-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-text-muted uppercase tracking-wider font-semibold">Ladder Layers</span>
          <span className="text-xs font-mono font-bold text-emerald-300">{layers} × side</span>
        </div>
        <input type="range" min={1} max={5} step={1} value={layers} onChange={(e) => setField('layers', e.target.value)} disabled={isRunning} className="w-full accent-emerald-500" />
      </div>

      <div className={cn('rounded-xl p-3 text-[11px] space-y-1 border', overBudget ? 'bg-danger/10 border-danger/30 text-danger' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200')}>
        <div className="flex justify-between">
          <span>Active commitment:</span>
          <strong className="font-mono">${(orderSize * layers).toFixed(2)} × 2 sides = ${totalCommitment.toFixed(2)}</strong>
        </div>
        <div className="flex justify-between">
          <span>Budget headroom:</span>
          <strong className="font-mono">${(budget - totalCommitment).toFixed(2)}</strong>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-2">
        <Input label="Spread Offset (bps)" type="number" min="0" step="0.5" value={mm.spreadBps} onChange={(e) => setField('spreadBps', e.target.value)} disabled={isRunning} />
        <Input label="Re-quote Threshold (bps)" type="number" min="1" step="0.5" value={mm.requoteBps} onChange={(e) => setField('requoteBps', e.target.value)} disabled={isRunning} />
      </div>
      
      <Input label="Maker Fee Rate" type="number" min="0" step="0.00001" value={mm.makerFeeRate} onChange={(e) => setField('makerFeeRate', e.target.value)} disabled={isRunning} />
    </>
  );

  const statsPanel = (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard label="Volume" value={<NumberDisplay value={mm.volumeUsdt} prefix="$" />} icon={<TrendingUp size={16} />} trend={mm.volumeUsdt > 0 ? 'up' : 'neutral'} />
      <StatCard label="Fees Paid (est)" value={<NumberDisplay value={mm.feesUsdt} prefix="$" decimals={4} />} icon={<Wallet size={16} />} />
      <StatCard label="Filled / Placed" value={<span className="font-mono">{mm.ordersFilled} / {mm.ordersPlaced}</span>} icon={<CheckCircle2 size={16} />} />
      <StatCard label="Fee / Volume" value={<span className="font-mono">{mm.volumeUsdt > 0 ? `${((mm.feesUsdt / mm.volumeUsdt) * 100).toFixed(4)}%` : '—'}</span>} icon={<Target size={16} />} />
    </div>
  );

  const logsPanel = (
    <div className="h-full overflow-y-auto custom-scrollbar p-3 space-y-2">
      {logs.length === 0 ? (
        <div className="h-full flex items-center justify-center text-text-muted text-xs">Waiting for execution...</div>
      ) : (
        logs.map((l, i) => {
          const time = new Date(l.ts).toLocaleTimeString();
          const colour = l.type === 'fill' ? 'text-success' : l.type === 'order' ? 'text-cyan-400' : l.type === 'cancel' ? 'text-amber-400' : l.type === 'error' ? 'text-danger' : 'text-text-muted';
          return (
            <div key={i} className={cn('flex gap-2 text-xs font-mono py-0.5', colour)}>
              <span className="text-text-muted/50 shrink-0 w-[64px]">{time}</span>
              <span className="break-words">{l.message}</span>
            </div>
          );
        })
      )}
    </div>
  );




  return (
    <>
      <BotLayout

        title="Market Maker Bot"
        icon={Layers}
        status={isRunning ? 'RUNNING' : mm.status === 'ERROR' ? 'ERROR' : 'STOPPED'}
        symbol={mm.symbol}
        market="spot"
        configPanel={configPanel}
        statsPanel={statsPanel}
        logsPanel={logsPanel}
        howItWorksPanel={<BotsHowItWorks botType="Market Maker" />}
        isLocked={isRunning}
        onStart={() => setShowConfirm(true)}
        onStop={() => { void stopBotInternal(); }}
      />
      <BotRiskSetupModal
        isOpen={showConfirm}
        botName="Market Maker Bot"
        onCancel={() => setShowConfirm(false)}
        onConfirm={() => { setShowConfirm(false); startBot(); }}
      />
    </>
  );
};
