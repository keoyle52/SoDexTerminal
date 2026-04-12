import React from 'react';
import { useAccountStore } from '../../store/accountStore';
import { useMarketStore } from '../../store/marketStore';
import { NumberDisplay } from '../common/NumberDisplay';

export const PortfolioPanel: React.FC = () => {
  const { activeMarket } = useMarketStore();
  const { balances, positions } = useAccountStore();

  return (
    <div className="w-full h-full flex flex-col bg-[#111318] border border-[#1e2028] text-xs">
      <div className="flex justify-between px-4 h-8 items-center border-b border-[#1e2028] bg-[#0a0b0d]/30 text-[10px] font-bold text-[#e8eaed] uppercase tracking-wider shrink-0">
        <span>Portfolio</span>
        {activeMarket === 'perps' && (
           <span className="text-[#9aa0a6]">
              Margin: <NumberDisplay value={balances?.marginBalance || 0} prefix="$" className="text-white" />
           </span>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto p-2">
        {activeMarket === 'spot' ? (
           <div className="flex flex-col space-y-1">
              <div className="flex justify-between text-[#9aa0a6] text-[10px] uppercase font-bold px-3 py-1.5 bg-black/20 rounded">
                <span className="w-1/3">Asset</span>
                <span className="w-1/3 text-right">Available</span>
                <span className="w-1/3 text-right">Locked</span>
              </div>
              {balances && Array.isArray(balances) && balances.length > 0 ? balances.map((b: any, i: number) => (
                <div key={i} className="flex justify-between text-[#e8eaed] font-mono px-3 py-2 hover:bg-white/5 rounded border-b border-[#1e2028]/50 last:border-0 transition-colors">
                  <span className="w-1/3 font-sans font-bold">{b.asset}</span>
                  <span className="w-1/3 text-right"><NumberDisplay value={b.free} /></span>
                  <span className="w-1/3 text-right text-[#9aa0a6]"><NumberDisplay value={b.locked} /></span>
                </div>
              )) : (
                <div className="text-center text-[#9aa0a6] mt-6 font-semibold text-[11px] uppercase tracking-wider opacity-50">No Spot Assets</div>
              )}
           </div>
        ) : (
           <div className="flex flex-col space-y-4">
              <div className="bg-[#1e2028]/50 p-3 rounded flex justify-between items-center border border-[#1e2028]">
                 <span className="text-[#9aa0a6] font-semibold text-[11px] uppercase tracking-wider">Unrealized PNL</span>
                 <NumberDisplay value={balances?.unrealizedPnl || 0} prefix="$" colorize className="text-lg font-bold" />
              </div>

              <div className="flex flex-col">
                 <div className="flex justify-between text-[#9aa0a6] text-[10px] uppercase font-bold px-3 py-1.5 bg-black/20 rounded mb-1">
                   <span className="w-2/5">Sym/Side</span>
                   <span className="w-1/5 text-right">Size</span>
                   <span className="w-2/5 text-right">UnPNL</span>
                 </div>
                 {positions && positions.length > 0 ? positions.map((p: any, i: number) => (
                   <div key={i} className="flex justify-between items-center text-[#e8eaed] font-mono px-3 py-2.5 hover:bg-white/5 rounded border-b border-[#1e2028]/50 last:border-0 transition-colors cursor-pointer group">
                     <div className="flex flex-col w-2/5">
                       <span className="font-sans font-bold text-[11px] group-hover:text-white transition">{p.symbol}</span>
                       <span className={p.positionSide === 'LONG' ? 'text-[#00c853] text-[9px] font-bold' : 'text-[#f44336] text-[9px] font-bold'}>{p.positionSide} {p.leverage}x</span>
                     </div>
                     <span className="w-1/5 text-right"><NumberDisplay value={p.positionAmt} /></span>
                     <span className="w-2/5 text-right"><NumberDisplay value={p.unRealizedProfit} colorize /></span>
                   </div>
                 )) : (
                   <div className="text-center text-[#9aa0a6] mt-6 font-semibold text-[11px] uppercase tracking-wider opacity-50">No Open Positions</div>
                 )}
              </div>
           </div>
        )}
      </div>
    </div>
  );
};
