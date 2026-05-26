import { Router, Request, Response } from 'express';
import { getBot, isRegistered, registerChat, linkAccount, getBotStates, updateBotState } from '../bot';

const router = Router();

// POST /api/telegram/notify
// Body: { chatId: string|number, text: string }
// Sends a message to the given chat ID using our shared bot.
router.post('/notify', async (req: Request, res: Response) => {
  const { chatId, text } = req.body as { chatId?: string | number; text?: string };

  if (!chatId || !text) {
    res.status(400).json({ error: 'chatId and text are required' });
    return;
  }

  const bot = getBot();
  if (!bot) {
    res.status(503).json({ error: 'Telegram bot is not running (check TELEGRAM_BOT_TOKEN)' });
    return;
  }

  const numericId = Number(chatId);
  if (!Number.isFinite(numericId)) {
    res.status(400).json({ error: 'chatId must be a numeric value' });
    return;
  }

  try {
    await bot.sendMessage(numericId, text, { parse_mode: 'Markdown' });
    registerChat(numericId);
    res.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[telegram/notify]', msg);
    res.status(502).json({ error: msg });
  }
});

// POST /api/telegram/verify
// Body: { chatId, evmAddress?, apiKeyName?, isTestnet? }
// Verifies the user has started our bot and links their SoDEX account.
router.post('/verify', async (req: Request, res: Response) => {
  const { chatId, evmAddress, apiKeyName, isTestnet } = req.body as {
    chatId?: string | number;
    evmAddress?: string;
    apiKeyName?: string;
    isTestnet?: boolean;
  };

  if (!chatId) {
    res.status(400).json({ error: 'chatId is required' });
    return;
  }

  const numericId = Number(chatId);
  if (!Number.isFinite(numericId)) {
    res.status(400).json({ error: 'chatId must be a numeric value' });
    return;
  }

  if (isRegistered(numericId)) {
    res.json({ ok: true, registered: true });
    return;
  }

  const bot = getBot();
  if (!bot) {
    res.status(503).json({ error: 'Telegram bot is not running' });
    return;
  }

  try {
    await bot.sendMessage(
      numericId,
      '✅ *SoDEX Terminal connected!*\n\nReal-time alerts are now active. Your trading notifications will arrive here.',
      { parse_mode: 'Markdown' },
    );
    registerChat(numericId);
    if (evmAddress && apiKeyName) {
      linkAccount(numericId, {
        evmAddress,
        apiKeyName,
        isTestnet: isTestnet ?? false,
      });
    }
    res.json({ ok: true, registered: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.json({
      ok: false,
      registered: false,
      reason: 'Could not reach that Chat ID. Make sure you sent /start to our bot first.',
      detail: msg,
    });
  }
});

// GET /api/telegram/status
// Query: ?chatId=...
// Returns registration link status and bot running states.
router.get('/status', (req: Request, res: Response) => {
  const { chatId } = req.query;

  if (!chatId) {
    res.status(400).json({ error: 'chatId is required' });
    return;
  }

  const numericId = Number(chatId);
  if (!Number.isFinite(numericId)) {
    res.status(400).json({ error: 'chatId must be a numeric value' });
    return;
  }

  res.json({
    ok: true,
    registered: isRegistered(numericId),
    botStates: getBotStates(numericId)
  });
});

// POST /api/telegram/states
// Body: { chatId, botStates: { grid?, mm?, signal?, predictor? } }
// Updates running bot states on the backend.
router.post('/states', (req: Request, res: Response) => {
  const { chatId, botStates } = req.body as {
    chatId?: string | number;
    botStates?: {
      grid?: 'RUNNING' | 'STOPPED';
      mm?: 'RUNNING' | 'STOPPED';
      signal?: 'RUNNING' | 'STOPPED';
      predictor?: 'RUNNING' | 'STOPPED';
    };
  };

  if (!chatId || !botStates) {
    res.status(400).json({ error: 'chatId and botStates are required' });
    return;
  }

  const numericId = Number(chatId);
  if (!Number.isFinite(numericId)) {
    res.status(400).json({ error: 'chatId must be a numeric value' });
    return;
  }

  if (botStates.grid) updateBotState(numericId, 'grid', botStates.grid);
  if (botStates.mm) updateBotState(numericId, 'mm', botStates.mm);
  if (botStates.signal) updateBotState(numericId, 'signal', botStates.signal);
  if (botStates.predictor) updateBotState(numericId, 'predictor', botStates.predictor);

  res.json({ ok: true });
});

// POST /api/telegram/disconnect
// Body: { chatId }
// Unregisters the chat ID and unlinks the account.
router.post('/disconnect', async (req: Request, res: Response) => {
  const { chatId } = req.body as { chatId?: string | number };

  if (!chatId) {
    res.status(400).json({ error: 'chatId is required' });
    return;
  }

  const numericId = Number(chatId);
  if (!Number.isFinite(numericId)) {
    res.status(400).json({ error: 'chatId must be a numeric value' });
    return;
  }

  try {
    const { unregisterChat } = require('../bot');
    unregisterChat(numericId);
    
    const bot = getBot();
    if (bot) {
      await bot.sendMessage(
        numericId,
        '🔌 *SoDEX Terminal disconnected!*\n\nYour account has been unlinked from this Telegram chat by the website.',
        { parse_mode: 'Markdown' }
      ).catch(() => {});
    }

    res.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: msg });
  }
});

export { router as telegramRouter };
