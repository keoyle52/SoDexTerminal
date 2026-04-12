import { create } from 'zustand';

export interface MarketState {
  activeSymbol: string;
  activeMarket: 'spot' | 'perps';
  symbols: any[];
  ticker: any | null;
  orderBook: { bids: [string, string][]; asks: [string, string][] };
  candles: any[];
  recentTrades: any[];
  markPrice: string | null;
  fundingRate: string | null;

  // Actions
  setActiveSymbol: (symbol: string) => void;
  setActiveMarket: (market: 'spot' | 'perps') => void;
  setSymbols: (symbols: any[]) => void;
  setTicker: (ticker: any) => void;
  setOrderBook: (orderBook: { bids: [string, string][]; asks: [string, string][] }) => void;
  
  // Real-time delta updaters
  updateOrderBookStream: (delta: any) => void; 
  addCandle: (candle: any) => void;
  addRecentTrades: (trades: any[]) => void;
  
  setMarkPrice: (price: string) => void;
  setFundingRate: (rate: string) => void;
  resetMarketData: () => void;
}

export const useMarketStore = create<MarketState>((set) => ({
  activeSymbol: 'BTC-USD', // Default as perps fallback, will be initialized
  activeMarket: 'perps', 
  symbols: [],
  ticker: null,
  orderBook: { bids: [], asks: [] },
  candles: [],
  recentTrades: [],
  markPrice: null,
  fundingRate: null,

  setActiveSymbol: (symbol) => set({ activeSymbol: symbol }),
  setActiveMarket: (market) => set({ activeMarket: market }),
  setSymbols: (symbols) => set({ symbols }),
  setTicker: (ticker) => set({ ticker }),
  setOrderBook: (orderBook) => set({ orderBook }),
  
  updateOrderBookStream: (snapshot) => set(() => ({
    orderBook: {
      bids: snapshot.bids ?? [],
      asks: snapshot.asks ?? []
    }
  })),

  addCandle: (candle) => set((state) => {
    const newCandles = [...state.candles];
    // Simple logic: update last candle if time matches, or push new
    if (newCandles.length > 0 && newCandles[newCandles.length - 1].time === candle.time) {
      newCandles[newCandles.length - 1] = candle;
    } else {
      newCandles.push(candle);
    }
    return { candles: newCandles };
  }),

  addRecentTrades: (trades) => set((state) => ({
     // Keep last 100 trades to avoid bloat
     recentTrades: [...trades, ...state.recentTrades].slice(0, 100) 
  })),

  setMarkPrice: (price) => set({ markPrice: price }),
  setFundingRate: (rate) => set({ fundingRate: rate }),
  
  resetMarketData: () => set({
    ticker: null,
    orderBook: { bids: [], asks: [] },
    candles: [],
    recentTrades: [],
    markPrice: null,
    fundingRate: null
  })
}));
