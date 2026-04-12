import { useEffect, useState } from 'react';
import { useMarketStore } from '../store/marketStore';
import { spotClient } from '../api/rest/spotClient';
import { perpsClient } from '../api/rest/perpsClient';

export function useOrderBook(limit: number = 20) {
  const { activeSymbol, activeMarket, orderBook } = useMarketStore();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeSymbol) return;

    let isMounted = true;
    const fetchSnapshot = async () => {
       setLoading(true);
       try {
         const client = activeMarket === 'spot' ? spotClient : perpsClient;
         const book = await client.getOrderbook(activeSymbol, limit);
         if (isMounted && book) {
            // WS sends snapshots, but doing REST pre-fetch
            // guarantees it loads immediately when symbol changes
            useMarketStore.getState().updateOrderBookStream(book);
         }
       } catch (err) {
         console.error('[OrderBook Hook] Failed to fetch REST snapshot', err);
       } finally {
         if (isMounted) setLoading(false);
       }
    };

    fetchSnapshot();
  }, [activeSymbol, activeMarket, limit]);

  return { loading, orderBook };
}
