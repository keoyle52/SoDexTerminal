import React, { useEffect, useRef, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Play, Square, BarChart3, Hash, DollarSign, Activity } from 'lucide-react';
import { useBotStore } from '../store/botStore';
import { useSettingsStore } from '../store/settingsStore';
import { placeOrder, fetchOrderbook } from '../api/services';
import { NumberDisplay } from '../components/common/NumberDisplay';
import { StatusBadge } from '../components/common/StatusBadge';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { StatCard } from '../components/common/Card';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';

const FEE_RATE = 0.001;
const DEFAULT_INTERVAL_SEC = 10;

export const VolumeBot: React.FC = () => {
  const { volumeBot: state } = useBotStore();
  const { confirmOrders } = useSettingsStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = useRef(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const executeTrade = useCallback(async () => {
    if (!runningRef.current) return;
    const { volumeBot: s } = useBotStore.getState();

    const maxVol = parseFloat(s.maxVolumeTarget);
    if (maxVol > 0 && s.totalVolume >= maxVol) {
      runningRef.current = false;
      s.setField('status', 'STOPPED');
      s.addLog({ time: new Date().toLocaleTimeString(), message: `Max volume target (${maxVol}) reached. Bot stopped.` });
      return;
    }

    const market = s.isSpot ? 'spot' : 'perps';

    try {
      const orderbook = await fetchOrderbook(s.symbol, market, 5);
      const bestBid = orderbook?.bids?.[0]?.[0] ?? orderbook?.bids?.[0]?.price;
      const bestAsk = orderbook?.asks?.[0]?.[0] ?? orderbook?.asks?.[0]?.price;

      if (!bestBid || !bestAsk) {
        s.addLog({ time: new Date().toLocaleTimeString(), message: `No orderbook data for ${s.symbol}` });
        return;
      }

      const bidPrice = parseFloat(bestBid);
      const askPrice = parseFloat(bestAsk);
      const midPrice = (bidPrice + askPrice) / 2;
      const spread = ((askPrice - bidPrice) / midPrice) * 100;

      const spreadTol = parseFloat(s.spreadTolerance);
      if (spreadTol > 0 && spread > spreadTol) {
        s.addLog({ time: new Date().toLocaleTimeString(), message: `Spread too wide (${spread.toFixed(2)}% > ${spreadTol}%). Skipping.` });
        return;
      }

      const min = parseFloat(s.minAmount);
      const max = parseFloat(s.maxAmount);
      const quantity = min + Math.random() * (max - min);
      const side: 1 | 2 = Math.random() > 0.5 ? 1 : 2;
      const sideLabel = side === 1 ? 'BUY' : 'SELL';
      const fillPrice = side === 1 ? askPrice : bidPrice;

      const result = await placeOrder(
        { symbol: s.symbol, side, type: 2, quantity: quantity.toFixed(8) },
        market,
      );

      const vol = quantity * fillPrice;
      const fee = vol * FEE_RATE;

      const freshState = useBotStore.getState().volumeBot;
      const prevCount = freshState.tradesCount;
      const prevSpread = freshState.avgSpread;

      freshState.setField('totalVolume', freshState.totalVolume + vol);
      freshState.setField('tradesCount', prevCount + 1);
      freshState.setField('totalFee', freshState.totalFee + fee);
      freshState.setField('avgSpread', prevSpread + (spread - prevSpread) / (prevCount + 1));

      freshState.addLog({
        time: new Date().toLocaleTimeString(),
        symbol: s.symbol,
        side: sideLabel,
        amount: quantity,
        price: fillPrice,
        fee,
        orderId: result?.orderId ?? result?.id,
      });
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Unknown error';
      s.addLog({ time: new Date().toLocaleTimeString(), message: `ERROR: ${msg}` });
      toast.error(`Volume Bot: ${msg}`);
    }
  }, []);

  const scheduleNextRef = useRef<() => void>(() => {});

  useEffect(() => {
    scheduleNextRef.current = () => {
      if (!runningRef.current) return;
      const { volumeBot: s } = useBotStore.getState();
      const interval = Math.max(1, parseInt(s.intervalSec) || DEFAULT_INTERVAL_SEC) * 1000;
      timerRef.current = setTimeout(async () => {
        await executeTrade();
        scheduleNextRef.current();
      }, interval);
    };
  }, [executeTrade]);

  const doStart = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    state.resetStats();
    state.setField('status', 'RUNNING');
    state.addLog({ time: new Date().toLocaleTimeString(), message: 'Bot started' });

    (async () => {
      await executeTrade();
      scheduleNextRef.current();
    })();
  }, [state, executeTrade]);

  const startBot = useCallback(() => {
    if (confirmOrders) {
      setShowConfirm(true);
    } else {
      doStart();
    }
  }, [confirmOrders, doStart]);

  const stopBot = useCallback(() => {
    runningRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    state.setField('status', 'STOPPED');
    state.addLog({ time: new Date().toLocaleTimeString(), message: 'Bot stopped' });
  }, [state]);

  useEffect(() => {
    return () => {
      runningRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  return (
    <div className="flex h-[calc(100vh-52px)]">
      <ConfirmModal
        isOpen={showConfirm}
        title="Volume Bot'u Başlat"
        message={`${state.symbol} için Volume Bot başlatılacak.\nPiyasa: ${state.isSpot ? 'Spot' : 'Perps'}\nMiktar aralığı: ${state.minAmount} – ${state.maxAmount}\nAralık: ${state.intervalSec}s`}
        onConfirm={doStart}
        onCancel={() => setShowConfirm(false)}
      />

      {/* Settings Panel */}
      <div className="w-80 border-r border-border bg-surface/30 backdrop-blur-sm p-5 flex flex-col gap-5 overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">Ayarlar</h2>
          <StatusBadge status={state.status} />
        </div>

        <Input
          label="Sembol"
          type="text"
          value={state.symbol}
          onChange={(e) => state.setField('symbol', e.target.value)}
          placeholder="BTC-USDC"
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Min Miktar"
            type="number"
            value={state.minAmount}
            onChange={(e) => state.setField('minAmount', e.target.value)}
          />
          <Input
            label="Max Miktar"
            type="number"
            value={state.maxAmount}
            onChange={(e) => state.setField('maxAmount', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Aralık (sn)"
            type="number"
            value={state.intervalSec}
            onChange={(e) => state.setField('intervalSec', e.target.value)}
          />
          <Input
            label="Max Hacim"
            type="number"
            value={state.maxVolumeTarget}
            onChange={(e) => state.setField('maxVolumeTarget', e.target.value)}
            hint="0 = limitsiz"
          />
        </div>

        <Input
          label="Spread Toleransı (%)"
          type="number"
          value={state.spreadTolerance}
          onChange={(e) => state.setField('spreadTolerance', e.target.value)}
          hint="0 = sınırsız"
        />

        {/* Market Toggle */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-medium text-text-secondary uppercase tracking-wider">Piyasa</label>
          <div className="flex gap-2">
            <button
              onClick={() => state.setField('isSpot', true)}
              className={`flex-1 py-2 text-xs rounded-lg border transition-all duration-200 ${state.isSpot ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background/40 text-text-muted hover:border-border-hover'}`}
            >
              Spot
            </button>
            <button
              onClick={() => state.setField('isSpot', false)}
              className={`flex-1 py-2 text-xs rounded-lg border transition-all duration-200 ${!state.isSpot ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background/40 text-text-muted hover:border-border-hover'}`}
            >
              Perps
            </button>
          </div>
        </div>

        <div className="mt-auto pt-4 border-t border-border">
          {state.status !== 'RUNNING' ? (
            <Button
              variant="primary"
              fullWidth
              size="lg"
              icon={<Play size={16} />}
              onClick={startBot}
            >
              Bot&apos;u Başlat
            </Button>
          ) : (
            <Button
              variant="danger"
              fullWidth
              size="lg"
              icon={<Square size={16} />}
              onClick={stopBot}
            >
              Durdur
            </Button>
          )}
        </div>
      </div>

      {/* Live Status Panel */}
      <div className="flex-1 p-6 flex flex-col gap-5 overflow-y-auto">
        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            label="Üretilen Hacim"
            value={<NumberDisplay value={state.totalVolume} suffix=" USDC" />}
            icon={<BarChart3 size={16} />}
          />
          <StatCard
            label="İşlem Sayısı"
            value={<NumberDisplay value={state.tradesCount} decimals={0} />}
            icon={<Hash size={16} />}
          />
          <StatCard
            label="Ödenen Fee"
            value={<NumberDisplay value={state.totalFee} prefix="$" />}
            icon={<DollarSign size={16} />}
          />
          <StatCard
            label="Ort. Spread"
            value={<NumberDisplay value={state.avgSpread} suffix="%" />}
            icon={<Activity size={16} />}
          />
        </div>

        {/* Volume Progress */}
        {parseFloat(state.maxVolumeTarget) > 0 && (
          <div className="glass-card p-4">
            <div className="flex justify-between text-xs mb-2">
              <span className="text-text-secondary">Hacim İlerlemesi</span>
              <span className="text-text-primary font-mono tabular-nums">
                {((state.totalVolume / parseFloat(state.maxVolumeTarget)) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="h-2 bg-background rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-primary-soft rounded-full transition-all duration-500"
                style={{ width: `${Math.min((state.totalVolume / parseFloat(state.maxVolumeTarget)) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Log Panel */}
        <div className="flex-1 glass-card flex flex-col overflow-hidden p-0">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Log Kayıtları</span>
            <span className="text-[10px] text-text-muted">{state.logs.length} kayıt</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-1">
            {state.logs.map((log, i) => (
              <div
                key={i}
                className="text-xs flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-surface-hover/50 transition-colors font-mono animate-fade-in"
              >
                <span className="text-text-muted w-16 shrink-0 tabular-nums">{log.time}</span>
                {log.symbol && <span className="w-20 font-medium text-text-primary">{log.symbol}</span>}
                {log.side && (
                  <span className={`badge ${log.side === 'BUY' ? 'badge-success' : 'badge-danger'}`}>{log.side}</span>
                )}
                {log.amount && (
                  <span className="tabular-nums text-text-secondary">
                    <NumberDisplay value={log.amount} decimals={4} />
                  </span>
                )}
                {log.price && (
                  <span className="tabular-nums text-text-muted">
                    @ <NumberDisplay value={log.price} />
                  </span>
                )}
                {log.message && <span className="text-text-secondary truncate">{log.message}</span>}
              </div>
            ))}
            {state.logs.length === 0 && (
              <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
                <div className="text-center">
                  <Activity size={32} className="mx-auto mb-3 opacity-30" />
                  <p>Bot log kayıtları burada görünecektir.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
