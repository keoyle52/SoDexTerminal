export type SizingMode = 'fixed' | 'proportional';

export interface CopyConfig {
  sourceAccountId: string;
  sizingMode: SizingMode;
  fixedNotionalUsd: number;
  proportionalPct: number;
  maxLeverage: number;
  maxNotionalPerTradeUsd: number;
  maxDailyLossUsd: number;
  requireStopLoss: boolean;
  defaultStopLossPct: number;
  paused: boolean;
  slippageFeeGuardEnabled: boolean;
  aiCoPilotMode: 'disabled' | 'auto' | 'manual';
  aiRiskThreshold: number;
}

export interface AccountSnapshot {
  equityUsd: number;
  todayRealizedPnlUsd: number;
  openNotionalUsd: number;
}

export interface RiskDecision {
  allow: boolean;
  reason: string;
  sizedQuantity: string;
  appliedStopLossPrice: string | null;
}

export function evaluateCopyTrade(
  trade: { s: string; S: string; p: string; q: string },
  config: CopyConfig,
  account: AccountSnapshot
): RiskDecision {
  const reject = (reason: string): RiskDecision => ({
    allow: false, reason, sizedQuantity: '0', appliedStopLossPrice: null,
  });

  if (config.paused) return reject('Session is paused');

  if (account.todayRealizedPnlUsd < -config.maxDailyLossUsd) {
    return reject(`Daily loss limit exceeded: $${Math.abs(account.todayRealizedPnlUsd).toFixed(2)} > $${config.maxDailyLossUsd}`);
  }

  const price = parseFloat(trade.p);
  const sourceQty = parseFloat(trade.q);
  if (!price || !sourceQty) return reject('Malformed trade payload');

  let notional: number;
  if (config.sizingMode === 'proportional') {
    notional = price * sourceQty * (config.proportionalPct / 100);
  } else {
    notional = config.fixedNotionalUsd;
  }

  if (config.slippageFeeGuardEnabled && notional < 10) {
    return reject('Trade too small ($<10) — slippage/fee guard');
  }

  notional = Math.min(notional, config.maxNotionalPerTradeUsd);

  const maxAllowed = account.equityUsd * config.maxLeverage - account.openNotionalUsd;
  if (maxAllowed <= 0) return reject('Leverage budget exhausted');
  notional = Math.min(notional, maxAllowed);

  const sizedQty = (notional / price).toFixed(6);

  let stopPrice: string | null = null;
  if (config.requireStopLoss) {
    const pct = config.defaultStopLossPct / 100;
    stopPrice = trade.S === 'BUY'
      ? (price * (1 - pct)).toFixed(4)
      : (price * (1 + pct)).toFixed(4);
  }

  return { allow: true, reason: 'Passed all risk checks', sizedQuantity: sizedQty, appliedStopLossPrice: stopPrice };
}
