import React from 'react';
import clsx from 'clsx';

interface Props {
  status: 'connected' | 'connecting' | 'disconnected';
  label?: boolean;
}

export const ConnectionStatus: React.FC<Props> = ({ status, label = true }) => {
  const getDotColor = () => {
    switch (status) {
      case 'connected': return 'bg-[#00c853] shadow-[0_0_8px_rgba(0,200,83,0.8)]';
      case 'connecting': return 'bg-[#fbbc04] animate-pulse';
      case 'disconnected': return 'bg-[#f44336] shadow-[0_0_8px_rgba(244,67,54,0.8)]';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="flex items-center space-x-2 text-[10px] font-semibold">
      <div className={clsx('w-2 h-2 rounded-full', getDotColor())} />
      {label && <span className="text-[#9aa0a6] uppercase tracking-wider">WS: {status}</span>}
    </div>
  );
};
