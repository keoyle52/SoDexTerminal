import { useOrderStore } from '../../store/orderStore';

export const TPSLForm: React.FC = () => {
  const { 
    useTpSl, 
    takeProfitPrice, 
    stopLossPrice, 
    takeProfitTriggerType, 
    stopLossTriggerType, 
    setOrderField 
  } = useOrderStore();

  if (!useTpSl) return null;

  return (
    <div className="flex flex-col space-y-3 mt-3 bg-black/20 p-2.5 rounded border border-[#1e2028] shadow-inner">
      {/* Target Profit */}
      <div className="flex flex-col space-y-1.5">
        <div className="flex justify-between items-center">
           <span className="text-[10px] text-[#00c853] uppercase font-bold tracking-wider">Take Profit</span>
           <button 
             onClick={() => setOrderField('takeProfitTriggerType', takeProfitTriggerType === 'MARK' ? 'LAST' : 'MARK')}
             className="text-[9px] font-bold text-[#4285f4] bg-[#4285f4]/10 hover:bg-[#4285f4]/20 px-1.5 py-0.5 rounded transition uppercase border border-[#4285f4]/30"
           >
             {takeProfitTriggerType}
           </button>
        </div>
        <div className="flex bg-[#0a0b0d] border border-[#1e2028] rounded focus-within:border-[#00c853]/50 transition shadow-inner">
           <input 
             type="number"
             value={takeProfitPrice}
             onChange={(e) => setOrderField('takeProfitPrice', e.target.value)}
             className="w-full bg-transparent outline-none text-[#e8eaed] text-xs px-2.5 py-1.5 font-mono"
             placeholder="TP Trigger Price"
           />
        </div>
      </div>

      {/* Stop Loss */}
      <div className="flex flex-col space-y-1.5 pt-1">
        <div className="flex justify-between items-center">
           <span className="text-[10px] text-[#f44336] uppercase font-bold tracking-wider">Stop Loss</span>
           <button 
             onClick={() => setOrderField('stopLossTriggerType', stopLossTriggerType === 'MARK' ? 'LAST' : 'MARK')}
             className="text-[9px] font-bold text-[#4285f4] bg-[#4285f4]/10 hover:bg-[#4285f4]/20 px-1.5 py-0.5 rounded transition uppercase border border-[#4285f4]/30"
           >
             {stopLossTriggerType}
           </button>
        </div>
        <div className="flex bg-[#0a0b0d] border border-[#1e2028] rounded focus-within:border-[#f44336]/50 transition shadow-inner">
           <input 
             type="number"
             value={stopLossPrice}
             onChange={(e) => setOrderField('stopLossPrice', e.target.value)}
             className="w-full bg-transparent outline-none text-[#e8eaed] text-xs px-2.5 py-1.5 font-mono"
             placeholder="SL Trigger Price"
           />
        </div>
      </div>
    </div>
  );
};
