import { WSManager } from './wsManager';
import { API_URLS } from '../../utils/constants';

let spotWSManager: WSManager | null = null;

export const initSpotWS = (network: 'mainnet' | 'testnet'): WSManager => {
  if (spotWSManager) {
    spotWSManager.disconnect();
  }
  const url = API_URLS[network].spotWS;
  spotWSManager = new WSManager(url);
  return spotWSManager;
};

export const getSpotWS = (): WSManager => {
  if (!spotWSManager) {
    throw new Error('Spot WS Manager not initialized. Call initSpotWS first on root load.');
  }
  return spotWSManager;
};

export const spotWSSubscriptions = {
  subscribeMarket: (symbol: string) => {
    const ws = getSpotWS();
    ws.subscribe({ type: "ticker", symbol });
    ws.subscribe({ type: "miniTicker", symbol });
    ws.subscribe({ type: "bookTicker", symbol });
    ws.subscribe({ type: "l2book", symbol });
    ws.subscribe({ type: "marketTrade", symbol });
  },
  unsubscribeMarket: (symbol: string) => {
    const ws = getSpotWS();
    ws.unsubscribe({ type: "ticker", symbol });
    ws.unsubscribe({ type: "miniTicker", symbol });
    ws.unsubscribe({ type: "bookTicker", symbol });
    ws.unsubscribe({ type: "l2book", symbol });
    ws.unsubscribe({ type: "marketTrade", symbol });
  },
  subscribeCandleInterval: (symbol: string, interval: string) => {
    const ws = getSpotWS();
    ws.subscribe({ type: "candles", symbol, interval });
  },
  unsubscribeCandleInterval: (symbol: string, interval: string) => {
    const ws = getSpotWS();
    ws.unsubscribe({ type: "candles", symbol, interval });
  },
  subscribeAccount: (userAddress: string) => {
    const ws = getSpotWS();
    ws.subscribe({ type: "accountFrontendState", userAddress });
    ws.subscribe({ type: "accountOrderUpdates", userAddress });
    ws.subscribe({ type: "accountUpdates", userAddress });
    ws.subscribe({ type: "accountTrades", userAddress });
    ws.subscribe({ type: "accountEvents", userAddress });
  },
  unsubscribeAccount: (userAddress: string) => {
    const ws = getSpotWS();
    ws.unsubscribe({ type: "accountFrontendState", userAddress });
    ws.unsubscribe({ type: "accountOrderUpdates", userAddress });
    ws.unsubscribe({ type: "accountUpdates", userAddress });
    ws.unsubscribe({ type: "accountTrades", userAddress });
    ws.unsubscribe({ type: "accountEvents", userAddress });
  }
};
