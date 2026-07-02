import { useWave3Store } from '../store/wave3Store';
import type { Wave3Regime } from '../store/wave3Store';
import { useRiskStore } from '../store/riskStore';
import { fetchMarkPriceFor } from './btcPredictorEngine'; // Re-use the existing price fetcher or fallback

let engineInterval: NodeJS.Timeout | null = null;
let simulatedCycle = 0;

export function startWave3Engine() {
  if (engineInterval) return;
  useWave3Store.getState().addLog('System initialized. Connecting to Gemini Intelligence streams...', 'INFO');
  
  engineInterval = setInterval(async () => {
    const w3State = useWave3Store.getState();
    const riskState = useRiskStore.getState();
    if (!w3State.isAgentRunning) return;

    try {
      // 1. Fetch market data
      const isSoso = w3State.targetCoin.startsWith('SOSO');
      const market = isSoso ? 'spot' : 'perps';
      const price = await fetchMarkPriceFor(w3State.targetCoin, market) || (isSoso ? 0.28 : 60000);
      
      // Update running position
      w3State.updatePositionPnl(price);

      simulatedCycle++;

      // 2. Flash Crash / Risk Simulation (Every ~15 cycles for demo)
      if (riskState.isRiskShieldActive && simulatedCycle % 15 === 0) {
        riskState.setRiskLevel('CRITICAL');
        riskState.addRiskEvent({
          type: 'FLASH_CRASH',
          asset: w3State.targetCoin,
          message: `Sudden -4% drop detected in ${w3State.targetCoin} orderbook. Emergency halt activated.`
        });
        w3State.addLog(`CRITICAL: Flash crash signature detected. Suspending active bots.`, 'WARNING');
        w3State.setActiveAction('EMERGENCY_HALT');
        if (w3State.activePosition) {
          w3State.addLog(`Soft closing active position to protect capital.`, 'ACTION');
          w3State.setActivePosition(null);
        }
        return;
      }
      
      // Recover from risk
      if (riskState.currentRiskLevel === 'CRITICAL' && simulatedCycle % 15 !== 0) {
        riskState.setRiskLevel('SAFE');
        w3State.addLog(`Markets stabilized. Resuming Gemini analysis.`, 'SUCCESS');
      }

      // 3. Normal AI Regime Analysis
      if (simulatedCycle % 5 === 0 && riskState.currentRiskLevel === 'SAFE') {
        const regimes: Wave3Regime[] = ['CONSOLIDATION', 'TRENDING_UP', 'TRENDING_DOWN', 'HIGH_VOLATILITY'];
        const nextRegime = regimes[Math.floor(Math.random() * regimes.length)];
        w3State.setCurrentRegime(nextRegime);
        
        w3State.addLog(`Gemini identified new regime: ${nextRegime}. Evaluating R/R...`, 'INFO');

        if (w3State.activePosition) {
           // Decide if we should close
           if (w3State.activePosition.pnl > 0 && Math.random() > 0.5) {
             w3State.addLog(`Target reached. Closing ${w3State.activePosition.botType} bot position for profit.`, 'SUCCESS');
             w3State.setActivePosition(null);
           } else if (nextRegime === 'HIGH_VOLATILITY') {
             w3State.addLog(`Volatility spike. Halting current bot.`, 'WARNING');
             w3State.setActivePosition(null);
           }
        } else {
           // Decide to open a new bot
           if (nextRegime === 'CONSOLIDATION') {
             w3State.setActiveAction('DEPLOY_GRID');
             w3State.addLog(`Deploying Grid Bot for range-bound arbitrage.`, 'ACTION');
             w3State.setActivePosition({
               botType: 'Grid Bot',
               entryPrice: price,
               currentPrice: price,
               pnl: 0,
               size: 1000,
               status: 'ACTIVE'
             });
           } else if (nextRegime === 'TRENDING_UP') {
             w3State.setActiveAction('DEPLOY_DCA');
             w3State.addLog(`Deploying DCA Bot to accumulate on uptrend.`, 'ACTION');
             w3State.setActivePosition({
               botType: 'DCA Bot',
               entryPrice: price,
               currentPrice: price,
               pnl: 0,
               size: 500,
               status: 'ACTIVE'
             });
           } else if (nextRegime === 'TRENDING_DOWN') {
             w3State.setActiveAction('WAITING');
             w3State.addLog(`Downtrend detected. Maintaining capital preservation (Waiting).`, 'INFO');
           }
        }
      }

    } catch (e) {
      console.error(e);
    }
  }, 3000); // Poll every 3 seconds for fast demo UX
}

export function stopWave3Engine() {
  if (engineInterval) {
    clearInterval(engineInterval);
    engineInterval = null;
    useWave3Store.getState().addLog('Autonomous Agent disconnected.', 'WARNING');
  }
}
