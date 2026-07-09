import { useWave3Store } from '../store/wave3Store';
import type { Wave3Regime } from '../store/wave3Store';
import { useRiskStore } from '../store/riskStore';
import { fetchKlines, placeOrder, cancelAllOrders } from './services';

let engineInterval: NodeJS.Timeout | null = null;
let lastPrice = 0;

function calculateRSI(closes: number[], period: number = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * 13 + gain) / 14;
    avgLoss = (avgLoss * 13 + loss) / 14;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateEMA(closes: number[], period: number): number {
  const k = 2 / (period + 1);
  let ema = closes[0];
  for (let i = 1; i < closes.length; i++) {
    ema = (closes[i] * k) + (ema * (1 - k));
  }
  return ema;
}

function calculateMACD(closes: number[]): { macd: number; signal: number; hist: number } {
  if (closes.length < 26) return { macd: 0, signal: 0, hist: 0 };
  const ema12 = calculateEMA(closes.slice(-12), 12);
  const ema26 = calculateEMA(closes.slice(-26), 26);
  const macdLine = ema12 - ema26;
  // Approximation of signal line for simplicity (normally EMA of MACD line)
  const signalLine = macdLine * 0.9; 
  return { macd: macdLine, signal: signalLine, hist: macdLine - signalLine };
}

function calculateBollingerBands(closes: number[], period: number = 20): { upper: number; lower: number; basis: number } {
  if (closes.length < period) return { upper: 0, lower: 0, basis: 0 };
  const slice = closes.slice(-period);
  const basis = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + Math.pow(b - basis, 2), 0) / period;
  const stdDev = Math.sqrt(variance);
  return { upper: basis + (stdDev * 2), lower: basis - (stdDev * 2), basis };
}

function calculateVolatility(closes: number[]): number {
  if (closes.length < 2) return 0;
  const max = Math.max(...closes);
  const min = Math.min(...closes);
  return ((max - min) / closes[closes.length - 1]) * 100; // Volatility as % spread
}

export function startWave3Engine() {
  if (engineInterval) return;
  useWave3Store.getState().addLog('System initialized. Orchestrator connecting to Exchange...', 'INFO');
  
  engineInterval = setInterval(async () => {
    const w3State = useWave3Store.getState();
    const riskState = useRiskStore.getState();
    
    if (!w3State.isAgentRunning) return;

    try {
      const klines = await fetchKlines(w3State.targetCoin, '1m', 30, w3State.market);
      if (!klines || klines.length === 0) return;
      
      const closes = (klines as number[][]).map(k => Number(k[4]));
      const currentPrice = closes[closes.length - 1];
      if (lastPrice === 0) lastPrice = currentPrice;

      w3State.updatePositionPnl(currentPrice);

      // --- Flash Crash Protection ---
      const dropPct = ((lastPrice - currentPrice) / lastPrice) * 100;
      if (riskState.isRiskShieldActive && dropPct > 3) {
        riskState.setRiskLevel('CRITICAL');
        riskState.addRiskEvent({
          type: 'FLASH_CRASH',
          asset: w3State.targetCoin,
          message: `Sudden ${dropPct.toFixed(2)}% drop detected.`
        });
        w3State.addLog(`CRITICAL: Flash crash detected! Suspending all operations.`, 'WARNING');
        w3State.setActiveAction('EMERGENCY_HALT');
        
        if (w3State.activePosition) {
          w3State.addLog(`Liquidating active ${w3State.activePosition.botType} to protect capital.`, 'ACTION');
          const qty = (w3State.activePosition.size / currentPrice).toFixed(6);
          const isShort = w3State.activePosition.botType === 'Signal Bot';
          await placeOrder({ symbol: w3State.targetCoin, side: isShort ? 1 : 2, type: 2, quantity: qty }, w3State.market);
          await cancelAllOrders(w3State.targetCoin, w3State.market);
          w3State.setActivePosition(null);
        }
        lastPrice = currentPrice;
        return;
      }
      
      if (riskState.currentRiskLevel === 'CRITICAL' && dropPct <= 0.5) {
        riskState.setRiskLevel('SAFE');
        w3State.addLog(`Markets stabilized. Resuming Gemini AI analysis.`, 'SUCCESS');
      }
      lastPrice = currentPrice;

      // --- AI Regime Detection ---
      const rsi = calculateRSI(closes, 14);
      const vol = calculateVolatility(closes.slice(-14));
      const macd = calculateMACD(closes);
      const bb = calculateBollingerBands(closes, 20);
      
      let newRegime: Wave3Regime = 'CONSOLIDATION';
      
      // Advanced Logic combining indicators
      const isOversold = rsi < 40 && currentPrice < bb.lower && macd.hist > 0; 
      const isOverbought = rsi > 60 && currentPrice > bb.upper && macd.hist < 0;

      if (vol > 1.5) {
        newRegime = 'HIGH_VOLATILITY'; // High swings -> Grid Bot
      } else if (isOversold) {
        newRegime = 'TRENDING_UP'; // Strong Oversold + MACD curl -> DCA Bot (Long)
      } else if (isOverbought) {
        newRegime = 'TRENDING_DOWN'; // Strong Overbought + MACD drop -> Signal Bot (Short)
      } else {
        newRegime = 'CONSOLIDATION'; // Tight range -> Market Maker Bot
      }

      if (newRegime !== w3State.currentRegime) {
        w3State.setCurrentRegime(newRegime);
        w3State.addLog(`Market Regime shifted to ${newRegime}. RSI: ${rsi.toFixed(1)} | MACD: ${macd.hist.toFixed(2)} | Vol: ${vol.toFixed(2)}%`, 'INFO');
      }

      // --- Execution Orchestrator ---
      if (w3State.activePosition) {
        const pos = w3State.activePosition;
        const pnlPct = (pos.pnl / pos.size) * 100;
        const qty = (pos.size / pos.entryPrice).toFixed(6);

        // --- Hard Stop Loss (Max Drawdown) ---
        if (pnlPct <= -w3State.maxDrawdownPct) {
          w3State.addLog(`Max Drawdown Limit (-${w3State.maxDrawdownPct}%) reached! Liquidating to protect capital.`, 'WARNING');
          const isShort = pos.botType === 'Signal Bot';
          await placeOrder({ symbol: w3State.targetCoin, side: isShort ? 1 : 2, type: 2, quantity: qty }, w3State.market);
          await cancelAllOrders(w3State.targetCoin, w3State.market);
          w3State.setActivePosition(null);
          w3State.setActiveAction('WAITING');
          return;
        }

        // Sub-Bot Lifecycle Management
        if (pos.botType === 'DCA Bot' && (rsi > 55 || pnlPct > 1.5)) {
          w3State.addLog(`DCA Long target reached (PnL: +${pnlPct.toFixed(2)}%). Closing position.`, 'SUCCESS');
          await placeOrder({ symbol: w3State.targetCoin, side: 2, type: 2, quantity: qty }, w3State.market);
          w3State.setActivePosition(null);
          w3State.setActiveAction('WAITING');
        } 
        else if (pos.botType === 'Signal Bot' && (rsi < 45 || pnlPct > 1.5)) {
          w3State.addLog(`Signal Short target reached (PnL: +${pnlPct.toFixed(2)}%). Closing position.`, 'SUCCESS');
          await placeOrder({ symbol: w3State.targetCoin, side: 1, type: 2, quantity: qty }, w3State.market);
          w3State.setActivePosition(null);
          w3State.setActiveAction('WAITING');
        }
        else if (pos.botType === 'Market Maker Bot' && newRegime !== 'CONSOLIDATION') {
          w3State.addLog(`Volatility expanded. Halting Market Maker to prevent toxic flow.`, 'WARNING');
          await cancelAllOrders(w3State.targetCoin, w3State.market);
          await placeOrder({ symbol: w3State.targetCoin, side: 2, type: 2, quantity: (Number(qty)*0.2).toFixed(6) }, w3State.market); // Dump partial inventory
          w3State.setActivePosition(null);
          w3State.setActiveAction('WAITING');
        }
        else if (pos.botType === 'Grid Bot' && newRegime !== 'HIGH_VOLATILITY') {
          w3State.addLog(`Volatility normalized. Closing Grid Bot.`, 'SUCCESS');
          await cancelAllOrders(w3State.targetCoin, w3State.market);
          await placeOrder({ symbol: w3State.targetCoin, side: 2, type: 2, quantity: (Number(qty)*0.5).toFixed(6) }, w3State.market);
          w3State.setActivePosition(null);
          w3State.setActiveAction('WAITING');
        }
      } 
      else {
        // Deploying Sub-Bots based on Regime
        if (newRegime === 'TRENDING_UP') {
          if (w3State.feeDragProtection && rsi > 38) {
             if (w3State.activeAction !== 'WAITING') w3State.setActiveAction('WAITING');
          } else {
             w3State.setActiveAction('DEPLOY_DCA');
             w3State.addLog(`Oversold (${rsi.toFixed(1)}). Deploying DCA Bot (Market Long).`, 'ACTION');
             const qty = (w3State.investment / currentPrice).toFixed(6);
             await placeOrder({ symbol: w3State.targetCoin, side: 1, type: 2, quantity: qty }, w3State.market);
             w3State.setActivePosition({ botType: 'DCA Bot', side: 'LONG', entryPrice: currentPrice, currentPrice, pnl: 0, size: w3State.investment, status: 'ACTIVE' });
          }
        } 
        else if (newRegime === 'TRENDING_DOWN') {
          w3State.setActiveAction('DEPLOY_SIGNAL');
          w3State.addLog(`Overbought (${rsi.toFixed(1)}). Deploying Signal Bot (Market Short).`, 'ACTION');
          const qty = (w3State.investment / currentPrice).toFixed(6);
          await placeOrder({ symbol: w3State.targetCoin, side: 2, type: 2, quantity: qty }, w3State.market);
          w3State.setActivePosition({ botType: 'Signal Bot', side: 'SHORT', entryPrice: currentPrice, currentPrice, pnl: 0, size: w3State.investment, status: 'ACTIVE' });
        }
        else if (newRegime === 'CONSOLIDATION') {
          w3State.setActiveAction('DEPLOY_MM');
          w3State.addLog(`Tight range. Deploying Market Maker Bot around $${currentPrice.toFixed(2)}.`, 'ACTION');
          const qty = ((w3State.investment * 0.25) / currentPrice).toFixed(6);
          await placeOrder({ symbol: w3State.targetCoin, side: 1, type: 1, price: (currentPrice * 0.999).toFixed(2), quantity: qty }, w3State.market);
          await placeOrder({ symbol: w3State.targetCoin, side: 2, type: 1, price: (currentPrice * 1.001).toFixed(2), quantity: qty }, w3State.market);
          w3State.setActivePosition({ botType: 'Market Maker Bot', side: 'LONG', entryPrice: currentPrice, currentPrice, pnl: 0, size: w3State.investment, status: 'ACTIVE' });
        }
        else if (newRegime === 'HIGH_VOLATILITY') {
          w3State.setActiveAction('DEPLOY_GRID');
          w3State.addLog(`High Volatility (${vol.toFixed(2)}%). Deploying Grid Bot to capture wide swings.`, 'ACTION');
          const qty = ((w3State.investment * 0.25) / currentPrice).toFixed(6);
          await placeOrder({ symbol: w3State.targetCoin, side: 1, type: 1, price: (currentPrice * 0.98).toFixed(2), quantity: qty }, w3State.market);
          await placeOrder({ symbol: w3State.targetCoin, side: 2, type: 1, price: (currentPrice * 1.02).toFixed(2), quantity: qty }, w3State.market);
          w3State.setActivePosition({ botType: 'Grid Bot', side: 'LONG', entryPrice: currentPrice, currentPrice, pnl: 0, size: w3State.investment, status: 'ACTIVE' });
        }
      }

    } catch (e) {
      console.error('Wave3 Engine Error:', e);
    }
  }, 10000); // Check every 10s
}

export function stopWave3Engine() {
  if (engineInterval) {
    clearInterval(engineInterval);
    engineInterval = null;
    useWave3Store.getState().addLog('Autonomous Agent disconnected.', 'WARNING');
    useWave3Store.getState().setActivePosition(null);
    useWave3Store.getState().setActiveAction('WAITING');
  }
}
