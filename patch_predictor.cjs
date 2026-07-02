const fs = require('fs');
const path = require('path');

const predictorPath = path.join(__dirname, 'src', 'pages', 'BtcPredictor.tsx');
const content = fs.readFileSync(predictorPath, 'utf8');

const returnIndex = content.indexOf('return (');
if (returnIndex === -1) {
  console.error("Could not find return statement");
  process.exit(1);
}

const beforeReturn = content.substring(0, returnIndex);

const newReturn = `return (
    <div className="h-full flex flex-col bg-background overflow-hidden relative">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="shrink-0 px-8 pt-8 pb-4 border-b border-border/40 relative z-10 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black text-text-primary tracking-tight flex items-center gap-3">
            <Brain className="text-primary" size={32} />
            AI Strategy Predictor
          </h1>
          <p className="text-text-secondary mt-1 font-medium">Cycle-driven AI trader using Gemini insights.</p>
        </div>
        
        <div className="flex gap-2">
          {['SOSO', 'BTC', 'ETH', 'SOL'].map(c => (
            <button
              key={c}
              onClick={() => setSelectedAsset(c as any)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-bold transition-all",
                selectedAsset === c ? "bg-primary text-background shadow-lg shadow-primary/20" : "bg-surface/50 text-text-muted hover:text-text-primary border border-border"
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 relative z-10 custom-scrollbar space-y-6">
        {/* Status Hero */}
        <div className="p-6 rounded-3xl bg-surface/30 border border-border/40 backdrop-blur-xl shadow-2xl flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg", isRunning ? "bg-emerald-500 text-white animate-pulse" : "bg-surface-2 text-text-muted border border-border")}>
              {isRunning ? <Play size={32} /> : <Square size={32} />}
            </div>
            <div>
              <h2 className="text-2xl font-black text-text-primary">
                {isRunning ? 'Predictor Online' : 'Predictor Offline'}
              </h2>
              <div className="text-sm font-medium text-text-secondary flex items-center gap-2 mt-1">
                <Clock size={14} /> Next Cycle: {isRunning ? Math.max(0, Math.ceil((((cycleStartedAt || 0) + duration * 60000) - now) / 1000)) : '--'}s
              </div>
            </div>
          </div>
          
          <div className="flex gap-4">
            <div className="bg-background border border-border rounded-xl p-2 flex items-center gap-2">
              <span className="text-xs font-bold text-text-muted px-2">Duration</span>
              <select 
                value={duration} 
                onChange={(e) => setDuration(Number(e.target.value) as any)}
                className="bg-transparent text-text-primary font-bold outline-none cursor-pointer"
                disabled={isRunning}
              >
                {DURATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            
            <button
              onClick={() => isRunning ? handleStop() : handleStart()}
              disabled={busy}
              className={cn(
                "px-8 py-3 rounded-xl font-black text-lg transition-all shadow-xl flex items-center gap-2",
                isRunning ? "bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20" : "bg-primary text-background hover:scale-105"
              )}
            >
              {isRunning ? <StopCircle size={20} /> : <Play size={20} />}
              {isRunning ? 'STOP' : 'START CYCLE'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Chart */}
          <div className="lg:col-span-2 rounded-3xl border border-border overflow-hidden bg-surface shadow-2xl h-[450px]">
             <TradingChart symbol={symbol} market={market} markers={[]} />
          </div>

          {/* Verdict Panel */}
          <div className="bg-[#0a0a0c] border border-border/40 rounded-3xl p-6 shadow-2xl flex flex-col">
            <h3 className="text-sm font-bold text-text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
              <Cpu size={16} /> Latest Verdict
            </h3>
            
            {symState.aiVerdict ? (
               <div className="space-y-4 flex-1">
                 <div className="text-3xl font-black text-text-primary">
                   {symState.aiVerdict.verdict === 'LONG' ? <span className="text-emerald-400">LONG</span> :
                    symState.aiVerdict.verdict === 'SHORT' ? <span className="text-red-400">SHORT</span> : 
                    <span className="text-amber-400">HOLD</span>}
                 </div>
                 <p className="text-sm text-text-secondary leading-relaxed">{symState.aiVerdict.reasoning}</p>
                 
                 {symState.openPosition && (
                   <div className="mt-auto p-4 rounded-xl bg-primary/10 border border-primary/20">
                     <div className="text-xs font-bold text-primary uppercase tracking-widest mb-1">Active Position</div>
                     <div className="text-xl font-black text-text-primary">
                       {symState.openPosition.direction} @ {symState.openPosition.entryPrice.toFixed(4)}
                     </div>
                   </div>
                 )}
               </div>
            ) : (
               <div className="flex-1 flex flex-col items-center justify-center text-text-muted/50 gap-3">
                 <Sparkles size={48} className="opacity-20" />
                 <p className="text-sm font-medium">Waiting for first cycle resolution.</p>
               </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default BtcPredictor;
`;

fs.writeFileSync(predictorPath, beforeReturn + newReturn);
