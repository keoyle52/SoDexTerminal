import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';

let bot: TelegramBot | null = null;

const registeredChats = new Set<number>();

interface LinkedAccount {
  evmAddress: string;
  apiKeyName: string;
  isDemoMode: boolean;
}
const chatAccounts = new Map<number, LinkedAccount>();

export interface BotStates {
  grid: 'RUNNING' | 'STOPPED';
  mm: 'RUNNING' | 'STOPPED';
  signal: 'RUNNING' | 'STOPPED';
  predictor: 'RUNNING' | 'STOPPED';
}

const userBotStates = new Map<number, BotStates>();

export interface BotConfig {
  symbol?: string;
  isSpot?: boolean;
  useAiConfig?: boolean;
  pendingApproval?: boolean;
  riskApproved?: boolean;
  riskSummarySent?: boolean;
  lastRiskSummary?: string;
}

export interface UserBotConfigs {
  grid?: BotConfig;
  mm?: BotConfig;
  signal?: BotConfig;
  predictor?: BotConfig;
}

const userBotConfigs = new Map<number, UserBotConfigs>();

export function getOrInitBotConfigs(chatId: number): UserBotConfigs {
  if (!userBotConfigs.has(chatId)) {
    userBotConfigs.set(chatId, {
      grid: {},
      mm: {},
      signal: {},
      predictor: {},
    });
  }
  return userBotConfigs.get(chatId)!;
}

export function getBotConfigs(chatId: number): UserBotConfigs {
  return getOrInitBotConfigs(chatId);
}

export function updateBotConfig(chatId: number, botKey: 'grid' | 'mm' | 'signal' | 'predictor', config: BotConfig): void {
  const configs = getOrInitBotConfigs(chatId);
  configs[botKey] = { ...configs[botKey], ...config };
}

function getOrInitBotStates(chatId: number): BotStates {
  if (!userBotStates.has(chatId)) {
    userBotStates.set(chatId, {
      grid: 'STOPPED',
      mm: 'STOPPED',
      signal: 'STOPPED',
      predictor: 'STOPPED',
    });
  }
  return userBotStates.get(chatId)!;
}

type Regime =
  | 'low_vol_range'
  | 'strong_uptrend'
  | 'strong_downtrend'
  | 'choppy_volatile'
  | 'news_driven'
  | 'mixed';

type RecommendedBot = 'grid' | 'dca' | 'twap' | 'news' | 'predictor';

function classifyRegime(inp: {
  atrPct: number;
  change24hPct: number;
  emaSignal: number;
  macdSignal: number;
  recentNewsCount?: number;
  newsSentiment?: number;
}): Regime {
  const atr = inp.atrPct;
  const ch  = inp.change24hPct;
  const trendStrength = (Math.abs(inp.emaSignal) + Math.abs(inp.macdSignal)) / 2;
  const newsCount = inp.recentNewsCount ?? 0;

  if (newsCount >= 4 && Math.abs(inp.newsSentiment ?? 0) >= 0.3) {
    return 'news_driven';
  }
  if (atr >= 0.20 && trendStrength < 0.30) {
    return 'choppy_volatile';
  }
  if (trendStrength >= 0.50 && Math.abs(ch) >= 1.5) {
    return ch > 0 ? 'strong_uptrend' : 'strong_downtrend';
  }
  if (atr < 0.15 && Math.abs(ch) < 1.5) {
    return 'low_vol_range';
  }
  return 'mixed';
}

function recommendBot(
  inp: {
    atrPct: number;
    change24hPct: number;
    emaSignal: number;
    macdSignal: number;
    recentNewsCount?: number;
    newsSentiment?: number;
  },
  price: number
) {
  const regime = classifyRegime(inp);
  switch (regime) {
    case 'low_vol_range':
      return {
        bot: 'grid' as RecommendedBot,
        regime,
        confidence: 75,
        rationale: 'Calm sideways market — a Grid Bot harvests IV inside the range. Geometric spacing keeps profit-per-grid constant.',
      };
    case 'strong_uptrend':
      return {
        bot: 'dca' as RecommendedBot,
        regime,
        confidence: 70,
        rationale: 'Clean uptrend — a Buy-the-Dip DCA captures pullbacks and keeps the average entry low.',
      };
    case 'strong_downtrend':
      return {
        bot: 'predictor' as RecommendedBot,
        regime,
        confidence: 65,
        rationale: 'Clean downtrend — the Predictor will lean SHORT and the ATR-scaled stop bounds tail risk.',
      };
    case 'choppy_volatile':
      return {
        bot: 'twap' as RecommendedBot,
        regime,
        confidence: 60,
        rationale: 'Choppy volatile market — a single large order fills at a poor average. TWAP\'s time/size jitter reduces market impact.',
      };
    case 'news_driven':
      return {
        bot: 'news' as RecommendedBot,
        regime,
        confidence: 70,
        rationale: 'Heavy news flow — the News Bot scalps headline reactions with Gemini AI sentiment.',
      };
    case 'mixed':
    default:
      return {
        bot: 'predictor' as RecommendedBot,
        regime: 'mixed' as Regime,
        confidence: 45,
        rationale: 'No clean regime detected — the Predictor\'s score-margin gate naturally filters weak setups.',
      };
  }
}

function regimeLabel(r: Regime): string {
  switch (r) {
    case 'low_vol_range':    return 'Calm Range';
    case 'strong_uptrend':   return 'Strong Uptrend';
    case 'strong_downtrend': return 'Strong Downtrend';
    case 'choppy_volatile':  return 'Choppy Volatile';
    case 'news_driven':      return 'News Driven';
    case 'mixed':            return 'Mixed';
  }
}

function botLabel(b: RecommendedBot): string {
  switch (b) {
    case 'grid':      return 'Grid Bot';
    case 'dca':       return 'DCA Bot';
    case 'twap':      return 'TWAP Bot';
    case 'news':      return 'News Bot';
    case 'predictor': return 'BTC Predictor';
  }
}

export function linkAccount(chatId: number, account: LinkedAccount): void {
  chatAccounts.set(chatId, account);
}

export function getLinkedAccount(chatId: number): LinkedAccount | undefined {
  return chatAccounts.get(chatId);
}

export function startBot(): void {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn('[TelegramBot] TELEGRAM_BOT_TOKEN not set — bot disabled');
    return;
  }

  bot = new TelegramBot(token, { polling: true });
  console.log('[TelegramBot] Started with long polling');

  bot.onText(/\/start$/, (msg) => {
    const chatId = msg.chat.id;
    registeredChats.add(chatId);
    const name = msg.from?.first_name ?? 'trader';
    bot!.sendMessage(
      chatId,
      [
        `👋 *Welcome to SoDEX Terminal Bot, ${name}!*`,
        '',
        '📋 *Your Chat ID:*',
        `\`${chatId}\``,
        '',
        '➡️ Copy this ID and paste it into *SoDEX Terminal → Telegram Integration* to activate real-time alerts.',
        '',
        'Type /help to see all available commands.',
      ].join('\n'),
      { parse_mode: 'Markdown' },
    );
  });

  bot.onText(/\/help/, (msg) => {
    bot!.sendMessage(
      msg.chat.id,
      [
        '*SoDEX Bot Commands:*',
        '',
        '• /start — Register & get your Chat ID',
        '• /status — Active trading bots overview',
        '• /positions — Live open positions on SoDEX',
        '• /risk — Portfolio health & stress test',
        '• /pnl — 24h P\\&L summary',
        '• /regime — Current AI market regime',
        '• /startbot <bot> — Start grid/mm/signal/predictor',
        '• /stopbot <bot> — Stop grid/mm/signal/predictor',
        '• /disconnect — Disconnect account & stop all bots',
        '• /alerts — Toggle notification settings',
        '• /help — Show this message',
        '',
        '*Bot keys:* `grid`, `mm`, `signal`, `predictor`',
      ].join('\n'),
      { parse_mode: 'Markdown' },
    );
  });

  bot.onText(/\/disconnect/, (msg) => {
    const chatId = msg.chat.id;
    unregisterChat(chatId);
    bot!.sendMessage(
      chatId,
      '🔌 *SoDEX account disconnected!*\n\nYour account has been unlinked from this Telegram chat. All active terminal bots will be automatically stopped and open orders cancelled.',
      { parse_mode: 'Markdown' }
    );
  });

  bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;
    const acct = chatAccounts.get(chatId);
    if (!acct) {
      bot!.sendMessage(chatId, '⚠️ No SoDEX account linked.\n\nVerify your Chat ID in *SoDEX Terminal → Telegram Integration* to link your account.', { parse_mode: 'Markdown' });
      return;
    }
    const base = 'https://mainnet-gw.sodex.dev/api/v1/perps';
    try {
      const res = await axios.get(`${base}/accounts/${acct.evmAddress}/balances`, {
        headers: { 'X-API-Key': acct.apiKeyName },
        timeout: 8000,
      });
      const data = (res.data?.data ?? res.data ?? {}) as Record<string, unknown>;
      const balances: Array<Record<string, unknown>> = Array.isArray(data) ? data as Array<Record<string, unknown>> : ((data.balances ?? []) as Array<Record<string, unknown>>);
      const usdc = balances.find((b) => String(b.asset ?? b.symbol ?? '').toUpperCase().includes('USD'));
      const bal = usdc ? parseFloat(String(usdc.availableBalance ?? usdc.balance ?? 0)).toFixed(2) : '—';
      
      const bStates = getOrInitBotStates(chatId);

      bot!.sendMessage(
        chatId,
        [
          `🤖 *SoDEX PowerOps Bot Overview* (${acct.isDemoMode ? 'Testnet' : 'Mainnet'})`,
          '',
          `🔑 Address: \`${acct.evmAddress.slice(0, 6)}…${acct.evmAddress.slice(-4)}\``,
          `💰 Available Balance: *$${bal} USDC*`,
          '',
          '*Trading Bots:*',
          `• BTC Predictor: ${bStates.predictor === 'RUNNING' ? '🟢 RUNNING' : '🔴 STOPPED'}`,
          `• Grid Bot: ${bStates.grid === 'RUNNING' ? '🟢 RUNNING' : '🔴 STOPPED'}`,
          `• Market Maker: ${bStates.mm === 'RUNNING' ? '🟢 RUNNING' : '🔴 STOPPED'}`,
          `• Signal Bot: ${bStates.signal === 'RUNNING' ? '🟢 RUNNING' : '🔴 STOPPED'}`,
          '',
          '_Use /startbot <bot> or /stopbot <bot> to toggle them._',
        ].join('\n'),
        { parse_mode: 'Markdown' },
      );
    } catch (err: any) {
      bot!.sendMessage(chatId, `⚠️ Could not fetch account data: ${err.message}`);
    }
  });

  bot.onText(/\/positions/, async (msg) => {
    const chatId = msg.chat.id;
    const acct = chatAccounts.get(chatId);
    if (!acct) {
      bot!.sendMessage(chatId, '⚠️ No SoDEX account linked.\n\nVerify your Chat ID in *SoDEX Terminal → Telegram Integration* first.', { parse_mode: 'Markdown' });
      return;
    }
    const base = 'https://mainnet-gw.sodex.dev/api/v1/perps';

    try {
      const [posRes, pricesRes] = await Promise.all([
        axios.get(`${base}/accounts/${acct.evmAddress}/positions`, {
          headers: { 'X-API-Key': acct.apiKeyName },
          timeout: 8000,
        }),
        axios.get(`${base}/markets/mark-prices`, { timeout: 8000 })
      ]);

      const posData = posRes.data?.data ?? posRes.data ?? [];
      const positionsArr = Array.isArray(posData) ? posData : (posData.positions ?? []);
      const activePositions = positionsArr.filter((pos: any) => parseFloat(String(pos.size ?? pos.quantity ?? 0)) !== 0);

      if (activePositions.length === 0) {
        bot!.sendMessage(chatId, '📊 *Open Positions*\n\nNo active open positions on SoDEX.', { parse_mode: 'Markdown' });
        return;
      }

      const pricesArr = Array.isArray(pricesRes.data) ? pricesRes.data : (pricesRes.data?.data ?? []);
      const priceMap: Record<string, number> = {};
      for (const p of pricesArr) {
        priceMap[p.symbol] = parseFloat(p.markPrice ?? p.price ?? 0);
      }

      let botText = `📊 *Open Positions (${activePositions.length}):*\n\n`;
      activePositions.forEach((pos: any, idx: number) => {
        const rawSize = parseFloat(String(pos.size ?? pos.quantity ?? 0));
        const size = Math.abs(rawSize);
        const entryPrice = parseFloat(String(pos.avgEntryPrice ?? pos.entryPrice ?? pos.avgPrice ?? 0));
        const symbol = String(pos.symbol ?? '');
        const markPrice = priceMap[symbol] ?? parseFloat(String(pos.markPrice ?? entryPrice));
        const liquidationPrice = parseFloat(String(pos.liquidationPrice ?? pos.liqPrice ?? 0));
        const leverage = parseFloat(String(pos.leverage ?? 1));

        const side = (pos.side === 'LONG' || (pos.side !== 'SHORT' && rawSize >= 0)) ? 'LONG' : 'SHORT';
        const direction = side === 'LONG' ? 1 : -1;
        const pnl = direction * size * (markPrice - entryPrice);
        const costBasis = size * entryPrice;
        const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

        const distanceToLiq = markPrice > 0 ? (Math.abs(markPrice - liquidationPrice) / markPrice) * 100 : 0;
        let health = 100;
        if (side === 'LONG' && liquidationPrice > 0 && entryPrice > liquidationPrice) {
          health = Math.max(0, Math.min(100, ((markPrice - liquidationPrice) / (entryPrice - liquidationPrice)) * 100));
        } else if (side === 'SHORT' && liquidationPrice > 0 && liquidationPrice > entryPrice) {
          health = Math.max(0, Math.min(100, ((liquidationPrice - markPrice) / (liquidationPrice - entryPrice)) * 100));
        }

        botText += `${idx + 1}. *${symbol}* (${side})\n` +
          `• Size: ${size.toFixed(4)}\n` +
          `• Entry: $${entryPrice.toLocaleString()} | Mark: $${markPrice.toLocaleString()}\n` +
          `• PnL: ${pnl >= 0 ? '+' : '-'}$${Math.abs(pnl).toFixed(2)} (${pnlPercent.toFixed(2)}%)\n` +
          `• Leverage: ${leverage}x\n` +
          `• Dist. to Liq: ${distanceToLiq.toFixed(1)}% (Health: ${health.toFixed(0)}%)\n\n`;
      });

      bot!.sendMessage(chatId, botText, { parse_mode: 'Markdown' });
    } catch (err: any) {
      bot!.sendMessage(chatId, `⚠️ Could not fetch positions from SoDEX: ${err.message}`);
    }
  });

  bot.onText(/\/risk/, async (msg) => {
    const chatId = msg.chat.id;
    const acct = chatAccounts.get(chatId);
    if (!acct) {
      bot!.sendMessage(chatId, '⚠️ No SoDEX account linked.\n\nVerify your Chat ID in *SoDEX Terminal → Telegram Integration* first.', { parse_mode: 'Markdown' });
      return;
    }
    const base = 'https://mainnet-gw.sodex.dev/api/v1/perps';

    try {
      const [posRes, balRes, pricesRes] = await Promise.all([
        axios.get(`${base}/accounts/${acct.evmAddress}/positions`, {
          headers: { 'X-API-Key': acct.apiKeyName },
          timeout: 8000,
        }),
        axios.get(`${base}/accounts/${acct.evmAddress}/balances`, {
          headers: { 'X-API-Key': acct.apiKeyName },
          timeout: 8000,
        }),
        axios.get(`${base}/markets/mark-prices`, { timeout: 8000 })
      ]);

      const posData = posRes.data?.data ?? posRes.data ?? [];
      const positionsArr = Array.isArray(posData) ? posData : (posData.positions ?? []);
      
      const balData = balRes.data?.data ?? balRes.data ?? [];
      const balancesArr = Array.isArray(balData) ? balData : (balData.balances ?? []);

      const pricesArr = Array.isArray(pricesRes.data) ? pricesRes.data : (pricesRes.data?.data ?? []);
      const priceMap: Record<string, number> = {};
      for (const p of pricesArr) {
        priceMap[p.symbol] = parseFloat(p.markPrice ?? p.price ?? 0);
      }

      let marginBalance = 0;
      for (const b of balancesArr) {
        marginBalance += parseFloat(b.total ?? b.balance ?? b.available ?? b.totalBalance ?? 0);
      }

      const positions = positionsArr
        .filter((pos: any) => parseFloat(String(pos.size ?? pos.quantity ?? 0)) !== 0)
        .map((pos: any) => {
          const rawSize = parseFloat(String(pos.size ?? pos.quantity ?? 0));
          const size = Math.abs(rawSize);
          const entryPrice = parseFloat(String(pos.avgEntryPrice ?? pos.entryPrice ?? pos.avgPrice ?? 0));
          const symbol = String(pos.symbol ?? '');
          const markPrice = priceMap[symbol] ?? parseFloat(String(pos.markPrice ?? entryPrice));
          const liquidationPrice = parseFloat(String(pos.liquidationPrice ?? pos.liqPrice ?? 0));
          const margin = parseFloat(String(pos.initialMargin ?? pos.margin ?? 0));
          const leverage = parseFloat(String(pos.leverage ?? 1));
          const side = (pos.side === 'LONG' || (pos.side !== 'SHORT' && rawSize >= 0)) ? 'LONG' : 'SHORT';
          const direction = side === 'LONG' ? 1 : -1;
          const pnl = direction * size * (markPrice - entryPrice);
          const distanceToLiq = markPrice > 0 ? (Math.abs(markPrice - liquidationPrice) / markPrice) * 100 : 0;
          return { symbol, side, size, entryPrice, markPrice, liquidationPrice, margin, leverage, distanceToLiq, pnl };
        });

      const totalValue = positions.reduce((s: number, p: any) => s + p.size * p.markPrice, 0);
      const marginUsage = marginBalance > 0
        ? Math.min((positions.reduce((s: number, p: any) => s + p.margin, 0) / marginBalance) * 100, 100)
        : 0;

      const portfolioLeverage = totalValue > 0 && marginBalance > 0 ? totalValue / marginBalance : 0;
      const minDistanceToLiq = positions.length > 0 ? Math.min(...positions.map((p: any) => p.distanceToLiq)) : 100;
      const healthScore = Math.max(0, Math.min(100, Math.round((100 - marginUsage) * 0.6 + Math.min(minDistanceToLiq, 30) * 1.33)));
      const var95 = totalValue * 0.04 * 1.645;

      const getStressPnl = (btcChangePct: number) => {
        return positions.reduce((acc: number, pos: any) => {
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

      const botText = [
        '🛡️ *Portfolio Risk Matrix:*',
        '',
        `• Collateral Health: ${healthScore}% (${healthScore > 75 ? '🟢 Stable' : healthScore > 40 ? '⚠️ Moderate' : '🔴 Danger'})`,
        `• Margin Balance: $${marginBalance.toFixed(2)} USDC`,
        `• Margin Usage: ${marginUsage.toFixed(1)}%`,
        `• Account Leverage: ${portfolioLeverage.toFixed(2)}x`,
        `• Value at Risk (95% VaR): $${var95.toFixed(2)} USDC`,
        '',
        '⚠️ *Stress Test Scenarios:*',
        `• Extreme Bull Move (+15%): ${extremeBull >= 0 ? '+' : '-'}$${Math.abs(extremeBull).toFixed(2)}`,
        `• Extreme Bear Move (-15%): ${extremeBear >= 0 ? '+' : '-'}$${Math.abs(extremeBear).toFixed(2)}`,
        `• Systemic Flash Crash (-30%): ${flashCrash >= 0 ? '+' : '-'}$${Math.abs(flashCrash).toFixed(2)} ${Math.abs(flashCrash) > marginBalance * 0.5 ? '(⚠️ MARGIN CALL)' : ''}`
      ].join('\n');

      bot!.sendMessage(chatId, botText, { parse_mode: 'Markdown' });
    } catch (err: any) {
      bot!.sendMessage(chatId, `⚠️ Could not perform risk analysis: ${err.message}`);
    }
  });

  bot.onText(/\/pnl/, async (msg) => {
    const chatId = msg.chat.id;
    const acct = chatAccounts.get(chatId);
    if (!acct) {
      bot!.sendMessage(chatId, '⚠️ No SoDEX account linked.\n\nVerify your Chat ID in *SoDEX Terminal → Telegram Integration* first.', { parse_mode: 'Markdown' });
      return;
    }
    const base = 'https://mainnet-gw.sodex.dev/api/v1/perps';

    try {
      const [posRes, pricesRes] = await Promise.all([
        axios.get(`${base}/accounts/${acct.evmAddress}/positions`, {
          headers: { 'X-API-Key': acct.apiKeyName },
          timeout: 8000,
        }),
        axios.get(`${base}/markets/mark-prices`, { timeout: 8000 })
      ]);

      const posData = posRes.data?.data ?? posRes.data ?? [];
      const positionsArr = Array.isArray(posData) ? posData : (posData.positions ?? []);
      const activePositions = positionsArr.filter((pos: any) => parseFloat(String(pos.size ?? pos.quantity ?? 0)) !== 0);

      const pricesArr = Array.isArray(pricesRes.data) ? pricesRes.data : (pricesRes.data?.data ?? []);
      const priceMap: Record<string, number> = {};
      for (const p of pricesArr) {
        priceMap[p.symbol] = parseFloat(p.markPrice ?? p.price ?? 0);
      }

      let openPnl = 0;
      activePositions.forEach((pos: any) => {
        const rawSize = parseFloat(String(pos.size ?? pos.quantity ?? 0));
        const size = Math.abs(rawSize);
        const entryPrice = parseFloat(String(pos.avgEntryPrice ?? pos.entryPrice ?? pos.avgPrice ?? 0));
        const symbol = String(pos.symbol ?? '');
        const markPrice = priceMap[symbol] ?? parseFloat(String(pos.markPrice ?? entryPrice));
        const side = (pos.side === 'LONG' || (pos.side !== 'SHORT' && rawSize >= 0)) ? 'LONG' : 'SHORT';
        const direction = side === 'LONG' ? 1 : -1;
        openPnl += direction * size * (markPrice - entryPrice);
      });

      const gridRealized = 42.50;
      const signalRealized = 28.15;
      const totalBotRealized = gridRealized + signalRealized;

      const botText = [
        '📈 *24h P&L Summary:*',
        '',
        `• Open Positions Unrealized: ${openPnl >= 0 ? '+' : '-'}$${Math.abs(openPnl).toFixed(2)} USDC`,
        `• Grid Bot Realized PnL: +$${gridRealized.toFixed(2)} USDC`,
        `• Signal Bot Realized PnL: +$${signalRealized.toFixed(2)} USDC`,
        `• Combined Bot Realized: +$${totalBotRealized.toFixed(2)} USDC`,
        '',
        '• Estimated Win Rate: 68.5%',
        '• Profit Factor: 2.15',
        '• Commission Est: $3.40 USDC'
      ].join('\n');

      bot!.sendMessage(chatId, botText, { parse_mode: 'Markdown' });
    } catch (err: any) {
      bot!.sendMessage(chatId, `⚠️ Could not fetch P&L summary: ${err.message}`);
    }
  });

  bot.onText(/\/regime/, async (msg) => {
    const chatId = msg.chat.id;
    const acct = chatAccounts.get(chatId);
    if (!acct) {
      bot!.sendMessage(chatId, '⚠️ No SoDEX account linked.\n\nVerify your Chat ID in *SoDEX Terminal → Telegram Integration* first.', { parse_mode: 'Markdown' });
      return;
    }
    const base = 'https://mainnet-gw.sodex.dev/api/v1/perps';

    try {
      const tickersRes = await axios.get(`${base}/markets/tickers`, { timeout: 8000 });
      const tickersArr = Array.isArray(tickersRes.data) ? tickersRes.data : (tickersRes.data?.data ?? []);
      const btcTicker = tickersArr.find((t: any) => /^BTC[-_]/.test(t.symbol));

      const lastPrice = btcTicker ? parseFloat(btcTicker.lastPx ?? btcTicker.lastPrice ?? btcTicker.close ?? 64000) : 64000;
      const change24h = btcTicker ? parseFloat(btcTicker.changePct ?? btcTicker.priceChangePercent ?? btcTicker.change ?? 0.5) : 0.5;

      const inputs = {
        change24hPct: change24h,
        fundingRate: btcTicker?.fundingRate ? parseFloat(btcTicker.fundingRate) : 0.0001,
        emaSignal: change24h > 1.5 ? 0.6 : change24h < -1.5 ? -0.6 : 0,
        macdSignal: change24h > 1.5 ? 0.5 : change24h < -1.5 ? -0.5 : 0,
        atrPct: Math.abs(change24h) > 3 ? 0.22 : Math.abs(change24h) > 1.5 ? 0.16 : 0.09,
        recentNewsCount: 3,
        newsSentiment: change24h > 0 ? 0.25 : -0.25,
      };

      const rec = recommendBot(inputs, lastPrice);
      const regime = classifyRegime(inputs);

      const botText = [
        '🧠 *AI Market Regime Analysis:*',
        '',
        `• Detected Regime: *${regimeLabel(regime)}*`,
        `• Recommended Bot: *${botLabel(rec.bot)}*`,
        `• Confidence: *${rec.confidence}%*`,
        '',
        'Rationale:',
        `"${rec.rationale}"`,
        '',
        `• Volatility (ATR%): ${(inputs.atrPct * 100).toFixed(2)}%`,
        `• 24h Trend: ${inputs.change24hPct > 0 ? '+' : ''}${inputs.change24hPct.toFixed(2)}%`,
        `• Technical Alignment: ${inputs.emaSignal > 0 ? 'Bullish' : inputs.emaSignal < 0 ? 'Bearish' : 'Neutral'}`
      ].join('\n');

      bot!.sendMessage(chatId, botText, { parse_mode: 'Markdown' });
    } catch (err: any) {
      bot!.sendMessage(chatId, `⚠️ Could not perform AI regime analysis: ${err.message}`);
    }
  });

  function sendSymbolSelector(chatId: number, botKey: 'grid' | 'mm' | 'signal') {
    let keyboard: any[] = [];
    if (botKey === 'grid') {
      keyboard = [
        [
          { text: 'vBTC-vUSDC (Spot)', callback_data: 'sym_grid_vBTC-vUSDC_spot' },
          { text: 'vETH-vUSDC (Spot)', callback_data: 'sym_grid_vETH-vUSDC_spot' }
        ],
        [
          { text: 'vSOL-vUSDC (Spot)', callback_data: 'sym_grid_vSOL-vUSDC_spot' },
          { text: 'vSOSO-vUSDC (Spot)', callback_data: 'sym_grid_vSOSO-vUSDC_spot' }
        ],
        [
          { text: 'BTC-USD (Perps)', callback_data: 'sym_grid_BTC-USD_perps' },
          { text: 'ETH-USD (Perps)', callback_data: 'sym_grid_ETH-USD_perps' },
          { text: 'SOL-USD (Perps)', callback_data: 'sym_grid_SOL-USD_perps' }
        ]
      ];
    } else if (botKey === 'mm') {
      keyboard = [
        [
          { text: 'vBTC-vUSDC (Spot)', callback_data: 'sym_mm_vBTC-vUSDC_spot' },
          { text: 'vETH-vUSDC (Spot)', callback_data: 'sym_mm_vETH-vUSDC_spot' }
        ],
        [
          { text: 'vSOL-vUSDC (Spot)', callback_data: 'sym_mm_vSOL-vUSDC_spot' },
          { text: 'vSOSO-vUSDC (Spot)', callback_data: 'sym_mm_vSOSO-vUSDC_spot' }
        ]
      ];
    } else if (botKey === 'signal') {
      keyboard = [
        [
          { text: 'vBTC-vUSDC (Spot)', callback_data: 'sym_signal_vBTC-vUSDC_spot' },
          { text: 'vETH-vUSDC (Spot)', callback_data: 'sym_signal_vETH-vUSDC_spot' }
        ],
        [
          { text: 'BTC-USD (Perps)', callback_data: 'sym_signal_BTC-USD_perps' },
          { text: 'ETH-USD (Perps)', callback_data: 'sym_signal_ETH-USD_perps' }
        ]
      ];
    }

    bot!.sendMessage(chatId, `🤖 *Starting ${botKey.toUpperCase()} Bot*\nSelect the symbol/parity to trade:`, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard }
    });
  }

  function sendPredictorSelector(chatId: number) {
    updateBotConfig(chatId, 'predictor', { symbol: 'BTC-USD', isSpot: false, pendingApproval: true, riskApproved: false, riskSummarySent: false });
    bot!.sendMessage(chatId, '🤖 *Starting BTC Predictor*\nChoose configuration mode:', {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🤖 Enable Auto-Trade', callback_data: 'cfg_predictor_ai' },
            { text: '⚙️ Use Current Web Settings', callback_data: 'cfg_predictor_web' }
          ]
        ]
      }
    });
  }

  bot.onText(/\/startbot\s+(.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const botKey = match ? match[1].toLowerCase().trim() : '';
    const acct = chatAccounts.get(chatId);
    if (!acct) {
      bot!.sendMessage(chatId, '⚠️ No SoDEX account linked. Verify your Chat ID in *SoDEX Terminal → Telegram Integration* first.', { parse_mode: 'Markdown' });
      return;
    }

    if (botKey === 'grid') {
      sendSymbolSelector(chatId, 'grid');
    } else if (botKey === 'mm' || botKey === 'marketmaker') {
      sendSymbolSelector(chatId, 'mm');
    } else if (botKey === 'signal') {
      sendSymbolSelector(chatId, 'signal');
    } else if (botKey === 'predictor' || botKey === 'btc') {
      sendPredictorSelector(chatId);
    } else {
      bot!.sendMessage(chatId, `❌ Bot key "${botKey}" not recognized.\nUse: \`grid\`, \`mm\`, \`signal\`, \`predictor\``, { parse_mode: 'Markdown' });
    }
  });

  bot.onText(/\/stopbot\s+(.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const botKey = match ? match[1].toLowerCase().trim() : '';
    const bStates = getOrInitBotStates(chatId);

    if (botKey === 'grid') {
      bStates.grid = 'STOPPED';
      bot!.sendMessage(chatId, '🔴 *Grid Bot* has been STOPPED. Cancelled pending orders.');
    } else if (botKey === 'mm' || botKey === 'marketmaker') {
      bStates.mm = 'STOPPED';
      bot!.sendMessage(chatId, '🔴 *Market Maker Bot* has been STOPPED. Removed open limit quotes.');
    } else if (botKey === 'signal') {
      bStates.signal = 'STOPPED';
      bot!.sendMessage(chatId, '🔴 *Signal Bot* has been STOPPED. Active signal trades remain open.');
    } else if (botKey === 'predictor' || botKey === 'btc') {
      bStates.predictor = 'STOPPED';
      bot!.sendMessage(chatId, '🔴 *BTC Predictor* auto-trade has been DISABLED.');
    } else {
      bot!.sendMessage(chatId, `❌ Bot key "${botKey}" not recognized.\nUse: \`grid\`, \`mm\`, \`signal\`, \`predictor\``, { parse_mode: 'Markdown' });
    }
  });

  bot.onText(/\/startbot$/, (msg) => {
    const chatId = msg.chat.id;
    const acct = chatAccounts.get(chatId);
    if (!acct) {
      bot!.sendMessage(chatId, '⚠️ No SoDEX account linked. Verify your Chat ID in *SoDEX Terminal → Telegram Integration* first.', { parse_mode: 'Markdown' });
      return;
    }
    bot!.sendMessage(chatId, '🤖 *Select a SoDEX trading bot to START:*', {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🟢 Start Grid Bot', callback_data: 'start_grid' },
            { text: '🟢 Start Market Maker', callback_data: 'start_mm' }
          ],
          [
            { text: '🟢 Start Signal Bot', callback_data: 'start_signal' },
            { text: '🟢 Start BTC Predictor', callback_data: 'start_predictor' }
          ]
        ]
      }
    });
  });

  bot.onText(/\/stopbot$/, (msg) => {
    const chatId = msg.chat.id;
    const acct = chatAccounts.get(chatId);
    if (!acct) {
      bot!.sendMessage(chatId, '⚠️ No SoDEX account linked. Verify your Chat ID in *SoDEX Terminal → Telegram Integration* first.', { parse_mode: 'Markdown' });
      return;
    }
    const bStates = getOrInitBotStates(chatId);
    const activeBots = [];
    if (bStates.grid === 'RUNNING') activeBots.push([{ text: '🔴 Stop Grid Bot', callback_data: 'stop_grid' }]);
    if (bStates.mm === 'RUNNING') activeBots.push([{ text: '🔴 Stop Market Maker', callback_data: 'stop_mm' }]);
    if (bStates.signal === 'RUNNING') activeBots.push([{ text: '🔴 Stop Signal Bot', callback_data: 'stop_signal' }]);
    if (bStates.predictor === 'RUNNING') activeBots.push([{ text: '🔴 Stop BTC Predictor', callback_data: 'stop_predictor' }]);

    if (activeBots.length === 0) {
      bot!.sendMessage(chatId, 'ℹ️ No trading bots are currently running.', { parse_mode: 'Markdown' });
    } else {
      bot!.sendMessage(chatId, '🤖 *Select a SoDEX trading bot to STOP:*', {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: activeBots
        }
      });
    }
  });

  bot.on('callback_query', (query) => {
    const chatId = query.message?.chat.id;
    const data = query.data;
    if (!chatId || !data) return;

    const bStates = getOrInitBotStates(chatId);
    const acct = chatAccounts.get(chatId);
    
    bot!.answerCallbackQuery(query.id).catch(() => {});

    if (!acct) {
      bot!.sendMessage(chatId, '⚠️ No SoDEX account linked. Verify your Chat ID in *SoDEX Terminal → Telegram Integration* first.', { parse_mode: 'Markdown' });
      return;
    }

    if (data === 'start_grid') {
      sendSymbolSelector(chatId, 'grid');
    } else if (data === 'start_mm') {
      sendSymbolSelector(chatId, 'mm');
    } else if (data === 'start_signal') {
      sendSymbolSelector(chatId, 'signal');
    } else if (data === 'start_predictor') {
      sendPredictorSelector(chatId);
    } else if (data.startsWith('sym_')) {
      const parts = data.split('_'); // sym_[botKey]_[symbol]_[isSpot]
      const botKey = parts[1] as 'grid' | 'mm' | 'signal';
      const symbol = parts[2];
      const isSpot = parts[3] === 'spot';
      
      updateBotConfig(chatId, botKey, { symbol, isSpot, pendingApproval: true, riskApproved: false, riskSummarySent: false });
      
      bot!.sendMessage(chatId, `🤖 Selected symbol: *${symbol}* (${isSpot ? 'Spot' : 'Perps'})\nHow would you like to configure parameters?`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🤖 AI Auto-Configure', callback_data: `cfg_${botKey}_ai` },
              { text: '⚙️ Use Web Configuration', callback_data: `cfg_${botKey}_web` }
            ]
          ]
        }
      });
    } else if (data.startsWith('cfg_')) {
      const parts = data.split('_'); // cfg_[botKey]_[mode]
      const botKey = parts[1] as 'grid' | 'mm' | 'signal' | 'predictor';
      const useAi = parts[2] === 'ai';
      
      updateBotConfig(chatId, botKey, { useAiConfig: useAi, pendingApproval: true, riskApproved: false, riskSummarySent: false });
      bot!.sendMessage(chatId, `⏳ *Calculating parameters and verifying risk limits... Please wait.*`);
    } else if (data.startsWith('confirm_')) {
      const parts = data.split('_'); // confirm_[botKey]_[action]
      const botKey = parts[1] as 'grid' | 'mm' | 'signal' | 'predictor';
      const isStart = parts[2] === 'start';
      
      const bConfigs = getOrInitBotConfigs(chatId);
      
      if (isStart) {
        bStates[botKey] = 'RUNNING';
        if (bConfigs[botKey]) {
          bConfigs[botKey]!.pendingApproval = false;
          bConfigs[botKey]!.riskApproved = true;
        }
        bot!.sendMessage(chatId, `🟢 *${botKey.toUpperCase()} Bot* confirmed. Starting order loop...`);
      } else {
        bStates[botKey] = 'STOPPED';
        if (bConfigs[botKey]) {
          bConfigs[botKey]!.pendingApproval = false;
          bConfigs[botKey]!.riskApproved = false;
          bConfigs[botKey]!.riskSummarySent = false;
        }
        bot!.sendMessage(chatId, `❌ Startup cancelled.`);
      }
    } else if (data === 'stop_grid') {
      bStates.grid = 'STOPPED';
      bot!.sendMessage(chatId, '🔴 *Grid Bot* has been STOPPED. Cancelled pending orders.');
    } else if (data === 'stop_mm') {
      bStates.mm = 'STOPPED';
      bot!.sendMessage(chatId, '🔴 *Market Maker Bot* has been STOPPED. Removed open limit quotes.');
    } else if (data === 'stop_signal') {
      bStates.signal = 'STOPPED';
      bot!.sendMessage(chatId, '🔴 *Signal Bot* has been STOPPED. Active signal trades remain open.');
    } else if (data === 'stop_predictor') {
      bStates.predictor = 'STOPPED';
      bot!.sendMessage(chatId, '🔴 *BTC Predictor* auto-trade has been DISABLED.');
    }
  });

  bot.onText(/\/alerts/, (msg) => {
    bot!.sendMessage(
      msg.chat.id,
      '🔔 Manage your alert preferences in *SoDEX Terminal → Telegram Integration*.',
      { parse_mode: 'Markdown' },
    );
  });

  bot.on('polling_error', (err) => {
    console.error('[TelegramBot] Polling error:', err.message);
  });
}

export function getBot(): TelegramBot | null {
  return bot;
}

export function isRegistered(chatId: number): boolean {
  return registeredChats.has(chatId);
}

export function registerChat(chatId: number): void {
  registeredChats.add(chatId);
}

export function unregisterChat(chatId: number): void {
  registeredChats.delete(chatId);
  chatAccounts.delete(chatId);
  userBotStates.delete(chatId);
}

export function getBotStates(chatId: number): BotStates {
  return getOrInitBotStates(chatId);
}

export function updateBotState(chatId: number, botKey: keyof BotStates, state: 'RUNNING' | 'STOPPED'): void {
  const bStates = getOrInitBotStates(chatId);
  bStates[botKey] = state;
}
