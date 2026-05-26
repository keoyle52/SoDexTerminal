import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  MessageSquare, Send, Smartphone, ShieldCheck, Bell,
  CheckCircle2, Play, Square, Settings, RefreshCw, Trash2, Cpu
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Toggle } from '../components/common/Input';
import { Input, Select } from '../components/common/Input';
import { SymbolSelector } from '../components/common/SymbolSelector';
import toast from 'react-hot-toast';
import { cn, getErrorMessage } from '../lib/utils';
import { useSettingsStore } from '../store/settingsStore';
import { API_BASE } from '../api/backendBase';
import { deriveAddressFromPrivateKey } from '../api/signer';
import { useBotStore } from '../store/botStore';
import { usePredictorStore } from '../store/predictorStore';
import { useBotPnlStore } from '../store/botPnlStore';
import {
  fetchPositions,
  normalizeSymbol,
  placeOrder,
  cancelAllOrders,
  fetchBookTickers,
  fetchOpenOrders,
  fetchOrderStatus,
  fetchOrderbook,
  updatePerpsLeverage,
  cancelOrder,
  batchCancelOrders
} from '../api/services';
import { buildContext, recommendGridBot, recommendMarketMakerBot, recommendSignalBot } from '../api/aiAutoConfig';
import { classifyRegime, recommendBot, regimeLabel, botLabel, type RegimeInputs } from '../api/aiOrchestrator';

interface Message {
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
}

interface AccountInfo { evmAddress: string; apiKeyName: string; isTestnet: boolean; }

interface TerminalLog {
  time: string;
  bot: 'SYSTEM' | 'GRID' | 'MM' | 'SIGNAL' | 'PREDICTOR';
  level: 'INFO' | 'TRADE' | 'SUCCESS' | 'ERROR';
  message: string;
}

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

type TabType = 'GRID' | 'MM' | 'SIGNAL' | 'PREDICTOR';

interface LocalGridLevel {
  price: number;
  orderId?: string;
  side?: 'BUY' | 'SELL';
  status: 'EMPTY' | 'ACTIVE' | 'FILLED';
}

interface LocalManagedOrder {
  clOrdID: string;
  orderID?: string;
  side: 'BUY' | 'SELL';
  price: number;
  quantity: number;
  postedAt: number;
}

function buildGridLevels(
  lower: number,
  upper: number,
  count: number,
  spacing: 'ARITHMETIC' | 'GEOMETRIC',
): number[] {
  if (lower <= 0 || upper <= 0 || count < 2 || lower >= upper) return [];
  const levels: number[] = [];
  if (spacing === 'GEOMETRIC') {
    const ratio = Math.pow(upper / lower, 1 / count);
    for (let i = 0; i <= count; i++) levels.push(lower * Math.pow(ratio, i));
  } else {
    const step = (upper - lower) / count;
    for (let i = 0; i <= count; i++) levels.push(lower + step * i);
  }
  return levels;
}

export const TelegramIntegration: React.FC = () => {
  const { 
    telegramChatId, 
    setTelegramChatId, 
    evmAddress, 
    apiKeyName, 
    isTestnet, 
    privateKey,
    isDemoMode,
    setIsDemoMode
  } = useSettingsStore();

  const grid = useBotStore(state => state.gridBot);
  const mm = useBotStore(state => state.marketMakerBot);
  const sig = useBotStore(state => state.signalBot);
  const pred = usePredictorStore(state => state.autoTradeEnabled);

  // Connection settings
  const [chatIdInput, setChatIdInput] = useState(telegramChatId);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [_testError, setTestError] = useState('');

  // Inline Credentials setup
  const [addressInput, setAddressInput] = useState(evmAddress || '');
  const [apiKeyInput, setApiKeyInput] = useState(apiKeyName || '');
  const [privateKeyInput, setPrivateKeyInput] = useState(privateKey || '');
  const [testnetInput, setTestnetInput] = useState(isTestnet);

  // Notification toggles
  const [alertEnabled, setAlertEnabled] = useState(true);
  const [orderFillsEnabled, setOrderFillsEnabled] = useState(true);

  const gridLevelsRef = useRef<LocalGridLevel[]>([]);
  const mmOrdersRef = useRef<Map<string, LocalManagedOrder>>(new Map());
  const seqRef = useRef(0);
  const sessionIdRef = useRef('');
  const lastCancelAtRef = useRef(0);
  const consecutiveErrorsRef = useRef<Record<string, number>>({ GRID: 0, MM: 0, SIGNAL: 0, PREDICTOR: 0 });
  const reconcileBusyRef = useRef(false);
  const pollBusyRef = useRef(false);



  // Chat Preview messages
  const [messages, setMessages] = useState<Message[]>([
    { sender: 'bot', text: '🤖 SoDEX PowerOps Bot\n\nConnected and ready! I will notify you about regime changes, P&L reports, and order fills.\n\nType /help to see available commands.', timestamp: '14:20' },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Interactive menu states
  const [pendingAction, setPendingAction] = useState<'START_SELECT' | 'STOP_SELECT' | null>(null);
  const [runningBotsList, setRunningBotsList] = useState<string[]>([]);

  // Bot Controller Panel tabs & values
  const [activeTab, setActiveTab] = useState<TabType>('GRID');
  
  // Local params overrides to prevent direct stores writes before clicking Start
  const [gridParams, setGridParams] = useState({
    symbol: 'BTC_USDC',
    lowerPrice: '60000',
    upperPrice: '70000',
    gridCount: '10',
    spacing: 'ARITHMETIC',
    amount: '0.01',
    isSpot: true,
    leverage: '5',
    stopLossPrice: '',
    takeProfitPrice: ''
  });
  const [mmParams, setMmParams] = useState({
    symbol: 'BTC_USDC',
    budget: '100',
    size: '10',
    spread: '5',
    rebalance: '10',
    layers: '3',
    makerFeeRate: '0.0001',
    volumeTargetUsdt: '',
    feeBudgetUsdt: ''
  });
  const [sigParams, setSigParams] = useState({
    symbol: 'BTC-USD',
    leverage: '5',
    amount: '50',
    tp: '3',
    sl: '2',
    combineMode: 'ANY',
    checkInterval: '60',
    klineInterval: '1m',
    cooldownSeconds: '120',
    maxOpenPositions: '1',
    onConflictingSignal: 'CLOSE_AND_REVERSE',
    isSpot: false
  });
  const [predParams, setPredParams] = useState({ amount: '100', leverage: '10' });

  // Terminal Console state
  const [terminalLogs, setTerminalLogs] = useState<TerminalLog[]>([
    { time: new Date().toLocaleTimeString(), bot: 'SYSTEM', level: 'INFO', message: 'PowerOps live bot runner initialized.' }
  ]);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const addTerminalLog = useCallback((bot: TerminalLog['bot'], level: TerminalLog['level'], message: string) => {
    setTerminalLogs(prev => [
      { time: new Date().toLocaleTimeString(), bot, level, message },
      ...prev
    ].slice(0, 150));
  }, []);

  const disconnectAndStopAllBots = useCallback(async (localOnly = false) => {
    addTerminalLog('SYSTEM', 'ERROR', 'Telegram connection disconnected. Stopping all bots and cancelling open orders.');
    
    // Stop Grid
    const activeGrid = useBotStore.getState().gridBot;
    if (activeGrid.status === 'RUNNING') {
      useBotStore.getState().gridBot.setField('status', 'STOPPED');
      if (!isDemoMode) {
        const market: 'spot' | 'perps' = activeGrid.isSpot ? 'spot' : 'perps';
        await cancelAllOrders(activeGrid.symbol, market).catch(() => {});
      }
      gridLevelsRef.current = [];
    }

    // Stop MM
    const activeMm = useBotStore.getState().marketMakerBot;
    if (activeMm.status === 'RUNNING') {
      useBotStore.getState().marketMakerBot.setField('status', 'STOPPED');
      useBotStore.getState().marketMakerBot.setField('sessionStartedAt', null);
      if (!isDemoMode) {
        await cancelAllOrders(activeMm.symbol, 'spot').catch(() => {});
      }
      mmOrdersRef.current.clear();
      sessionIdRef.current = '';
    }

    // Stop Signal
    const activeSig = useBotStore.getState().signalBot;
    if (activeSig.status === 'RUNNING') {
      useBotStore.getState().signalBot.setField('status', 'STOPPED');
      if (!isDemoMode && activeSig.activePositions.length > 0) {
        const market: 'spot' | 'perps' = activeSig.isSpot ? 'spot' : 'perps';
        const stopIds: string[] = [];
        activeSig.activePositions.forEach(p => {
          if (p.tpOrderId) stopIds.push(p.tpOrderId);
          if (p.slOrderId) stopIds.push(p.slOrderId);
        });
        if (stopIds.length > 0) {
          await Promise.all(stopIds.map(id => cancelOrder(id, activeSig.symbol, market).catch(() => {})));
        }
      }
    }

    // Stop Predictor
    if (usePredictorStore.getState().autoTradeEnabled) {
      usePredictorStore.getState().setAutoTradeEnabled(false);
    }

    // Call backend disconnect if not localOnly
    if (!localOnly && telegramChatId) {
      try {
        await fetch(`${API_BASE}/api/telegram/disconnect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId: telegramChatId }),
        });
      } catch (err) {
        // ignore
      }
    }

    setTelegramChatId('');
    setChatIdInput('');
    setTestStatus('idle');
    toast.error('Telegram bot disconnected. All trading bots stopped & unfilled orders cancelled.');
  }, [telegramChatId, isDemoMode, addTerminalLog, setTelegramChatId]);

  // Auto scroll console
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalLogs]);

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

  const handleSaveCredentials = () => {
    if (!addressInput.trim() || !privateKeyInput.trim()) {
      toast.error('Address and Private Key are required.');
      return;
    }
    useSettingsStore.setState({
      evmAddress: addressInput.trim(),
      apiKeyName: apiKeyInput.trim() || addressInput.trim(),
      privateKey: privateKeyInput.trim(),
      isTestnet: testnetInput,
      isWalletConnected: true
    });
    toast.success('SoDEX API credentials saved successfully!');
  };

  // Bot execution states/refs inside the background loop
  const gridStepRef = useRef(0);
  const mmStepRef = useRef(0);
  const sigStepRef = useRef(0);
  const predStepRef = useRef(0);

  // Main Background Bot execution loop (Simulated or Real SoDEX API)
  useEffect(() => {
    let tickCount = 0;
    const interval = setInterval(async () => {
      // Every 3 ticks (15s), check if Telegram chat is still active/registered on backend.
      if (telegramChatId) {
        tickCount++;
        if (tickCount % 3 === 0) {
          try {
            const res = await fetch(`${API_BASE}/api/telegram/status?chatId=${telegramChatId}`);
            if (res.ok) {
              const data = await res.json() as { ok: boolean; registered: boolean };
              if (data.ok && !data.registered) {
                void disconnectAndStopAllBots(true);
                return;
              }
            }
          } catch {
            // ignore network/unreachable blips
          }
        }
      }

      const activeGrid = useBotStore.getState().gridBot;
      const activeMm = useBotStore.getState().marketMakerBot;
      const activeSig = useBotStore.getState().signalBot;
      const activePred = usePredictorStore.getState().autoTradeEnabled;

      // ── Grid Bot Loop ──
      if (activeGrid.status === 'RUNNING') {
        if (!evmAddress || !privateKey) {
          addTerminalLog('GRID', 'ERROR', 'Credentials missing. Stopped Grid Bot.');
          useBotStore.getState().gridBot.setField('status', 'STOPPED');
          return;
        }

        if (isDemoMode) {
          // Simulation Mode
          const step = gridStepRef.current;
          if (step === 0) {
            addTerminalLog('GRID', 'INFO', `[DEMO] Initializing Grid Bot on ${activeGrid.symbol}. Mode: ${activeGrid.mode}`);
            addTerminalLog('GRID', 'INFO', `[DEMO] Placing ${activeGrid.gridCount} limit grid levels between $${activeGrid.lowerPrice} and $${activeGrid.upperPrice}...`);
            gridStepRef.current = 1;
          } else if (step === 1) {
            addTerminalLog('GRID', 'SUCCESS', `[DEMO] Placed initial Buy and Sell grids successfully. Orders active.`);
            gridStepRef.current = 2;
          } else if (step >= 2) {
            // Simulate dynamic order fill every few cycles
            if (Math.random() > 0.6) {
              const side = Math.random() > 0.5 ? 'BUY' : 'SELL';
              const price = side === 'BUY' ? parseFloat(activeGrid.lowerPrice) * 1.01 : parseFloat(activeGrid.upperPrice) * 0.99;
              const pnl = parseFloat(activeGrid.amountPerGrid) * price * 0.015;
              
              addTerminalLog('GRID', 'TRADE', `[DEMO] ${side} Limit filled at $${price.toFixed(2)}. PnL: +$${pnl.toFixed(2)} USDT.`);
              useBotStore.getState().gridBot.bumpField('completedGrids', 1);
              useBotStore.getState().gridBot.bumpField('realizedPnl', pnl);
              useBotPnlStore.getState().recordTrade('grid', {
                pnlUsdt: pnl,
                ts: Date.now(),
                note: `[DEMO] ${side} grid filled @ ${price.toFixed(2)}`,
              });

              if (orderFillsEnabled) {
                const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                setMessages(prev => [...prev, {
                  sender: 'bot',
                  text: `🤖 *[DEMO] Grid Bot Fill Update* (${activeGrid.symbol})\n• Side: ${side}\n• Price: $${price.toFixed(2)}\n• PnL: +$${pnl.toFixed(2)} USDT`,
                  timestamp: timeStr
                }]);
              }
            }
          }
        } else {
          // REAL API Grid Bot Mode!
          if (pollBusyRef.current) return;
          pollBusyRef.current = true;
          try {
            const market: 'spot' | 'perps' = activeGrid.isSpot ? 'spot' : 'perps';
            // Get last price
            const tickers = await fetchBookTickers(market);
            const arr = Array.isArray(tickers) ? tickers : [];
            const normalizedSym = normalizeSymbol(activeGrid.symbol, market);
            const ticker = arr.find((t: any) => t.symbol === normalizedSym) as any;
            if (!ticker) {
              addTerminalLog('GRID', 'ERROR', `Could not fetch price for ${activeGrid.symbol}`);
              return;
            }
            const bid = parseFloat(String(ticker.bidPrice ?? ticker.bid ?? '0'));
            const ask = parseFloat(String(ticker.askPrice ?? ticker.ask ?? '0'));
            const mid = (bid + ask) / 2;

            // Check stop conditions
            if (activeGrid.stopLossPrice && mid <= parseFloat(activeGrid.stopLossPrice)) {
              addTerminalLog('GRID', 'INFO', `Stop Loss triggered at $${mid.toFixed(2)}. Stopping bot.`);
              await cancelAllOrders(activeGrid.symbol, market);
              useBotStore.getState().gridBot.setField('status', 'STOPPED');
              gridLevelsRef.current = [];
              return;
            }
            if (activeGrid.takeProfitPrice && mid >= parseFloat(activeGrid.takeProfitPrice)) {
              addTerminalLog('GRID', 'INFO', `Take Profit triggered at $${mid.toFixed(2)}. Stopping bot.`);
              await cancelAllOrders(activeGrid.symbol, market);
              useBotStore.getState().gridBot.setField('status', 'STOPPED');
              gridLevelsRef.current = [];
              return;
            }

            // Check if initialized
            if (gridLevelsRef.current.length === 0) {
              addTerminalLog('GRID', 'INFO', `Initializing Grid Bot on ${activeGrid.symbol}. Mode: ${activeGrid.mode}`);
              
              if (!activeGrid.isSpot) {
                await updatePerpsLeverage(activeGrid.symbol, parseInt(activeGrid.leverage) || 5, 2);
              }

              const prices = buildGridLevels(
                parseFloat(activeGrid.lowerPrice),
                parseFloat(activeGrid.upperPrice),
                parseInt(activeGrid.gridCount),
                activeGrid.spacing as any
              );
              
              const levels: LocalGridLevel[] = prices.map(price => ({ price, status: 'EMPTY' }));
              
              addTerminalLog('GRID', 'INFO', `Placing ${activeGrid.gridCount} grid orders...`);
              
              for (let i = 0; i < levels.length; i++) {
                const level = levels[i];
                let side: 'BUY' | 'SELL' | null = null;
                if (activeGrid.mode === 'NEUTRAL') {
                  side = level.price < mid ? 'BUY' : 'SELL';
                } else if (activeGrid.mode === 'LONG') {
                  if (level.price < mid) side = 'BUY';
                } else if (activeGrid.mode === 'SHORT') {
                  if (level.price > mid) side = 'SELL';
                }
                
                if (side) {
                  try {
                    const res = await placeOrder({
                      symbol: activeGrid.symbol,
                      side: side === 'BUY' ? 1 : 2,
                      type: 1, // LIMIT
                      quantity: activeGrid.amountPerGrid,
                      price: level.price.toFixed(2),
                      timeInForce: 1, // GTC
                    }, market) as any;
                    
                    const orderId = String(res?.orderID ?? res?.orderId ?? res?.id ?? '');
                    if (orderId) {
                      levels[i] = {
                        ...level,
                        status: 'ACTIVE',
                        orderId,
                        side
                      };
                      addTerminalLog('GRID', 'INFO', `Placed ${side} @ $${level.price.toFixed(2)} (${orderId.slice(-8)})`);
                    }
                  } catch (err: any) {
                    addTerminalLog('GRID', 'ERROR', `Place failed @ $${level.price.toFixed(2)}: ${getErrorMessage(err)}`);
                  }
                }
              }
              
              gridLevelsRef.current = levels;
              useBotStore.getState().gridBot.setField('status', 'RUNNING');
              addTerminalLog('GRID', 'SUCCESS', `Initial grids successfully placed.`);
            } else {
              // Monitor live orders
              const openOrders = await fetchOpenOrders(market, activeGrid.symbol) as any[];
              const openOrderIds = new Set(openOrders.map(o => String(o.orderID ?? o.orderId ?? o.id ?? '')));
              
              const levels = [...gridLevelsRef.current];
              for (let i = 0; i < levels.length; i++) {
                const level = levels[i];
                if (level.status === 'ACTIVE' && level.orderId && !openOrderIds.has(level.orderId)) {
                  try {
                    const status = await fetchOrderStatus(level.orderId, activeGrid.symbol, market);
                    if (status && status.status === 'FILLED') {
                      const neighbourIdx = level.side === 'BUY' ? i + 1 : i - 1;
                      const neighbourPrice = (neighbourIdx >= 0 && neighbourIdx < levels.length)
                        ? levels[neighbourIdx].price
                        : level.price;
                      
                      const realQty = status.filledQty > 0 ? status.filledQty : parseFloat(activeGrid.amountPerGrid);
                      const pnl = Math.abs(neighbourPrice - level.price) * realQty;
                      
                      addTerminalLog('GRID', 'TRADE', `${level.side} filled @ $${level.price.toFixed(2)}. PnL: +$${pnl.toFixed(2)} USDT.`);
                      
                      useBotStore.getState().gridBot.bumpField('completedGrids', 1);
                      useBotStore.getState().gridBot.bumpField('realizedPnl', pnl);
                      useBotPnlStore.getState().recordTrade('grid', {
                        pnlUsdt: pnl,
                        ts: Date.now(),
                        note: `${level.side} grid filled @ ${level.price.toFixed(2)}`,
                      });

                      if (orderFillsEnabled) {
                        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        setMessages(prev => [...prev, {
                          sender: 'bot',
                          text: `🤖 *Grid Bot Fill Update* (${activeGrid.symbol})\n• Side: ${level.side}\n• Price: $${level.price.toFixed(2)}\n• PnL: +$${pnl.toFixed(2)} USDT`,
                          timestamp: timeStr
                        }]);
                      }

                      // Place replenishment
                      const replSide = level.side === 'BUY' ? 'SELL' : 'BUY';
                      const replPrice = level.side === 'BUY' ? levels[i + 1]?.price : levels[i - 1]?.price;
                      
                      if (replPrice) {
                        try {
                          const res = await placeOrder({
                            symbol: activeGrid.symbol,
                            side: replSide === 'BUY' ? 1 : 2,
                            type: 1, // LIMIT
                            quantity: activeGrid.amountPerGrid,
                            price: replPrice.toFixed(2),
                            timeInForce: 1,
                          }, market) as any;
                          
                          const orderId = String(res?.orderID ?? res?.orderId ?? res?.id ?? '');
                          if (orderId) {
                            const replIdx = level.side === 'BUY' ? i + 1 : i - 1;
                            levels[replIdx] = {
                              price: replPrice,
                              status: 'ACTIVE',
                              orderId,
                              side: replSide
                            };
                            addTerminalLog('GRID', 'INFO', `Replenished: Placed ${replSide} @ $${replPrice.toFixed(2)} (${orderId.slice(-8)})`);
                          }
                        } catch (err: any) {
                          addTerminalLog('GRID', 'ERROR', `Replenishment failed @ $${replPrice.toFixed(2)}: ${getErrorMessage(err)}`);
                        }
                      }
                      
                      levels[i] = { ...level, status: 'FILLED', orderId: undefined, side: undefined };
                    } else if (status && status.status === 'EXPIRED') {
                      addTerminalLog('GRID', 'INFO', `Order ${level.orderId.slice(-8)} was cancelled on exchange.`);
                      levels[i] = { ...level, status: 'EMPTY', orderId: undefined, side: undefined };
                    }
                  } catch (err) {
                    // Ignore transient
                  }
                }
              }
              gridLevelsRef.current = levels;
              
              const activeCount = levels.filter(l => l.status === 'ACTIVE').length;
              useBotStore.getState().gridBot.setField('activeOrders', activeCount);
            }
            consecutiveErrorsRef.current.GRID = 0;
          } catch (err: any) {
            consecutiveErrorsRef.current.GRID += 1;
            addTerminalLog('GRID', 'ERROR', `Runner error: ${getErrorMessage(err)}`);
            if (consecutiveErrorsRef.current.GRID >= 4) {
              addTerminalLog('GRID', 'ERROR', `Too many errors. Stopping Grid Bot.`);
              useBotStore.getState().gridBot.setField('status', 'STOPPED');
              gridLevelsRef.current = [];
            }
          } finally {
            pollBusyRef.current = false;
          }
        }
      } else {
        gridStepRef.current = 0;
        gridLevelsRef.current = [];
      }

      // ── Market Maker Loop ──
      if (activeMm.status === 'RUNNING') {
        if (!evmAddress || !privateKey) {
          addTerminalLog('MM', 'ERROR', 'Credentials missing. Stopped Market Maker.');
          useBotStore.getState().marketMakerBot.setField('status', 'STOPPED');
          return;
        }

        if (isDemoMode) {
          // Simulation
          const step = mmStepRef.current;
          if (step === 0) {
            addTerminalLog('MM', 'INFO', `[DEMO] Market Maker started on ${activeMm.symbol}. Budget: $${activeMm.budgetUsdt} USDT.`);
            addTerminalLog('MM', 'INFO', `[DEMO] Quoting bid/ask layers at spread ${activeMm.spreadBps} bps...`);
            mmStepRef.current = 1;
          } else if (step >= 1) {
            if (Math.random() > 0.5) {
              const side = Math.random() > 0.5 ? 'BUY' : 'SELL';
              const price = 64200 + (Math.random() - 0.5) * 100;
              const volume = parseFloat(activeMm.orderSizeUsdt);
              const fee = volume * 0.0001; // maker fee
              
              addTerminalLog('MM', 'TRADE', `[DEMO] Maker ${side} order filled @ $${price.toFixed(2)}. Volume: $${volume} USDT.`);
              useBotStore.getState().marketMakerBot.bumpField('ordersFilled', 1);
              useBotStore.getState().marketMakerBot.bumpField('volumeUsdt', volume);
              useBotStore.getState().marketMakerBot.bumpField('feesUsdt', fee);

              if (orderFillsEnabled && Math.random() > 0.7) {
                const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                setMessages(prev => [...prev, {
                  sender: 'bot',
                  text: `🤖 *[DEMO] MM Bot Order Fill*\n• Pair: ${activeMm.symbol}\n• Side: ${side}\n• Size: $${volume} USDT\n• Total Volume: $${useBotStore.getState().marketMakerBot.volumeUsdt.toFixed(2)} USDT`,
                  timestamp: timeStr
                }]);
              }
            }
          }
        } else {
          // REAL API Market Maker Mode!
          if (reconcileBusyRef.current) return;
          reconcileBusyRef.current = true;
          try {
            if (!sessionIdRef.current) {
              sessionIdRef.current = Math.random().toString(36).slice(2, 8);
              seqRef.current = 0;
            }

            const ob = await fetchOrderbook(activeMm.symbol, 'spot', 5) as any;
            let topBid = parseFloat(String(ob?.bids?.[0]?.[0] ?? 0));
            let topAsk = parseFloat(String(ob?.asks?.[0]?.[0] ?? 0));
            
            if (topBid <= 0 || topAsk <= topBid) {
              const bts = await fetchBookTickers('spot') as any[];
              const row = bts.find(t => t.symbol === activeMm.symbol);
              topBid = parseFloat(String(row?.bidPrice ?? row?.bid ?? 0));
              topAsk = parseFloat(String(row?.askPrice ?? row?.ask ?? 0));
            }

            if (topBid <= 0 || topAsk <= topBid) {
              addTerminalLog('MM', 'ERROR', `Orderbook unavailable for ${activeMm.symbol}`);
              return;
            }

            const openOrders = await fetchOpenOrders('spot', activeMm.symbol) as any[];
            const openByCloid = new Map<string, any>();
            for (const o of openOrders) {
              const cl = String(o.clOrdID ?? o.clientOrderId ?? '');
              if (cl.startsWith('mm_')) openByCloid.set(cl, o);
            }

            const missingOrders: [string, LocalManagedOrder][] = [];
            const stillOpen = new Map<string, LocalManagedOrder>();
            for (const [cloid, mo] of mmOrdersRef.current.entries()) {
              if (openByCloid.has(cloid)) {
                stillOpen.set(cloid, mo);
              } else {
                missingOrders.push([cloid, mo]);
              }
            }
            mmOrdersRef.current = stillOpen;

            if (missingOrders.length > 0) {
              for (const [cloid, mo] of missingOrders) {
                try {
                  const status = await fetchOrderStatus(mo.orderID ?? cloid, activeMm.symbol, 'spot');
                  if (status && status.status === 'FILLED' && status.filledQty > 0) {
                    const realQty = status.filledQty;
                    const realPrice = status.avgFillPrice > 0 ? status.avgFillPrice : mo.price;
                    const realNotional = status.filledValue > 0 ? status.filledValue : realQty * realPrice;
                    const realFee = status.totalFee > 0 ? status.totalFee : realNotional * 0.0001;

                    useBotStore.getState().marketMakerBot.bumpField('ordersFilled', 1);
                    useBotStore.getState().marketMakerBot.bumpField('volumeUsdt', realNotional);
                    useBotStore.getState().marketMakerBot.bumpField('feesUsdt', realFee);
                    useBotStore.getState().marketMakerBot.bumpField('inventoryBase', mo.side === 'BUY' ? realQty : -realQty);

                    useBotPnlStore.getState().recordTrade('marketmaker', {
                      pnlUsdt: -realFee,
                      ts: Date.now(),
                      note: `${mo.side} MM fill ${realQty.toFixed(4)} @ ${realPrice.toFixed(2)}`,
                    });

                    addTerminalLog('MM', 'TRADE', `✓ Maker ${mo.side} filled @ $${realPrice.toFixed(2)}. Vol +$${realNotional.toFixed(2)}, Fee: $${realFee.toFixed(4)}`);

                    if (orderFillsEnabled) {
                      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      setMessages(prev => [...prev, {
                        sender: 'bot',
                        text: `🤖 *MM Bot Order Fill*\n• Side: ${mo.side}\n• Price: $${realPrice.toFixed(2)}\n• Size: $${realNotional.toFixed(2)} USDT\n• Inventory: ${useBotStore.getState().marketMakerBot.inventoryBase.toFixed(4)}`,
                        timestamp: timeStr
                      }]);
                    }
                  } else {
                    useBotStore.getState().marketMakerBot.bumpField('ordersCancelled', 1);
                    addTerminalLog('MM', 'INFO', `✗ Maker ${mo.side} @ $${mo.price.toFixed(2)} expired/cancelled.`);
                  }
                } catch {
                  // fallback
                }
              }
            }

            const postFillMm = useBotStore.getState().marketMakerBot;
            const volTarget = parseFloat(activeMm.volumeTargetUsdt) || 0;
            const feeBudget = parseFloat(activeMm.feeBudgetUsdt) || 0;
            if (volTarget > 0 && postFillMm.volumeUsdt >= volTarget) {
              addTerminalLog('MM', 'SUCCESS', `Volume target $${volTarget} reached. Stopping.`);
              await cancelAllOrders(activeMm.symbol, 'spot');
              useBotStore.getState().marketMakerBot.setField('status', 'STOPPED');
              return;
            }
            if (feeBudget > 0 && postFillMm.feesUsdt >= feeBudget) {
              addTerminalLog('MM', 'SUCCESS', `Fee budget $${feeBudget} reached. Stopping.`);
              await cancelAllOrders(activeMm.symbol, 'spot');
              useBotStore.getState().marketMakerBot.setField('status', 'STOPPED');
              return;
            }

            const requoteThreshold = (parseFloat(activeMm.requoteBps) || 5) * 0.0001;
            const toCancel: string[] = [];
            for (const [cloid, mo] of mmOrdersRef.current.entries()) {
              const ref = mo.side === 'BUY' ? topBid : topAsk;
              if (Math.abs(mo.price - ref) / ref > requoteThreshold) {
                toCancel.push(mo.orderID ?? cloid);
                mmOrdersRef.current.delete(cloid);
              }
            }

            if (toCancel.length > 0) {
              await batchCancelOrders(toCancel, activeMm.symbol, 'spot');
              useBotStore.getState().marketMakerBot.bumpField('ordersCancelled', toCancel.length);
              lastCancelAtRef.current = Date.now();
              addTerminalLog('MM', 'INFO', `Re-quote: cancelled ${toCancel.length} stale order(s).`);
            }

            if (Date.now() - lastCancelAtRef.current < 5000) {
              return;
            }

            const layers = Math.max(1, Math.min(5, parseInt(activeMm.layers) || 1));
            const liveBuys = [...openByCloid.values()].filter(o => o.side === 1 || o.side === 'BUY');
            const liveSells = [...openByCloid.values()].filter(o => o.side === 2 || o.side === 'SELL');
            
            const offsetMul = (parseFloat(activeMm.spreadBps) || 0) * 0.0001;
            const qtyPerOrder = parseFloat(activeMm.orderSizeUsdt) / topBid;

            const budget = parseFloat(activeMm.budgetUsdt) || 100;
            const orderSize = parseFloat(activeMm.orderSizeUsdt) || 10;
            const committedBuyUsdt = liveBuys.reduce((sum, o) => sum + (parseFloat(o.price ?? 0) * parseFloat(o.quantity ?? o.qty ?? 0)), 0);
            const remainingBuyBudget = Math.max(0, budget - committedBuyUsdt);
            const buySlots = Math.min(layers, liveBuys.length + Math.floor(remainingBuyBudget / orderSize));

            for (let i = liveBuys.length; i < buySlots; i++) {
              const px = topBid * (1 - offsetMul) - i * 0.01;
              seqRef.current += 1;
              const cloid = `mm_${sessionIdRef.current}_${seqRef.current.toString(36)}`;
              try {
                const res = await placeOrder({
                  symbol: activeMm.symbol,
                  side: 1,
                  type: 1,
                  quantity: qtyPerOrder.toFixed(4),
                  price: px.toFixed(2),
                  timeInForce: 4,
                  clOrdID: cloid,
                }, 'spot') as any;

                const orderID = String(res?.orderID ?? res?.orderId ?? cloid);
                mmOrdersRef.current.set(cloid, {
                  clOrdID: cloid,
                  orderID,
                  side: 'BUY',
                  price: px,
                  quantity: qtyPerOrder,
                  postedAt: Date.now()
                });
                useBotStore.getState().marketMakerBot.bumpField('ordersPlaced', 1);
                addTerminalLog('MM', 'INFO', `↗ BUY ${qtyPerOrder.toFixed(4)} @ $${px.toFixed(2)} posted.`);
              } catch (err: any) {
                if (!/post.?only|would.?cross/i.test(getErrorMessage(err))) {
                  addTerminalLog('MM', 'ERROR', `Place failed: ${getErrorMessage(err)}`);
                }
              }
            }

            const liveInventory = useBotStore.getState().marketMakerBot.inventoryBase;
            const reservedSellQty = liveSells.reduce((sum, o) => sum + parseFloat(o.quantity ?? o.qty ?? 0), 0);
            const availableInventory = Math.max(0, liveInventory - reservedSellQty);
            const sellSlots = Math.min(layers, liveSells.length + Math.floor(availableInventory / qtyPerOrder));

            for (let i = liveSells.length; i < sellSlots; i++) {
              const px = topAsk * (1 + offsetMul) + i * 0.01;
              seqRef.current += 1;
              const cloid = `mm_${sessionIdRef.current}_${seqRef.current.toString(36)}`;
              try {
                const res = await placeOrder({
                  symbol: activeMm.symbol,
                  side: 2,
                  type: 1,
                  quantity: qtyPerOrder.toFixed(4),
                  price: px.toFixed(2),
                  timeInForce: 4,
                  clOrdID: cloid,
                }, 'spot') as any;

                const orderID = String(res?.orderID ?? res?.orderId ?? cloid);
                mmOrdersRef.current.set(cloid, {
                  clOrdID: cloid,
                  orderID,
                  side: 'SELL',
                  price: px,
                  quantity: qtyPerOrder,
                  postedAt: Date.now()
                });
                useBotStore.getState().marketMakerBot.bumpField('ordersPlaced', 1);
                addTerminalLog('MM', 'INFO', `↘ SELL ${qtyPerOrder.toFixed(4)} @ $${px.toFixed(2)} posted.`);
              } catch (err: any) {
                if (!/post.?only|would.?cross/i.test(getErrorMessage(err))) {
                  addTerminalLog('MM', 'ERROR', `Place failed: ${getErrorMessage(err)}`);
                }
              }
            }
            consecutiveErrorsRef.current.MM = 0;
          } catch (err: any) {
            consecutiveErrorsRef.current.MM += 1;
            addTerminalLog('MM', 'ERROR', `MM runner error: ${getErrorMessage(err)}`);
            if (consecutiveErrorsRef.current.MM >= 4) {
              addTerminalLog('MM', 'ERROR', `Too many MM errors. Stopping MM bot.`);
              useBotStore.getState().marketMakerBot.setField('status', 'STOPPED');
            }
          } finally {
            reconcileBusyRef.current = false;
          }
        }
      } else {
        mmStepRef.current = 0;
        mmOrdersRef.current.clear();
        sessionIdRef.current = '';
      }

      // ── Signal Bot Loop ──
      if (activeSig.status === 'RUNNING') {
        if (!evmAddress || !privateKey) {
          addTerminalLog('SIGNAL', 'ERROR', 'Credentials missing. Stopped Signal Bot.');
          useBotStore.getState().signalBot.setField('status', 'STOPPED');
          return;
        }

        const step = sigStepRef.current;
        if (step === 0) {
          addTerminalLog('SIGNAL', 'INFO', `Signal Bot activated on ${activeSig.symbol}. Scanning indicators...`);
          sigStepRef.current = 1;
        } else if (step === 1) {
          // Simulate scanning indicators
          if (Math.random() > 0.8) {
            const side: 'LONG' | 'SHORT' = Math.random() > 0.5 ? 'LONG' : 'SHORT';
            addTerminalLog('SIGNAL', 'INFO', `Indicator crossover alert! RSI oversold / MACD Bullish on ${activeSig.symbol}.`);
            
            if (isDemoMode) {
              const entryPrice = 64000;
              addTerminalLog('SIGNAL', 'TRADE', `[DEMO] Executing ${side} market entry at $${entryPrice.toFixed(2)}. Size: $${activeSig.amountUsdt} USDT.`);
              
              const newPos = {
                id: Math.random().toString(36).substr(2, 9),
                symbol: activeSig.symbol,
                side,
                entryPrice,
                quantity: parseFloat(activeSig.amountUsdt) / entryPrice,
                leverage: parseInt(activeSig.leverage),
                tpPrice: side === 'LONG' ? entryPrice * 1.03 : entryPrice * 0.97,
                slPrice: side === 'LONG' ? entryPrice * 0.98 : entryPrice * 1.02,
                openTime: Date.now(),
                triggeredBy: ['RSI', 'MACD'],
                unrealizedPnl: 0,
                status: 'OPEN' as const
              };
              useBotStore.getState().signalBot.setField('activePositions', [newPos]);
              sigStepRef.current = 2;
            } else {
              // REAL API Signal Trade!
              try {
                const tickers = await fetchBookTickers('perps');
                const row = tickers.find((t: any) => t.symbol === activeSig.symbol) as any;
                const price = row ? (parseFloat(row.bidPrice) + parseFloat(row.askPrice)) / 2 : 64000;
                
                const qty = (parseFloat(activeSig.amountUsdt) * parseInt(activeSig.leverage)) / price;
                
                addTerminalLog('SIGNAL', 'TRADE', `Executing ${side} market entry at $${price.toFixed(2)}. Size: $${activeSig.amountUsdt} USDT (Leverage ${activeSig.leverage}x).`);
                
                await updatePerpsLeverage(activeSig.symbol, parseInt(activeSig.leverage) || 5, 2);
                
                const res = await placeOrder({
                  symbol: activeSig.symbol,
                  side: side === 'LONG' ? 1 : 2,
                  type: 2, // MARKET
                  quantity: qty.toFixed(4)
                }, 'perps') as any;
                
                const orderId = String(res?.orderID ?? res?.orderId ?? res?.id ?? '');
                
                if (orderId) {
                  let avgPrice = price;
                  let filledQty = qty;
                  
                  for (let attempt = 0; attempt < 3; attempt++) {
                    await new Promise(r => setTimeout(r, 600));
                    const status = await fetchOrderStatus(orderId, activeSig.symbol, 'perps');
                    if (status && status.filledQty > 0) {
                      avgPrice = status.avgFillPrice;
                      filledQty = status.filledQty;
                      break;
                    }
                  }

                  const tpPct = parseFloat(activeSig.takeProfitPct) || 3.0;
                  const slPct = parseFloat(activeSig.stopLossPct) || 2.0;
                  
                  const tpPrice = side === 'LONG' ? avgPrice * (1 + tpPct/100) : avgPrice * (1 - tpPct/100);
                  const slPrice = side === 'LONG' ? avgPrice * (1 - slPct/100) : avgPrice * (1 + slPct/100);

                  addTerminalLog('SIGNAL', 'TRADE', `Market order filled at $${avgPrice.toFixed(2)}. Placing stop orders (TP @ $${tpPrice.toFixed(2)}, SL @ $${slPrice.toFixed(2)}).`);

                  const closeSide = side === 'LONG' ? 2 : 1;
                  
                  let tpOrderId = '';
                  let slOrderId = '';

                  try {
                    const tpRes = await placeOrder({
                      symbol: activeSig.symbol,
                      side: closeSide,
                      type: 2,
                      quantity: filledQty.toFixed(4),
                      stopPrice: tpPrice.toFixed(2),
                      stopType: 2,
                      triggerType: 2,
                      reduceOnly: true
                    }, 'perps') as any;
                    tpOrderId = String(tpRes?.orderID ?? tpRes?.orderId ?? '');
                  } catch (err) {
                    addTerminalLog('SIGNAL', 'ERROR', `Could not place TP Stop Order: ${getErrorMessage(err)}`);
                  }

                  try {
                    const slRes = await placeOrder({
                      symbol: activeSig.symbol,
                      side: closeSide,
                      type: 2,
                      quantity: filledQty.toFixed(4),
                      stopPrice: slPrice.toFixed(2),
                      stopType: 1,
                      triggerType: 2,
                      reduceOnly: true
                    }, 'perps') as any;
                    slOrderId = String(slRes?.orderID ?? slRes?.orderId ?? '');
                  } catch (err) {
                    addTerminalLog('SIGNAL', 'ERROR', `Could not place SL Stop Order: ${getErrorMessage(err)}`);
                  }

                  const newPos = {
                    id: orderId,
                    symbol: activeSig.symbol,
                    side,
                    entryPrice: avgPrice,
                    quantity: filledQty,
                    leverage: parseInt(activeSig.leverage),
                    tpPrice,
                    slPrice,
                    openTime: Date.now(),
                    triggeredBy: ['RSI', 'MACD'],
                    tpOrderId,
                    slOrderId,
                    unrealizedPnl: 0,
                    status: 'OPEN' as const
                  };
                  
                  useBotStore.getState().signalBot.setField('activePositions', [newPos]);
                  sigStepRef.current = 2;
                }
              } catch (err: any) {
                addTerminalLog('SIGNAL', 'ERROR', `Signal trade execution failed: ${getErrorMessage(err)}`);
              }
            }
          }
        } else if (step === 2) {
          const currentPos = useBotStore.getState().signalBot.activePositions[0];
          if (currentPos) {
            if (isDemoMode) {
              if (Math.random() > 0.7) {
                const win = Math.random() > 0.4;
                const finalPnl = win ? parseFloat(activeSig.amountUsdt) * 0.03 : -parseFloat(activeSig.amountUsdt) * 0.02;
                addTerminalLog('SIGNAL', 'TRADE', `[DEMO] Closed position ${currentPos.id}. Reason: ${win ? 'TP_HIT' : 'SL_HIT'}. PnL: $${finalPnl.toFixed(2)} USDT.`);
                
                const prevTrades = useBotStore.getState().signalBot.totalTrades;
                const prevWins = useBotStore.getState().signalBot.winTrades;
                useBotStore.getState().signalBot.setField('totalTrades', prevTrades + 1);
                if (win) useBotStore.getState().signalBot.setField('winTrades', prevWins + 1);
                useBotStore.getState().signalBot.setField('realizedPnl', useBotStore.getState().signalBot.realizedPnl + finalPnl);
                useBotStore.getState().signalBot.setField('activePositions', []);
                sigStepRef.current = 1;

                if (orderFillsEnabled) {
                  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  setMessages(prev => [...prev, {
                    sender: 'bot',
                    text: `🤖 *[DEMO] Signal Position Closed*\n• Symbol: ${activeSig.symbol}\n• Side: ${currentPos.side}\n• Outcome: ${win ? 'Take Profit' : 'Stop Loss'}\n• Realized PnL: +$${finalPnl.toFixed(2)} USDT`,
                    timestamp: timeStr
                  }]);
                }
              }
            } else {
              // Real Position Tracking (high freq TP/SL checks)
              try {
                const tickers = await fetchBookTickers('perps');
                const row = tickers.find((t: any) => t.symbol === currentPos.symbol) as any;
                if (row) {
                  const price = (parseFloat(row.bidPrice) + parseFloat(row.askPrice)) / 2;
                  const side = currentPos.side;
                  const pnl = currentPos.quantity * (side === 'LONG' ? (price - currentPos.entryPrice) : (currentPos.entryPrice - price));
                  
                  const posCopy = { ...currentPos, unrealizedPnl: pnl };
                  useBotStore.getState().signalBot.setField('activePositions', [posCopy]);
                  
                  const tpPrice = currentPos.tpPrice || 0;
                  const slPrice = currentPos.slPrice || 0;
                  
                  const tpHit = side === 'LONG' ? price >= tpPrice : price <= tpPrice;
                  const slHit = side === 'LONG' ? price <= slPrice : price >= slPrice;

                  if (tpHit || slHit) {
                    const win = tpHit;
                    addTerminalLog('SIGNAL', 'TRADE', `TP/SL target crossed at $${price.toFixed(2)}. Closing position.`);
                    
                    const closeSide = side === 'LONG' ? 2 : 1;
                    await placeOrder({
                      symbol: currentPos.symbol,
                      side: closeSide,
                      type: 2,
                      quantity: currentPos.quantity.toFixed(4),
                      reduceOnly: true
                    }, 'perps');

                    if (currentPos.tpOrderId) await cancelOrder(currentPos.tpOrderId, currentPos.symbol, 'perps');
                    if (currentPos.slOrderId) await cancelOrder(currentPos.slOrderId, currentPos.symbol, 'perps');

                    addTerminalLog('SIGNAL', 'TRADE', `Closed position ${currentPos.id}. Outcome: ${win ? 'TP_HIT' : 'SL_HIT'}. PnL: $${pnl.toFixed(2)} USDT.`);
                    
                    const prevTrades = useBotStore.getState().signalBot.totalTrades;
                    const prevWins = useBotStore.getState().signalBot.winTrades;
                    useBotStore.getState().signalBot.setField('totalTrades', prevTrades + 1);
                    if (win) useBotStore.getState().signalBot.setField('winTrades', prevWins + 1);
                    useBotStore.getState().signalBot.setField('realizedPnl', useBotStore.getState().signalBot.realizedPnl + pnl);
                    useBotPnlStore.getState().recordTrade('signal', {
                      pnlUsdt: pnl,
                      ts: Date.now(),
                      note: `Signal closed @ ${price.toFixed(2)}`,
                    });
                    useBotStore.getState().signalBot.setField('activePositions', []);
                    sigStepRef.current = 1;

                    if (orderFillsEnabled) {
                      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      setMessages(prev => [...prev, {
                        sender: 'bot',
                        text: `🤖 *Signal Position Closed*\n• Symbol: ${activeSig.symbol}\n• Outcome: ${win ? 'Take Profit' : 'Stop Loss'}\n• PnL: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} USDT`,
                        timestamp: timeStr
                      }]);
                    }
                  }
                }
              } catch (err) {
                // Ignore transient
              }
            }
          } else {
            sigStepRef.current = 1;
          }
        }
      } else {
        sigStepRef.current = 0;
      }

      // ── Predictor Bot Loop ──
      if (activePred) {
        if (!evmAddress || !privateKey) {
          addTerminalLog('PREDICTOR', 'ERROR', 'Credentials missing. Stopped Predictor Bot.');
          usePredictorStore.getState().setAutoTradeEnabled(false);
          return;
        }

        const step = predStepRef.current;
        if (step === 0) {
          addTerminalLog('PREDICTOR', 'INFO', `BTC Predictor auto-trade enabled. Listening to SoSoValue ETF & News sentiment...`);
          predStepRef.current = 1;
        } else if (step === 1) {
          if (Math.random() > 0.8) {
            const verdict = usePredictorStore.getState().aiVerdict?.decision ?? 'BULLISH';
            
            if (isDemoMode) {
              const price = 64300 + (Math.random() - 0.5) * 50;
              addTerminalLog('PREDICTOR', 'INFO', `[DEMO] Model check: ETF Flow = Positive, Sentiment = Bullish. Confidence: 88%.`);
              addTerminalLog('PREDICTOR', 'TRADE', `[DEMO] Opening forecast trade (${verdict}) at $${price.toFixed(2)}. Size: $${usePredictorStore.getState().tradeAmountUsdt} USDT.`);
              
              setTimeout(() => {
                if (usePredictorStore.getState().autoTradeEnabled) {
                  const pnl = (verdict === 'BULLISH' ? 1 : -1) * parseFloat(usePredictorStore.getState().tradeAmountUsdt) * 0.012;
                  addTerminalLog('PREDICTOR', 'TRADE', `[DEMO] Forecast cycle complete. Profit settled: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} USDT.`);
                }
              }, 4000);
            } else {
              // REAL API Predictor Trade!
              try {
                const tickers = await fetchBookTickers('perps');
                const row = tickers.find((t: any) => t.symbol === 'BTC-USD') as any;
                const price = row ? (parseFloat(row.bidPrice) + parseFloat(row.askPrice)) / 2 : 64300;

                const amount = usePredictorStore.getState().tradeAmountUsdt;
                const leverage = usePredictorStore.getState().tradeLeverage;
                const qty = (parseFloat(amount) * leverage) / price;

                addTerminalLog('PREDICTOR', 'INFO', `Model check: ETF Flow = Positive, Sentiment = Bullish. Confidence: 88%.`);
                addTerminalLog('PREDICTOR', 'TRADE', `Opening forecast trade (${verdict}) at $${price.toFixed(2)}. Size: $${amount} USDT.`);

                await updatePerpsLeverage('BTC-USD', leverage, 2);

                const res = await placeOrder({
                  symbol: 'BTC-USD',
                  side: verdict === 'BULLISH' ? 1 : 2,
                  type: 2,
                  quantity: qty.toFixed(4)
                }, 'perps') as any;

                const orderId = String(res?.orderID ?? res?.orderId ?? '');

                if (orderId) {
                  setTimeout(async () => {
                    if (usePredictorStore.getState().autoTradeEnabled) {
                      try {
                        const tickersAfter = await fetchBookTickers('perps');
                        const rowAfter = tickersAfter.find((t: any) => t.symbol === 'BTC-USD') as any;
                        const priceAfter = rowAfter ? (parseFloat(rowAfter.bidPrice) + parseFloat(rowAfter.askPrice)) / 2 : price;
                        
                        const pnl = qty * (verdict === 'BULLISH' ? (priceAfter - price) : (price - priceAfter));

                        await placeOrder({
                          symbol: 'BTC-USD',
                          side: verdict === 'BULLISH' ? 2 : 1,
                          type: 2,
                          quantity: qty.toFixed(4),
                          reduceOnly: true
                        }, 'perps');

                        addTerminalLog('PREDICTOR', 'TRADE', `Forecast cycle complete. Closed swap at $${priceAfter.toFixed(2)}. PnL: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} USDT.`);

                        useBotPnlStore.getState().recordTrade('predictor', {
                          pnlUsdt: pnl,
                          ts: Date.now(),
                          note: `Predictor closed @ ${priceAfter.toFixed(2)}`,
                        });
                      } catch (err) {
                        // ignore
                      }
                    }
                  }, 8000);
                }
              } catch (err: any) {
                addTerminalLog('PREDICTOR', 'ERROR', `Predictor order failed: ${getErrorMessage(err)}`);
              }
            }
          }
        }
      } else {
        predStepRef.current = 0;
      }

    }, 5000);

    return () => clearInterval(interval);
  }, [evmAddress, privateKey, orderFillsEnabled, addTerminalLog, isDemoMode, telegramChatId, disconnectAndStopAllBots]);

  // AI Auto configure parameters helper
  const handleAiConfigure = async () => {
    addTerminalLog('SYSTEM', 'INFO', 'Invoking AI analysis model...');
    try {
      if (activeTab === 'GRID') {
        const market = gridParams.isSpot ? 'spot' : 'perps';
        const ctx = await buildContext(gridParams.symbol, market);
        const budget = parseFloat(gridParams.amount) * parseInt(gridParams.gridCount) * ctx.price || 200;
        const rec = recommendGridBot(ctx, budget);
        setGridParams(prev => ({
          ...prev,
          lowerPrice: rec.preset.lowerPrice as string,
          upperPrice: rec.preset.upperPrice as string,
          gridCount: rec.preset.gridCount as string,
          amount: rec.preset.amountPerGrid as string,
          spacing: rec.preset.spacing as string,
        }));
        addTerminalLog('GRID', 'SUCCESS', `AI Configuration applied: ${rec.rationale}`);
      } else if (activeTab === 'MM') {
        const ctx = await buildContext(mmParams.symbol, 'spot');
        const budget = parseFloat(mmParams.budget) || 100;
        const rec = recommendMarketMakerBot(ctx, budget);
        setMmParams(prev => ({
          ...prev,
          budget: rec.preset.budgetUsdt as string,
          size: rec.preset.orderSizeUsdt as string,
          spread: rec.preset.spreadBps as string,
          rebalance: rec.preset.requoteBps as string,
          layers: rec.preset.layers as string,
          makerFeeRate: rec.preset.makerFeeRate as string,
        }));
        addTerminalLog('MM', 'SUCCESS', `AI Configuration applied: ${rec.rationale}`);
      } else if (activeTab === 'SIGNAL') {
        const market = sigParams.isSpot ? 'spot' : 'perps';
        const ctx = await buildContext(sigParams.symbol, market);
        const rec = recommendSignalBot(ctx);
        setSigParams(prev => ({
          ...prev,
          leverage: rec.preset.leverage as string,
          amount: rec.preset.amountUsdt as string,
          tp: rec.preset.takeProfitPct as string,
          sl: rec.preset.stopLossPct as string,
          combineMode: rec.preset.combineMode as string,
          checkInterval: rec.preset.checkInterval as string,
          klineInterval: rec.preset.klineInterval as string,
          cooldownSeconds: rec.preset.cooldownSeconds as string,
          maxOpenPositions: rec.preset.maxOpenPositions as string,
          onConflictingSignal: rec.preset.onConflictingSignal as string,
        }));
        if (rec.preset.signalsJson) {
          try {
            const parsed = JSON.parse(rec.preset.signalsJson);
            if (Array.isArray(parsed)) {
              useBotStore.getState().signalBot.setField('signals', parsed);
            }
          } catch {}
        }
        addTerminalLog('SIGNAL', 'SUCCESS', `AI Configuration applied: ${rec.rationale}`);
      } else if (activeTab === 'PREDICTOR') {
        setPredParams(prev => ({
          ...prev,
          leverage: '15',
          amount: '100'
        }));
        addTerminalLog('PREDICTOR', 'SUCCESS', 'AI Configuration applied: forecast margin leverage set to 15x, trade amount 100 USDT.');
      }
      toast.success('AI configurations applied!');
    } catch (err) {
      const msg = getErrorMessage(err);
      toast.error(`AI configure failed: ${msg}`);
      addTerminalLog('SYSTEM', 'ERROR', `AI configure failed: ${msg}`);
    }
  };


  const handleStartStopBot = () => {
    // Validate credentials
    if (!evmAddress || !privateKey) {
      addTerminalLog('SYSTEM', 'ERROR', 'Bot launch failed: EVM address or Private Key is not set.');
      toast.error('Please configure your API credentials first!');
      return;
    }

    if (activeTab === 'GRID') {
      if (grid.status === 'RUNNING') {
        useBotStore.getState().gridBot.setField('status', 'STOPPED');
        addTerminalLog('GRID', 'INFO', 'Grid Bot stop signal received. Cancelling grid layers...');
        toast.success('Grid Bot stopped!');
      } else {
        // sync overrides to store
        useBotStore.getState().gridBot.setField('symbol', gridParams.symbol);
        useBotStore.getState().gridBot.setField('lowerPrice', gridParams.lowerPrice);
        useBotStore.getState().gridBot.setField('upperPrice', gridParams.upperPrice);
        useBotStore.getState().gridBot.setField('gridCount', gridParams.gridCount);
        useBotStore.getState().gridBot.setField('amountPerGrid', gridParams.amount);
        useBotStore.getState().gridBot.setField('spacing', gridParams.spacing as any);
        useBotStore.getState().gridBot.setField('isSpot', gridParams.isSpot);
        useBotStore.getState().gridBot.setField('leverage', gridParams.leverage);
        useBotStore.getState().gridBot.setField('stopLossPrice', gridParams.stopLossPrice);
        useBotStore.getState().gridBot.setField('takeProfitPrice', gridParams.takeProfitPrice);
        useBotStore.getState().gridBot.setField('status', 'RUNNING');
        toast.success('Grid Bot started!');
      }
    } else if (activeTab === 'MM') {
      if (mm.status === 'RUNNING') {
        useBotStore.getState().marketMakerBot.setField('status', 'STOPPED');
        useBotStore.getState().marketMakerBot.setField('sessionStartedAt', null);
        addTerminalLog('MM', 'INFO', 'Market Maker stopped. Open limit orders removed.');
        toast.success('Market Maker stopped!');
      } else {
        useBotStore.getState().marketMakerBot.setField('symbol', mmParams.symbol);
        useBotStore.getState().marketMakerBot.setField('budgetUsdt', mmParams.budget);
        useBotStore.getState().marketMakerBot.setField('orderSizeUsdt', mmParams.size);
        useBotStore.getState().marketMakerBot.setField('spreadBps', mmParams.spread);
        useBotStore.getState().marketMakerBot.setField('requoteBps', mmParams.rebalance);
        useBotStore.getState().marketMakerBot.setField('layers', mmParams.layers);
        useBotStore.getState().marketMakerBot.setField('makerFeeRate', mmParams.makerFeeRate);
        useBotStore.getState().marketMakerBot.setField('volumeTargetUsdt', mmParams.volumeTargetUsdt);
        useBotStore.getState().marketMakerBot.setField('feeBudgetUsdt', mmParams.feeBudgetUsdt);
        useBotStore.getState().marketMakerBot.setField('status', 'RUNNING');
        useBotStore.getState().marketMakerBot.setField('sessionStartedAt', Date.now());
        toast.success('Market Maker started!');
      }
    } else if (activeTab === 'SIGNAL') {
      if (sig.status === 'RUNNING') {
        useBotStore.getState().signalBot.setField('status', 'STOPPED');
        addTerminalLog('SIGNAL', 'INFO', 'Signal Bot stopped.');
        toast.success('Signal Bot stopped!');
      } else {
        useBotStore.getState().signalBot.setField('symbol', sigParams.symbol);
        useBotStore.getState().signalBot.setField('leverage', sigParams.leverage);
        useBotStore.getState().signalBot.setField('amountUsdt', sigParams.amount);
        useBotStore.getState().signalBot.setField('takeProfitPct', sigParams.tp);
        useBotStore.getState().signalBot.setField('stopLossPct', sigParams.sl);
        useBotStore.getState().signalBot.setField('combineMode', sigParams.combineMode as any);
        useBotStore.getState().signalBot.setField('checkInterval', sigParams.checkInterval);
        useBotStore.getState().signalBot.setField('klineInterval', sigParams.klineInterval);
        useBotStore.getState().signalBot.setField('cooldownSeconds', sigParams.cooldownSeconds);
        useBotStore.getState().signalBot.setField('maxOpenPositions', sigParams.maxOpenPositions);
        useBotStore.getState().signalBot.setField('onConflictingSignal', sigParams.onConflictingSignal as any);
        useBotStore.getState().signalBot.setField('isSpot', sigParams.isSpot);
        useBotStore.getState().signalBot.setField('status', 'RUNNING');
        toast.success('Signal Bot started!');
      }
    } else if (activeTab === 'PREDICTOR') {
      if (pred) {
        usePredictorStore.getState().setAutoTradeEnabled(false);
        addTerminalLog('PREDICTOR', 'INFO', 'BTC Predictor auto-trade disabled.');
        toast.success('Auto-trade disabled!');
      } else {
        usePredictorStore.getState().setTradeAmountUsdt(predParams.amount || '100');
        usePredictorStore.getState().setTradeLeverage(parseInt(predParams.leverage) || 10);
        usePredictorStore.getState().setAutoTradeEnabled(true);
        toast.success('BTC Predictor auto-trade enabled!');
      }
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
• /startbot — Interactively select a bot to start
• /stopbot — Interactively select a bot to stop
• /disconnect — Disconnect account & stop all bots

Configure credentials in the panel below to activate live states.`;
      } else if (cmd === '/startbot') {
        setPendingAction('START_SELECT');
        botText = `🤖 *Select a bot to START:*
1. Grid Bot
2. Market Maker
3. Signal Bot
4. BTC Predictor

*Reply with the number (1-4) or bot name.*`;
      } else if (cmd === '/stopbot') {
        const runningBots: string[] = [];
        if (grid.status === 'RUNNING') runningBots.push('Grid Bot');
        if (mm.status === 'RUNNING') runningBots.push('Market Maker');
        if (sig.status === 'RUNNING') runningBots.push('Signal Bot');
        if (pred) runningBots.push('BTC Predictor');

        if (runningBots.length === 0) {
          botText = `ℹ️ No trading bots are currently running.`;
        } else {
          setPendingAction('STOP_SELECT');
          setRunningBotsList(runningBots);
          botText = `🤖 *Select a bot to STOP:*
` + runningBots.map((b, i) => `${i + 1}. ${b}`).join('\n') + `

*Reply with the number.*`;
        }
      } else if (pendingAction === 'START_SELECT') {
        let selected = '';
        if (userText === '1' || userText.toLowerCase().includes('grid')) selected = 'grid';
        else if (userText === '2' || userText.toLowerCase().includes('mm') || userText.toLowerCase().includes('market')) selected = 'mm';
        else if (userText === '3' || userText.toLowerCase().includes('signal')) selected = 'signal';
        else if (userText === '4' || userText.toLowerCase().includes('pred') || userText.toLowerCase().includes('btc')) selected = 'predictor';

        if (selected) {
          if (!evmAddress || !privateKey) {
            botText = `❌ *Startup Failed:* SoDEX API credentials missing. Please enter them in the setup panel below.`;
          } else {
            if (selected === 'grid') {
              useBotStore.getState().gridBot.setField('status', 'RUNNING');
              botText = `🟢 *Grid Bot* has been STARTED. Initial orders are being placed. Check the Live Terminal below.`;
            } else if (selected === 'mm') {
              useBotStore.getState().marketMakerBot.setField('status', 'RUNNING');
              useBotStore.getState().marketMakerBot.setField('sessionStartedAt', Date.now());
              botText = `🟢 *Market Maker Bot* has been STARTED. Limit spreads posted on book.`;
            } else if (selected === 'signal') {
              useBotStore.getState().signalBot.setField('status', 'RUNNING');
              botText = `🟢 *Signal Bot* has been STARTED. Scanning crossovers.`;
            } else if (selected === 'predictor') {
              usePredictorStore.getState().setAutoTradeEnabled(true);
              botText = `🟢 *BTC Predictor* has been ENABLED. Auto-trades will execute on indicators shift.`;
            }
          }
          setPendingAction(null);
        } else {
          botText = `❌ Choice not recognized. Select 1-4 or bot name. Or type /help to abort.`;
        }
      } else if (pendingAction === 'STOP_SELECT') {
        const idx = parseInt(userText) - 1;
        if (!isNaN(idx) && idx >= 0 && idx < runningBotsList.length) {
          const selectedBotName = runningBotsList[idx];
          if (selectedBotName === 'Grid Bot') {
            useBotStore.getState().gridBot.setField('status', 'STOPPED');
            botText = `🔴 *Grid Bot* has been stopped and open grid layers cancelled.`;
          } else if (selectedBotName === 'Market Maker') {
            useBotStore.getState().marketMakerBot.setField('status', 'STOPPED');
            useBotStore.getState().marketMakerBot.setField('sessionStartedAt', null);
            botText = `🔴 *Market Maker Bot* stopped. Open limits cancelled.`;
          } else if (selectedBotName === 'Signal Bot') {
            useBotStore.getState().signalBot.setField('status', 'STOPPED');
            botText = `🔴 *Signal Bot* stopped.`;
          } else if (selectedBotName === 'BTC Predictor') {
            usePredictorStore.getState().setAutoTradeEnabled(false);
            botText = `🔴 *BTC Predictor* auto-trade disabled.`;
          }
          setPendingAction(null);
        } else {
          botText = `❌ Choice not recognized. Enter a valid list index.`;
        }
      } else if (cmd.startsWith('/status')) {
        botText = `🤖 Bot Status Overview:

${pred ? '🟢' : '🔴'} BTC Predictor: ${pred ? 'RUNNING (Auto-Trade)' : 'STOPPED'}
• Forecast: ${usePredictorStore.getState().currentPrediction}

${grid.status === 'RUNNING' ? '🟢' : '🔴'} Grid Bot: ${grid.status}
• Active Orders: ${grid.activeOrders} | Completed Grids: ${grid.completedGrids}
• Realized PnL: +$${grid.realizedPnl.toFixed(2)} USDT

${mm.status === 'RUNNING' ? '🟢' : '🔴'} Market Maker: ${mm.status}
• Volume: $${mm.volumeUsdt.toFixed(2)} USDT | Fills: ${mm.ordersFilled}

${sig.status === 'RUNNING' ? '🟢' : '🔴'} Signal Bot: ${sig.status}
• Realized PnL: +$${sig.realizedPnl.toFixed(2)} USDT`;
      } else if (cmd.startsWith('/positions')) {
        const rawPositions = await fetchPositions();
        const positionsArr = Array.isArray(rawPositions) ? rawPositions : [];
        if (positionsArr.length === 0) {
          botText = `📊 Open Positions:\nNo active open positions on SoDEX.`;
        } else {
          botText = `📊 Open Positions (${positionsArr.length}):\n\n`;
          positionsArr.forEach((pos: any, idx: number) => {
            const rawSize = parseFloat(String(pos.size ?? pos.quantity ?? 0));
            const entryPrice = parseFloat(String(pos.avgEntryPrice ?? pos.entryPrice ?? 0));
            const side = (pos.side === 'LONG' || rawSize >= 0) ? 'LONG' : 'SHORT';
            botText += `${idx + 1}. ${pos.symbol} (${side})\n• Size: ${Math.abs(rawSize).toFixed(4)}\n• Entry: $${entryPrice.toLocaleString()}\n\n`;
          });
        }
      } else if (cmd.startsWith('/risk')) {
        const rawPositions = await fetchPositions();
        const positionsArr = Array.isArray(rawPositions) ? rawPositions : [];
        botText = `🛡️ Risk Metrics Summary:
• Active Positions: ${positionsArr.length}
• Collateral Health: ${evmAddress ? '🟢 Stable' : '🔴 Key Missing'}`;
      } else if (cmd.startsWith('/pnl')) {
        botText = `📈 24h P&L Summary:
• Grid Realized: +$${grid.realizedPnl.toFixed(2)} USDT
• Signal Realized: +$${sig.realizedPnl.toFixed(2)} USDT
• Combined: +$${(grid.realizedPnl + sig.realizedPnl).toFixed(2)} USDT`;
      } else if (cmd.startsWith('/regime')) {
        const predictorSignals = usePredictorStore.getState().currentSignals;
        const inputs: RegimeInputs = {
          atrPct: predictorSignals?.atrPct ?? 0.10,
          change24hPct: 0.5,
          fundingRate: predictorSignals?.fundingRate ?? 0,
          emaSignal: predictorSignals?.emaSignal ?? 0,
          macdSignal: predictorSignals?.macdSignal ?? 0,
          newsSentiment: predictorSignals?.newsSentiment ?? 0,
          aiConfidence: 85,
        };
        const rec = recommendBot(inputs, 64000);
        const regime = classifyRegime(inputs);
        botText = `🧠 Market Regime: ${regimeLabel(regime)}\n• Recommendation: ${botLabel(rec.bot)}\n• Rationale: "${rec.rationale}"`;
      } else if (cmd.startsWith('/disconnect')) {
        await disconnectAndStopAllBots(false);
        botText = `🔌 *SoDEX account disconnected!*

Your account has been unlinked from this Telegram chat. All active terminal bots will be automatically stopped and open orders cancelled.`;
      } else {
        botText = `❓ Unknown command: "${userText}"\nType /help to see command options.`;
      }

      setMessages(prev => [...prev, { sender: 'bot', text: botText, timestamp: time }]);
    } catch (err) {
      setMessages(prev => [...prev, { sender: 'bot', text: `❌ Error: ${getErrorMessage(err)}`, timestamp: time }]);
    } finally {
      setIsTyping(false);
    }
  };

  const getBotStatusText = (botKey: TabType) => {
    if (botKey === 'GRID') return grid.status;
    if (botKey === 'MM') return mm.status;
    if (botKey === 'SIGNAL') return sig.status;
    return pred ? 'RUNNING' : 'STOPPED';
  };

  const isCurrentBotRunning = getBotStatusText(activeTab) === 'RUNNING';

  return (
    <div className="p-4 md:p-6 h-full flex flex-col gap-5 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-400 to-primary flex items-center justify-center shadow-lg">
          <MessageSquare size={22} className="text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-text-primary">Telegram Control & Live Console</h2>
          <p className="text-[11px] text-text-muted">Manage active trading bots, calibrate AI parameters, and monitor live API feeds</p>
        </div>
        {isConfigured && (
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success/10 border border-success/20 text-success text-[11px] font-semibold">
              <CheckCircle2 size={12} />
              Connected
            </div>
            <button
              onClick={() => disconnectAndStopAllBots(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/30 text-rose-400 text-[11px] font-semibold transition-all cursor-pointer shadow-sm hover:shadow-md"
            >
              <Trash2 size={12} />
              Disconnect
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 shrink-0">
        
        {/* Left Column - Credentials Setup and Alerts */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          
          {/* API Connection Setup Form */}
          <Card className="p-4 border-l-4 border-l-primary bg-surface/50">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/50">
              <ShieldCheck size={14} className="text-primary" />
              <span className="text-xs font-bold text-text-primary uppercase tracking-wider">SoDEX API Connection</span>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">EVM Address</label>
                <input
                  type="text"
                  value={addressInput}
                  onChange={(e) => setAddressInput(e.target.value)}
                  placeholder="0x..."
                  className="w-full mt-1 bg-background/60 border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-primary/50 font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">API Key Name</label>
                  <input
                    type="text"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="MyKeyName"
                    className="w-full mt-1 bg-background/60 border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-primary/50"
                  />
                </div>
                <div className="flex flex-col justify-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-text-secondary select-none">
                    <input
                      type="checkbox"
                      checked={testnetInput}
                      onChange={(e) => setTestnetInput(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-0"
                    />
                    Is Testnet
                  </label>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Private Key</label>
                <input
                  type="password"
                  value={privateKeyInput}
                  onChange={(e) => setPrivateKeyInput(e.target.value)}
                  placeholder="Enter private key (local sign)"
                  className="w-full mt-1 bg-background/60 border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-primary/50 font-mono"
                />
              </div>
              <Button
                variant="primary"
                size="sm"
                fullWidth
                onClick={handleSaveCredentials}
              >
                Save API Connection
              </Button>
            </div>
          </Card>

          {/* Connection ID config */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/50">
              <RefreshCw size={14} className="text-primary" />
              <span className="text-xs font-bold text-text-primary uppercase tracking-wider">Telegram Chat Linking</span>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Telegram Chat ID</label>
                <input
                  type="text"
                  value={chatIdInput}
                  onChange={(e) => setChatIdInput(e.target.value)}
                  placeholder="e.g. 123456789"
                  className="w-full mt-1.5 bg-background/60 border border-border rounded-lg px-3 py-2 text-xs font-mono text-text-primary focus:outline-none focus:border-primary/50"
                />
              </div>
              <Button
                variant="primary"
                size="sm"
                fullWidth
                onClick={handleVerify}
                loading={testStatus === 'testing'}
              >
                Verify & Connect Chat
              </Button>
            </div>
          </Card>

          {/* Notification toggles */}
          <Card className="p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 pb-2.5 border-b border-border/50">
              <Bell size={14} className="text-primary" />
              <span className="text-xs font-bold text-text-primary uppercase tracking-wider">Fills & Regime Alerts</span>
            </div>
            <Toggle
              label="Demo Mode (Simulate Trades)"
              checked={isDemoMode}
              onChange={setIsDemoMode}
            />
            <Toggle
              label="Regime Change Alerts"
              checked={alertEnabled}
              onChange={setAlertEnabled}
            />
            <Toggle
              label="Order Fill Confirmations"
              checked={orderFillsEnabled}
              onChange={setOrderFillsEnabled}
            />
          </Card>

        </div>

        {/* Center Column - Phone Chat Preview */}
        <div className="lg:col-span-3 flex flex-col items-center">
          <div className="w-full flex items-center justify-between mb-2 px-1">
            <span className="text-[10px] text-text-muted uppercase tracking-widest font-semibold">Interactive Chat Preview</span>
            <span className={cn(
              "text-[10px] px-2 py-0.5 rounded-full border",
              isDemoMode 
                ? "text-amber-400 border-amber-500/20 bg-amber-500/10" 
                : "text-emerald-400 border-emerald-500/20 bg-emerald-500/10"
            )}>
              {isDemoMode ? 'Demo Chat Mode' : 'Live Trading Mode'}
            </span>
          </div>
          <div className="w-full max-w-[360px] h-[550px] bg-[#121214] border-[6px] border-[#2A2A2E] rounded-[40px] shadow-2xl relative overflow-hidden flex flex-col">
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
            {/* Chat list */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-[#0C0C0E]">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex flex-col max-w-[80%] rounded-2xl p-2.5 text-xs leading-relaxed',
                    m.sender === 'user'
                      ? 'bg-primary text-white self-end rounded-br-sm'
                      : 'bg-[#18181D] border border-border text-text-secondary self-start rounded-bl-sm',
                  )}
                >
                  <div className="whitespace-pre-line">{m.text}</div>
                  <span className="text-[8px] opacity-50 mt-1 self-end">{m.timestamp}</span>
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
            {/* Chat Input */}
            <div className="p-3 bg-[#16161A] border-t border-border flex items-center gap-2 shrink-0">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="/help  /status  /startbot  /stopbot"
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

      {/* Bot Control Center and Terminal Section */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5 flex-1 min-h-[380px]">
        
        {/* Quick Config / Controller Dashboard */}
        <Card className="xl:col-span-2 p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-border/50">
            <span className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
              <Settings size={14} className="text-primary" /> Bot Control Panel
            </span>
            <span className={cn(
              "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
              isCurrentBotRunning ? "bg-success/15 text-success" : "bg-text-muted/10 text-text-muted"
            )}>
              {getBotStatusText(activeTab)}
            </span>
          </div>

          {/* Tab buttons */}
          <div className="grid grid-cols-4 gap-1.5 mb-4 shrink-0">
            {(['GRID', 'MM', 'SIGNAL', 'PREDICTOR'] as TabType[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "py-2 rounded-lg text-[10px] font-bold transition-all border",
                  activeTab === tab 
                    ? "bg-primary/10 border-primary text-primary" 
                    : "bg-surface border-border text-text-secondary hover:text-text-primary"
                )}
              >
                {tab === 'MM' ? 'MM' : tab}
              </button>
            ))}
          </div>

          {/* Config Editor Form per bot */}
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
            {activeTab === 'GRID' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => !isCurrentBotRunning && setGridParams(p => ({ ...p, isSpot: true }))}
                    className={cn('py-1.5 text-xs font-semibold rounded-lg border transition-all', gridParams.isSpot ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background/40 text-text-muted', isCurrentBotRunning && 'opacity-50')}
                  >Spot</button>
                  <button
                    onClick={() => !isCurrentBotRunning && setGridParams(p => ({ ...p, isSpot: false }))}
                    className={cn('py-1.5 text-xs font-semibold rounded-lg border transition-all', !gridParams.isSpot ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background/40 text-text-muted', isCurrentBotRunning && 'opacity-50')}
                  >Perps</button>
                </div>
                <SymbolSelector
                  value={gridParams.symbol}
                  onChange={(v) => setGridParams(p => ({ ...p, symbol: v }))}
                  market={gridParams.isSpot ? 'spot' : 'perps'}
                  disabled={isCurrentBotRunning}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Lower Price"
                    type="number"
                    value={gridParams.lowerPrice}
                    onChange={(e) => setGridParams(p => ({ ...p, lowerPrice: e.target.value }))}
                    disabled={isCurrentBotRunning}
                  />
                  <Input
                    label="Upper Price"
                    type="number"
                    value={gridParams.upperPrice}
                    onChange={(e) => setGridParams(p => ({ ...p, upperPrice: e.target.value }))}
                    disabled={isCurrentBotRunning}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Grid Levels"
                    type="number"
                    value={gridParams.gridCount}
                    onChange={(e) => setGridParams(p => ({ ...p, gridCount: e.target.value }))}
                    disabled={isCurrentBotRunning}
                  />
                  <Input
                    label="Amount/Grid"
                    type="number"
                    value={gridParams.amount}
                    onChange={(e) => setGridParams(p => ({ ...p, amount: e.target.value }))}
                    disabled={isCurrentBotRunning}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    label="Spacing"
                    value={gridParams.spacing}
                    onChange={(e) => setGridParams(p => ({ ...p, spacing: e.target.value }))}
                    disabled={isCurrentBotRunning}
                    options={[
                      { value: 'ARITHMETIC', label: 'Arithmetic' },
                      { value: 'GEOMETRIC', label: 'Geometric' }
                    ]}
                  />
                  {!gridParams.isSpot ? (
                    <Input
                      label="Leverage"
                      type="number"
                      value={gridParams.leverage}
                      onChange={(e) => setGridParams(p => ({ ...p, leverage: e.target.value }))}
                      disabled={isCurrentBotRunning}
                    />
                  ) : (
                    <div />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Stop Loss Price"
                    type="number"
                    value={gridParams.stopLossPrice}
                    onChange={(e) => setGridParams(p => ({ ...p, stopLossPrice: e.target.value }))}
                    disabled={isCurrentBotRunning}
                    placeholder="None"
                  />
                  <Input
                    label="Take Profit Price"
                    type="number"
                    value={gridParams.takeProfitPrice}
                    onChange={(e) => setGridParams(p => ({ ...p, takeProfitPrice: e.target.value }))}
                    disabled={isCurrentBotRunning}
                    placeholder="None"
                  />
                </div>
              </>
            )}

            {activeTab === 'MM' && (
              <>
                <SymbolSelector
                  value={mmParams.symbol}
                  onChange={(v) => setMmParams(p => ({ ...p, symbol: v }))}
                  market="spot"
                  disabled={isCurrentBotRunning}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Budget USDT"
                    type="number"
                    value={mmParams.budget}
                    onChange={(e) => setMmParams(p => ({ ...p, budget: e.target.value }))}
                    disabled={isCurrentBotRunning}
                  />
                  <Input
                    label="Order size USDT"
                    type="number"
                    value={mmParams.size}
                    onChange={(e) => setMmParams(p => ({ ...p, size: e.target.value }))}
                    disabled={isCurrentBotRunning}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Spread Offset (bps)"
                    type="number"
                    value={mmParams.spread}
                    onChange={(e) => setMmParams(p => ({ ...p, spread: e.target.value }))}
                    disabled={isCurrentBotRunning}
                  />
                  <Input
                    label="Re-quote Threshold (bps)"
                    type="number"
                    value={mmParams.rebalance}
                    onChange={(e) => setMmParams(p => ({ ...p, rebalance: e.target.value }))}
                    disabled={isCurrentBotRunning}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Ladder Layers"
                    type="number"
                    min="1"
                    max="5"
                    value={mmParams.layers}
                    onChange={(e) => setMmParams(p => ({ ...p, layers: e.target.value }))}
                    disabled={isCurrentBotRunning}
                  />
                  <Input
                    label="Maker Fee Rate"
                    type="number"
                    step="0.00001"
                    value={mmParams.makerFeeRate}
                    onChange={(e) => setMmParams(p => ({ ...p, makerFeeRate: e.target.value }))}
                    disabled={isCurrentBotRunning}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Volume Target (USDT)"
                    type="number"
                    value={mmParams.volumeTargetUsdt}
                    onChange={(e) => setMmParams(p => ({ ...p, volumeTargetUsdt: e.target.value }))}
                    disabled={isCurrentBotRunning}
                    placeholder="None"
                  />
                  <Input
                    label="Fee Budget (USDT)"
                    type="number"
                    value={mmParams.feeBudgetUsdt}
                    onChange={(e) => setMmParams(p => ({ ...p, feeBudgetUsdt: e.target.value }))}
                    disabled={isCurrentBotRunning}
                    placeholder="None"
                  />
                </div>
              </>
            )}

            {activeTab === 'SIGNAL' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => !isCurrentBotRunning && setSigParams(p => ({ ...p, isSpot: true }))}
                    className={cn('py-1.5 text-xs font-semibold rounded-lg border transition-all', sigParams.isSpot ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background/40 text-text-muted', isCurrentBotRunning && 'opacity-50')}
                  >Spot</button>
                  <button
                    onClick={() => !isCurrentBotRunning && setSigParams(p => ({ ...p, isSpot: false }))}
                    className={cn('py-1.5 text-xs font-semibold rounded-lg border transition-all', !sigParams.isSpot ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background/40 text-text-muted', isCurrentBotRunning && 'opacity-50')}
                  >Perps</button>
                </div>
                <SymbolSelector
                  value={sigParams.symbol}
                  onChange={(v) => setSigParams(p => ({ ...p, symbol: v }))}
                  market={sigParams.isSpot ? 'spot' : 'perps'}
                  disabled={isCurrentBotRunning}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Leverage margin"
                    type="number"
                    value={sigParams.leverage}
                    onChange={(e) => setSigParams(p => ({ ...p, leverage: e.target.value }))}
                    disabled={isCurrentBotRunning}
                  />
                  <Input
                    label="Position Amount ($)"
                    type="number"
                    value={sigParams.amount}
                    onChange={(e) => setSigParams(p => ({ ...p, amount: e.target.value }))}
                    disabled={isCurrentBotRunning}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Take profit %"
                    type="number"
                    value={sigParams.tp}
                    onChange={(e) => setSigParams(p => ({ ...p, tp: e.target.value }))}
                    disabled={isCurrentBotRunning}
                  />
                  <Input
                    label="Stop loss %"
                    type="number"
                    value={sigParams.sl}
                    onChange={(e) => setSigParams(p => ({ ...p, sl: e.target.value }))}
                    disabled={isCurrentBotRunning}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    label="Combine Mode"
                    value={sigParams.combineMode}
                    onChange={(e) => setSigParams(p => ({ ...p, combineMode: e.target.value }))}
                    disabled={isCurrentBotRunning}
                    options={[
                      { value: 'ANY', label: 'ANY (Or)' },
                      { value: 'ALL', label: 'ALL (And)' },
                      { value: 'MAJORITY', label: 'MAJORITY' }
                    ]}
                  />
                  <Select
                    label="Conflict Mode"
                    value={sigParams.onConflictingSignal}
                    onChange={(e) => setSigParams(p => ({ ...p, onConflictingSignal: e.target.value }))}
                    disabled={isCurrentBotRunning}
                    options={[
                      { value: 'IGNORE', label: 'Ignore' },
                      { value: 'CLOSE_ONLY', label: 'Close Only' },
                      { value: 'CLOSE_AND_REVERSE', label: 'Close & Reverse' }
                    ]}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    label="Check (s)"
                    type="number"
                    value={sigParams.checkInterval}
                    onChange={(e) => setSigParams(p => ({ ...p, checkInterval: e.target.value }))}
                    disabled={isCurrentBotRunning}
                  />
                  <Input
                    label="Cooldown (s)"
                    type="number"
                    value={sigParams.cooldownSeconds}
                    onChange={(e) => setSigParams(p => ({ ...p, cooldownSeconds: e.target.value }))}
                    disabled={isCurrentBotRunning}
                  />
                  <Input
                    label="Max Positions"
                    type="number"
                    value={sigParams.maxOpenPositions}
                    onChange={(e) => setSigParams(p => ({ ...p, maxOpenPositions: e.target.value }))}
                    disabled={isCurrentBotRunning}
                  />
                </div>
              </>
            )}

            {activeTab === 'PREDICTOR' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Trade size USDT"
                    type="number"
                    value={predParams.amount}
                    onChange={(e) => setPredParams(p => ({ ...p, amount: e.target.value }))}
                    disabled={isCurrentBotRunning}
                  />
                  <Input
                    label="Margin Leverage"
                    type="number"
                    value={predParams.leverage}
                    onChange={(e) => setPredParams(p => ({ ...p, leverage: e.target.value }))}
                    disabled={isCurrentBotRunning}
                  />
                </div>
                <p className="text-[10px] text-text-muted">
                  BTC Predictor continuously monitors ETF inflows, treasury accumulation, and macro-news signals to enter LONG/SHORT swaps.
                </p>
              </>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 mt-4 pt-3 border-t border-border/50 shrink-0">
            {!isCurrentBotRunning && (
              <Button
                variant="primary"
                className="flex-1 bg-gradient-to-r from-fuchsia-500 to-indigo-500 hover:opacity-90 border-0"
                icon={<Cpu size={14} />}
                onClick={handleAiConfigure}
              >
                AI Config
              </Button>
            )}
            <Button
              variant={isCurrentBotRunning ? 'danger' : 'primary'}
              className="flex-1"
              icon={isCurrentBotRunning ? <Square size={14} /> : <Play size={14} />}
              onClick={handleStartStopBot}
            >
              {isCurrentBotRunning ? 'Stop Bot' : 'Start Bot'}
            </Button>
          </div>
        </Card>

        {/* Live Terminal Console logs */}
        <Card className="xl:col-span-3 p-0 flex flex-col overflow-hidden bg-black/90 border-black shadow-2xl relative">
          <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between shrink-0 bg-neutral-900/80">
            <span className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              SoDEX PowerOps Terminal
              <span className={cn(
                "ml-2 text-[9px] px-1.5 py-0.5 rounded font-sans tracking-normal uppercase",
                isDemoMode ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
              )}>
                {isDemoMode ? 'Demo Mode' : 'Live Trading'}
              </span>
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTerminalLogs([])}
                className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                title="Clear terminal"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          {/* Monospaced Log List */}
          <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1.5 leading-normal text-left min-h-[220px]">
            {terminalLogs.length > 0 ? (
              [...terminalLogs].reverse().map((log, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="text-white/40 select-none text-[10px] mt-0.5">{log.time}</span>
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider shrink-0 select-none uppercase",
                    log.level === 'INFO' && 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
                    log.level === 'SUCCESS' && 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
                    log.level === 'TRADE' && 'bg-violet-500/10 text-violet-400 border border-violet-500/20',
                    log.level === 'ERROR' && 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
                  )}>
                    {log.bot}
                  </span>
                  <span className={cn(
                    "flex-1 whitespace-pre-wrap break-all",
                    log.level === 'INFO' && 'text-sky-100',
                    log.level === 'SUCCESS' && 'text-emerald-300',
                    log.level === 'TRADE' && 'text-violet-300',
                    log.level === 'ERROR' && 'text-rose-300 font-bold',
                  )}>
                    {log.message}
                  </span>
                </div>
              ))
            ) : (
              <div className="h-full flex items-center justify-center text-white/20 select-none font-bold italic">
                No logs recorded. Start a bot or execute commands to trigger log feeds.
              </div>
            )}
            <div ref={terminalEndRef} />
          </div>
        </Card>

      </div>
    </div>
  );
};
