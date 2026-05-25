import { Router, Request, Response } from 'express';
import { getBot, isRegistered, registerChat, linkAccount } from '../bot';

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

export { router as telegramRouter };
