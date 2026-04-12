import { create } from 'zustand';
import { ORDER_TYPES, ORDER_SIDES } from '../utils/constants';

export interface OrderState {
  orderType: string;
  side: string;
  price: string;
  quantity: string;
  total: string;
  leverage: number; // 1x to 100x
  marginMode: 'CROSS' | 'ISOLATED';
  
  // TP/SL State
  useTpSl: boolean;
  takeProfitPrice: string;
  takeProfitTriggerType: 'MARK' | 'LAST';
  stopLossPrice: string;
  stopLossTriggerType: 'MARK' | 'LAST';

  // Actions
  setOrderField: (field: keyof Omit<OrderState, 'setOrderField' | 'resetForm'>, value: any) => void;
  resetForm: () => void;
}

export const useOrderStore = create<OrderState>((set) => ({
  orderType: ORDER_TYPES.LIMIT,
  side: ORDER_SIDES.BUY,
  price: '',
  quantity: '',
  total: '',
  leverage: 1,
  marginMode: 'CROSS',
  
  useTpSl: false,
  takeProfitPrice: '',
  takeProfitTriggerType: 'LAST',
  stopLossPrice: '',
  stopLossTriggerType: 'LAST',

  setOrderField: (field, value) => set({ [field]: value }),
  
  resetForm: () => set({
    price: '',
    quantity: '',
    total: '',
    useTpSl: false,
    takeProfitPrice: '',
    stopLossPrice: ''
  })
}));
