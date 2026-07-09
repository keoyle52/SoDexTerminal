import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useRiskStore } from '../store/riskStore';

interface UseRiskEnforcerProps {
  botName: string;
  unrealizedPnlUsdt?: number;
  investmentUsdt?: number;
  onStop: (reason: string) => void;
  isRunning: boolean;
}

export function useRiskEnforcer({
  botName,
  unrealizedPnlUsdt = 0,
  investmentUsdt = 0,
  onStop,
  isRunning
}: UseRiskEnforcerProps) {
  const { maxLossMode, maxLossValue } = useRiskStore();
  const lastPnlRef = useRef(unrealizedPnlUsdt);

  useEffect(() => {
    if (!isRunning) return;

    // We only enforce max loss if PnL is negative
    if (unrealizedPnlUsdt < 0) {
      const lossMagnitude = Math.abs(unrealizedPnlUsdt);
      
      let shouldStop = false;
      let reason = '';

      if (maxLossMode === 'usd' && lossMagnitude >= maxLossValue) {
        shouldStop = true;
        reason = `Max Loss Reached ($${lossMagnitude.toFixed(2)} >= $${maxLossValue})`;
      } else if (maxLossMode === 'pct' && investmentUsdt > 0) {
        const lossPct = (lossMagnitude / investmentUsdt) * 100;
        if (lossPct >= maxLossValue) {
          shouldStop = true;
          reason = `Max Loss Reached (${lossPct.toFixed(2)}% >= ${maxLossValue}%)`;
        }
      }

      if (shouldStop) {
        toast.error(`[${botName}] Risk Shield Triggered: ${reason}`);
        onStop(reason);
      }
    }

    lastPnlRef.current = unrealizedPnlUsdt;
  }, [unrealizedPnlUsdt, isRunning, maxLossMode, maxLossValue, investmentUsdt, botName, onStop]);
}
