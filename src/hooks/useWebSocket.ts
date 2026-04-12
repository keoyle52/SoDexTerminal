import { useEffect, useCallback } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { useMarketStore } from '../store/marketStore';
import { useAccountStore } from '../store/accountStore';
import { initSpotWS, spotWSSubscriptions } from '../api/ws/spotWS';
import { initPerpsWS, perpsWSSubscriptions } from '../api/ws/perpsWS';

/**
 * Custom hook to initialize and manage global WebSocket connections
 * based on user settings (network) and market changes.
 */
export function useWebSocket() {
  const { network } = useSettingsStore();
  const { activeMarket, activeSymbol, setTicker, updateOrderBookStream, addRecentTrades, setMarkPrice, resetMarketData } = useMarketStore();
  const { address, addOrUpdateOpenOrder } = useAccountStore();

  const handleSpotMessage = useCallback((data: any) => {
    switch(data.type) {
      case 'ticker': case 'miniTicker': case 'bookTicker': setTicker(data); break;
      case 'l2book': updateOrderBookStream(data); break;
      case 'candles': useMarketStore.getState().addCandle(data); break;
      case 'marketTrade': addRecentTrades([data]); break;
      case 'accountOrderUpdates': 
         if (data.order) addOrUpdateOpenOrder(data.order); 
         break;
    }
  }, [setTicker, updateOrderBookStream, addRecentTrades, addOrUpdateOpenOrder]);

  const handlePerpsMessage = useCallback((data: any) => {
    switch(data.type) {
      case 'ticker': case 'miniTicker': case 'bookTicker': setTicker(data); break;
      case 'l2book': updateOrderBookStream(data); break;
      case 'candles': useMarketStore.getState().addCandle(data); break;
      case 'marketTrade': addRecentTrades([data]); break;
      case 'markPrice': setMarkPrice(data.price); break;
      case 'accountOrderUpdates': 
         if (data.order) addOrUpdateOpenOrder(data.order);
         break;
    }
  }, [setTicker, updateOrderBookStream, addRecentTrades, setMarkPrice, addOrUpdateOpenOrder]);

  useEffect(() => {
    const spotWs = initSpotWS(network);
    const perpsWs = initPerpsWS(network);

    spotWs.onMessage = handleSpotMessage;
    perpsWs.onMessage = handlePerpsMessage;

    spotWs.connect();
    perpsWs.connect();

    // Clean up WS explicitly if unmounted entirely
    return () => {
      spotWs.disconnect();
      perpsWs.disconnect();
    };
  }, [network, handleSpotMessage, handlePerpsMessage]);

  useEffect(() => {
    // Symbol or Market changed. Refresh WS subscriptions and clean data.
    if (!activeSymbol) return;
    
    resetMarketData(); // Clears old symbol's data from UI briefly before rest/WS backfills it.

    if (activeMarket === 'spot') {
      try { spotWSSubscriptions.subscribeMarket(activeSymbol); } catch(e){}
    } else {
      try { perpsWSSubscriptions.subscribeMarket(activeSymbol); } catch(e){}
    }
    
    return () => {
      if (activeMarket === 'spot') {
        try { spotWSSubscriptions.unsubscribeMarket(activeSymbol); } catch(e){}
      } else {
        try { perpsWSSubscriptions.unsubscribeMarket(activeSymbol); } catch(e){}
      }
    };
  }, [activeSymbol, activeMarket, resetMarketData]);

  useEffect(() => {
    // Authenticated streams
    if (!address) return;
    
    try { spotWSSubscriptions.subscribeAccount(address); } catch(e){}
    try { perpsWSSubscriptions.subscribeAccount(address); } catch(e){}

    return () => {
      try { spotWSSubscriptions.unsubscribeAccount(address); } catch(e){}
      try { perpsWSSubscriptions.unsubscribeAccount(address); } catch(e){}
    };
  }, [address]);
}
