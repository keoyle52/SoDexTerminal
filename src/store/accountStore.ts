import { create } from 'zustand';

export interface AccountState {
  address: string | null;
  balances: any | null;  // SpotAccountBalances | PerpsAccountBalance
  openOrders: any[];
  positions: any[];      // Perps only
  orderHistory: any[];
  tradeHistory: any[];
  fundingHistory: any[]; // Perps only
  feeRate: any | null;
  accountID: number | null;

  // Actions
  setAddress: (address: string | null) => void;
  setAccountID: (id: number | null) => void;
  setBalances: (balances: any | null) => void;
  setOpenOrders: (orders: any[]) => void;
  addOrUpdateOpenOrder: (order: any) => void;
  removeOpenOrder: (orderId: string) => void;
  setPositions: (positions: any[]) => void;
  setOrderHistory: (history: any[]) => void;
  setTradeHistory: (trades: any[]) => void;
  setFundingHistory: (fundings: any[]) => void;
  setFeeRate: (rate: any | null) => void;
  
  resetAccountData: () => void;
}

export const useAccountStore = create<AccountState>((set) => ({
  address: null,
  balances: null,
  openOrders: [],
  positions: [],
  orderHistory: [],
  tradeHistory: [],
  fundingHistory: [],
  feeRate: null,
  accountID: null,

  setAddress: (address) => set({ address }),
  setAccountID: (id) => set({ accountID: id }),
  setBalances: (balances) => set({ balances }),
  setOpenOrders: (orders) => set({ openOrders: orders }),
  
  addOrUpdateOpenOrder: (order) => set((state) => {
    const existing = state.openOrders.findIndex(o => o.clOrdID === order.clOrdID || o.orderID === order.orderID);
    if (existing >= 0) {
      const updated = [...state.openOrders];
      updated[existing] = order;
      return { openOrders: updated };
    }
    return { openOrders: [order, ...state.openOrders] };
  }),

  removeOpenOrder: (orderId) => set((state) => ({
    openOrders: state.openOrders.filter(o => o.clOrdID !== orderId && o.orderID !== orderId)
  })),

  setPositions: (positions) => set({ positions }),
  setOrderHistory: (history) => set({ orderHistory: history }),
  setTradeHistory: (trades) => set({ tradeHistory: trades }),
  setFundingHistory: (fundings) => set({ fundingHistory: fundings }),
  setFeeRate: (rate) => set({ feeRate: rate }),

  resetAccountData: () => set({
    address: null,
    accountID: null,
    balances: null,
    openOrders: [],
    positions: [],
    orderHistory: [],
    tradeHistory: [],
    fundingHistory: [],
    feeRate: null
  })
}));
