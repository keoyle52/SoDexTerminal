import { useEffect, useState } from 'react';
import { useMarketStore } from '../store/marketStore';
import { spotWSSubscriptions } from '../api/ws/spotWS';
import { perpsWSSubscriptions } from '../api/ws/perpsWS';
import { spotClient } from '../api/rest/spotClient';
import { perpsClient } from '../api/rest/perpsClient';

export function useCandles(defaultInterval: string = '15m') {
  const { activeSymbol, activeMarket, candles } = useMarketStore();
  const [interval, setChartInterval] = useState(defaultInterval);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeSymbol) return;
    
    let isMounted = true;

    // 1. Fetch REST history so chart isn't empty on load
    const fetchHistory = async () => {
       setLoading(true);
       try {
         const client = activeMarket === 'spot' ? spotClient : perpsClient;
         const history = await client.getKlines(activeSymbol, interval, 200);
         if (isMounted && Array.isArray(history)) {
            useMarketStore.setState({ candles: history });
         }
       } catch (err) {
         console.error('[Candles Hook] Failed to fetch klines history', err);
       } finally {
         if (isMounted) setLoading(false);
       }
    };
    
    fetchHistory();

    // 2. Subscribe dynamically to WS for live candle updates
    const subLogic = activeMarket === 'spot' ? spotWSSubscriptions : perpsWSSubscriptions;
    
    try {
        subLogic.subscribeCandleInterval(activeSymbol, interval);
    } catch(e) {}

    return () => {
       isMounted = false;
       try {
           subLogic.unsubscribeCandleInterval(activeSymbol, interval);
       } catch(e) {}
    };
  }, [activeSymbol, activeMarket, interval]);

  return { interval, setChartInterval, loading, data: candles };
}
