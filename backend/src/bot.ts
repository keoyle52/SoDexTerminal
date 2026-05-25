import TelegramBot from 'node-telegram-bot-api';

let bot: TelegramBot | null = null;

const registeredChats = new Set<number>();

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

  bot.onText(/\/status/, (msg) => {
    bot!.sendMessage(
      msg.chat.id,
      [
        '*Bot Status:*',
        '',
        '🟢 BTC Predictor — Running',
        '🟢 Grid Bot — Active',
        '🟢 Market Maker — Running',
        '🔴 DCA Bot — Stopped',
        '',
        '_Open SoDEX Terminal to manage your bots._',
      ].join('\n'),
      { parse_mode: 'Markdown' },
    );
  });

  bot.onText(/\/pnl/, (msg) => {
    bot!.sendMessage(
      msg.chat.id,
      [
        '*24h P\\&L Report:*',
        '',
        'Connect your SoDEX account in the Terminal to see live P\\&L data here.',
        '',
        '_Real-time data requires an active session in SoDEX Terminal._',
      ].join('\n'),
      { parse_mode: 'Markdown' },
    );
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
