import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  ChevronDown, ChevronUp, ShieldAlert, AlertTriangle, Info,
  Hash, BarChart3, DollarSign, Clock
} from 'lucide-react';
import { NumberDisplay } from '../components/common/NumberDisplay';
import { BotRiskSetupModal } from '../components/common/BotRiskSetupModal';
import { StatCard } from '../components/common/Card';
import { Input, Select } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { useSettingsStore } from '../store/settingsStore';
import { placeOrder, fetchBookTickers, fetchFeeRate, fetchOrderStatus, cancelOrder, normalizeSymbol } from '../api/services';
import type { FeeRateInfo } from '../api/services';
import { recommendTwapBot } from '../api/aiAutoConfig';
import { AutoConfigureButton } from '../components/common/AutoConfigureButton';
import { SymbolSelector } from '../components/common/SymbolSelector';
import { BotLayout } from '../components/bots/BotLayout';
import { BotsHowItWorks } from '../components/bots/BotsHowItWorks';
import { cn, getErrorMessage } from '../lib/utils';
import { useBotPnlStore } from '../store/botPnlStore';

// After this many consecutive slice failures the bot auto-stops into
// ERROR state. TWAP runs are typically long (minutes-to-hours) so 3 is
// a reasonable balance between "don't give up on a single blip" and
// "don't burn through half the run on persistent failures".
const MAX_CONSECUTIVE_SLICE_ERRORS = 3;

interface TwapLog {
  time: string;
  side?: string;
  message?: string;
  price?: number;
  amount?: number;
}

type TwapOrderType = 'MARKET' | 'LIMIT';

export const TwapBot: React.FC = () => {
  const { confirmOrders, isDemoMode } = useSettingsStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = useRef(false);
  const feeRateRef = useRef<FeeRateInfo>({ makerFee: 0.00035, takerFee: 0.00065 });
  const pendingLimitOrdersRef = useRef<Set<string>>(new Set());
  const consecutiveErrorsRef = useRef(0);

  // ── Core ────────────────────────────────────────────────────────
  const [symbol, setSymbol] = useState('BTC-USD');
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [totalAmount, setTotalAmount] = useState('1.0');
  const [slices, setSlices] = useState('10');
  const [intervalSec, setIntervalSec] = useState('60');
  const [isSpot, setIsSpot] = useState(false);
  const [executionMode, setExecutionMode] = useState<'SESSION' | 'SINGLE'>('SESSION');

  // ── Advanced execution ───────────────────────────────────────────────────
  const [orderType, setOrderType] = useState<TwapOrderType>('MARKET');
  const [limitOffsetBps, setLimitOffsetBps] = useState('5');
  const [sizeVariancePct, setSizeVariancePct] = useState('0');
  const [timeVariancePct, setTimeVariancePct] = useState('0');
  const [maxBuyPrice, setMaxBuyPrice] = useState('');
  const [minSellPrice, setMinSellPrice] = useState('');
  
  

  const [status, setStatus] = useState<'STOPPED' | 'RUNNING' | 'ERROR'>('STOPPED');
  const [showConfirm, setShowConfirm] = useState(false);

  const [executedSlices, setExecutedSlices] = useState(0);
  const [executedVolume, setExecutedVolume] = useState(0);
  const [executedQty, setExecutedQty] = useState(0);
  const [skippedSlices, setSkippedSlices] = useState(0);
  const [avgPrice, setAvgPrice] = useState(0);
  const [totalFee, setTotalFee] = useState(0);
  const [logs, setLogs] = useState<TwapLog[]>([]);

  const addLog = useCallback((log: TwapLog) => {
    setLogs((prev) => [log, ...prev].slice(0, 50));
  }, []);

  const jitter = useCallback((value: number, percent: number): number => {
    if (!Number.isFinite(percent) || percent <= 0) return value;
    const p = Math.min(Math.abs(percent), 50) / 100;
    const factor = 1 + (Math.random() * 2 - 1) * p;
    return Math.max(0, value * factor);
  }, []);

  const executeSlice = useCallback(async (
    sliceAmount: number,
    currentSlice: number,
    totalSlices: number,
  ): Promise<'OK' | 'SKIPPED' | 'ERROR'> => {
    if (!runningRef.current) return 'ERROR';

    const market: 'spot' | 'perps' = isSpot ? 'spot' : 'perps';
    const sideNum = side === 'BUY' ? 1 : 2;

    try {
      const tickers = await fetchBookTickers(market);
      const arr = Array.isArray(tickers) ? tickers : [];
      const normalizedSym = normalizeSymbol(symbol, market);
      const ticker = arr.find((t) => (t as Record<string, unknown>).symbol === normalizedSym) as Record<string, unknown> | undefined;

      const bidPrice = parseFloat(String(ticker?.bidPrice ?? ticker?.bid ?? '0'));
      const askPrice = parseFloat(String(ticker?.askPrice ?? ticker?.ask ?? '0'));
      const midPrice = (bidPrice + askPrice) / 2;
      if (bidPrice <= 0 || askPrice <= 0) {
        addLog({ time: new Date().toLocaleTimeString(), message: `No price data — slice ${currentSlice + 1} skipped.` });
        setSkippedSlices((p) => p + 1);
        return 'SKIPPED';
      }

      const maxBuy  = parseFloat(maxBuyPrice);
      const minSell = parseFloat(minSellPrice);
      if (side === 'BUY' && Number.isFinite(maxBuy) && maxBuy > 0 && midPrice > maxBuy) {
        addLog({
          time: new Date().toLocaleTimeString(),
          side,
          price: midPrice,
          message: `Slice ${currentSlice + 1} skipped — mid ${midPrice.toFixed(2)} > max buy ${maxBuy}`,
        });
        setSkippedSlices((p) => p + 1);
        return 'SKIPPED';
      }
      if (side === 'SELL' && Number.isFinite(minSell) && minSell > 0 && midPrice < minSell) {
        addLog({
          time: new Date().toLocaleTimeString(),
          side,
          price: midPrice,
          message: `Slice ${currentSlice + 1} skipped — mid ${midPrice.toFixed(2)} < min sell ${minSell}`,
        });
        setSkippedSlices((p) => p + 1);
        return 'SKIPPED';
      }

      const fillPrice = side === 'BUY' ? askPrice : bidPrice;
      const orderParams: Record<string, unknown> = {
        symbol,
        side: sideNum as 1 | 2,
        type: orderType === 'LIMIT' ? 1 : 2,
        quantity: sliceAmount.toFixed(8),
      };
      if (orderType === 'LIMIT') {
        const offsetBps = parseFloat(limitOffsetBps) || 0;
        const offsetPx = (offsetBps / 10_000) * midPrice;
        const limitPx = side === 'BUY' ? bidPrice + offsetPx : askPrice - offsetPx;
        orderParams.price = limitPx.toFixed(8);
        orderParams.timeInForce = 1;
      }

      const placeRes = await placeOrder(orderParams as unknown as Parameters<typeof placeOrder>[0], market);
      const placeResObj = placeRes as Record<string, unknown>;
      const orderId = String(placeResObj?.orderID ?? placeResObj?.orderId ?? placeResObj?.id ?? '');

      let actualPrice = orderType === 'MARKET' ? fillPrice : parseFloat(String(orderParams.price));
      let actualQty = sliceAmount;
      let actualFee = 0;
      let filledThisCall = orderType === 'MARKET';

      if (orderType === 'LIMIT' && orderId && !isDemoMode) {
        pendingLimitOrdersRef.current.add(orderId);
      }

      if (orderType === 'MARKET' && orderId && !isDemoMode) {
        for (let attempt = 0; attempt < 3; attempt++) {
          await new Promise((r) => setTimeout(r, 600));
          try {
            const status = await fetchOrderStatus(orderId, symbol, market);
            if (status && status.filledQty > 0) {
              actualPrice = status.avgFillPrice > 0 ? status.avgFillPrice : actualPrice;
              actualQty = status.filledQty;
              actualFee = status.totalFee > 0 ? status.totalFee : (actualQty * actualPrice) * feeRateRef.current.takerFee;
              filledThisCall = true;
              break;
            }
          } catch {
            // swallow
          }
        }
      } else {
        const feeBps = orderType === 'LIMIT' ? feeRateRef.current.makerFee : feeRateRef.current.takerFee;
        actualFee = (actualQty * actualPrice) * feeBps;
      }

      const vol = actualQty * actualPrice;
      setExecutedSlices((p) => p + 1);
      setExecutedVolume((p) => p + vol);
      setExecutedQty((p) => p + actualQty);
      setTotalFee((p) => p + actualFee);
      setAvgPrice((prev) => {
        const prevSlices = currentSlice;
        return prevSlices === 0 ? actualPrice : prev + (actualPrice - prev) / (prevSlices + 1);
      });
      useBotPnlStore.getState().recordTrade('twap', {
        pnlUsdt: 0,
        ts: Date.now(),
        note: `Slice ${currentSlice + 1}/${totalSlices} ${side} ${actualQty.toFixed(6)} @ ${actualPrice.toFixed(2)}${orderType === 'LIMIT' ? ' (limit)' : ''}`,
      });
      addLog({
        time: new Date().toLocaleTimeString(),
        side,
        amount: actualQty,
        price: actualPrice,
        message: `Slice ${currentSlice + 1}/${totalSlices} ${orderType === 'LIMIT' ? 'limit-placed' : filledThisCall ? 'filled' : 'filled (unverified)'}`,
      });
      consecutiveErrorsRef.current = 0;
      return 'OK';
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      consecutiveErrorsRef.current += 1;
      addLog({
        time: new Date().toLocaleTimeString(),
        message: `ERROR (${consecutiveErrorsRef.current}/${MAX_CONSECUTIVE_SLICE_ERRORS}): ${msg}`,
      });
      toast.error(`TWAP: ${msg}`);
      return 'ERROR';
    }
  }, [symbol, side, isSpot, orderType, limitOffsetBps, maxBuyPrice, minSellPrice, addLog, isDemoMode]);

  const doStart = useCallback(() => {
    if (runningRef.current) return;

    const total = parseFloat(totalAmount);
    const numSlices = parseInt(slices);
    const interval = parseInt(intervalSec);

    if (isNaN(total) || isNaN(numSlices) || isNaN(interval) || total <= 0 || numSlices < 1 || interval < 1) {
      toast.error('Invalid parameters');
      return;
    }

    runningRef.current = true;
    setStatus('RUNNING');
    setExecutedSlices(0);
    setExecutedVolume(0);
    setExecutedQty(0);
    setSkippedSlices(0);
    setAvgPrice(0);
    setTotalFee(0);
    setLogs([]);
    consecutiveErrorsRef.current = 0;
    pendingLimitOrdersRef.current = new Set();

    const baseSlice = total / numSlices;
    const sizeVar = parseFloat(sizeVariancePct) || 0;
    const timeVar = parseFloat(timeVariancePct) || 0;

    let currentSlice = 0;
    let cumulativeQty = 0;
    const market: 'spot' | 'perps' = isSpot ? 'spot' : 'perps';

    const runSlice = async () => {
      if (!runningRef.current || currentSlice >= numSlices) {
        if (currentSlice >= numSlices) {
          runningRef.current = false;
          setStatus('STOPPED');
          addLog({ time: new Date().toLocaleTimeString(), message: 'All slices completed. Bot stopped.' });
        }
        return;
      }

      const remainingQty = Math.max(0, total - cumulativeQty);
      const targetSlice = currentSlice === numSlices - 1
        ? remainingQty
        : Math.min(remainingQty, jitter(baseSlice, sizeVar));
      cumulativeQty += targetSlice;

      await executeSlice(targetSlice, currentSlice, numSlices);

      if (consecutiveErrorsRef.current >= MAX_CONSECUTIVE_SLICE_ERRORS) {
        runningRef.current = false;
        setStatus('ERROR');
        addLog({
          time: new Date().toLocaleTimeString(),
          message: `Auto-stopped after ${MAX_CONSECUTIVE_SLICE_ERRORS} consecutive slice errors`,
        });
        return;
      }

      currentSlice++;

      if (runningRef.current && currentSlice < numSlices) {
        const nextDelay = jitter(interval, timeVar) * 1000;
        timerRef.current = setTimeout(runSlice, nextDelay);
      } else if (currentSlice >= numSlices) {
        runningRef.current = false;
        setStatus('STOPPED');
        addLog({ time: new Date().toLocaleTimeString(), message: 'All slices completed. Bot stopped.' });
      }
    };

    (async () => {
      const feeRate = await fetchFeeRate(market);
      feeRateRef.current = feeRate;
      addLog({
        time: new Date().toLocaleTimeString(),
        message: `TWAP started: ${numSlices} slices × ${baseSlice.toFixed(6)}, ${interval}s interval, ${orderType} orders`,
      });
      runSlice();
    })();
  }, [
    totalAmount, slices, intervalSec, isSpot, sizeVariancePct, timeVariancePct,
    orderType, executeSlice, addLog, jitter,
  ]);

  const stopBot = useCallback(async () => {
    runningRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const market: 'spot' | 'perps' = isSpot ? 'spot' : 'perps';
    const pending = Array.from(pendingLimitOrdersRef.current);
    if (pending.length > 0 && !isDemoMode) {
      await Promise.all(pending.map((id) =>
        cancelOrder(id, symbol, market).catch(() => { /* already gone */ }),
      ));
      addLog({ time: new Date().toLocaleTimeString(), message: `Cancelled ${pending.length} pending limit order(s)` });
    }
    pendingLimitOrdersRef.current = new Set();
    consecutiveErrorsRef.current = 0;
    setStatus('STOPPED');
    addLog({ time: new Date().toLocaleTimeString(), message: 'Bot stopped by user' });
  }, [addLog, isDemoMode, isSpot, symbol]);

  useEffect(() => () => {
    runningRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const isRunning = status === 'RUNNING';
  const totalSlicesNum = parseInt(slices) || 1;

  const totalNum = parseFloat(totalAmount) || 0;
  const intervalNum = parseInt(intervalSec) || 0;
  const totalDurationSec = intervalNum * Math.max(0, totalSlicesNum - 1);
  const durationLabel = useMemo(() => (
    totalDurationSec >= 3600
      ? `${(totalDurationSec / 3600).toFixed(1)} hours`
      : totalDurationSec >= 60 ? `${Math.round(totalDurationSec / 60)} minutes`
      : `${totalDurationSec} seconds`
  ), [totalDurationSec]);
  const sliceQty = totalSlicesNum > 0 ? totalNum / totalSlicesNum : 0;



  const configPanel = (
    <>
      <AutoConfigureButton
        symbol={symbol}
        market={isSpot ? 'spot' : 'perps'}
        recommender={recommendTwapBot}
        hidden={isRunning}
        onApply={(preset) => {
          if (preset.slices)      setSlices(String(preset.slices));
          if (preset.intervalSec) setIntervalSec(String(preset.intervalSec));
          if (preset.orderType === 'limit') setOrderType('LIMIT');
        }}
      />

      <div>
        <label className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2 block">Trading Pair</label>
        <SymbolSelector market={isSpot ? 'spot' : 'perps'} value={symbol} onChange={setSymbol} disabled={isRunning} />
      </div>

      <div className="grid grid-cols-2 gap-2 bg-background/50 p-1 rounded-xl border border-border/50">
        <button type="button" onClick={() => setExecutionMode('SESSION')} className={cn("py-2 text-xs font-bold rounded-lg transition-colors", executionMode === 'SESSION' ? "bg-primary text-background" : "text-text-muted hover:text-text-primary")}>Session (Auto)</button>
        <button type="button" onClick={() => setExecutionMode('SINGLE')} className={cn("py-2 text-xs font-bold rounded-lg transition-colors", executionMode === 'SINGLE' ? "bg-amber-500 text-background" : "text-text-muted hover:text-text-primary")}>Single (Manual)</button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Select label="Direction" value={side} onChange={(e) => setSide(e.target.value as 'BUY' | 'SELL')} disabled={isRunning} options={[{ value: 'BUY', label: 'Buy' }, { value: 'SELL', label: 'Sell' }]} />
        <Input label="Total amount" type="number" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} disabled={isRunning} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Slice count" type="number" value={slices} onChange={(e) => setSlices(e.target.value)} disabled={isRunning} />
        <Input label="Interval (s)" type="number" value={intervalSec} onChange={(e) => setIntervalSec(e.target.value)} disabled={isRunning} />
      </div>

        <div className="flex gap-2">
          {(['MARKET','LIMIT'] as const).map((t) => (
            <button key={t} onClick={() => !isRunning && setOrderType(t)} className={cn('flex-1 py-2 text-[11px] rounded-lg border transition-all', orderType === t ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background/40 text-text-muted hover:border-border-hover', isRunning && 'opacity-50 pointer-events-none')}>{t}</button>
          ))}
        </div>
        {orderType === 'LIMIT' && (
          <Input label="Limit offset (bps inside spread)" type="number" value={limitOffsetBps} onChange={(e) => setLimitOffsetBps(e.target.value)} disabled={isRunning} />
        )}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Size variance %" type="number" value={sizeVariancePct} onChange={(e) => setSizeVariancePct(e.target.value)} disabled={isRunning} />
          <Input label="Time variance %" type="number" value={timeVariancePct} onChange={(e) => setTimeVariancePct(e.target.value)} disabled={isRunning} />
        </div>

        {side === 'BUY' ? (
          <Input label="Max buy price" type="number" value={maxBuyPrice} onChange={(e) => setMaxBuyPrice(e.target.value)} disabled={isRunning} />
        ) : (
          <Input label="Min sell price" type="number" value={minSellPrice} onChange={(e) => setMinSellPrice(e.target.value)} disabled={isRunning} />
        )}
      
    </>
  );

  const statsPanel = (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard label="Slices done" value={<span>{executedSlices}/{totalSlicesNum}</span>} icon={<Hash size={16} />} />
      <StatCard label="Volume" value={<NumberDisplay value={executedVolume} prefix="$" />} icon={<BarChart3 size={16} />} />
      <StatCard label="Avg. price" value={<NumberDisplay value={avgPrice} />} icon={<DollarSign size={16} />} />
      <StatCard label="Total fee" value={<NumberDisplay value={totalFee} prefix="$" />} icon={<Clock size={16} />} />
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
        title="TWAP Bot"
        icon={Clock}
        status={status}
        symbol={symbol}
        market={isSpot ? 'spot' : 'perps'}
        configPanel={configPanel}
        statsPanel={statsPanel}
        logsPanel={logsPanel}
        howItWorksPanel={<BotsHowItWorks botType="TWAP" />}
        isLocked={isRunning}
        onStart={() => setShowConfirm(true)}
        onStop={stopBot}
      />
      <BotRiskSetupModal
        isOpen={showConfirm}
        botName="TWAP Strategy"
        onConfirm={() => { setShowConfirm(false); doStart(); }}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
};
