import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Brain, TrendingUp, TrendingDown, Play, Pause, Settings,
  Activity, BarChart3, Zap,
  ChevronUp, ChevronDown, History
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';
import { fetchKlines, fetchTickers, fetchOrderbook } from '../api/services';
import { fetchSosoNews, fetchEtfCurrentMetrics } from '../api/sosoServices';
import { analyzeSentiment } from '../api/geminiClient';
import { callAiStrategist } from '../api/aiStrategist';
import { useSettingsStore } from '../store/settingsStore';

// ─── Types ─────────────────────────────────────────────────────────────────
type Timeframe = '5m' | '15m' | '1h' | '4h' | '1d';
type Direction = 'LONG' | 'SHORT' | 'NEUTRAL';

interface Prediction {
  id: string;
  timeframe: Timeframe;
  direction: Direction;
  confidence: number;
  entryPrice: number;
  currentPrice: number;
  pnlPercent: number;
  timestamp: number;
  signals: SignalBreakdown;
  aiAnalysis: string;
  status: 'ACTIVE' | 'CLOSED' | 'STOPPED';
}

interface SignalBreakdown {
  technical: number;
  fundamental: number;
  sentiment: number;
  marketStructure: number;
}

interface TradeSettings {
  amount: number;
  leverage: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  autoTrade: boolean;
}

// ─── Constants ─────────────────────────────────────────────────────────────
const TIMEFRAMES: Record<Timeframe, { label: string; ms: number; klines: number }> = {
  '5m': { label: '5m', ms: 5 * 60 * 1000, klines: 40 },
  '15m': { label: '15m', ms: 15 * 60 * 1000, klines: 60 },
  '1h': { label: '1h', ms: 60 * 60 * 1000, klines: 100 },
  '4h': { label: '4h', ms: 4 * 60 * 60 * 1000, klines: 100 },
  '1d': { label: '1d', ms: 24 * 60 * 60 * 1000, klines: 100 },
};

// ─── Main Component ────────────────────────────────────────────────────────
export const BtcPredictor: React.FC = () => {
  // ── State ─────────────────────────────────────────────────────────────
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>('15m');
  const [isRunning, setIsRunning] = useState(false);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [entryPrice, setEntryPrice] = useState<number>(0);
  const [activePrediction, setActivePrediction] = useState<Prediction | null>(null);
  const [predictionHistory] = useState<Prediction[]>([]);
  const [showSignalDetails, setShowSignalDetails] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Trade Settings
  const [tradeSettings, setTradeSettings] = useState<TradeSettings>({
    amount: 100,
    leverage: 5,
    stopLossPercent: 2,
    takeProfitPercent: 4,
    autoTrade: false,
  });

  // Performance Stats
  const [stats] = useState({
    totalTrades: 0,
    winRate: 0,
    totalPnl: 0,
    avgConfidence: 0,
  });

  const { isWalletConnected } = useSettingsStore();
  const cycleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPriceRef = useRef<number>(0);

  // ── Price Feed ─────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        // @ts-ignore
        const tickers = await fetchTickers();
        // @ts-ignore
        const btc = tickers.find(t => t.symbol.includes('BTC'));
        if (btc) {
          // @ts-ignore
          const newPrice = parseFloat(btc.lastPrice);
          prevPriceRef.current = currentPrice;
          setCurrentPrice(newPrice);
        }
      } catch (err) {
        console.error('Price fetch error:', err);
      }
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, 3000);
    return () => clearInterval(interval);
  }, []);

  // ── Core Analysis Function ───────────────────────────────────────────────
  const runAnalysis = useCallback(async () => {
    if (!isRunning) return;
    
    setIsAnalyzing(true);
    toast.loading('AI analiz yapıyor...', { id: 'analysis' });

    try {
      const tf = TIMEFRAMES[selectedTimeframe];
      
      // 1. Fetch Technical Data
      const klines = await fetchKlines('BTC-USD', selectedTimeframe, tf.klines);
      const closes: number[] = klines.map((k: any) => k.close);
      const current: number = closes[closes.length - 1];
      
      // Technical Indicators
      const sma20 = calculateSMA(closes, 20);
      const rsi = calculateRSI(closes, 14);
      const ema12 = calculateEMA(closes, 12);
      const ema26 = calculateEMA(closes, 26);
      const macd = ema12 - ema26;
      
      // 2. Fetch Orderbook Data
      // @ts-ignore
      const orderbook = await fetchOrderbook('BTC-USD', 20);
      // @ts-ignore
      const bidDepth: number = orderbook.bids.reduce((sum: number, b: any) => sum + parseFloat(b[1]), 0);
      // @ts-ignore
      const askDepth: number = orderbook.asks.reduce((sum: number, a: any) => sum + parseFloat(a[1]), 0);
      const imbalance = bidDepth + askDepth > 0 ? (bidDepth - askDepth) / (bidDepth + askDepth) : 0;

      // 3. Fetch News & ETF Data
      const news = await fetchSosoNews(1, 5);
      // @ts-ignore
      const etf: any = await fetchEtfCurrentMetrics();
      
      // 4. AI Sentiment Analysis
      let sentimentScore = 0;
      if (news.list && news.list.length > 0) {
        for (const item of news.list.slice(0, 3)) {
          const result = await analyzeSentiment((item as any).title || '');
          sentimentScore += result === 'BULLISH' ? 1 : result === 'BEARISH' ? -1 : 0;
        }
        sentimentScore = Math.max(-1, Math.min(1, sentimentScore / 3));
      }

      // 5. Calculate Signal Scores
      const technicalScore = (
        (current > sma20 ? 0.3 : -0.3) +
        (rsi > 70 ? -0.2 : rsi < 30 ? 0.2 : 0) +
        (macd > 0 ? 0.2 : -0.2) +
        (imbalance > 0.1 ? 0.2 : imbalance < -0.1 ? -0.2 : 0)
      );

      const fundamentalScore = (
        ((etf?.btcHoldingsChange24h || 0) > 0 ? 0.3 : -0.3) +
        sentimentScore * 0.4
      );

      const marketStructureScore = imbalance * 0.5;

      // 6. AI Strategist Analysis
      // @ts-ignore
      const aiAnalysis: any = await callAiStrategist({
        price: current,
        sma20,
        rsi,
        macd,
        imbalance,
        sentiment: sentimentScore,
        etfFlow: etf?.btcHoldingsChange24h || 0,
      });

      // 7. Final Direction & Confidence
      let totalScore = technicalScore + fundamentalScore + marketStructureScore;
      if (aiAnalysis?.signal) {
        totalScore += aiAnalysis.signal === 'BULLISH' ? 0.4 : aiAnalysis.signal === 'BEARISH' ? -0.4 : 0;
      }

      const confidence = Math.min(95, Math.abs(totalScore) * 50 + 50);
      
      let direction: Direction = 'NEUTRAL';
      if (totalScore > 0.5) direction = 'LONG';
      else if (totalScore < -0.5) direction = 'SHORT';

      // 8. Create Prediction
      const prediction: Prediction = {
        id: Date.now().toString(),
        timeframe: selectedTimeframe,
        direction,
        confidence,
        entryPrice: current,
        currentPrice: current,
        pnlPercent: 0,
        timestamp: Date.now(),
        signals: {
          technical: Math.abs(technicalScore) * 100,
          fundamental: Math.abs(fundamentalScore) * 100,
          sentiment: Math.abs(sentimentScore) * 100,
          marketStructure: Math.abs(marketStructureScore) * 100,
        },
        aiAnalysis: aiAnalysis?.rationale || 'Technical analysis based prediction',
        status: 'ACTIVE',
      };

      setActivePrediction(prediction);
      setEntryPrice(current);

      // 9. Auto-Trade Execution
      if (tradeSettings.autoTrade && direction !== 'NEUTRAL' && isWalletConnected) {
        await executeTrade(prediction);
      }

      toast.success(`AI Prediction: ${direction} (${confidence.toFixed(1)}% confidence)`, { id: 'analysis' });

    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Analysis error', { id: 'analysis' });
    } finally {
      setIsAnalyzing(false);
    }
  }, [isRunning, selectedTimeframe, tradeSettings, isWalletConnected]);

  // ── Trade Execution ──────────────────────────────────────────────────────
  const executeTrade = async (prediction: Prediction) => {
    try {
      const notional = tradeSettings.amount * tradeSettings.leverage;
      
      // Oto-işlem (API entegrasyonu sonradan yapılacak)
      // @ts-ignore
      console.log('Auto-trade:', { symbol: 'BTC-USD', side: prediction.direction, amount: notional });
      
      toast.success(`İşlem sinyali: ${prediction.direction} $${notional}`);
    } catch (err) {
      toast.error('İşlem açılamadı');
    }
  };


  // ── Cycle Management ────────────────────────────────────────────────────
  useEffect(() => {
    if (isRunning) {
      runAnalysis();
      cycleTimerRef.current = setInterval(runAnalysis, TIMEFRAMES[selectedTimeframe].ms);
    } else {
      if (cycleTimerRef.current) clearInterval(cycleTimerRef.current);
    }
    
    return () => {
      if (cycleTimerRef.current) clearInterval(cycleTimerRef.current);
    };
  }, [isRunning, selectedTimeframe, runAnalysis]);

  // ── PnL Update ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (activePrediction && currentPrice > 0) {
      const pnl = activePrediction.direction === 'LONG'
        ? ((currentPrice - activePrediction.entryPrice) / activePrediction.entryPrice) * 100
        : ((activePrediction.entryPrice - currentPrice) / activePrediction.entryPrice) * 100;
      
      setActivePrediction(prev => prev ? { ...prev, currentPrice, pnlPercent: pnl } : null);
    }
  }, [currentPrice, activePrediction?.entryPrice, activePrediction?.direction]);

  // ── Helpers ─────────────────────────────────────────────────────────────
  const calculateSMA = (data: number[], period: number) => {
    if (data.length < period) return data[data.length - 1];
    const sum = data.slice(-period).reduce((a, b) => a + b, 0);
    return sum / period;
  };

  const calculateEMA = (data: number[], period: number) => {
    const k = 2 / (period + 1);
    let ema = data[0];
    for (let i = 1; i < data.length; i++) {
      ema = data[i] * k + ema * (1 - k);
    }
    return ema;
  };

  const calculateRSI = (data: number[], period: number) => {
    if (data.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
      const diff = data[i] - data[i - 1];
      if (diff > 0) gains += diff;
      else losses += Math.abs(diff);
    }
    const rs = gains / (losses || 1);
    return 100 - (100 / (1 + rs));
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Brain size={22} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">BTC AI Predictor</h1>
            <p className="text-xs text-text-muted">Professional AI-powered prediction engine</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Timeframe Selector */}
          <div className="flex bg-surface rounded-lg p-1">
            {(Object.keys(TIMEFRAMES) as Timeframe[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setSelectedTimeframe(tf)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                  selectedTimeframe === tf
                    ? 'bg-primary text-white'
                    : 'text-text-muted hover:text-text-primary'
                )}
              >
                {TIMEFRAMES[tf].label}
              </button>
            ))}
          </div>
          
          {/* Start/Stop */}
          <Button
            variant={isRunning ? 'danger' : 'primary'}
            onClick={() => setIsRunning(!isRunning)}
            icon={isRunning ? <Pause size={16} /> : <Play size={16} />}
            loading={isAnalyzing}
          >
            {isRunning ? 'Stop' : 'Start'}
          </Button>
        </div>
      </div>

      {/* How It Works */}
      <Card className="p-5 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={20} className="text-primary" />
          <h3 className="font-semibold text-lg">How It Works</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <div className="flex flex-col gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">1</div>
            <div className="font-medium">Data Collection</div>
            <div className="text-xs text-text-muted">Fetches real-time data from SoDEX, SoSoValue News, and ETF flows</div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">2</div>
            <div className="font-medium">AI Analysis</div>
            <div className="text-xs text-text-muted">Gemini AI analyzes sentiment and strategizes based on technical signals</div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">3</div>
            <div className="font-medium">Prediction</div>
            <div className="text-xs text-text-muted">Generates UP/DOWN/NEUTRAL signals with confidence scores</div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">4</div>
            <div className="font-medium">Auto-Trade</div>
            <div className="text-xs text-text-muted">Optional auto-execution with your SL/TP settings (max 125x leverage)</div>
          </div>
        </div>
      </Card>

      {/* Price Display */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-xs text-text-muted uppercase tracking-wider mb-1">Live Price</div>
          <div className={cn(
            "text-2xl font-mono font-bold transition-all duration-300",
            currentPrice > (prevPriceRef.current || 0) ? "text-success" : 
            currentPrice < (prevPriceRef.current || 0) ? "text-danger" : ""
          )}>
            ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="text-xs text-text-muted uppercase tracking-wider mb-1">Entry Price</div>
          <div className="text-2xl font-mono font-bold">${entryPrice > 0 ? entryPrice.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}</div>
        </Card>
        
        <Card className={cn(
          "p-4",
          activePrediction?.pnlPercent && activePrediction.pnlPercent > 0 ? "border-l-4 border-l-success" :
          activePrediction?.pnlPercent && activePrediction.pnlPercent < 0 ? "border-l-4 border-l-danger" : ""
        )}>
          <div className="text-xs text-text-muted uppercase tracking-wider mb-1">P&L (%)</div>
          <div className={cn(
            "text-2xl font-mono font-bold",
            activePrediction?.pnlPercent && activePrediction.pnlPercent > 0 ? "text-success" :
            activePrediction?.pnlPercent && activePrediction.pnlPercent < 0 ? "text-danger" : ""
          )}>
            {activePrediction?.pnlPercent ? `${activePrediction.pnlPercent > 0 ? '+' : ''}${activePrediction.pnlPercent.toFixed(2)}%` : '-'}
          </div>
        </Card>
      </div>

      {/* Main Prediction Card */}
      {activePrediction && (
        <Card className={cn(
          "p-6 border-2",
          activePrediction.direction === 'LONG' ? "border-success/50 bg-success/5" :
          activePrediction.direction === 'SHORT' ? "border-danger/50 bg-danger/5" :
          "border-warning/50 bg-warning/5"
        )}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {activePrediction.direction === 'LONG' ? (
                <TrendingUp size={28} className="text-success" />
              ) : activePrediction.direction === 'SHORT' ? (
                <TrendingDown size={28} className="text-danger" />
              ) : (
                <Activity size={28} className="text-warning" />
              )}
              <div>
                <div className="text-lg font-bold">
                  {activePrediction.direction === 'LONG' ? 'UP' :
                   activePrediction.direction === 'SHORT' ? 'DOWN' : 'NEUTRAL'}
                </div>
                <div className="text-xs text-text-muted">
                  Confidence: {activePrediction.confidence.toFixed(1)}%
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-2xl font-bold font-mono">
                {activePrediction.confidence.toFixed(0)}%
              </div>
              <div className="text-xs text-text-muted">AI Confidence Score</div>
            </div>
          </div>
          
          <div className="p-3 bg-surface rounded-lg mb-4">
            <div className="text-xs text-text-muted mb-1">AI Analysis</div>
            <div className="text-sm">{activePrediction.aiAnalysis}</div>
          </div>
          
          {/* Signal Breakdown */}
          <button
            onClick={() => setShowSignalDetails(!showSignalDetails)}
            className="flex items-center gap-2 text-sm text-primary hover:underline w-full"
          >
            {showSignalDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            Signal Details
          </button>
          
          {showSignalDetails && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 bg-surface rounded-lg">
                <div className="text-xs text-text-muted mb-1">Technical</div>
                <div className="text-lg font-bold">{activePrediction.signals.technical.toFixed(0)}%</div>
              </div>
              <div className="p-3 bg-surface rounded-lg">
                <div className="text-xs text-text-muted mb-1">Fundamental</div>
                <div className="text-lg font-bold">{activePrediction.signals.fundamental.toFixed(0)}%</div>
              </div>
              <div className="p-3 bg-surface rounded-lg">
                <div className="text-xs text-text-muted mb-1">Sentiment</div>
                <div className="text-lg font-bold">{activePrediction.signals.sentiment.toFixed(0)}%</div>
              </div>
              <div className="p-3 bg-surface rounded-lg">
                <div className="text-xs text-text-muted mb-1">Market</div>
                <div className="text-lg font-bold">{activePrediction.signals.marketStructure.toFixed(0)}%</div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Trade Settings */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Settings size={18} className="text-primary" />
          <h3 className="font-semibold">Auto-Trade Settings</h3>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="text-xs text-text-muted block mb-1.5">Amount (USDC)</label>
            <Input
              type="number"
              value={tradeSettings.amount}
              onChange={(e) => setTradeSettings({ ...tradeSettings, amount: Number(e.target.value) })}
              min={10}
            />
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-1.5">Leverage (max 125x)</label>
            <Input
              type="number"
              value={tradeSettings.leverage}
              onChange={(e) => setTradeSettings({ ...tradeSettings, leverage: Math.min(125, Math.max(1, Number(e.target.value))) })}
              min={1}
              max={125}
            />
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-1.5">Stop Loss (%)</label>
            <Input
              type="number"
              value={tradeSettings.stopLossPercent}
              onChange={(e) => setTradeSettings({ ...tradeSettings, stopLossPercent: Number(e.target.value) })}
              min={0.5}
              max={20}
              step={0.5}
            />
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-1.5">Take Profit (%)</label>
            <Input
              type="number"
              value={tradeSettings.takeProfitPercent}
              onChange={(e) => setTradeSettings({ ...tradeSettings, takeProfitPercent: Number(e.target.value) })}
              min={1}
              max={50}
              step={0.5}
            />
          </div>
        </div>
        
        <div className="mt-4 flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={tradeSettings.autoTrade}
              onChange={(e) => setTradeSettings({ ...tradeSettings, autoTrade: e.target.checked })}
              className="w-4 h-4 rounded border-border bg-surface checked:bg-primary"
            />
            <span className="text-sm">Auto-Trade Enabled</span>
          </label>
          
          {!isWalletConnected && tradeSettings.autoTrade && (
            <span className="text-xs text-warning">⚠️ Connect wallet</span>
          )}
        </div>
      </Card>

      {/* Stats & History */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Performance Stats */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={18} className="text-primary" />
            <h3 className="font-semibold">Performans</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-surface rounded-lg text-center">
              <div className="text-2xl font-bold">{stats.totalTrades}</div>
              <div className="text-xs text-text-muted">Total Trades</div>
            </div>
            <div className="p-3 bg-surface rounded-lg text-center">
              <div className="text-2xl font-bold text-success">{stats.winRate.toFixed(1)}%</div>
              <div className="text-xs text-text-muted">Win Rate</div>
            </div>
            <div className="p-3 bg-surface rounded-lg text-center">
              <div className={cn(
                "text-2xl font-bold",
                stats.totalPnl >= 0 ? "text-success" : "text-danger"
              )}>
                {stats.totalPnl >= 0 ? '+' : ''}{stats.totalPnl.toFixed(2)}%
              </div>
              <div className="text-xs text-text-muted">Total P&L</div>
            </div>
            <div className="p-3 bg-surface rounded-lg text-center">
              <div className="text-2xl font-bold">{stats.avgConfidence.toFixed(0)}%</div>
              <div className="text-xs text-text-muted">Avg. Confidence</div>
            </div>
          </div>
        </Card>

        {/* Prediction History */}
        <Card className="p-5">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center justify-between w-full"
          >
            <div className="flex items-center gap-2">
              <History size={18} className="text-primary" />
              <h3 className="font-semibold">Prediction History</h3>
            </div>
            {showHistory ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          
          {showHistory && (
            <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
              {predictionHistory.length === 0 ? (
                <div className="text-center text-text-muted text-sm py-4">
                  No predictions yet
                </div>
              ) : (
                predictionHistory.slice(0, 10).map((pred) => (
                  <div
                    key={pred.id}
                    className="flex items-center justify-between p-3 bg-surface rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {pred.direction === 'LONG' ? (
                        <TrendingUp size={16} className="text-success" />
                      ) : pred.direction === 'SHORT' ? (
                        <TrendingDown size={16} className="text-danger" />
                      ) : (
                        <Activity size={16} className="text-warning" />
                      )}
                      <div>
                        <div className="text-sm font-medium">{pred.direction}</div>
                        <div className="text-xs text-text-muted">{pred.timeframe}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold">{pred.confidence.toFixed(0)}%</div>
                      <div className={cn(
                        "text-xs",
                        pred.pnlPercent > 0 ? "text-success" : pred.pnlPercent < 0 ? "text-danger" : "text-text-muted"
                      )}>
                        {pred.pnlPercent > 0 ? '+' : ''}{pred.pnlPercent.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Backtesting Notice */}
      <Card className="p-4 bg-primary/5 border-primary/20">
        <div className="flex items-start gap-3">
          <Zap size={18} className="text-primary shrink-0 mt-0.5" />
          <div>
            <div className="font-medium text-sm">Backtesting Feature</div>
            <p className="text-xs text-text-muted mt-1">
              Visit the <strong>Backtesting</strong> page for detailed historical testing. 
              Test and optimize your strategy with real market data.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default BtcPredictor;
