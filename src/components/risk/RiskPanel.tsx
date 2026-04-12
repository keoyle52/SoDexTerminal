import React, { useState, useEffect } from 'react';
import { useRiskStore } from '../../store/riskStore';
import { useAccountStore } from '../../store/accountStore';
import { spotClient } from '../../api/rest/spotClient';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { ShieldAlert, Activity, Clock, Zap } from 'lucide-react';

export const RiskPanel: React.FC = () => {
  const { 
    scheduleCancelEnabled, setScheduleCancelEnabled,
    scheduleCancelInterval, setScheduleCancelInterval,
    nextScheduledCancel, setNextScheduledCancel 
  } = useRiskStore();
  
  const { address, accountID } = useAccountStore();
  const [loading, setLoading] = useState(false);
  const [intervalMin, setIntervalMin] = useState(Math.max(1, Math.floor(scheduleCancelInterval / 60000)));
  const [timeLeft, setTimeLeft] = useState<string | null>(null);

  useEffect(() => {
    if (!scheduleCancelEnabled || !nextScheduledCancel) {
      setTimeLeft(null);
      return;
    }

    const timer = setInterval(() => {
      const diff = nextScheduledCancel.getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("EXPIRED");
        return;
      }
      const secs = Math.floor(diff / 1000);
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      setTimeLeft(`${m}:${s.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(timer);
  }, [scheduleCancelEnabled, nextScheduledCancel]);

  const handleUpdate = async (enabled: boolean) => {
     if (!address || accountID === null) return toast.error("Wallet or Account not linked");
     setLoading(true);
     
     try {
       const ms = enabled ? intervalMin * 60000 : 0;
       const payload = {
         type: 'scheduleCancel',
         params: {
           accountID: accountID,
           scheduledTimestamp: enabled ? Date.now() + ms : undefined,
         }
       };

       await spotClient.scheduleCancel(payload);
       
       setScheduleCancelEnabled(enabled);
       setScheduleCancelInterval(ms);
       if (enabled) {
         setNextScheduledCancel(new Date(Date.now() + ms));
         toast.success(`Dead Man's Switch Active (${intervalMin}m)`);
       } else {
         setNextScheduledCancel(null);
         toast.success("Dead Man's Switch Disabled");
       }
     } catch (e: any) {
       toast.error(`Schedule Cancel Failed: ${e.message}`);
     } finally {
       setLoading(false);
     }
  };

  return (
    <div className="w-full h-14 flex items-center bg-[#111318]/80 backdrop-blur-md rounded-lg border border-[#1e2028] shadow-[0_4px_20px_rgba(0,0,0,0.4)] px-5 space-x-6">
      <div className={clsx(
        "flex items-center justify-center p-2 rounded-lg transition-all duration-300", 
        scheduleCancelEnabled ? "bg-[#00c853]/10 shadow-[0_0_15px_rgba(0,200,83,0.1)]" : "bg-black/40"
      )}>
        <ShieldAlert size={20} className={scheduleCancelEnabled ? "text-[#00c853] animate-pulse" : "text-[#5f6368]"} />
      </div>

      <div className="flex flex-col flex-1 pl-4 border-l border-[#1e2028]">
        <div className="flex items-center space-x-2">
          <span className="text-[10px] uppercase text-[#e8eaed] font-bold tracking-[0.2em]">Dead Man's Switch</span>
          {scheduleCancelEnabled && (
            <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-[#00c853]/10 text-[#00c853] text-[9px] font-bold border border-[#00c853]/20">
              <Activity size={10} />
              <span>LIVE</span>
            </span>
          )}
        </div>
        <span className="text-[9px] text-[#9aa0a6] uppercase leading-tight font-semibold mt-0.5">
          Automatic Emergency Liquidation / Cancellation Protocol
        </span>
      </div>

      {scheduleCancelEnabled && timeLeft && (
        <div className="flex flex-col items-center justify-center px-4 border-x border-[#1e2028] h-full">
          <span className="text-[8px] text-[#9aa0a6] font-bold uppercase tracking-widest mb-1">Refresh Due In</span>
          <div className="flex items-center space-x-2 text-[#e8eaed] font-mono font-bold text-sm">
            <Clock size={12} className="text-[#4285f4]" />
            <span>{timeLeft}</span>
          </div>
        </div>
      )}

      <div className="flex items-center space-x-4 bg-[#0a0b0d] p-1.5 px-4 rounded-md shadow-inner border border-[#1e2028]/50">
         <span className="text-[10px] text-[#5f6368] uppercase font-bold tracking-widest select-none">Timeout</span>
         <div className="flex items-center space-x-2">
            <input 
              type="number" 
              value={intervalMin}
              onChange={(e) => setIntervalMin(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-8 bg-transparent text-[#e8eaed] text-xs font-mono font-extrabold outline-none text-right placeholder-[#5f6368]"
              min="1"
            />
            <span className="text-[10px] text-[#9aa0a6] font-bold select-none uppercase">min</span>
         </div>
      </div>

      <button
        onClick={() => handleUpdate(!scheduleCancelEnabled)}
        disabled={loading}
        className={clsx(
          "min-w-[140px] py-2.5 text-[10px] uppercase tracking-[0.1em] font-extrabold rounded-md transition-all duration-300 shadow-lg active:scale-95 flex items-center justify-center space-x-2",
          scheduleCancelEnabled 
             ? "bg-transparent text-[#f44336] border border-[#f44336]/40 hover:bg-[#f44336]/10" 
             : "bg-[#4285f4] text-white border border-[#4285f4]/50 hover:bg-[#4285f4]/80 shadow-[0_4px_15px_rgba(66,133,244,0.3)]"
        )}
      >
        {loading ? (
          <Zap size={14} className="animate-spin" />
        ) : (
          <>
            <Zap size={14} className={clsx(scheduleCancelEnabled ? "text-[#f44336]" : "text-white")} />
            <span>{scheduleCancelEnabled ? 'Deactivate Prot' : 'Activate Protocol'}</span>
          </>
        )}
      </button>
    </div>
  );
};
