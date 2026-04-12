import { WSManager } from './wsManager';
import { API_URLS } from '../../utils/constants';

let perpsWSManager: WSManager | null = null;

export const initPerpsWS = (network: 'mainnet' | 'testnet'): WSManager => {
  if (perpsWSManager) {
    perpsWSManager.disconnect();
  }
  const url = API_URLS[network].perpsWS;
  perpsWSManager = new WSManager(url);
  return perpsWSManager;
};

export const getPerpsWS = (): WSManager => {
  if (!perpsWSManager) {
    throw new Error('Perps WS Manager not initialized. Call initPerpsWS first on root load.');
  }
  return perpsWSManager;
};

export const perpsWSSubscriptions = {
  subscribeMarket: (symbol: string) => {
    const ws = getPerpsWS();
    ws.subscribe({ type: "ticker", symbol });
    ws.subscribe({ type: "miniTicker", symbol });
    ws.subscribe({ type: "bookTicker", symbol });
    ws.subscribe({ type: "markPrice", symbol }); // Extensively used unique stream for perps
    ws.subscribe({ type: "l2book", symbol });
    ws.subscribe({ type: "marketTrade", symbol });
  },
  unsubscribeMarket: (symbol: string) => {
    const ws = getPerpsWS();
    ws.unsubscribe({ type: "ticker", symbol });
    ws.unsubscribe({ type: "miniTicker", symbol });
    ws.unsubscribe({ type: "bookTicker", symbol });
    ws.unsubscribe({ type: "markPrice", symbol });
    ws.unsubscribe({ type: "l2book", symbol });
    ws.unsubscribe({ type: "marketTrade", symbol });
  },
  subscribeCandleInterval: (symbol: string, interval: string) => {
    const ws = getPerpsWS();
    ws.subscribe({ type: "candles", symbol, interval });
  },
  unsubscribeCandleInterval: (symbol: string, interval: string) => {
    const ws = getPerpsWS();
    ws.unsubscribe({ type: "candles", symbol, interval });
  },
  subscribeAccount: (userAddress: string) => {
    const ws = getPerpsWS();
    ws.subscribe({ type: "accountFrontendState", userAddress });
    ws.subscribe({ type: "accountOrderUpdates", userAddress });
    ws.subscribe({ type: "accountUpdates", userAddress });
    ws.subscribe({ type: "accountTrades", userAddress });
    ws.subscribe({ type: "accountEvents", userAddress });
  },
  unsubscribeAccount: (userAddress: string) => {
    const ws = getPerpsWS();
    ws.unsubscribe({ type: "accountFrontendState", userAddress });
    ws.unsubscribe({ type: "accountOrderUpdates", userAddress });
    ws.unsubscribe({ type: "accountUpdates", userAddress });
    ws.unsubscribe({ type: "accountTrades", userAddress });
    ws.unsubscribe({ type: "accountEvents", userAddress });
  }
};
