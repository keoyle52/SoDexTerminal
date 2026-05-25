import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';

let bot: TelegramBot | null = null;

const registeredChats = new Set<number>();

interface LinkedAccount {
  evmAddress: string;
  apiKeyName: string;
  isTestnet: boolean;
}
const chatAccounts = new Map<number, LinkedAccount>();

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

  bot.onText(/\/start/, (msg) => {
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
        '• /pnl — 24h P\\&L summary',
        '• /alerts — Toggle notification settings',
        '• /help — Show this message',
      ].join('\n'),
      { parse_mode: 'Markdown' },
    );
  });

  bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;
    const acct = chatAccounts.get(chatId);
    if (!acct) {
      bot!.sendMessage(chatId, '⚠️ No SoDEX account linked.\n\nVerify your Chat ID in *SoDEX Terminal → Telegram Integration* to link your account.', { parse_mode: 'Markdown' });
      return;
    }
    const base = acct.isTestnet
      ? 'https://testnet-gw.sodex.dev/api/v1/perps'
      : 'https://mainnet-gw.sodex.dev/api/v1/perps';
    try {
      const res = await axios.get(`${base}/accounts/${acct.evmAddress}/balances`, {
        headers: { 'X-API-Key': acct.apiKeyName },
        timeout: 8000,
      });
      const data = (res.data?.data ?? res.data ?? {}) as Record<string, unknown>;
      const balances: Array<Record<string, unknown>> = Array.isArray(data) ? data as Array<Record<string, unknown>> : ((data.balances ?? []) as Array<Record<string, unknown>>);
      const usdc = balances.find((b) => String(b.asset ?? b.symbol ?? '').toUpperCase().includes('USD'));
      const bal = usdc ? parseFloat(String(usdc.availableBalance ?? usdc.balance ?? 0)).toFixed(2) : '—';
      bot!.sendMessage(
        chatId,
        [
          `*Account Status* (${acct.isTestnet ? 'Testnet' : 'Mainnet'})`,
          '',
          `� Address: \`${acct.evmAddress.slice(0, 6)}…${acct.evmAddress.slice(-4)}\``,
          `💰 Available Balance: *$${bal} USDC*`,
          '',
          '_Open SoDEX Terminal to manage your bots._',
        ].join('\n'),
        { parse_mode: 'Markdown' },
      );
    } catch {
      bot!.sendMessage(chatId, '⚠️ Could not fetch account data from SoDEX. Try again shortly.');
    }
  });

  bot.onText(/\/pnl/, async (msg) => {
    const chatId = msg.chat.id;
    const acct = chatAccounts.get(chatId);
    if (!acct) {
      bot!.sendMessage(chatId, '⚠️ No SoDEX account linked.\n\nVerify your Chat ID in *SoDEX Terminal → Telegram Integration* first.', { parse_mode: 'Markdown' });
      return;
    }
    const base = acct.isTestnet
      ? 'https://testnet-gw.sodex.dev/api/v1/perps'
      : 'https://mainnet-gw.sodex.dev/api/v1/perps';
    try {
      const res = await axios.get(`${base}/accounts/${acct.evmAddress}/positions`, {
        headers: { 'X-API-Key': acct.apiKeyName },
        timeout: 8000,
      });
      const data = (res.data?.data ?? res.data ?? {}) as Record<string, unknown>;
      const positions: Array<Record<string, unknown>> = Array.isArray(data) ? data as Array<Record<string, unknown>> : ((data.positions ?? []) as Array<Record<string, unknown>>);
      const open = positions.filter((p) => parseFloat(String(p.size ?? p.quantity ?? 0)) !== 0);
      if (open.length === 0) {
        bot!.sendMessage(chatId, '📊 *P&L Report*\n\nNo open positions.', { parse_mode: 'Markdown' });
        return;
      }
      const lines = open.slice(0, 5).map((p) => {
        const sym = String(p.symbol ?? p.contractName ?? '?');
        const pnl = parseFloat(String(p.unrealisedPnl ?? p.unrealizedPnl ?? 0)).toFixed(2);
        const side = String(p.side ?? p.direction ?? '?').toUpperCase();
        const emoji = parseFloat(pnl) >= 0 ? '🟢' : '🔴';
        return `${emoji} ${sym} ${side}  PnL: *$${pnl}*`;
      });
      bot!.sendMessage(
        chatId,
        ['*Open Positions P&L:*', '', ...lines].join('\n'),
        { parse_mode: 'Markdown' },
      );
    } catch {
      bot!.sendMessage(chatId, '⚠️ Could not fetch positions from SoDEX. Try again shortly.');
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
