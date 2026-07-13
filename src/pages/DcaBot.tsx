import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  Repeat, Hash, DollarSign, TrendingUp, Activity,
  ChevronDown, ChevronUp, ShieldAlert, Zap
} from 'lucide-react';
import { NumberDisplay } from '../components/common/NumberDisplay';
import { BotRiskSetupModal } from '../components/common/BotRiskSetupModal';
import { StatCard } from '../components/common/Card';
import { Input, Select } from '../components/common/Input';
import { useSettingsStore } from '../store/settingsStore';
import { placeOrder, fetchBookTickers, fetchOrderStatus, normalizeSymbol } from '../api/services';
import { recommendDcaBot } from '../api/aiAutoConfig';
import { AutoConfigureButton } from '../components/common/AutoConfigureButton';
import { SymbolSelector } from '../components/common/SymbolSelector';
import { BotLayout } from '../components/bots/BotLayout';
import { BotsHowItWorks } from '../components/bots/BotsHowItWorks';
import { cn, getErrorMessage } from '../lib/utils';
import { useBotPnlStore } from '../store/botPnlStore';

interface DcaLog {
  time: string;
  side?: string;
  message?: string;
  price?: number;
  amount?: number;
}

/**
 * Professional DCA bot — adds the conditional behaviours that real
 * exchanges expose for "Smart DCA" (Binance) / "Recurring buy with
 * conditions" (Bybit / OKX):
 *
 *  - **Buy-the-dip mode**: only fire when price has dropped X% from the
 *    last fill (or, on the very first tick, X% from the price seen at
 *    Start). Lets the bot accumulate cheaper basis without the user
 *    babysitting the chart.
 *  - **Take-profit price**: stop & close once mid crosses this price.
 *  - **Stop-loss price**: stop bot if mid drops below this level — the
 *    cumulative basis is at risk and further buys would compound it.
 *  - **Per-cycle take profit %**: stop the bot once unrealized PnL
 *    exceeds this percent of total deployed capital.
 *  - **Max orders cap**: explicit upper bound on how many fills will
 *    fire before the bot self-stops, even if no other guard has
 *    triggered.
 */
type DcaCondition = 'NONE' | 'BUY_THE_DIP';

// DCA runs are typically long (hours-to-days) so we use a slightly
// higher threshold than TWAP. 3 consecutive failures = 3 × the user's
// chosen interval of no successful orders — plenty of time to surface
// intermittent issues without burning through the whole schedule on a
// persistent auth / balance problem.
const MAX_CONSECUTIVE_ORDER_ERRORS = 3;

export const DcaBot: React.FC = () => {
  const { confirmOrders, isDemoMode } = useSettingsStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = useRef(false);
  // Consecutive fatal order errors. Reset on every successful fill.
  // When this hits MAX_CONSECUTIVE_ORDER_ERRORS we auto-stop the bot
  // into ERROR state and DO NOT call scheduleNext, so the schedule
  // does not keep firing against a persistent failure.
  const consecutiveErrorsRef = useRef(0);

  // ── Core ────────────────────────────────────────────────────────
  const [symbol, setSymbol] = useState('BTC-USD');
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [amountPerOrder, setAmountPerOrder] = useState('0.01');
  const [intervalSec, setIntervalSec] = useState('3600');
  const [maxOrders, setMaxOrders] = useState('20');
  const [isSpot, setIsSpot] = useState(false);
  const [executionMode, setExecutionMode] = useState<'SESSION' | 'SINGLE'>('SESSION');

  // ── Conditional buy ───────────────────────────────────────────
  const [condition, setCondition] = useState<DcaCondition>('NONE');
  const [dipPercent, setDipPercent] = useState('1.5');     // % drop from last buy required to fire
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // ── Stop conditions ───────────────────────────────────────────
  const [takeProfitPrice, setTakeProfitPrice] = useState('');
  const [stopLossPrice, setStopLossPrice] = useState('');
  const [takeProfitPct, setTakeProfitPct] = useState('');     // unrealised PnL % gate
  const [stopOpen, setStopOpen] = useState(false);

  const [status, setStatus] = useState<'STOPPED' | 'RUNNING' | 'ERROR'>('STOPPED');
  const [showConfirm, setShowConfirm] = useState(false);

  const [executedOrders, setExecutedOrders] = useState(0);
  const [skippedOrders, setSkippedOrders] = useState(0);
  const [totalInvested, setTotalInvested] = useState(0);
  const [totalQty, setTotalQty] = useState(0);
  const [avgPrice, setAvgPrice] = useState(0);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [logs, setLogs] = useState<DcaLog[]>([]);
  const lastFillPriceRef = useRef<number | null>(null);

  const addLog = useCallback((log: DcaLog) => {
    setLogs((prev) => [log, ...prev].slice(0, 50));
  }, []);

  /**
   * Fetch the latest mid + best bid/ask, return all three so the order
   * placement logic can use the right side of the book and the
   * stop-condition checks can use the mid.
   */
  const fetchPrices = useCallback(async (): Promise<{ bid: number; ask: number; mid: number; fill: number } | null> => {
    const market: 'spot' | 'perps' = isSpot ? 'spot' : 'perps';
    try {
      const tickers = await fetchBookTickers(market);
      const arr = Array.isArray(tickers) ? tickers : [];
      const normalizedSym = normalizeSymbol(symbol, market);
      const ticker = arr.find((t) => (t as Record<string, unknown>).symbol === normalizedSym) as Record<string, unknown> | undefined;
      if (!ticker) return null;
      const bid = parseFloat(String(ticker.bidPrice ?? ticker.bid ?? '0'));
      const ask = parseFloat(String(ticker.askPrice ?? ticker.ask ?? '0'));
      const mid = (bid + ask) / 2;
      const fill = side === 'BUY' ? ask : bid;
      return { bid, ask, mid, fill };
    } catch (err: unknown) {
      addLog({ time: new Date().toLocaleTimeString(), message: `ERROR fetching price: ${getErrorMessage(err)}` });
      return null;
    }
  }, [isSpot, symbol, side, addLog]);

  const stopBot = useCallback((reason?: string) => {
    runningRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setStatus('STOPPED');
    addLog({ time: new Date().toLocaleTimeString(), message: reason ? `Bot stopped — ${reason}` : 'Bot stopped by user' });
  }, [addLog]);

  const executeDcaOrder = useCallback(async () => {
    if (!runningRef.current) return;
    const market: 'spot' | 'perps' = isSpot ? 'spot' : 'perps';
    const sideNum = side === 'BUY' ? 1 : 2;
    const amount = parseFloat(amountPerOrder);
    if (isNaN(amount) || amount <= 0) return;

    try {
      const prices = await fetchPrices();
      if (!prices || prices.fill <= 0) {
        addLog({ time: new Date().toLocaleTimeString(), message: 'No price data available. Order skipped.' });
        return;
      }
      setCurrentPrice(prices.fill);

      // ── Stop conditions evaluated BEFORE firing the next order ──
      const tp = parseFloat(takeProfitPrice);
      const sl = parseFloat(stopLossPrice);
      const tpPct = parseFloat(takeProfitPct);
      if (Number.isFinite(tp) && tp > 0 && side === 'BUY' && prices.mid >= tp) {
        addLog({ time: new Date().toLocaleTimeString(), message: `Take-profit hit (${prices.mid.toFixed(2)} ≥ ${tp}). Stopping.` });
        stopBot(`TP @ ${tp}`);
        return;
      }
      if (Number.isFinite(sl) && sl > 0 && side === 'BUY' && prices.mid <= sl) {
        addLog({ time: new Date().toLocaleTimeString(), message: `Stop-loss hit (${prices.mid.toFixed(2)} ≤ ${sl}). Stopping.` });
        stopBot(`SL @ ${sl}`);
        return;
      }
      if (Number.isFinite(tpPct) && tpPct > 0 && avgPrice > 0) {
        const unrealisedPct = ((prices.mid - avgPrice) / avgPrice) * 100 * (side === 'BUY' ? 1 : -1);
        if (unrealisedPct >= tpPct) {
          addLog({ time: new Date().toLocaleTimeString(), message: `PnL target hit (${unrealisedPct.toFixed(2)}% ≥ ${tpPct}%). Stopping.` });
          stopBot(`PnL @ ${tpPct}%`);
          return;
        }
      }

      // ── Conditional fire: buy-the-dip ──
      if (condition === 'BUY_THE_DIP' && side === 'BUY') {
        const baseline = lastFillPriceRef.current ?? prices.mid;
        const dropNeeded = parseFloat(dipPercent);
        if (Number.isFinite(dropNeeded) && dropNeeded > 0) {
          const drop = ((baseline - prices.fill) / baseline) * 100;
          if (drop < dropNeeded) {
            addLog({
              time: new Date().toLocaleTimeString(),
              message: `Skipped — price ${prices.fill.toFixed(2)} is only ${drop.toFixed(2)}% below baseline ${baseline.toFixed(2)} (need ≥ ${dropNeeded}%)`,
            });
            setSkippedOrders((p) => p + 1);
            return;
          }
        }
      }

      // ── Place market order ──
      const placeRes = await placeOrder(
        { symbol, side: sideNum as 1 | 2, type: 2, quantity: amount.toFixed(8) },
        market,
      );
      const placeResObj = placeRes as Record<string, unknown>;
      const orderId = String(placeResObj?.orderID ?? placeResObj?.orderId ?? placeResObj?.id ?? '');

      // Resolve the REAL fill price + qty via fetchOrderStatus — same
      // retry pattern as SignalBot / TwapBot because /trades lags the
      // placement response by ~300-1500ms on testnet. Fall back to the
      // pre-trade best-offer price if the retries time out; log so the
      // user knows this tick's avgPrice is an estimate.
      let actualPrice = prices.fill;
      let actualQty = amount;
      if (orderId && !isDemoMode) {
        let resolved = false;
        for (let attempt = 0; attempt < 3; attempt++) {
          await new Promise((r) => setTimeout(r, 600));
          try {
            const status = await fetchOrderStatus(orderId, symbol, market);
            if (status && status.filledQty > 0) {
              actualPrice = status.avgFillPrice > 0 ? status.avgFillPrice : actualPrice;
              actualQty = status.filledQty;
              resolved = true;
              break;
            }
            if (status && status.status === 'EXPIRED' && attempt === 2) {
              addLog({
                time: new Date().toLocaleTimeString(),
                message: `DCA order ${orderId} expired unfilled — skipping this tick`,
              });
              setSkippedOrders((p) => p + 1);
              return;
            }
          } catch {
            // swallow — retry loop handles it
          }
        }
        if (!resolved) {
          addLog({
            time: new Date().toLocaleTimeString(),
            message: `Fill verification timed out — avg price uses mid ${actualPrice.toFixed(2)}`,
          });
        }
      }

      const vol = actualQty * actualPrice;
      lastFillPriceRef.current = actualPrice;
      // Successful fill — clear the failure streak.
      consecutiveErrorsRef.current = 0;

      // Use functional setters across the board so multiple rapid ticks
      // (e.g. the user shortens intervalSec to 1s) never overwrite each
      // other's increments via stale closures.
      setExecutedOrders((prev) => {
        const newCount = prev + 1;
        // Running average using the fresh count.
        setAvgPrice((prevAvg) => prevAvg === 0 ? actualPrice : prevAvg + (actualPrice - prevAvg) / newCount);
        // Hard cap on order count — evaluated with the fresh count so
        // max-orders never overshoots by one due to stale-closure reads.
        const maxOrd = parseInt(maxOrders);
        if (Number.isFinite(maxOrd) && maxOrd > 0 && newCount >= maxOrd) {
          // Defer the stop so we don't mutate runningRef inside a setter.
          queueMicrotask(() => stopBot(`Max orders (${maxOrd}) reached`));
        }
        return newCount;
      });
      setTotalInvested((p) => p + vol);
      setTotalQty((p) => p + actualQty);
      useBotPnlStore.getState().recordTrade('dca', {
        pnlUsdt: 0,
        ts: Date.now(),
        note: `${side} ${actualQty.toFixed(6)} @ ${actualPrice.toFixed(2)}`,
      });

      addLog({
        time: new Date().toLocaleTimeString(),
        side,
        amount: actualQty,
        price: actualPrice,
        message: condition === 'BUY_THE_DIP' ? 'Dip buy executed' : 'DCA order executed',
      });
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      consecutiveErrorsRef.current += 1;
      addLog({
        time: new Date().toLocaleTimeString(),
        message: `ERROR (${consecutiveErrorsRef.current}/${MAX_CONSECUTIVE_ORDER_ERRORS}): ${msg}`,
      });
      toast.error(`DCA: ${msg}`);
      // Hard-fail: flip to ERROR status and stop the schedule entirely.
      // The previous implementation kept queuing new ticks against a
      // persistent failure (e.g. expired auth), silently wasting the
      // user's entire DCA schedule.
      if (consecutiveErrorsRef.current >= MAX_CONSECUTIVE_ORDER_ERRORS) {
        runningRef.current = false;
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
        setStatus('ERROR');
        addLog({
          time: new Date().toLocaleTimeString(),
          message: `Auto-stopped after ${MAX_CONSECUTIVE_ORDER_ERRORS} consecutive failures — check credentials / balance and re-Start.`,
        });
      }
    }
  }, [
    isSpot, symbol, side, amountPerOrder,
    takeProfitPrice, stopLossPrice, takeProfitPct,
    avgPrice, condition, dipPercent,
    maxOrders, addLog, fetchPrices, stopBot, isDemoMode,
  ]);

  const scheduleNextRef = useRef<() => void>(() => {});
  useEffect(() => {
    scheduleNextRef.current = () => {
      if (!runningRef.current) return;
      const interval = Math.max(1, parseInt(intervalSec) || 3600) * 1000;
      timerRef.current = setTimeout(async () => {
        await executeDcaOrder();
        scheduleNextRef.current();
      }, interval);
    };
  }, [executeDcaOrder, intervalSec]);

  const doStart = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    setStatus('RUNNING');
    setExecutedOrders(0);
    setSkippedOrders(0);
    setTotalInvested(0);
    setTotalQty(0);
    setAvgPrice(0);
    setCurrentPrice(0);
    setLogs([]);
    lastFillPriceRef.current = null;
    // Clear any failure streak inherited from a previous ERROR-stopped
    // session so the first tick is not unfairly penalised.
    consecutiveErrorsRef.current = 0;

    addLog({
      time: new Date().toLocaleTimeString(),
      message: `DCA Bot started${condition === 'BUY_THE_DIP' ? ` — buy-the-dip mode (${dipPercent}% drop required)` : ''}`,
    });

    (async () => {
      await executeDcaOrder();
      scheduleNextRef.current();
    })();
  }, [executeDcaOrder, addLog, condition, dipPercent]);

  useEffect(() => () => {
    runningRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const isRunning = status === 'RUNNING';
  const pnlPercent = avgPrice > 0 && currentPrice > 0
    ? ((currentPrice - avgPrice) / avgPrice) * 100 * (side === 'BUY' ? 1 : -1)
    : 0;

  // ── Live preview values ──
  const orderAmt = parseFloat(amountPerOrder) || 0;
  const intervalNum = parseInt(intervalSec) || 0;
  const maxOrd = parseInt(maxOrders) || 0;
  const totalAmount = maxOrd > 0 ? orderAmt * maxOrd : 0;
  const totalCapitalNotional = totalAmount * (currentPrice || 0);
  const intervalLabel = useMemo(() => (
    intervalNum >= 86400 ? `${(intervalNum / 86400).toFixed(1)} days`
    : intervalNum >= 3600 ? `${(intervalNum / 3600).toFixed(1)} hours`
    : intervalNum >= 60   ? `${Math.round(intervalNum / 60)} minutes`
    : `${intervalNum} seconds`
  ), [intervalNum]);
  const totalDurationLabel = useMemo(() => {
    if (maxOrd <= 0 || intervalNum <= 0) return 'until stopped';
    const totalSec = intervalNum * Math.max(0, maxOrd - 1);
    if (totalSec >= 86400) return `${(totalSec / 86400).toFixed(1)} days`;
    if (totalSec >= 3600)  return `${(totalSec / 3600).toFixed(1)} hours`;
    if (totalSec >= 60)    return `${Math.round(totalSec / 60)} minutes`;
    return `${totalSec} seconds`;
  }, [maxOrd, intervalNum]);



  // Build UI panels for BotLayout
  const configPanel = (
    <>
      <AutoConfigureButton
        symbol={symbol}
        market={isSpot ? 'spot' : 'perps'}
        recommender={(ctx) => {
          const px = currentPrice > 0 ? currentPrice : (ctx.price || 100);
          const currentBudget = (parseFloat(amountPerOrder) * px) * (parseInt(maxOrders) || 10);
          return recommendDcaBot(ctx, currentBudget || 500);
        }}
        hidden={isRunning}
        onApply={(preset) => {
          if (preset.intervalMin) setIntervalSec(String(parseInt(String(preset.intervalMin)) * 60));
          if (preset.maxOrders)   setMaxOrders(String(preset.maxOrders));
          if (preset.amountPerOrder) {
            const px = currentPrice > 0 ? currentPrice : 0;
            if (px > 0) {
              const baseAmt = parseFloat(String(preset.amountPerOrder)) / px;
              setAmountPerOrder(baseAmt.toFixed(6));
            }
          }
          if (preset.mode === 'buy-the-dip') {
            setCondition('BUY_THE_DIP');
            if (preset.dipPct) setDipPercent(String(preset.dipPct));
          } else if (preset.mode === 'fixed') {
            setCondition('NONE');
          }
        }}
      />
      
      {/* Market */}
      <div className="flex flex-col gap-3">
        <div>
          <label className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2 block">Trading Pair</label>
          <SymbolSelector market={isSpot ? 'spot' : 'perps'} value={symbol} onChange={(val) => {
            setSymbol(val);
            if (val.includes('SOSO')) {
              setIsSpot(true);
              setSymbol('vSOSO-vUSDC');
            }
          }} disabled={isRunning} />
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => { if (!isRunning) setIsSpot(true); }} className={cn('flex-1 py-2 text-xs rounded-lg border transition-all cursor-pointer', isSpot ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background/40 text-text-muted hover:border-border-hover', isRunning && 'opacity-50')}>Spot</button>
          <button 
            type="button" 
            onClick={() => { if (!isRunning && !symbol.includes('SOSO')) setIsSpot(false); }} 
            disabled={symbol.includes('SOSO')}
            className={cn('flex-1 py-2 text-xs rounded-lg border transition-all cursor-pointer', !isSpot ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background/40 text-text-muted hover:border-border-hover', (isRunning || symbol.includes('SOSO')) && 'opacity-50 cursor-not-allowed')}
          >
            Perps
          </button>
        </div>
      </div>
      
      {/* Direction & Amount */}
      <div className="grid grid-cols-2 gap-3">
        <Select label="Direction" value={side} onChange={(e) => setSide(e.target.value as 'BUY' | 'SELL')} disabled={isRunning} options={[{ value: 'BUY', label: 'Buy' }, { value: 'SELL', label: 'Sell' }]} />
        <Input label="Amount per order" type="number" value={amountPerOrder} onChange={(e) => setAmountPerOrder(e.target.value)} disabled={isRunning} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Interval (s)" type="number" value={intervalSec} onChange={(e) => setIntervalSec(e.target.value)} disabled={isRunning} hint="3600 = 1h" />
        <Input label="Max orders" type="number" value={maxOrders} onChange={(e) => setMaxOrders(e.target.value)} disabled={isRunning} hint="0 = unbounded" />
      </div>

      {/* Conditions */}
      <Collapsible open={advancedOpen} onToggle={() => setAdvancedOpen((p) => !p)} icon={<Zap size={14} />} label="Conditional fire" badge={condition !== 'NONE' ? `${condition === 'BUY_THE_DIP' ? `Dip ≥${dipPercent}%` : ''}` : undefined}>
        <div>
          <label className="block text-[11px] font-medium text-text-secondary uppercase tracking-wider mb-1.5">Mode</label>
          <div className="flex gap-2">
            {(['NONE','BUY_THE_DIP'] as const).map((c) => (
              <button key={c} onClick={() => !isRunning && setCondition(c)} className={cn('flex-1 py-2 text-[11px] rounded-lg border transition-all flex flex-col items-center gap-0.5', condition === c ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background/40 text-text-muted hover:border-border-hover', isRunning && 'opacity-50 pointer-events-none')}>
                <span className="font-semibold uppercase tracking-wider">{c === 'NONE' ? 'Always fire' : 'Buy the dip'}</span>
              </button>
            ))}
          </div>
        </div>
        {condition === 'BUY_THE_DIP' && (
          <Input label="Dip % required" type="number" value={dipPercent} onChange={(e) => setDipPercent(e.target.value)} disabled={isRunning} />
        )}
      </Collapsible>

      <Collapsible open={stopOpen} onToggle={() => setStopOpen((p) => !p)} icon={<ShieldAlert size={14} />} label="Stop conditions">
        <Input label="Take-profit price" type="number" value={takeProfitPrice} onChange={(e) => setTakeProfitPrice(e.target.value)} disabled={isRunning} />
        <Input label="Stop-loss price" type="number" value={stopLossPrice} onChange={(e) => setStopLossPrice(e.target.value)} disabled={isRunning} />
        <Input label="Profit % target" type="number" value={takeProfitPct} onChange={(e) => setTakeProfitPct(e.target.value)} disabled={isRunning} />
      </Collapsible>
    </>
  );

  const statsPanel = (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard label="Orders done" value={<NumberDisplay value={executedOrders} decimals={0} />} icon={<Hash size={16} />} />
      <StatCard label="Total invested" value={<NumberDisplay value={totalInvested} prefix="$" />} icon={<DollarSign size={16} />} />
      <StatCard label="Avg. price" value={<NumberDisplay value={avgPrice} />} icon={<Repeat size={16} />} />
      <StatCard label="Unrealised PnL" value={<NumberDisplay value={Math.abs(pnlPercent)} suffix="%" prefix={pnlPercent >= 0 ? '+' : '-'} trend={pnlPercent >= 0 ? 'up' : 'down'} />} icon={<TrendingUp size={16} />} trend={pnlPercent >= 0 ? (pnlPercent > 0 ? 'up' : 'neutral') : 'down'} />
    </div>
  );

  const logsPanel = (
    <div className="h-full overflow-y-auto custom-scrollbar p-3 space-y-2">
      {logs.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-text-muted text-xs gap-2">
          <Activity size={24} className="opacity-30" />
          <span>Waiting for execution...</span>
        </div>
      ) : (
        logs.map((log, i) => (
          <div key={i} className="flex gap-3 text-xs font-mono">
            <span className="text-text-muted/50">{log.time}</span>
            {log.side && <span className={cn(log.side === 'BUY' ? 'text-emerald-400' : 'text-red-400')}>{log.side}</span>}
            {log.amount != null && <span className="tabular-nums text-text-secondary"><NumberDisplay value={log.amount} decimals={4} /></span>}
            {log.price != null && <span className="tabular-nums text-text-muted">@ <NumberDisplay value={log.price} /></span>}
            {log.message && <span className="text-text-secondary truncate">{log.message}</span>}
          </div>
        ))
      )}
    </div>
  );

  return (
    <>
      <BotLayout
        title="DCA Bot"
        icon={Repeat}
        status={status}
        symbol={symbol}
        market={isSpot ? 'spot' : 'perps'}
        configPanel={configPanel}
        statsPanel={statsPanel}
        logsPanel={logsPanel}
        howItWorksPanel={<BotsHowItWorks botType="DCA" />}
        isLocked={isRunning}
        onStart={() => setShowConfirm(true)}
        onStop={stopBot}
      />
      <BotRiskSetupModal
        isOpen={showConfirm}
        botName="DCA Bot"
        onConfirm={() => { setShowConfirm(false); doStart(); }}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
};

// Local helpers
interface CollapsibleProps { open: boolean; onToggle: () => void; icon: React.ReactNode; label: string; badge?: string; children: React.ReactNode; }
const Collapsible: React.FC<CollapsibleProps> = ({ open, onToggle, icon, label, badge, children }) => (
  <div className="rounded-xl border border-border bg-background/30 overflow-hidden">
    <button type="button" onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold text-text-secondary hover:text-text-primary transition-colors bg-surface-2">
      <span className="flex items-center gap-2">{icon}{label}</span>
      <span className="flex items-center gap-2">
        {badge && <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full">{badge}</span>}
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </span>
    </button>
    {open && <div className="p-4 flex flex-col gap-4 border-t border-border/50">{children}</div>}
  </div>
);
