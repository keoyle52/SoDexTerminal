import React from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import { X, Save, ShieldCheck, Cpu, Palette, RotateCcw } from 'lucide-react';
import clsx from 'clsx';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { 
    apiKeyName, setApiKeyName,
    privateKey, setPrivateKey,
    network, setNetwork,
    theme, setTheme,
    layoutReset, 
  } = useSettingsStore();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md px-4 transition-all duration-300">
      <div className="bg-[#111318] border border-[#1e2028] shadow-[0_20px_60px_rgba(0,0,0,0.8)] rounded-xl w-full max-w-[550px] overflow-hidden flex flex-col scale-100 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between px-8 py-5 border-b border-[#1e2028] bg-[#0a0b0d]/50">
          <div className="flex items-center space-x-3">
            <div className="p-1.5 bg-[#4285f4]/10 rounded-lg">
              <Cpu size={18} className="text-[#4285f4]" />
            </div>
            <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">Engine Configuration</h3>
          </div>
          <button 
            onClick={onClose} 
            className="text-[#5f6368] hover:text-[#f44336] bg-transparent hover:bg-[#f44336]/10 transition-all p-2 rounded-full"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="flex flex-col p-8 space-y-8 overflow-y-auto max-h-[80vh] w-full custom-scrollbar">
          {/* SEC */}
          <div className="space-y-6">
             <div className="flex flex-col space-y-2">
               <div className="flex items-center space-x-2 text-[#4285f4]">
                 <ShieldCheck size={14} />
                 <h4 className="text-[10px] uppercase tracking-[0.2em] font-black">Secure API Binding</h4>
               </div>
               <p className="text-[10px] text-[#9aa0a6] uppercase leading-relaxed font-bold opacity-80 pl-5">
                 Your private key is loaded exclusively into non-persistent RAM state variables. It natively signs EIP-712 exchange payloads on your machine with zero remote transmission.
               </p>
             </div>
             
             <div className="flex flex-col space-y-5 pt-2">
               <div className="flex flex-col space-y-2.5">
                 <div className="flex justify-between items-center px-1">
                   <span className="text-[10px] uppercase font-black text-[#e8eaed] tracking-wider">Key Alias / Account Ref</span>
                   <span className="text-[9px] text-[#5f6368] font-bold uppercase">Required</span>
                 </div>
                 <input 
                   type="text"
                   value={apiKeyName}
                   onChange={e => setApiKeyName(e.target.value)}
                   className="w-full bg-[#0a0b0d] border border-[#1e2028] text-xs font-mono text-white px-4 py-3.5 rounded-lg shadow-inner focus:border-[#4285f4]/50 hover:border-[#2a2d35] outline-none transition-all"
                   placeholder="e.g., Master Ledger Import"
                 />
               </div>
               <div className="flex flex-col space-y-2.5">
                 <div className="flex justify-between items-center px-1">
                   <span className="text-[10px] uppercase font-black text-[#e8eaed] tracking-wider">EVM Target Private Key (Hex)</span>
                   {privateKey ? (
                     <span className="bg-[#00c853]/10 text-[#00c853] px-2 py-0.5 rounded text-[8px] font-black tracking-widest border border-[#00c853]/20">ENCRYPTED & LOCKED</span>
                   ) : (
                     <span className="text-[9px] text-[#f44336] font-bold uppercase">Critical</span>
                   )}
                 </div>
                 <div className="relative">
                   <input 
                     type="password"
                     value={privateKey || ''}
                     onChange={e => setPrivateKey(e.target.value)}
                     className="w-full bg-[#0a0b0d] border border-[#1e2028] text-xs font-mono text-white px-4 py-3.5 rounded-lg shadow-inner focus:border-[#4285f4]/50 hover:border-[#2a2d35] outline-none transition-all pr-12"
                     placeholder="0x..."
                   />
                   <div className="absolute right-4 top-1/2 -translate-y-1/2">
                     <ShieldCheck size={16} className={privateKey ? "text-[#00c853]" : "text-[#5f6368] opacity-30"} />
                   </div>
                 </div>
               </div>
             </div>
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-[#1e2028] to-transparent w-full" />

          {/* PREF */}
          <div className="flex space-x-8">
            <div className="flex-1 flex flex-col space-y-3">
               <h4 className="text-[10px] uppercase tracking-[0.2em] text-[#9aa0a6] font-black ml-1">Network</h4>
               <select 
                 value={network}
                 onChange={(e) => setNetwork(e.target.value as 'mainnet' | 'testnet')}
                 className="bg-[#0a0b0d] border border-[#1e2028] text-[11px] font-black uppercase tracking-wider text-[#e8eaed] px-4 py-3.5 rounded-lg outline-none w-full shadow-inner cursor-pointer hover:border-[#2a2d35] transition-all appearance-none"
               >
                 <option value="testnet">SoDEX Testnet Gateway</option>
                 <option value="mainnet" disabled>SoDEX Mainnet Proxy (Soon)</option>
               </select>
            </div>
            <div className="flex-1 flex flex-col space-y-3">
               <div className="flex items-center space-x-2 ml-1">
                 <Palette size={12} className="text-[#9aa0a6]" />
                 <h4 className="text-[10px] uppercase tracking-[0.2em] text-[#9aa0a6] font-black">Aesthetics</h4>
               </div>
               <div className="flex bg-[#0a0b0d] border border-[#1e2028] p-1 rounded-lg font-black text-[10px] tracking-wider uppercase h-[46px] w-full shadow-inner">
                 <button 
                   onClick={() => setTheme('dark')} 
                   className={clsx("flex-1 rounded-md transition-all duration-300", theme === 'dark' ? "bg-[#1e2028] text-white shadow-lg border border-white/5" : "text-[#5f6368] hover:text-[#9aa0a6]")}
                 >
                   Deep Dark
                 </button>
                 <button 
                   onClick={() => setTheme('light')} 
                   className={clsx("flex-1 rounded-md transition-all cursor-not-allowed opacity-30")}
                   disabled
                 >
                   Light
                 </button>
               </div>
            </div>
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-[#1e2028] to-transparent w-full" />

          {/* DANGERS */}
          <div className="flex flex-col space-y-4">
             <div className="flex items-center justify-between bg-[#f44336]/5 border border-[#f44336]/20 rounded-xl p-6 shadow-sm overflow-hidden relative">
               <div className="absolute -right-4 -top-4 text-[#f44336] opacity-5">
                 <RotateCcw size={80} />
               </div>
               <div className="flex flex-col relative z-10">
                 <span className="text-[11px] uppercase font-black text-white tracking-widest">Reset Terminal Matrix</span>
                 <span className="text-[10px] text-[#9aa0a6] font-bold mt-1.5 uppercase max-w-[240px] leading-relaxed">
                   Hard reset all dashboard grid dimensions to initial state.
                 </span>
               </div>
               <button 
                 onClick={() => { layoutReset(); onClose(); }}
                 className="bg-[#1e2028] hover:bg-[#f44336] text-[#f44336] hover:text-white border border-[#f44336]/30 hover:border-[#f44336] uppercase font-black tracking-[0.15em] text-[10px] py-3 px-6 rounded-lg transition-all shadow-lg active:scale-95 relative z-10"
               >
                 Execute Reset
               </button>
             </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-[#1e2028] bg-[#0a0b0d]/50 flex justify-end items-center space-x-6">
           <span className="text-[9px] text-[#5f6368] font-bold uppercase tracking-widest">Auto-applying Changes...</span>
           <button 
             onClick={onClose}
             className="bg-[#4285f4] hover:bg-[#4285f4]/90 text-white font-black text-[11px] uppercase tracking-[0.2em] py-3.5 px-12 rounded-lg shadow-[0_4px_20px_rgba(66,133,244,0.4)] transition-all active:scale-95 flex items-center space-x-2"
           >
             <Save size={16} />
             <span>Synchronize</span>
           </button>
        </div>
      </div>
    </div>
  );
};
