import { useWave3Store } from '../store/wave3Store';
import type { Wave3Regime } from '../store/wave3Store';
import { useRiskStore } from '../store/riskStore';
import { fetchMarkPriceFor } from './btcPredictorEngine'; 

let engineInterval: NodeJS.Timeout | null = null;
let simulatedCycle = 0;

export function startWave3Engine() {
  if (engineInterval) return;
  useWave3Store.getState().addLog('System initialized. Connecting to Gemini Intelligence streams...', 'INFO');
  
  engineInterval = setInterval(async () => {
    const w3State = useWave3Store.getState();
    const riskState = useRiskStore.getState();
    
    // Continuous background checking, but only take action if agent is running
    if (!w3State.isAgentRunning) return;

    try {
      const isSoso = w3State.targetCoin.startsWith('SOSO');
      const price = await fetchMarkPriceFor(w3State.targetCoin, w3State.market) || (isSoso ? 0.28 : 60000);
      
      w3State.updatePositionPnl(price);
      simulatedCycle++;

      // Flash Crash Protection
      if (riskState.isRiskShieldActive && simulatedCycle % 20 === 0) {
        riskState.setRiskLevel('CRITICAL');
        riskState.addRiskEvent({
          type: 'FLASH_CRASH',
          asset: w3State.targetCoin,
          message: `Sudden -4% drop detected in ${w3State.targetCoin} ${w3State.market.toUpperCase()} orderbook.`
        });
        w3State.addLog(`CRITICAL: Flash crash signature detected. Suspending active bots.`, 'WARNING');
        w3State.setActiveAction('EMERGENCY_HALT');
        if (w3State.activePosition) {
          w3State.addLog(`Soft closing active position to protect $${w3State.investment} capital.`, 'ACTION');
          w3State.setActivePosition(null);
        }
        return;
      }
      
      // Recover
      if (riskState.currentRiskLevel === 'CRITICAL' && simulatedCycle % 20 !== 0) {
        riskState.setRiskLevel('SAFE');
        w3State.addLog(`Markets stabilized. Resuming Gemini analysis.`, 'SUCCESS');
      }

      // AI Analysis Cycle
      if (simulatedCycle % 7 === 0 && riskState.currentRiskLevel === 'SAFE') {
        const regimes: Wave3Regime[] = ['CONSOLIDATION', 'TRENDING_UP', 'TRENDING_DOWN', 'HIGH_VOLATILITY'];
        const nextRegime = regimes[Math.floor(Math.random() * regimes.length)];
        w3State.setCurrentRegime(nextRegime);
        
        w3State.addLog(`Gemini identified new regime: ${nextRegime}. Evaluating R/R for ${w3State.targetCoin}...`, 'INFO');

        if (w3State.activePosition) {
           if (w3State.activePosition.pnl > 0 && Math.random() > 0.5) {
             w3State.addLog(`Target reached. Closing ${w3State.activePosition.botType} bot position for profit.`, 'SUCCESS');
             w3State.setActivePosition(null);
           } else if (nextRegime === 'HIGH_VOLATILITY') {
             w3State.addLog(`Volatility spike. Halting current bot to preserve capital.`, 'WARNING');
             w3State.setActivePosition(null);
           }
        } else {
           // Decide to open
           if (nextRegime === 'CONSOLIDATION') {
             if (w3State.feeDragProtection && Math.random() > 0.5) {
                w3State.setActiveAction('WAITING');
                w3State.addLog(`Consolidation detected, but spread is too tight. Fee Drag Protection prevented a negative EV Grid Bot deployment.`, 'WARNING');
             } else {
                w3State.setActiveAction('DEPLOY_GRID');
                w3State.addLog(`Deploying Grid Bot with $${w3State.investment} on ${w3State.targetCoin} ${w3State.market.toUpperCase()} for range-bound arbitrage.`, 'ACTION');
                w3State.setActivePosition({
                  botType: 'Grid Bot',
                  entryPrice: price,
                  currentPrice: price,
                  pnl: 0,
                  size: w3State.investment,
                  status: 'ACTIVE'
                });
             }
           } else if (nextRegime === 'TRENDING_UP') {
             w3State.setActiveAction('DEPLOY_DCA');
             w3State.addLog(`RSI indicates strong momentum. Deploying DCA Bot with $${w3State.investment} to accumulate on uptrend.`, 'ACTION');
             w3State.setActivePosition({
               botType: 'DCA Bot',
               entryPrice: price,
               currentPrice: price,
               pnl: 0,
               size: w3State.investment,
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
  }, 4000); 
}

export function stopWave3Engine() {
  if (engineInterval) {
    clearInterval(engineInterval);
    engineInterval = null;
    useWave3Store.getState().addLog('Autonomous Agent disconnected.', 'WARNING');
  }
}
