import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchSymbols,
  fetchTickers,
  fetchMiniTickers,
  fetchOrderbook,
  fetchKlines,
  fetchMarkPrices,
  fetchFundingRates,
  fetchAccountInfo,
  fetchBalances,
  fetchPositions,
  fetchOpenOrders,
  fetchOrderHistory,
  fetchAccountFills,
  placeOrder,
  cancelOrder,
  cancelAllOrders
} from './services';
import type { PlaceOrderParams } from './services';

// --- Queries ---

export function useSymbols(market: 'spot' | 'perps' = 'perps') {
  return useQuery({
    queryKey: ['symbols', market],
    queryFn: () => fetchSymbols(market),
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}

export function useTickers(market: 'spot' | 'perps' = 'perps', enabled = true) {
  return useQuery({
    queryKey: ['tickers', market],
    queryFn: () => fetchTickers(market),
    enabled,
    refetchInterval: 5000,
  });
}

export function useMiniTickers(market: 'spot' | 'perps' = 'perps', enabled = true) {
  return useQuery({
    queryKey: ['miniTickers', market],
    queryFn: () => fetchMiniTickers(market),
    enabled,
    refetchInterval: 5000,
  });
}

export function useOrderbook(symbol: string, market: 'spot' | 'perps' = 'perps', limit = 20, enabled = true) {
  return useQuery({
    queryKey: ['orderbook', market, symbol, limit],
    queryFn: () => fetchOrderbook(symbol, market, limit),
    enabled: enabled && !!symbol,
    refetchInterval: 3000,
  });
}

export function useKlines(symbol: string, interval: string, limit = 500, market: 'spot' | 'perps' = 'perps', enabled = true) {
  return useQuery({
    queryKey: ['klines', market, symbol, interval, limit],
    queryFn: () => fetchKlines(symbol, interval, limit, market),
    enabled: enabled && !!symbol,
  });
}

export function useMarkPrices(enabled = true) {
  return useQuery({
    queryKey: ['markPrices'],
    queryFn: () => fetchMarkPrices(),
    enabled,
    refetchInterval: 5000,
  });
}

export function useFundingRates(enabled = true) {
  return useQuery({
    queryKey: ['fundingRates'],
    queryFn: () => fetchFundingRates(),
    enabled,
    refetchInterval: 60000, // 1 minute
  });
}

// --- Account Queries ---

export function useAccountInfo(market: 'spot' | 'perps' = 'perps', enabled = true) {
  return useQuery({
    queryKey: ['accountInfo', market],
    queryFn: () => fetchAccountInfo(market),
    enabled,
    refetchInterval: 10000,
  });
}

export function useBalances(market: 'spot' | 'perps' = 'perps', enabled = true) {
  return useQuery({
    queryKey: ['balances', market],
    queryFn: () => fetchBalances(market),
    enabled,
    refetchInterval: 10000,
  });
}

export function usePositions(enabled = true) {
  return useQuery({
    queryKey: ['positions'],
    queryFn: () => fetchPositions(),
    enabled,
    refetchInterval: 5000,
  });
}

export function useOpenOrders(symbol?: string, market: 'spot' | 'perps' = 'perps', enabled = true) {
  return useQuery({
    queryKey: ['openOrders', market, symbol],
    queryFn: () => fetchOpenOrders(market, symbol),
    enabled,
    refetchInterval: 5000,
  });
}

export function useOrderHistory(market: 'spot' | 'perps' = 'perps', symbol?: string, limit = 50) {
  return useQuery({
    queryKey: ['orderHistory', market, symbol, limit],
    queryFn: () => fetchOrderHistory(market, { symbol, limit }),
  });
}

export function useAccountFills(market: 'spot' | 'perps' = 'perps', limit = 50) {
  return useQuery({
    queryKey: ['accountFills', market, limit],
    queryFn: () => fetchAccountFills(market, limit),
  });
}

// --- Mutations ---

export function usePlaceOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ params, market }: { params: PlaceOrderParams, market: 'spot' | 'perps' }) => 
      placeOrder(params, market),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['openOrders', variables.market] });
      queryClient.invalidateQueries({ queryKey: ['balances', variables.market] });
      if (variables.market === 'perps') {
        queryClient.invalidateQueries({ queryKey: ['positions'] });
      }
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, symbol, market }: { orderId: string, symbol: string, market: 'spot' | 'perps' }) => 
      cancelOrder(orderId, symbol, market),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['openOrders', variables.market] });
    },
  });
}

export function useCancelAllOrders() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ symbol, market }: { symbol?: string, market: 'spot' | 'perps' }) => 
      cancelAllOrders(symbol, market),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['openOrders', variables.market] });
    },
  });
}
