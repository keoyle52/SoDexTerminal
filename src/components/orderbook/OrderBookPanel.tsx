import React from 'react';
import { useOrderBook } from '../../hooks/useOrderBook';
import { NumberDisplay } from '../common/NumberDisplay';
import { useMarketStore } from '../../store/marketStore';

export const OrderBookPanel: React.FC = () => {
  const { symbols, activeSymbol } = useMarketStore();
  const { orderBook } = useOrderBook(20);
  
  const symbolInfo = symbols.find((s: any) => s.symbol === activeSymbol);
  const priceDec = symbolInfo?.pricePrecision ?? 2;
  const qtyDec = symbolInfo?.quantityPrecision ?? 4;

  const bids = orderBook?.bids || [];
  const asks = orderBook?.asks || []; 

  // Reverse asks so lowest ask is near the spread
  const displayAsks = [...asks].reverse().slice(-14); 
  const displayBids = bids.slice(0, 14);

  const maxVolume = Math.max(
    ...bids.map(b => parseFloat(b[1])), 
    ...asks.map(a => parseFloat(a[1])),
    0.001
  );

  const bestAsk = asks.length > 0 ? parseFloat(asks[0][0]) : 0;
  const bestBid = bids.length > 0 ? parseFloat(bids[0][0]) : 0;
  const spread = bestAsk && bestBid ? (bestAsk - bestBid) : 0;
  const spreadPct = bestAsk ? (spread / bestAsk) * 100 : 0;

  return (
    <div className="w-full h-full flex flex-col bg-[#111318] text-xs font-mono overflow-hidden">
      <div className="flex justify-between items-center px-4 h-8 border-b border-[#1e2028] bg-[#0a0b0d]/30 text-[10px] text-[#9aa0a6] uppercase font-bold shrink-0 tracking-wider">
        <span>Price</span>
        <span>Amount</span>
        <span>Total</span>
      </div>

      <div className="flex-1 flex flex-col py-1 overflow-hidden select-none">
        {/* Asks */}
        <div className="flex-1 flex flex-col justify-end">
          {displayAsks.map((ask, idx) => {
             const price = parseFloat(ask[0]);
             const amount = parseFloat(ask[1]);
             const depthPct = Math.min((amount / maxVolume) * 100, 100);
             return (
               <div key={`ask-${price}-${idx}`} className="flex justify-between px-4 py-[3px] hover:bg-white/5 cursor-pointer relative group">
                 <div className="absolute right-0 top-0 bottom-0 bg-[#f44336]/10" style={{ width: `${depthPct}%` }} />
                 <span className="text-[#f44336] relative z-10 font-medium">{price.toFixed(priceDec)}</span>
                 <span className="text-[#e8eaed] relative z-10">{amount.toFixed(qtyDec)}</span>
                 <span className="text-[#9aa0a6] relative z-10 opacity-70">{(price * amount).toFixed(priceDec)}</span>
               </div>
             );
          })}
        </div>

        {/* Spread Info */}
        <div className="flex items-center justify-between my-1 px-4 py-1.5 bg-black/20 border-y border-[#1e2028]">
           <NumberDisplay value={bestAsk || bestBid || 0} decimals={priceDec} className="text-lg text-[#e8eaed] font-bold drop-shadow-md" />
           <span className="text-[#9aa0a6] text-[11px] font-sans font-medium tracking-wide">
             Spread: <NumberDisplay value={spread} decimals={priceDec} className="text-[#e8eaed] font-mono" /> (<NumberDisplay value={spreadPct} suffix="%" className="font-mono" />)
           </span>
        </div>

        {/* Bids */}
        <div className="flex-1 flex flex-col justify-start">
           {displayBids.map((bid, idx) => {
             const price = parseFloat(bid[0]);
             const amount = parseFloat(bid[1]);
             const depthPct = Math.min((amount / maxVolume) * 100, 100);
             return (
               <div key={`bid-${price}-${idx}`} className="flex justify-between px-4 py-[3px] hover:bg-white/5 cursor-pointer relative group">
                 <div className="absolute right-0 top-0 bottom-0 bg-[#00c853]/10" style={{ width: `${depthPct}%` }} />
                 <span className="text-[#00c853] relative z-10 font-medium">{price.toFixed(priceDec)}</span>
                 <span className="text-[#e8eaed] relative z-10">{amount.toFixed(qtyDec)}</span>
                 <span className="text-[#9aa0a6] relative z-10 opacity-70">{(price * amount).toFixed(priceDec)}</span>
               </div>
             );
          })}
        </div>
      </div>
    </div>
  );
};
