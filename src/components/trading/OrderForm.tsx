import React, { useState } from 'react';
import clsx from 'clsx';
import { useOrderStore } from '../../store/orderStore';
import { useMarketStore } from '../../store/marketStore';
import { useAccountStore } from '../../store/accountStore';
import { useSettingsStore } from '../../store/settingsStore';
import { ORDER_TYPES } from '../../utils/constants';
import { LeverageSlider } from './LeverageSlider';
import { TPSLForm } from './TPSLForm';
import { spotClient } from '../../api/rest/spotClient';
import { perpsClient } from '../../api/rest/perpsClient';
import toast from 'react-hot-toast';

export const OrderForm: React.FC = () => {
  const { activeMarket, activeSymbol, ticker, symbols } = useMarketStore();
  const { balances, address } = useAccountStore();
  const { } = useSettingsStore();
  const [loading, setLoading] = useState(false);

  const symbolInfo = symbols.find((s: any) => s.symbol === activeSymbol);
  const qtyDec = symbolInfo?.quantityPrecision ?? 4;
  const priceDec = symbolInfo?.pricePrecision ?? 2;
  const symbolID = symbolInfo?.symbolID ?? symbolInfo?.id;

  const { 
    orderType, setOrderField, 
    side, price, quantity, 
    marginMode, useTpSl,
    takeProfitPrice, stopLossPrice,
    takeProfitTriggerType, stopLossTriggerType,
  } = useOrderStore();

  const handlePctClick = (pct: number) => {
    let baseVal = 1000;
    if (activeMarket === 'spot' && balances && balances.length) {
       const balance = balances.find((b: any) => b.asset === 'USDT');
       if (balance) baseVal = parseFloat(balance.free);
    } else if (activeMarket === 'perps' && balances?.availableMargin) {
       baseVal = parseFloat(balances.availableMargin);
    }
    
    const maxQty = baseVal / (parseFloat(ticker?.lastPrice) || 1);
    setOrderField('quantity', ((pct / 100) * maxQty).toFixed(qtyDec));
  };

  const onSubmit = async () => {
     if (!address) return toast.error("Wallet not connected!");
     if (!symbolID) return toast.error("Invalid Symbol ID");

     setLoading(true);
     try {
       if (activeMarket === 'perps') {
         const orders = [];
         
         // Main Order
         orders.push({
           clOrdID: `v-${Date.now()}`,
           side,
           type: orderType,
           price: orderType === ORDER_TYPES.LIMIT ? price : undefined,
           quantity: quantity,
           positionSide: 'BOTH',
           timeInForce: orderType === ORDER_TYPES.LIMIT ? 'GTC' : 'IOC',
           reduceOnly: false,
           modifier: useTpSl ? 'BRACKET' : 0,
         });

         if (useTpSl) {
           // TP Order
           if (takeProfitPrice) {
             orders.push({
               clOrdID: `tp-${Date.now()}`,
               side: side === 'BUY' ? 'SELL' : 'BUY',
               type: 'STOP',
               stopPrice: takeProfitPrice,
               triggerType: takeProfitTriggerType,
               stopType: 'TAKE_PROFIT',
               quantity: quantity,
               modifier: 'ATTACHED_STOP',
               reduceOnly: true,
             });
           }

           // SL Order
           if (stopLossPrice) {
             orders.push({
               clOrdID: `sl-${Date.now()}`,
               side: side === 'BUY' ? 'SELL' : 'BUY',
               type: 'STOP',
               stopPrice: stopLossPrice,
               triggerType: stopLossTriggerType,
               stopType: 'STOP_LOSS',
               quantity: quantity,
               modifier: 'ATTACHED_STOP',
               reduceOnly: true,
             });
           }
         }

         const pPayload = {
           type: 'newOrder',
           params: {
             accountID: address,
             symbolID: symbolID,
             orders: orders
           }
         };
         await perpsClient.batchOrders(pPayload);
       } else {
         const sPayload = {
           type: 'newOrder',
           params: {
             accountID: address,
             symbolID: symbolID,
             orders: [{
               clOrdID: `s-${Date.now()}`,
               side,
               type: orderType,
               timeInForce: orderType === ORDER_TYPES.LIMIT ? 'GTC' : 'IOC',
               price: orderType === ORDER_TYPES.LIMIT ? price : undefined,
               quantity: quantity,
             }]
           }
         };
         await spotClient.batchOrders(sPayload);
       }
       toast.success("Order Placed Successfully!");
     } catch (e: any) {
       toast.error(`Order Failed: ${e.message}`);
     } finally {
       setLoading(false);
     }
  };

  return (
    <div className="w-full bg-[#111318] border border-[#1e2028] flex flex-col p-3 h-full overflow-y-auto">
      <div className="flex space-x-1 mb-4 border-b border-[#1e2028] pb-3">
        {['LIMIT', 'MARKET', 'STOP'].map(t => (
          <button 
            key={t}
            onClick={() => setOrderField('orderType', t)}
            className={clsx(
              "flex-1 text-[10px] uppercase font-bold py-1.5 rounded transition shadow-sm",
              orderType === t ? "bg-[#1e2028] text-white" : "text-[#9aa0a6] hover:text-white hover:bg-white/5"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {activeMarket === 'perps' && (
        <div className="flex items-center justify-between mb-4 border border-[#1e2028] rounded p-1 bg-[#0a0b0d] text-[10px] font-bold shadow-inner">
           <button 
             onClick={() => setOrderField('marginMode', 'CROSS')}
             className={clsx("flex-1 py-1 rounded transition", marginMode === 'CROSS' ? "bg-[#1e2028] text-[#e8eaed] shadow" : "text-[#9aa0a6]")}
           >
             CROSS
           </button>
           <button 
             onClick={() => setOrderField('marginMode', 'ISOLATED')}
             className={clsx("flex-1 py-1 rounded transition", marginMode === 'ISOLATED' ? "bg-[#1e2028] text-[#e8eaed] shadow" : "text-[#9aa0a6]")}
           >
             ISOLATED
           </button>
        </div>
      )}

      <div className="flex flex-col space-y-4">
        {orderType !== ORDER_TYPES.MARKET && (
          <div className="flex flex-col">
            <span className="text-[10px] text-[#9aa0a6] uppercase font-bold mb-1.5 tracking-wider">Price</span>
            <div className="flex items-center bg-[#0a0b0d] border border-[#1e2028] rounded focus-within:border-[#4285f4]/50 transition px-2.5 shadow-inner">
              <input 
                type="number"
                value={price}
                onChange={(e) => setOrderField('price', e.target.value)}
                className="w-full bg-transparent py-2 text-xs text-[#e8eaed] outline-none font-mono"
                placeholder={parseFloat(ticker?.lastPrice || "0").toFixed(priceDec)}
              />
              <span className="text-[#5f6368] text-[10px] ml-2 font-bold select-none uppercase">{activeSymbol.split('-')[1] || 'USD'}</span>
            </div>
          </div>
        )}

        <div className="flex flex-col">
          <span className="text-[10px] text-[#9aa0a6] uppercase font-bold mb-1.5 tracking-wider">Amount</span>
          <div className="flex items-center bg-[#0a0b0d] border border-[#1e2028] rounded focus-within:border-[#4285f4]/50 transition px-2.5 shadow-inner">
            <input 
              type="number"
              value={quantity}
              onChange={(e) => setOrderField('quantity', e.target.value)}
              className="w-full bg-transparent py-2 text-xs text-[#e8eaed] outline-none font-mono"
              placeholder="0.00"
            />
            <span className="text-[#5f6368] text-[10px] ml-2 font-bold select-none uppercase">{activeSymbol.split('-')[0]}</span>
          </div>
        </div>

        <div className="flex space-x-1.5 mt-2">
          {[25, 50, 75, 100].map(pct => (
            <button 
              key={pct}
              onClick={() => handlePctClick(pct)}
              className="flex-1 bg-[#1e2028] hover:bg-[#2a2d35] text-[#9aa0a6] hover:text-[#e8eaed] py-1 rounded text-[10px] font-mono transition font-bold"
            >
              {pct}%
            </button>
          ))}
        </div>
      </div>

      {activeMarket === 'perps' && (
        <>
          <LeverageSlider />
          <div className="mt-5 flex items-center justify-between px-1">
            <span className="text-[10px] text-[#e8eaed] uppercase font-bold select-none cursor-pointer tracking-wider" onClick={() => setOrderField('useTpSl', !useTpSl)}>
               TP/SL Orders
            </span>
            <input 
               type="checkbox" 
               checked={useTpSl} 
               onChange={(e) => setOrderField('useTpSl', e.target.checked)}
               className="cursor-pointer border-[#1e2028] rounded bg-[#0a0b0d] accent-[#4285f4]"
            />
          </div>
          <TPSLForm />
        </>
      )}

      <div className="mt-auto pt-6 flex space-x-2">
        <button 
          onClick={() => { setOrderField('side', 'BUY'); onSubmit(); }}
          disabled={loading}
          className="flex-1 bg-[#00c853] hover:bg-[#00c853]/90 text-white font-bold text-xs uppercase py-3 rounded shadow-[0_0_15px_rgba(0,200,83,0.15)] transition-all active:scale-95 disabled:opacity-50"
        >
          Buy / Long
        </button>
        <button 
          onClick={() => { setOrderField('side', 'SELL'); onSubmit(); }}
          disabled={loading}
          className="flex-1 bg-[#f44336] hover:bg-[#f44336]/90 text-white font-bold text-xs uppercase py-3 rounded shadow-[0_0_15px_rgba(244,67,54,0.15)] transition-all active:scale-95 disabled:opacity-50"
        >
          Sell / Short
        </button>
      </div>
    </div>
  );
};
