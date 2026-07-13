import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { 
  Play, TrendingUp, DollarSign, Activity, Percent, ArrowDownRight, 
  HelpCircle, Settings, Shield, BarChart3, Database, Coins, Sparkles 
} from 'lucide-react';
import { runBacktest, type BacktestResult, type BacktestTrade } from '../api/backtestEngine';
import { cn } from '../lib/utils';
import { createDefaultSignals } from '../api/signalEngine';
import { NumberDisplay } from '../components/common/NumberDisplay';
import { 
  buildContext, recommendGridBot, recommendDcaBot, 
  recommendTwapBot, recommendMarketMakerBot, recommendSignalBot 
} from '../api/aiAutoConfig';

const COINS = [
  { value: 'BTC-USD', label: 'BTC-USD (Bitcoin)' },
  { value: 'ETH-USD', label: 'ETH-USD (Ethereum)' },
  { value: 'SOL-USD', label: 'SOL-USD (Solana)' },
  { value: 'LINK-USD', label: 'LINK-USD (Chainlink)' }
];

export const BacktestStudio: React.FC = () => {
  const [symbol, setSymbol] = useState('BTC-USD');
  const [market, setMarket] = useState<'spot' | 'perps'>('perps');
  const [botType, setBotType] = useState<'GRID' | 'DCA' | 'TWAP' | 'MM' | 'SIGNAL'>('GRID');
  const [budget, setBudget] = useState('1000');
  
  // Strategy Parameters
  const [params, setParams] = useState<Record<string, string>>({
    lowerPrice: '',
    upperPrice: '',
    gridCount: '10',
    amountPerGrid: '',
    dipPct: '1.5',
    maxOrders: '10',
    amountPerOrder: '',
    takeProfitPct: '1.5',
    stopLossPct: '3.0',
    slices: '10',
    totalAmount: '',
    spreadBps: '15',
    layers: '3',
    orderSizeUsdt: '100',
    combineMode: 'ANY'
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);

  const [configuring, setConfiguring] = useState(false);

  const handleParamChange = (key: string, val: string) => {
    setParams(prev => ({ ...prev, [key]: val }));
  };

  const runAutoConfigure = async () => {
    setConfiguring(true);
    try {
      const budgetNum = parseFloat(budget) || 1000;
      const ctx = await buildContext(symbol, market);
      let presetResult;
      if (botType === 'GRID') {
        presetResult = recommendGridBot(ctx, budgetNum);
      } else if (botType === 'DCA') {
        presetResult = recommendDcaBot(ctx, budgetNum);
      } else if (botType === 'TWAP') {
        presetResult = recommendTwapBot(ctx, budgetNum);
      } else if (botType === 'MM') {
        presetResult = recommendMarketMakerBot(ctx, budgetNum);
      } else {
        presetResult = recommendSignalBot(ctx);
      }
      
      const preset = presetResult.preset;
      setParams(prev => ({
        ...prev,
        lowerPrice: String(preset.lowerPrice ?? prev.lowerPrice),
        upperPrice: String(preset.upperPrice ?? prev.upperPrice),
        gridCount: String(preset.gridCount ?? prev.gridCount),
        dipPct: String(preset.dipPct ?? prev.dipPct),
        maxOrders: String(preset.maxOrders ?? prev.maxOrders),
        takeProfitPct: String(preset.takeProfitPct ?? prev.takeProfitPct),
        stopLossPct: String(preset.stopLossPct ?? prev.stopLossPct),
        slices: String(preset.slices ?? prev.slices),
        spreadBps: String(preset.spreadBps ?? prev.spreadBps),
        layers: String(preset.layers ?? prev.layers),
        orderSizeUsdt: String(preset.orderSizeUsdt ?? prev.orderSizeUsdt),
        combineMode: String(preset.combineMode ?? prev.combineMode),
      }));
      
      toast.success(presetResult.rationale, { duration: 7000 });
    } catch (e) {
      toast.error('AI Auto-configure failed: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setConfiguring(false);
    }
  };

  const executeBacktest = async () => {
    setLoading(true);
    try {
      const budgetNum = parseFloat(budget) || 1000;
      const response = await runBacktest(symbol, market, botType, params, budgetNum);
      setResult(response);
      toast.success('Historical simulation complete!');
    } catch (e) {
      toast.error('Simulation failed: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  };

  // Helper to render SVG Equity Chart
  const renderEquityChart = () => {
    if (!result || result.equityCurve.length < 2) return null;
    const curve = result.equityCurve;
    const balances = curve.map(c => c.balance);
    const minBal = Math.min(...balances);
    const maxBal = Math.max(...balances);
    const range = maxBal - minBal || 1;

    // SVG Layout dimensions
    const width = 600;
    const height = 200;
    const padding = 20;

    const points = curve.map((c, i) => {
      const x = padding + (i / (curve.length - 1)) * (width - padding * 2);
      const y = height - padding - ((c.balance - minBal) / range) * (height - padding * 2);
      return `${x},${y}`;
    }).join(' ');

    return (
      <div className="p-4 rounded-xl border border-border bg-[#0B0E11]/40 space-y-2">
        <div className="flex justify-between items-center text-[10px] text-text-secondary select-none">
          <span className="font-mono font-bold uppercase tracking-wider">Equity Curve Simulation</span>
          <span className="font-mono">Peak: ${maxBal.toFixed(2)} | Min: ${minBal.toFixed(2)}</span>
        </div>
        <div className="w-full relative h-[210px] bg-[#080B0E] rounded-lg border border-border overflow-hidden p-2">
          <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            {/* Grid Lines */}
            <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="rgba(255,255,255,0.05)" strokeDasharray="3" />
            <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="rgba(255,255,255,0.05)" strokeDasharray="3" />
            <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.05)" strokeDasharray="3" />

            {/* Area under curve */}
            <path
              d={`M ${padding},${height - padding} L ${points} L ${width - padding},${height - padding} Z`}
              fill="url(#chartGradient)"
            />

            {/* Line Path */}
            <polyline
              fill="none"
              stroke="#22d3ee"
              strokeWidth="2"
              points={points}
              className="drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]"
            />
          </svg>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background overflow-hidden">
      {/* Page Header */}
      <div className="shrink-0 px-6 pt-4 pb-3 border-b border-border bg-surface select-none">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-bold text-text-primary flex items-center gap-2">
              <Sparkles size={16} className="text-primary animate-pulse" />
              Quant Backtest Studio
            </h1>
            <p className="text-[10px] text-text-secondary mt-0.5">Run historical simulations for Grid, DCA, TWAP, Market Maker and Signal bot settings.</p>
          </div>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="flex-1 flex min-h-0 divide-x divide-border">
        {/* Left Column: Config Panel */}
        <div className="w-[35%] overflow-y-auto p-5 space-y-4 bg-[#0B0E11]/30 scrollbar-none font-sans text-xs">
          
          <div className="p-4 rounded-xl border border-border bg-[#101317]/50 space-y-4">
            <h3 className="text-xs font-bold text-text-primary flex items-center gap-1.5 border-b border-border pb-2">
              <Settings size={14} className="text-primary" />
              Backtest Setup
            </h3>

            {/* Symbol & Market */}
            <div className="space-y-3">
              <div>
                <label className="block text-[9px] text-text-secondary uppercase mb-1 font-bold">Select Symbol</label>
                <select 
                  value={symbol} 
                  onChange={(e) => setSymbol(e.target.value)}
                  className="w-full bg-[#080B0E] border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-primary outline-none cursor-pointer"
                >
                  {COINS.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[9px] text-text-secondary uppercase mb-1.5 font-bold">Market Type</label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setMarket('spot')} 
                    className={cn(
                      "flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer",
                      market === 'spot' ? "border-primary bg-primary/10 text-primary" : "border-border bg-background/40 text-text-muted hover:border-border-hover"
                    )}
                  >
                    Spot
                  </button>
                  <button 
                    onClick={() => setMarket('perps')} 
                    className={cn(
                      "flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer",
                      market === 'perps' ? "border-primary bg-primary/10 text-primary" : "border-border bg-background/40 text-text-muted hover:border-border-hover"
                    )}
                  >
                    Perps
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[9px] text-text-secondary uppercase mb-1 font-bold">Bot Type Strategy</label>
                <select 
                  value={botType} 
                  onChange={(e) => setBotType(e.target.value as any)}
                  className="w-full bg-[#080B0E] border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-primary outline-none cursor-pointer"
                >
                  <option value="GRID">Grid Trading Bot</option>
                  <option value="DCA">DCA (Dollar Cost Average)</option>
                  <option value="TWAP">TWAP (Time Weighted Avg Price)</option>
                  <option value="MM">Market Maker Bot</option>
                  <option value="SIGNAL">Consensus Signal Bot</option>
                </select>
              </div>

              <div>
                <label className="block text-[9px] text-text-secondary uppercase mb-1 font-bold">Initial Simulation Capital (USDT)</label>
                <input 
                  type="number" 
                  value={budget} 
                  onChange={(e) => setBudget(e.target.value)}
                  className="w-full bg-[#080B0E] border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:border-primary outline-none font-mono font-bold"
                />
              </div>
            </div>
          </div>

          {/* Dynamic Parameters block based on botType */}
          <div className="p-4 rounded-xl border border-border bg-[#101317]/50 space-y-4">
            <h3 className="text-xs font-bold text-text-primary flex items-center gap-1.5 border-b border-border pb-2">
              <Database size={14} className="text-primary" />
              Strategy Parameters
            </h3>

            <div className="space-y-3 font-mono">
              {botType === 'GRID' && (
                <>
                  <div>
                    <label className="block text-[9px] text-text-secondary uppercase mb-1 font-sans font-bold">Lower Price Target</label>
                    <input type="number" placeholder="Leave empty for auto-range" value={params.lowerPrice} onChange={(e) => handleParamChange('lowerPrice', e.target.value)} className="w-full bg-[#080B0E] border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary outline-none" />
                  </div>
                  <div>
                    <label className="block text-[9px] text-text-secondary uppercase mb-1 font-sans font-bold">Upper Price Target</label>
                    <input type="number" placeholder="Leave empty for auto-range" value={params.upperPrice} onChange={(e) => handleParamChange('upperPrice', e.target.value)} className="w-full bg-[#080B0E] border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary outline-none" />
                  </div>
                  <div>
                    <label className="block text-[9px] text-text-secondary uppercase mb-1 font-sans font-bold">Grid Count (Layers)</label>
                    <input type="number" value={params.gridCount} onChange={(e) => handleParamChange('gridCount', e.target.value)} className="w-full bg-[#080B0E] border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary outline-none" />
                  </div>
                </>
              )}

              {botType === 'DCA' && (
                <>
                  <div>
                    <label className="block text-[9px] text-text-secondary uppercase mb-1 font-sans font-bold">Price Dip Trigger %</label>
                    <input type="number" value={params.dipPct} onChange={(e) => handleParamChange('dipPct', e.target.value)} className="w-full bg-[#080B0E] border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary outline-none" />
                  </div>
                  <div>
                    <label className="block text-[9px] text-text-secondary uppercase mb-1 font-sans font-bold">Max Buy Orders</label>
                    <input type="number" value={params.maxOrders} onChange={(e) => handleParamChange('maxOrders', e.target.value)} className="w-full bg-[#080B0E] border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary outline-none" />
                  </div>
                  <div>
                    <label className="block text-[9px] text-text-secondary uppercase mb-1 font-sans font-bold">Take Profit %</label>
                    <input type="number" value={params.takeProfitPct} onChange={(e) => handleParamChange('takeProfitPct', e.target.value)} className="w-full bg-[#080B0E] border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary outline-none" />
                  </div>
                  <div>
                    <label className="block text-[9px] text-text-secondary uppercase mb-1 font-sans font-bold">Stop Loss %</label>
                    <input type="number" value={params.stopLossPct} onChange={(e) => handleParamChange('stopLossPct', e.target.value)} className="w-full bg-[#080B0E] border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary outline-none" />
                  </div>
                </>
              )}

              {botType === 'TWAP' && (
                <>
                  <div>
                    <label className="block text-[9px] text-text-secondary uppercase mb-1 font-sans font-bold">Number of Slices</label>
                    <input type="number" value={params.slices} onChange={(e) => handleParamChange('slices', e.target.value)} className="w-full bg-[#080B0E] border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary outline-none" />
                  </div>
                </>
              )}

              {botType === 'MM' && (
                <>
                  <div>
                    <label className="block text-[9px] text-text-secondary uppercase mb-1 font-sans font-bold">Spread (BPS)</label>
                    <input type="number" value={params.spreadBps} onChange={(e) => handleParamChange('spreadBps', e.target.value)} className="w-full bg-[#080B0E] border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary outline-none" />
                  </div>
                  <div>
                    <label className="block text-[9px] text-text-secondary uppercase mb-1 font-sans font-bold">Order Size (USDT)</label>
                    <input type="number" value={params.orderSizeUsdt} onChange={(e) => handleParamChange('orderSizeUsdt', e.target.value)} className="w-full bg-[#080B0E] border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary outline-none" />
                  </div>
                  <div>
                    <label className="block text-[9px] text-text-secondary uppercase mb-1 font-sans font-bold">Layers Count</label>
                    <input type="number" value={params.layers} onChange={(e) => handleParamChange('layers', e.target.value)} className="w-full bg-[#080B0E] border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary outline-none" />
                  </div>
                </>
              )}

              {botType === 'SIGNAL' && (
                <>
                  <div>
                    <label className="block text-[9px] text-text-secondary uppercase mb-1 font-sans font-bold">Consensus Rule</label>
                    <select 
                      value={params.combineMode} 
                      onChange={(e) => handleParamChange('combineMode', e.target.value)}
                      className="w-full bg-[#080B0E] border border-border rounded-lg px-3 py-2 text-xs text-text-primary outline-none cursor-pointer"
                    >
                      <option value="ANY">ANY indicator triggers</option>
                      <option value="ALL">ALL indicators must agree</option>
                      <option value="MAJORITY">MAJORITY agreement</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] text-text-secondary uppercase mb-1 font-sans font-bold">Take Profit %</label>
                    <input type="number" value={params.takeProfitPct} onChange={(e) => handleParamChange('takeProfitPct', e.target.value)} className="w-full bg-[#080B0E] border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary outline-none" />
                  </div>
                  <div>
                    <label className="block text-[9px] text-text-secondary uppercase mb-1 font-sans font-bold">Stop Loss %</label>
                    <input type="number" value={params.stopLossPct} onChange={(e) => handleParamChange('stopLossPct', e.target.value)} className="w-full bg-[#080B0E] border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary outline-none" />
                  </div>
                </>
              )}
            </div>
          </div>

          <button
            onClick={runAutoConfigure}
            disabled={configuring}
            className={cn(
              "group relative flex items-center justify-between gap-3 px-4 py-3 rounded-xl w-full",
              "bg-gradient-to-r from-fuchsia-500/15 via-violet-500/12 to-cyan-500/15",
              "border border-fuchsia-400/30 hover:border-fuchsia-400/50",
              "shadow-[0_0_12px_rgba(217,70,239,0.15)] hover:shadow-[0_0_18px_rgba(217,70,239,0.3)]",
              "transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-wait"
            )}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-fuchsia-500/30 to-cyan-400/30 border border-fuchsia-400/40 flex items-center justify-center">
                <Sparkles size={13} className="text-fuchsia-200" />
              </div>
              <div className="text-left">
                <div className="text-[11px] font-bold uppercase tracking-wider bg-gradient-to-r from-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
                  AI Auto-Configure Params
                </div>
                <div className="text-[10px] text-text-muted mt-0.5">
                  Optimize backtest settings via AI
                </div>
              </div>
            </div>
            {configuring ? (
              <div className="w-3 h-3 border-2 border-fuchsia-400/60 border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="text-[10px] text-fuchsia-300 font-mono group-hover:translate-x-0.5 transition-transform">→</span>
            )}
          </button>

          <button
            onClick={executeBacktest}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-primary hover:bg-primary/95 text-white font-bold text-xs shadow-lg shadow-primary/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play size={13} fill="currentColor" />
            <span>{loading ? 'SIMULATING TRADES...' : 'EXECUTE HISTORICAL RUN'}</span>
          </button>
        </div>

        {/* Right Column: Performance Results Dashboard */}
        <div className="w-[65%] flex flex-col min-h-0 overflow-y-auto p-6 space-y-6">
          <div className="flex flex-col gap-1.5 select-none">
            <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
              <BarChart3 size={14} className="text-primary" />
              Simulation Results Matrix
            </h2>
            <p className="text-[10px] text-text-secondary">Explore backtest performance metrics, yield percentages, and equity variance curves.</p>
          </div>

          {!result ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 border border-dashed border-border/60 rounded-2xl bg-[#0B0E11]/10 select-none">
              <Database size={32} className="text-text-muted mb-3 animate-pulse" />
              <h3 className="text-xs font-bold text-text-secondary">Historical Sandbox Empty</h3>
              <p className="text-[10px] text-text-muted max-w-[280px] mt-1 leading-normal">Configure your bot parameters on the left and run the backtest to simulate execution results.</p>
            </div>
          ) : (
            <div className="space-y-6 flex-1 flex flex-col min-h-0">
              
              {/* Stats Grid */}
              <div className="grid grid-cols-4 gap-4 select-none">
                
                {/* Metric 1 */}
                <div className="p-4 rounded-xl border border-border bg-[#101317]/40 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-text-secondary">
                    <span className="text-[9px] font-bold uppercase tracking-wider">Total Return</span>
                    <DollarSign size={13} className="text-primary" />
                  </div>
                  <div className="mt-3">
                    <div className={cn(
                      "text-sm font-black font-mono",
                      result.totalReturnUsd >= 0 ? "text-success" : "text-danger"
                    )}>
                      {result.totalReturnUsd >= 0 ? '+' : ''}{result.totalReturnUsd.toFixed(2)} USDT
                    </div>
                    <div className={cn(
                      "text-[10px] font-bold mt-0.5 font-mono",
                      result.totalReturnPct >= 0 ? "text-success" : "text-danger"
                    )}>
                      {result.totalReturnPct >= 0 ? '+' : ''}{result.totalReturnPct.toFixed(2)}%
                    </div>
                  </div>
                </div>

                {/* Metric 2 */}
                <div className="p-4 rounded-xl border border-border bg-[#101317]/40 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-text-secondary">
                    <span className="text-[9px] font-bold uppercase tracking-wider">Win Rate</span>
                    <Percent size={13} className="text-success" />
                  </div>
                  <div className="mt-3">
                    <div className="text-sm font-black font-mono text-text-primary">
                      {result.winRatePct}%
                    </div>
                    <p className="text-[8px] text-text-muted mt-0.5 font-sans font-bold">OF CLOSED TRADES</p>
                  </div>
                </div>

                {/* Metric 3 */}
                <div className="p-4 rounded-xl border border-border bg-[#101317]/40 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-text-secondary">
                    <span className="text-[9px] font-bold uppercase tracking-wider">Max Drawdown</span>
                    <ArrowDownRight size={13} className="text-danger" />
                  </div>
                  <div className="mt-3">
                    <div className="text-sm font-black font-mono text-danger">
                      -{result.maxDrawdownPct}%
                    </div>
                    <p className="text-[8px] text-text-muted mt-0.5 font-sans font-bold">PEAK-TO-TROUGH</p>
                  </div>
                </div>

                {/* Metric 4 */}
                <div className="p-4 rounded-xl border border-border bg-[#101317]/40 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-text-secondary">
                    <span className="text-[9px] font-bold uppercase tracking-wider">Total Trades</span>
                    <Activity size={13} className="text-primary" />
                  </div>
                  <div className="mt-3">
                    <div className="text-sm font-black font-mono text-text-primary">
                      {result.totalTrades}
                    </div>
                    <p className="text-[8px] text-text-muted mt-0.5 font-sans font-bold">ORDER FILLS RECORDED</p>
                  </div>
                </div>

              </div>

              {/* Equity Chart */}
              {renderEquityChart()}

              {/* Trade Logs Table */}
              <div className="flex-1 flex flex-col border border-border bg-[#101317]/20 rounded-xl overflow-hidden min-h-[220px]">
                <div className="shrink-0 px-4 py-3 border-b border-border bg-[#101317] flex justify-between items-center select-none">
                  <span className="text-[10px] font-bold text-text-primary uppercase tracking-wider">Simulated Execution Ledger</span>
                  <span className="text-[9px] text-text-muted font-mono">{result.trades.length} Fills logged</span>
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-none font-mono text-[11px] p-2">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-text-secondary border-b border-border/40 select-none text-[10px]">
                        <th className="px-3 py-2 font-sans font-bold">Time</th>
                        <th className="px-3 py-2 font-sans font-bold">Side</th>
                        <th className="px-3 py-2 font-sans font-bold text-right">Price</th>
                        <th className="px-3 py-2 font-sans font-bold text-right">Qty</th>
                        <th className="px-3 py-2 font-sans font-bold text-right">PnL (USDT)</th>
                        <th className="px-3 py-2 font-sans font-bold pl-4">Execution Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.trades.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center text-text-muted py-8 select-none">No trades executed during this simulation period.</td>
                        </tr>
                      ) : (
                        result.trades.map((trade, i) => (
                          <tr key={i} className="border-b border-border/20 last:border-b-0 hover:bg-white/[0.01] transition-colors">
                            <td className="px-3 py-2 text-text-muted text-[10px]">{trade.time}</td>
                            <td className="px-3 py-2">
                              <span className={cn(
                                "px-1.5 py-0.5 rounded-sm font-bold text-[9px]",
                                trade.side === 'BUY' ? "bg-success-soft text-success" : "bg-danger/10 text-danger"
                              )}>
                                {trade.side}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right text-text-primary">${trade.price.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right text-text-secondary">{trade.qty.toFixed(4)}</td>
                            <td className={cn(
                              "px-3 py-2 text-right font-bold",
                              trade.pnl === undefined ? "text-text-muted" :
                              trade.pnl >= 0 ? "text-success" : "text-danger"
                            )}>
                              {trade.pnl !== undefined ? `${trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}` : '—'}
                            </td>
                            <td className="px-3 py-2 pl-4 text-text-muted text-[10px]">{trade.reason}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
};
