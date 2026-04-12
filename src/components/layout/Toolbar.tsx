import React, { useState, useEffect } from 'react';
import { useMarketStore } from '../../store/marketStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useAccountStore } from '../../store/accountStore';
import { ConnectionStatus } from '../common/ConnectionStatus';
import { NumberDisplay } from '../common/NumberDisplay';
import { Activity, Settings, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { getSpotWS } from '../../api/ws/spotWS';
import { getPerpsWS } from '../../api/ws/perpsWS';

interface ToolbarProps {
  onOpenSettings: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ onOpenSettings }) => {
  const { activeSymbol, activeMarket, setActiveMarket, ticker } = useMarketStore();
  const { network, setNetwork } = useSettingsStore();
  const { address } = useAccountStore();
  const [wsStatus, setWsStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');

  // Monitor WS status periodically purely for the UI dot
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const ws = activeMarket === 'spot' ? getSpotWS() : getPerpsWS();
        setWsStatus(ws.status);
      } catch (e) {
        setWsStatus('disconnected');
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [activeMarket]);

  const formatAddr = (addr: string) => `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  const priceChange = ticker ? parseFloat(ticker.priceChangePercent) : 0;

  return (
    <div className="h-14 bg-[#0a0b0d] flex items-center justify-between px-4 w-full select-none z-40 relative">
      <div className="flex items-center space-x-6 h-full">
        {/* Logo */}
        <div className="flex items-center space-x-2 text-white font-bold text-lg tracking-wider">
          <Activity className="text-[#4285f4]" size={22} />
          <span>SoDEX</span>
        </div>

        <div className="w-px h-6 bg-[#1e2028]" />

        {/* Symbol Selector Mock */}
        <button className="flex items-center space-x-2 text-white hover:text-[#4285f4] transition duration-200 group">
          <span className="font-bold text-lg group-hover:drop-shadow-md">{activeSymbol}</span>
          <ChevronDown size={18} className="translate-y-px" />
        </button>

        {/* Spot/Perps Toggle */}
        <div className="flex items-center bg-[#111318] rounded border border-[#1e2028] p-0.5 text-[11px] font-bold tracking-wider">
          <button 
            className={clsx('px-3 py-1 rounded transition-colors', activeMarket === 'spot' ? 'bg-[#2a2d35] text-white shadow' : 'text-[#9aa0a6] hover:text-white')}
            onClick={() => setActiveMarket('spot')}
          >
            SPOT
          </button>
          <button 
            className={clsx('px-3 py-1 rounded transition-colors', activeMarket === 'perps' ? 'bg-[#2a2d35] text-white shadow' : 'text-[#9aa0a6] hover:text-white')}
            onClick={() => setActiveMarket('perps')}
          >
            PERPS
          </button>
        </div>

        {/* Ticker Info */}
        <div className="flex items-center space-x-6 ml-4 text-xs">
           <div className="flex flex-col">
             <span className="text-[#9aa0a6] text-[10px] uppercase font-semibold">Price</span>
             <NumberDisplay value={ticker?.lastPrice || 0} colorize className="font-bold text-sm" />
           </div>
           <div className="flex flex-col">
             <span className="text-[#9aa0a6] text-[10px] uppercase font-semibold">24h Change</span>
             <NumberDisplay value={priceChange} suffix="%" colorize className="font-medium" />
           </div>
           <div className="flex flex-col hidden lg:flex">
             <span className="text-[#9aa0a6] text-[10px] uppercase font-semibold">24h Volume</span>
             <NumberDisplay value={ticker?.volume || 0} prefix="$" className="text-[#e8eaed] font-medium" />
           </div>
        </div>
      </div>

      <div className="flex items-center space-x-5 h-full">
         <select 
           value={network}
           onChange={(e) => setNetwork(e.target.value as 'mainnet' | 'testnet')}
           className="bg-[#111318] border border-[#1e2028] hover:border-[#4285f4]/50 text-[#e8eaed] text-[11px] uppercase tracking-wider font-semibold rounded px-2 py-1.5 outline-none focus:border-[#4285f4] transition cursor-pointer"
         >
            <option value="mainnet">Mainnet</option>
            <option value="testnet">Testnet</option>
         </select>

         <ConnectionStatus status={wsStatus} />

         {address ? (
            <div className="bg-[#4285f4]/10 border border-[#4285f4]/30 text-[#4285f4] px-3 py-1.5 rounded font-mono text-xs font-semibold shadow-inner">
              {formatAddr(address)}
            </div>
         ) : (
            <button className="bg-[#4285f4] hover:bg-[#4285f4]/90 text-white px-4 py-1.5 rounded text-[11px] uppercase tracking-wider font-bold shadow-lg shadow-[#4285f4]/20 transition-transform active:scale-95">
              Connect Wallet
            </button>
         )}

         <button onClick={onOpenSettings} className="text-[#9aa0a6] hover:text-white transition p-1">
            <Settings size={18} />
         </button>
      </div>
    </div>
  );
};
