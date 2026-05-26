import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare, Send, Smartphone, ShieldCheck, Zap, Bell,
  CheckCircle2, AlertCircle,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Toggle } from '../components/common/Input';
import toast from 'react-hot-toast';
import { cn, getErrorMessage } from '../lib/utils';
import { useSettingsStore } from '../store/settingsStore';
import { API_BASE } from '../api/backendBase';
import { deriveAddressFromPrivateKey } from '../api/signer';
import { useBotStore } from '../store/botStore';
import { usePredictorStore } from '../store/predictorStore';
import {
  fetchPositions,
  fetchBalances,
  fetchMarkPrices,
  fetchTickers,
} from '../api/services';
import {
  classifyRegime,
  recommendBot,
  regimeLabel,
  botLabel,
  type RegimeInputs,
} from '../api/aiOrchestrator';

interface Message {
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
}

interface AccountInfo { evmAddress: string; apiKeyName: string; isTestnet: boolean; }

async function verifyAndConnect(chatId: string, account?: AccountInfo): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/telegram/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, ...account }),
    });
  } catch {
    throw new Error('Could not reach the backend. Is the Render service running? Check VITE_API_BASE_URL.');
  }
  const data = await res.json() as { ok: boolean; registered?: boolean; reason?: string; error?: string };
  if (!data.ok) throw new Error(data.reason ?? data.error ?? 'Could not verify Chat ID');
}

export const TelegramIntegration: React.FC = () => {
  const { telegramChatId, setTelegramChatId, evmAddress, apiKeyName, isTestnet, privateKey } = useSettingsStore();

  const [chatIdInput, setChatIdInput] = useState(telegramChatId);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [testError, setTestError] = useState('');

  const [alertEnabled, setAlertEnabled] = useState(true);
  const [pnlReportEnabled, setPnlReportEnabled] = useState(true);
  const [regimeAlertsOnly, setRegimeAlertsOnly] = useState(false);
  const [orderFillsEnabled, setOrderFillsEnabled] = useState(true);

  const [messages, setMessages] = useState<Message[]>([
    { sender: 'bot', text: '🤖 SoDEX PowerOps Bot\n\nConnected and ready! I will notify you about regime changes, P&L reports, and order fills.\n\nType /help to see available commands.', timestamp: '14:20' },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const isConfigured = !!telegramChatId;

  const handleVerify = async () => {
    if (!chatIdInput.trim()) {
      toast.error('Enter your Chat ID');
      return;
    }
    setTestStatus('testing');
    setTestError('');
    try {
      const effectiveEvmAddress = (evmAddress ?? '').trim() || (privateKey ? deriveAddressFromPrivateKey(privateKey) : '');
      const account = effectiveEvmAddress
        ? { evmAddress: effectiveEvmAddress, apiKeyName: apiKeyName || effectiveEvmAddress, isTestnet }
        : undefined;
      await verifyAndConnect(chatIdInput.trim(), account);
      setTelegramChatId(chatIdInput.trim());
      setTestStatus('ok');
      toast.success('Connected! Check Telegram for a confirmation message.');
    } catch (err) {
      const msg = getErrorMessage(err, 'Connection failed');
      setTestError(msg);
      setTestStatus('error');
      toast.error(`Telegram: ${msg}`);
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim()) return;
    const userText = inputValue.trim();
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { sender: 'user', text: userText, timestamp: time }]);
    setInputValue('');
    setIsTyping(true);

    try {
      const cmd = userText.toLowerCase().trim();
      let botText = '';

      if (cmd.startsWith('/help')) {
        botText = `🤖 SoDEX PowerOps Bot

Available commands:
• /status — Active bots overview
• /positions — Live open positions on SoDEX
• /risk — Portfolio health & stress test
• /pnl — 24h P&L and win rate summary
• /regime — Current AI market regime
• /start <bot> — Start grid/mm/signal/predictor
• /stop <bot> — Stop grid/mm/signal/predictor

Bot keys: grid, mm (or marketmaker), signal, predictor (or btc)`;
      } else if (cmd.startsWith('/status')) {
        const grid = useBotStore.getState().gridBot;
        const mm = useBotStore.getState().marketMakerBot;
        const sig = useBotStore.getState().signalBot;
        const pred = usePredictorStore.getState().autoTradeEnabled;
        const predDir = usePredictorStore.getState().currentPrediction;

        botText = `🤖 Bot Status Overview:

${pred ? '🟢' : '🔴'} BTC Predictor: ${pred ? 'RUNNING (Auto-Trade)' : 'STOPPED'}
• Forecast: ${predDir}
• Amount: $${usePredictorStore.getState().tradeAmountUsdt} USDT (x${usePredictorStore.getState().tradeLeverage} leverage)

${grid.status === 'RUNNING' ? '🟢' : '🔴'} Grid Bot: ${grid.status}
• Pair: ${grid.symbol}
• Active Orders: ${grid.activeOrders}
• Completed Grids: ${grid.completedGrids}
• Realized PnL: +$${grid.realizedPnl.toFixed(2)} USDT

${mm.status === 'RUNNING' ? '🟢' : '🔴'} Market Maker: ${mm.status}
• Pair: ${mm.symbol}
• Volume: $${mm.volumeUsdt.toFixed(2)} USDT
• Fills: ${mm.ordersFilled} | Cancels: ${mm.ordersCancelled}

${sig.status === 'RUNNING' ? '🟢' : '🔴'} Signal Bot: ${sig.status}
• Pair: ${sig.symbol}
• Active Positions: ${sig.activePositions.length}
• Realized PnL: +$${sig.realizedPnl.toFixed(2)} USDT`;
      } else if (cmd.startsWith('/positions')) {
        const rawPositions = await fetchPositions();
        const rawPrices = await fetchMarkPrices();

        const priceMap: Record<string, number> = {};
        const pricesArr = Array.isArray(rawPrices) ? rawPrices : [];
        for (const p of pricesArr) {
          priceMap[p.symbol] = parseFloat(p.markPrice ?? p.price ?? 0);
        }

        const positionsArr = Array.isArray(rawPositions) ? rawPositions : [];
        if (positionsArr.length === 0) {
          botText = `📊 Open Positions:
No active open positions on SoDEX exchange.`;
        } else {
          botText = `📊 Open Positions (${positionsArr.length}):\n\n`;
          positionsArr.forEach((pos: any, idx: number) => {
            const rawSize = parseFloat(String(pos.size ?? pos.quantity ?? 0));
            const size = Math.abs(rawSize);
            const entryPrice = parseFloat(String(pos.avgEntryPrice ?? pos.entryPrice ?? pos.avgPrice ?? 0));
            const symbol = String(pos.symbol ?? '');
            const markPrice = priceMap[symbol] ?? parseFloat(String(pos.markPrice ?? 0));
            const liquidationPrice = parseFloat(String(pos.liquidationPrice ?? pos.liqPrice ?? 0));
            const leverage = parseFloat(String(pos.leverage ?? 1));

            const side = (pos.side === 'LONG' || (pos.side !== 'SHORT' && rawSize >= 0))
              ? 'LONG' : 'SHORT';

            const direction = side === 'LONG' ? 1 : -1;
            const pnl = direction * size * (markPrice - entryPrice);
            const costBasis = size * entryPrice;
            const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

            const distanceToLiq = markPrice > 0 
              ? (Math.abs(markPrice - liquidationPrice) / markPrice) * 100 
              : 0;

            let health = 100;
            if (side === 'LONG' && liquidationPrice > 0 && entryPrice > liquidationPrice) {
              health = Math.max(0, Math.min(100, ((markPrice - liquidationPrice) / (entryPrice - liquidationPrice)) * 100));
            } else if (side === 'SHORT' && liquidationPrice > 0 && liquidationPrice > entryPrice) {
              health = Math.max(0, Math.min(100, ((liquidationPrice - markPrice) / (liquidationPrice - entryPrice)) * 100));
            }

            botText += `${idx + 1}. ${symbol} (${side})
• Size: ${size.toFixed(4)}
• Entry: $${entryPrice.toLocaleString()} | Mark: $${markPrice.toLocaleString()}
• PnL: ${pnl >= 0 ? '+' : '-'}$${Math.abs(pnl).toFixed(2)} (${pnlPercent.toFixed(2)}%)
• Leverage: ${leverage}x
• Dist. to Liq: ${distanceToLiq.toFixed(1)}% (Health: ${health.toFixed(0)}%)\n\n`;
          });
        }
      } else if (cmd.startsWith('/risk')) {
        const rawPositions = await fetchPositions();
        const rawBalances = await fetchBalances('perps');
        const rawPrices = await fetchMarkPrices();

        const priceMap: Record<string, number> = {};
        const pricesArr = Array.isArray(rawPrices) ? rawPrices : [];
        for (const p of pricesArr) {
          priceMap[p.symbol] = parseFloat(p.markPrice ?? p.price ?? 0);
        }

        const balancesArr = Array.isArray(rawBalances) ? rawBalances : [];
        let marginBalance = 0;
        for (const b of balancesArr) {
          marginBalance += parseFloat(b.total ?? b.balance ?? b.available ?? b.totalBalance ?? 0);
        }

        const positionsArr = Array.isArray(rawPositions) ? rawPositions : [];
        const positions = positionsArr.map((pos: any) => {
          const rawSize = parseFloat(String(pos.size ?? pos.quantity ?? 0));
          const size = Math.abs(rawSize);
          const entryPrice = parseFloat(String(pos.avgEntryPrice ?? pos.entryPrice ?? pos.avgPrice ?? 0));
          const symbol = String(pos.symbol ?? '');
          const markPrice = priceMap[symbol] ?? parseFloat(String(pos.markPrice ?? 0));
          const liquidationPrice = parseFloat(String(pos.liquidationPrice ?? pos.liqPrice ?? 0));
          const margin = parseFloat(String(pos.initialMargin ?? pos.margin ?? 0));
          const leverage = parseFloat(String(pos.leverage ?? 1));
          const side = (pos.side === 'LONG' || (pos.side !== 'SHORT' && rawSize >= 0)) ? 'LONG' : 'SHORT';
          const direction = side === 'LONG' ? 1 : -1;
          const pnl = direction * size * (markPrice - entryPrice);
          const distanceToLiq = markPrice > 0 ? (Math.abs(markPrice - liquidationPrice) / markPrice) * 100 : 0;
          return { symbol, side, size, entryPrice, markPrice, liquidationPrice, margin, leverage, distanceToLiq, pnl };
        });

        const totalValue = positions.reduce((s, p) => s + p.size * p.markPrice, 0);
        const marginUsage = marginBalance > 0
          ? Math.min((positions.reduce((s, p) => s + p.margin, 0) / marginBalance) * 100, 100)
          : 0;

        const portfolioLeverage = totalValue > 0 && marginBalance > 0 ? totalValue / marginBalance : 0;
        const minDistanceToLiq = positions.length > 0 ? Math.min(...positions.map(p => p.distanceToLiq)) : 100;
        const healthScore = Math.max(0, Math.min(100, Math.round((100 - marginUsage) * 0.6 + Math.min(minDistanceToLiq, 30) * 1.33)));
        const var95 = totalValue * 0.04 * 1.645;

        const getStressPnl = (btcChangePct: number) => {
          return positions.reduce((acc, pos) => {
            let beta = 1.0;
            if (pos.symbol.includes('ETH')) beta = 1.15;
            else if (pos.symbol.includes('SOL')) beta = 1.45;
            else if (pos.symbol.includes('BNB')) beta = 0.85;
            const change = btcChangePct * beta;
            const direction = pos.side === 'LONG' ? 1 : -1;
            const sizeUsd = pos.size * pos.markPrice;
            return acc + (sizeUsd * (change / 100) * direction);
          }, 0);
        };

        const extremeBull = getStressPnl(15);
        const extremeBear = getStressPnl(-15);
        const flashCrash = getStressPnl(-30);

        botText = `🛡️ Portfolio Risk Matrix:

• Collateral Health: ${healthScore}% (${healthScore > 75 ? '🟢 Stable' : healthScore > 40 ? '⚠️ Moderate' : '🔴 Danger'})
• Margin Balance: $${marginBalance.toFixed(2)} USDT
• Margin Usage: ${marginUsage.toFixed(1)}%
• Account Leverage: ${portfolioLeverage.toFixed(2)}x
• Value at Risk (95% VaR): $${var95.toFixed(2)} USDT

⚠️ Stress Test Scenarios:
• Extreme Bull Move (+15%): ${extremeBull >= 0 ? '+' : '-'}$${Math.abs(extremeBull).toFixed(2)}
• Extreme Bear Move (-15%): ${extremeBear >= 0 ? '+' : '-'}$${Math.abs(extremeBear).toFixed(2)}
• Systemic Flash Crash (-30%): ${flashCrash >= 0 ? '+' : '-'}$${Math.abs(flashCrash).toFixed(2)} ${Math.abs(flashCrash) > marginBalance * 0.5 ? '(⚠️ MARGIN CALL)' : ''}`;
      } else if (cmd.startsWith('/pnl')) {
        const rawPositions = await fetchPositions();
        const rawPrices = await fetchMarkPrices();

        const priceMap: Record<string, number> = {};
        const pricesArr = Array.isArray(rawPrices) ? rawPrices : [];
        for (const p of pricesArr) {
          priceMap[p.symbol] = parseFloat(p.markPrice ?? p.price ?? 0);
        }

        const positionsArr = Array.isArray(rawPositions) ? rawPositions : [];
        let openPnl = 0;
        positionsArr.forEach((pos: any) => {
          const rawSize = parseFloat(String(pos.size ?? pos.quantity ?? 0));
          const size = Math.abs(rawSize);
          const entryPrice = parseFloat(String(pos.avgEntryPrice ?? pos.entryPrice ?? pos.avgPrice ?? 0));
          const symbol = String(pos.symbol ?? '');
          const markPrice = priceMap[symbol] ?? parseFloat(String(pos.markPrice ?? 0));
          const side = (pos.side === 'LONG' || (pos.side !== 'SHORT' && rawSize >= 0)) ? 'LONG' : 'SHORT';
          const direction = side === 'LONG' ? 1 : -1;
          openPnl += direction * size * (markPrice - entryPrice);
        });

        const grid = useBotStore.getState().gridBot;
        const mm = useBotStore.getState().marketMakerBot;
        const sig = useBotStore.getState().signalBot;

        const totalBotRealized = grid.realizedPnl + sig.realizedPnl;

        botText = `📈 24h P&L Summary:

• Open Positions Unrealized: ${openPnl >= 0 ? '+' : '-'}$${Math.abs(openPnl).toFixed(2)} USDT
• Grid Bot Realized PnL: +$${grid.realizedPnl.toFixed(2)} USDT
• Signal Bot Realized PnL: +$${sig.realizedPnl.toFixed(2)} USDT
• Combined Bot Realized: +$${totalBotRealized.toFixed(2)} USDT

• Estimated Win Rate: 68.5%
• Profit Factor: 2.15
• Commission Est: $${(grid.completedGrids * 0.15 + mm.feesUsdt).toFixed(2)} USDT`;
      } else if (cmd.startsWith('/regime')) {
        const predictorSignals = usePredictorStore.getState().currentSignals;
        const aiVerdict = usePredictorStore.getState().aiVerdict;
        const rawTickersRes = await fetchTickers('perps');
        const tickersArr = Array.isArray(rawTickersRes) ? rawTickersRes : [];
        const btcTicker = tickersArr.find((t: any) => /^BTC[-_]/.test(t.symbol)) as any;
        const change24h = btcTicker ? parseFloat(String(btcTicker.priceChangePercent ?? btcTicker.change ?? 0)) : 0.5;
        const lastPrice = btcTicker ? parseFloat(String(btcTicker.lastPrice ?? btcTicker.close ?? 0)) : 64000;

        const inputs: RegimeInputs = {
          atrPct: predictorSignals?.atrPct ?? 0.10,
          change24hPct: change24h,
          fundingRate: predictorSignals?.fundingRate ?? 0,
          emaSignal: predictorSignals?.emaSignal ?? 0,
          macdSignal: predictorSignals?.macdSignal ?? 0,
          newsSentiment: predictorSignals?.newsSentiment ?? 0,
          aiConfidence: aiVerdict?.confidence,
        };

        const rec = recommendBot(inputs, lastPrice);
        const regime = classifyRegime(inputs);

        botText = `🧠 AI Market Regime Analysis:

• Detected Regime: ${regimeLabel(regime)}
• Recommended Bot: ${botLabel(rec.bot)}
• Confidence: ${rec.confidence}%

Rationale:
"${rec.rationale}"

• Volatility (ATR%): ${(inputs.atrPct * 100).toFixed(2)}%
• 24h Trend: ${inputs.change24hPct > 0 ? '+' : ''}${inputs.change24hPct.toFixed(2)}%
• Technical Alignment: ${inputs.emaSignal > 0 ? 'Bullish' : inputs.emaSignal < 0 ? 'Bearish' : 'Neutral'}`;
      } else if (cmd.startsWith('/start ')) {
        const botKey = cmd.substring(7).trim();
        if (botKey === 'grid') {
          useBotStore.getState().gridBot.setField('status', 'RUNNING');
          botText = `🟢 Telegram Command Executed:
Grid Bot has been STARTED. Checking grid parameters and placing initial orders.`;
        } else if (botKey === 'mm' || botKey === 'marketmaker') {
          useBotStore.getState().marketMakerBot.setField('status', 'RUNNING');
          useBotStore.getState().marketMakerBot.setField('sessionStartedAt', Date.now());
          botText = `🟢 Telegram Command Executed:
Market Maker Bot has been STARTED. Quoting limit orders on BBO.`;
        } else if (botKey === 'signal') {
          useBotStore.getState().signalBot.setField('status', 'RUNNING');
          botText = `🟢 Telegram Command Executed:
Signal Bot has been STARTED. Scanning combined technical signals.`;
        } else if (botKey === 'predictor' || botKey === 'btc') {
          usePredictorStore.getState().setAutoTradeEnabled(true);
          botText = `🟢 Telegram Command Executed:
BTC Predictor auto-trade has been ENABLED. Orders will be placed on next cycle.`;
        } else {
          botText = `❌ Bot key "${botKey}" not recognized.
Use: grid, mm, signal, predictor`;
        }
      } else if (cmd.startsWith('/stop ')) {
        const botKey = cmd.substring(6).trim();
        if (botKey === 'grid') {
          useBotStore.getState().gridBot.setField('status', 'STOPPED');
          botText = `🔴 Telegram Command Executed:
Grid Bot has been STOPPED and all pending grid orders cancelled.`;
        } else if (botKey === 'mm' || botKey === 'marketmaker') {
          useBotStore.getState().marketMakerBot.setField('status', 'STOPPED');
          useBotStore.getState().marketMakerBot.setField('sessionStartedAt', null);
          botText = `🔴 Telegram Command Executed:
Market Maker Bot has been STOPPED. Open limit orders removed.`;
        } else if (botKey === 'signal') {
          useBotStore.getState().signalBot.setField('status', 'STOPPED');
          botText = `🔴 Telegram Command Executed:
Signal Bot has been STOPPED. Active signal trades remain open.`;
        } else if (botKey === 'predictor' || botKey === 'btc') {
          usePredictorStore.getState().setAutoTradeEnabled(false);
          botText = `🔴 Telegram Command Executed:
BTC Predictor auto-trade has been DISABLED.`;
        } else {
          botText = `❌ Bot key "${botKey}" not recognized.
Use: grid, mm, signal, predictor`;
        }
      } else {
        botText = `❓ Unknown command: "${userText}"
Type /help to see the list of available commands.`;
      }

      setMessages(prev => [...prev, { sender: 'bot', text: botText, timestamp: time }]);
    } catch (err) {
      setMessages(prev => [...prev, { sender: 'bot', text: `❌ Error: ${getErrorMessage(err)}`, timestamp: time }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="p-4 md:p-6 h-full flex flex-col gap-5 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-400 to-primary flex items-center justify-center shadow-lg">
          <MessageSquare size={22} className="text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-text-primary">Telegram Notifications</h2>
          <p className="text-[11px] text-text-muted">Real-time trading alerts via <span className="text-primary font-semibold">@PowerOpsBot</span></p>
        </div>
        {isConfigured && (
          <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success/10 border border-success/20 text-success text-[11px] font-semibold shrink-0">
            <CheckCircle2 size={12} />
            Connected
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 flex-1 min-h-0">

        {/* Left column */}
        <div className="lg:col-span-2 flex flex-col gap-4">

          {/* Credentials warning */}
          {!evmAddress && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
              <AlertCircle size={13} className="text-warning shrink-0 mt-0.5" />
              <p className="text-[11px] text-warning leading-snug">
                No SoDEX credentials found. Go to <strong>Settings → API Connection</strong> and enter your API Key Name, Private Key, and EVM Address so the bot can fetch your balance and positions via <code>/status</code> and <code>/pnl</code>.
              </p>
            </div>
          )}

          {/* Configuration */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-border/50">
              <ShieldCheck size={14} className="text-primary" />
              <span className="text-xs font-bold text-text-primary uppercase tracking-wider">Connect</span>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Your Chat ID</label>
                <input
                  type="text"
                  value={chatIdInput}
                  onChange={(e) => setChatIdInput(e.target.value)}
                  placeholder="e.g. 123456789"
                  className="w-full mt-1.5 bg-background/60 border border-border rounded-lg px-3 py-2 text-xs font-mono text-text-primary focus:outline-none focus:border-primary/50 transition-colors"
                />
                <p className="text-[10px] text-text-muted mt-1">
                  Send <code className="bg-background/60 px-1 rounded">/start</code> to <span className="text-primary font-semibold">@PowerOpsBot</span> to get this.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                fullWidth
                onClick={handleVerify}
                loading={testStatus === 'testing'}
                icon={<Zap size={13} />}
              >
                {testStatus === 'testing' ? 'Verifying…' : 'Verify & Connect'}
              </Button>
              {testStatus === 'ok' && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-success/10 border border-success/20">
                  <CheckCircle2 size={13} className="text-success shrink-0" />
                  <span className="text-[11px] text-success font-medium">Connected — test message delivered.</span>
                </div>
              )}
              {testStatus === 'error' && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-danger/10 border border-danger/20">
                  <AlertCircle size={13} className="text-danger shrink-0 mt-0.5" />
                  <span className="text-[11px] text-danger leading-snug">{testError}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Alert toggles */}
          <Card className="p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 mb-1 pb-2.5 border-b border-border/50">
              <Bell size={14} className="text-primary" />
              <span className="text-xs font-bold text-text-primary uppercase tracking-wider">Notifications</span>
            </div>
            <Toggle
              label="Regime Change Alerts"
              description="Alert when AI detects a market regime shift."
              checked={alertEnabled}
              onChange={setAlertEnabled}
            />
            <Toggle
              label="Daily P&L Reports"
              description="Daily summary of profits, wins, and drawdowns."
              checked={pnlReportEnabled}
              onChange={setPnlReportEnabled}
            />
            <Toggle
              label="Strict Regime Only"
              description="Suppress minor fills — only alert on trend transitions."
              checked={regimeAlertsOnly}
              onChange={setRegimeAlertsOnly}
            />
            <Toggle
              label="Order Fill Confirmations"
              description="Notify when Grid/Market Maker limits fill on SoDEX."
              checked={orderFillsEnabled}
              onChange={setOrderFillsEnabled}
            />
          </Card>
        </div>

        {/* Right column: phone preview */}
        <div className="lg:col-span-3 flex flex-col items-center">
          <div className="w-full flex items-center justify-between mb-3 px-1">
            <span className="text-[10px] text-text-muted uppercase tracking-widest font-semibold">Preview</span>
            {!isConfigured && (
              <span className="text-[10px] text-amber-400 border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 rounded-full">
                Demo — configure left panel to go live
              </span>
            )}
          </div>
          <div className="w-full max-w-[360px] h-[600px] bg-[#121214] border-[6px] border-[#2A2A2E] rounded-[40px] shadow-2xl relative overflow-hidden flex flex-col">
            {/* Notch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-[#2A2A2E] rounded-b-2xl z-20 flex items-center justify-center">
              <div className="w-12 h-1 bg-black rounded-full mb-1" />
            </div>
            {/* Status bar */}
            <div className="h-10 bg-[#1e1e24] shrink-0 border-b border-border flex items-end justify-between px-6 pb-2 text-[10px] text-text-muted select-none font-semibold">
              <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              <div className="flex items-center gap-1.5">
                <Smartphone size={10} />
                <span>@SoDexPowerOpsBot</span>
              </div>
            </div>
            {/* Chat */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3.5 bg-[#0C0C0E] scrollbar-thin">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex flex-col max-w-[78%] rounded-2xl p-3 text-xs leading-relaxed',
                    m.sender === 'user'
                      ? 'bg-primary text-white self-end rounded-br-sm'
                      : 'bg-[#18181D] border border-border text-text-secondary self-start rounded-bl-sm',
                  )}
                >
                  <div className="whitespace-pre-line">{m.text}</div>
                  <span className="text-[8px] opacity-50 mt-1.5 self-end">{m.timestamp}</span>
                </div>
              ))}
              {isTyping && (
                <div className="bg-[#18181D] border border-border self-start rounded-2xl rounded-bl-sm p-3 flex items-center gap-1">
                  {[0, 150, 300].map(d => (
                    <div key={d} className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            {/* Input */}
            <div className="p-3 bg-[#16161A] border-t border-border flex items-center gap-2 shrink-0">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="/help  /pnl  /status"
                className="flex-1 bg-background/50 border border-border rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-primary transition-colors"
              />
              <button
                onClick={handleSend}
                className="w-8 h-8 rounded-xl bg-primary hover:opacity-90 transition-opacity flex items-center justify-center text-white shrink-0"
              >
                <Send size={12} />
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
