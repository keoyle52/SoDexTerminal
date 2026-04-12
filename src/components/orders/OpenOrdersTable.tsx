import React, { useState } from 'react';
import { useAccountStore } from '../../store/accountStore';
import { StatusBadge } from '../common/StatusBadge';
import { NumberDisplay } from '../common/NumberDisplay';
import { Trash2, Loader2 } from 'lucide-react';
import { useMarketStore } from '../../store/marketStore';
import { spotClient } from '../../api/rest/spotClient';
import { perpsClient } from '../../api/rest/perpsClient';
import toast from 'react-hot-toast';

export const OpenOrdersTable: React.FC = () => {
  const { openOrders, removeOpenOrder, address } = useAccountStore();
  const { activeMarket } = useMarketStore();
  const [cancelling, setCancelling] = useState<string | null>(null);

  const handleCancel = async (id: string) => {
    if (!address) return toast.error("Wallet not connected");
    setCancelling(id);
    try {
      const payload = { 
        type: 'cancelOrder', 
        params: { 
          accountID: address, 
          orders: [{ clOrdID: id }] 
        }
      };

      if (activeMarket === 'spot') {
        await spotClient.cancelBatchOrders(payload);
      } else {
        await perpsClient.cancelOrder(payload);
      }

      removeOpenOrder(id);
      toast.success("Order Cancelled Successfully");
    } catch (e: any) {
      toast.error(`Cancel Failed: ${e.message}`);
    } finally {
      setCancelling(null);
    }
  };

  return (
    <div className="w-full h-full bg-[#111318] flex flex-col font-mono text-xs overflow-auto border border-[#1e2028]">
       <table className="w-full text-left border-collapse">
         <thead className="sticky top-0 bg-[#0a0b0d] shadow z-10 text-[10px] uppercase text-[#9aa0a6] font-sans tracking-wide">
           <tr>
             <th className="p-3 font-bold w-24 border-b border-[#1e2028]">Time</th>
             <th className="p-3 font-bold border-b border-[#1e2028]">Symbol</th>
             <th className="p-3 font-bold border-b border-[#1e2028]">Type/Side</th>
             <th className="p-3 font-bold text-right border-b border-[#1e2028]">Price</th>
             <th className="p-3 font-bold text-right border-b border-[#1e2028]">Amount</th>
             <th className="p-3 font-bold text-center border-b border-[#1e2028]">Status</th>
             <th className="p-3 font-bold text-right w-16 border-b border-[#1e2028]">Action</th>
           </tr>
         </thead>
         <tbody className="bg-[#111318]">
           {openOrders.length > 0 ? openOrders.map((o: any, idx: number) => (
             <tr key={idx} className="border-b border-[#1e2028] hover:bg-white/5 transition-colors text-[#e8eaed] group">
               <td className="p-3 text-[11px] text-[#9aa0a6] group-hover:text-[#e8eaed] transition-colors">{new Date(o.time || Date.now()).toLocaleTimeString()}</td>
               <td className="p-3 font-sans font-bold text-[11px]">{o.symbol}</td>
               <td className="p-3">
                 <span className={o.side === 'BUY' ? 'text-[#00c853] font-bold' : 'text-[#f44336] font-bold'}>{o.side}</span>
                 <span className="text-[#5f6368] ml-2 text-[10px]">{o.type}</span>
               </td>
               <td className="p-3 text-right"><NumberDisplay value={o.price || 0} /></td>
               <td className="p-3 text-right"><NumberDisplay value={o.origQty || o.quantity || 0} /></td>
               <td className="p-3 text-center"><StatusBadge status={o.status || 'NEW'} /></td>
               <td className="p-3 text-right">
                 <button 
                   onClick={() => handleCancel(o.clOrdID || o.orderId)} 
                   disabled={cancelling === (o.clOrdID || o.orderId)}
                   className="text-[#9aa0a6] hover:text-[#f44336] bg-[#f44336]/10 p-1.5 rounded transition shadow-sm disabled:opacity-50"
                 >
                   {cancelling === (o.clOrdID || o.orderId) ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                 </button>
               </td>
             </tr>
           )) : (
             <tr>
               <td colSpan={7} className="p-10 text-center text-[#9aa0a6] font-sans text-[11px] uppercase tracking-widest font-semibold opacity-50">
                 No Open Orders
               </td>
             </tr>
           )}
         </tbody>
       </table>
    </div>
  );
};
