import React from 'react';
import { useOrderStore } from '../../store/orderStore';
import clsx from 'clsx';

export const LeverageSlider: React.FC = () => {
  const { leverage, setOrderField } = useOrderStore();
  const marks = [1, 10, 25, 50, 75, 100];

  return (
    <div className="flex flex-col space-y-2 mt-4 select-none">
      <div className="flex justify-between items-end text-[10px] text-[#9aa0a6] uppercase font-semibold">
        <span>Leverage</span>
        <span className="text-[#e8eaed] font-mono font-bold text-xs bg-[#1e2028] px-2 py-0.5 rounded shadow-inner">{leverage}x</span>
      </div>
      <div className="relative pt-2">
        <input 
          type="range"
          min="1"
          max="100"
          value={leverage}
          onChange={(e) => setOrderField('leverage', parseInt(e.target.value))}
          className="w-full h-1.5 bg-[#1e2028] rounded outline-none appearance-none cursor-pointer accent-[#4285f4] hover:accent-[#4285f4]/90 transition"
        />
        <div className="flex justify-between items-center text-[10px] text-[#9aa0a6] font-mono mt-1.5 px-0.5">
          {marks.map(m => (
            <span 
              key={m} 
              onClick={() => setOrderField('leverage', m)} 
              className={clsx(
                "cursor-pointer hover:text-white transition px-1 py-0.5 -mx-1 rounded",
                leverage === m && "text-[#4285f4] font-bold"
              )}
            >
              {m}x
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
