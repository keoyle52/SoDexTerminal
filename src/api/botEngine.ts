import { useBotStore } from '../store/botStore';
import { fetchMarkPriceFor } from './btcPredictorEngine';

let botEngineInterval: NodeJS.Timeout | null = null;
let cycleCount = 0;

export function startBotEngine() {
  if (botEngineInterval) return;
  console.log('Bot Execution Engine initialized. Connecting to Gemini API...');

  botEngineInterval = setInterval(async () => {
    cycleCount++;
    const bs = useBotStore.getState();

    // Random market conditions generator to make the sim feel alive
    const rsi = 30 + Math.random() * 40;
    const isVolatile = Math.random() > 0.8;

    try {
      // --- Grid Bot ---
      if (bs.gridBot.status === 'RUNNING') {
        const price = await fetchMarkPriceFor(bs.gridBot.symbol.replace('vBTC-vUSDC', 'BTC-USD'), bs.gridBot.isSpot ? 'spot' : 'perps') || 60000;
        
        if (cycleCount % 4 === 0) {
          const upper = parseFloat(bs.gridBot.upperPrice) || 70000;
          const lower = parseFloat(bs.gridBot.lowerPrice) || 50000;
          
          if (price > upper || price < lower) {
             bs.gridBot.addLog(`Price $${price.toFixed(2)} out of grid bounds. Waiting for return to range.`, 'WARNING');
          } else {
             const profit = (Math.random() * 5); // Sim profit per grid fill
             bs.gridBot.bumpField('realizedPnl', profit);
             bs.gridBot.bumpField('completedGrids', 1);
             bs.gridBot.addLog(`Grid filled at $${price.toFixed(2)}. Arbitrage profit: +$${profit.toFixed(2)}`, 'SUCCESS');
          }
        }
      }

      // --- Market Maker Bot ---
      if (bs.marketMakerBot.status === 'RUNNING') {
        const price = await fetchMarkPriceFor(bs.marketMakerBot.symbol.replace('vBTC-vUSDC', 'BTC-USD'), 'spot') || 60000;
        if (cycleCount % 3 === 0) {
           if (isVolatile) {
             bs.marketMakerBot.addLog(`Spread widened due to volatility. Repricing ${bs.marketMakerBot.layers} layers...`, 'WARNING');
             bs.marketMakerBot.bumpField('ordersCancelled', 2);
           } else {
             const profit = (Math.random() * 2);
             bs.marketMakerBot.bumpField('ordersFilled', 1);
             bs.marketMakerBot.bumpField('volumeUsdt', parseFloat(bs.marketMakerBot.orderSizeUsdt) || 10);
             bs.marketMakerBot.bumpField('realizedPnl', profit);
             bs.marketMakerBot.addLog(`Maker order filled at BBO $${price.toFixed(2)}. Captured spread.`, 'SUCCESS');
           }
        }
      }

      // --- Signal Bot ---
      if (bs.signalBot.status === 'RUNNING') {
        const price = await fetchMarkPriceFor(bs.signalBot.symbol, bs.signalBot.isSpot ? 'spot' : 'perps') || 60000;
        if (cycleCount % 6 === 0) {
           if (rsi > 65) {
             bs.signalBot.addLog(`RSI overheated (${rsi.toFixed(1)}). Executing Short Signal at $${price.toFixed(2)}...`, 'ACTION');
             bs.signalBot.bumpField('realizedPnl', -Math.random() * 10); // temporary drawdown
           } else if (rsi < 35) {
             bs.signalBot.addLog(`RSI oversold (${rsi.toFixed(1)}). Executing Long Signal at $${price.toFixed(2)}...`, 'ACTION');
             bs.signalBot.bumpField('realizedPnl', Math.random() * 15);
           } else {
             bs.signalBot.addLog(`Waiting for optimal webhook/indicator alignment.`, 'INFO');
           }
        }
      }

      // --- DCA Bot ---
      if (bs.dcaBot.status === 'RUNNING') {
        const price = await fetchMarkPriceFor(bs.dcaBot.symbol, 'spot') || 60000;
        if (cycleCount % 10 === 0) {
           const size = parseFloat(bs.dcaBot.orderSizeUsdt) || 50;
           bs.dcaBot.bumpField('ordersPlaced', 1);
           bs.dcaBot.bumpField('totalAccumulated', size / price);
           bs.dcaBot.addLog(`Accumulated $${size} worth of ${bs.dcaBot.symbol} at $${price.toFixed(2)}.`, 'SUCCESS');
        }
        if (cycleCount % 5 === 0) {
           // update pnl based on arbitrary market drift
           bs.dcaBot.bumpField('realizedPnl', (Math.random() - 0.4) * 20); 
        }
      }

      // --- TWAP Bot ---
      if (bs.twapBot.status === 'RUNNING') {
        const price = await fetchMarkPriceFor(bs.twapBot.symbol, 'spot') || 60000;
        const limit = parseFloat(bs.twapBot.priceLimit) || Infinity;
        if (cycleCount % 8 === 0) {
           if (price > limit) {
             bs.twapBot.addLog(`Price $${price.toFixed(2)} exceeds TWAP limit $${limit}. Pausing slice execution.`, 'WARNING');
           } else {
             const sliceSize = (parseFloat(bs.twapBot.investmentUsdt) || 1000) / (parseFloat(bs.twapBot.sliceCount) || 24);
             bs.twapBot.bumpField('slicesExecuted', 1);
             bs.twapBot.bumpField('totalAccumulated', sliceSize / price);
             bs.twapBot.addLog(`Executed TWAP slice ($${sliceSize.toFixed(2)}) at avg price $${price.toFixed(2)}.`, 'SUCCESS');
           }
        }
      }

    } catch (e) {
      console.error('Bot Engine Error:', e);
    }
  }, 5000); 
}

export function stopBotEngine() {
  if (botEngineInterval) {
    clearInterval(botEngineInterval);
    botEngineInterval = null;
    console.log('Bot Execution Engine stopped.');
  }
}
