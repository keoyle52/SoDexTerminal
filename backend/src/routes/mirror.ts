import { Router, Request, Response } from 'express';
import { analyzeWallet } from '../mirror/lib/analyzeWallet';
import { store } from '../mirror/lib/store';
import { CopyConfig } from '../mirror/lib/riskEngine';
import * as sodex from '../mirror/lib/sodexClient';

export const mirrorRouter = Router();

/* ── Wallet Analysis ─────────────────────────────────── */

// POST /api/mirror/analyze
mirrorRouter.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { address, accountId, network = 'mainnet' } = req.body;
    const apiKey = (req.headers['x-gemini-api-key'] as string) || process.env.GEMINI_API_KEY || '';
    if (!address || !accountId) {
      res.status(400).json({ error: 'address and accountId required' });
      return;
    }

    const net = network as sodex.SodexNetwork;
    const [orders, trades, positions, spotOrders, spotTrades] = await Promise.all([
      sodex.getPerpsOrderHistory(accountId, net).catch(() => []),
      sodex.getPerpsUserTrades(accountId, net).catch(() => []),
      sodex.getPerpsPositionHistory(accountId, net).catch(() => []),
      sodex.getSpotOrderHistory(address, net).catch(() => []),
      sodex.getSpotUserTrades(address, net).catch(() => []),
    ]);

    const report = await analyzeWallet({
      orders, trades, positions, spotOrders, spotTrades,
      address, accountId, network, apiKey,
    });

    res.json({
      address, accountId, network, report,
      rawCounts: {
        orders: orders.length, trades: trades.length,
        positions: positions.length, spotOrders: spotOrders.length,
        spotTrades: spotTrades.length,
      },
      trades, spotTrades,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Analysis failed' });
  }
});

/* ── Wallet Resolution ───────────────────────────────── */

// GET /api/mirror/wallet/resolve
mirrorRouter.get('/wallet/resolve', async (req: Request, res: Response) => {
  try {
    const address = req.query.address as string;
    const network = (req.query.network as string) || 'mainnet';
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      res.status(400).json({ error: 'Invalid wallet address' });
      return;
    }
    const state = await sodex.getAccountState(address, network as sodex.SodexNetwork);
    const accountId = state?.data?.aid ?? 0;
    if (!accountId) {
      res.status(404).json({ error: 'No active SoDEX account found for this address' });
      return;
    }
    res.json({ accountId });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Failed to resolve wallet' });
  }
});

/* ── Copy-Trading Session CRUD ───────────────────────── */

// POST /api/mirror/copy/start
mirrorRouter.post('/copy/start', async (req: Request, res: Response) => {
  try {
    const { userAccountId, sourceAccountId, agentPrivateKey, agentApiKeyName, network, config } = req.body;
    if (!userAccountId || !sourceAccountId || !agentPrivateKey || !network) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }
    const sessionId = store.insertSession({
      userAccountId, sourceAccountId,
      config: config as CopyConfig,
      agentPrivateKeyEnc: agentPrivateKey,
      agentApiKeyName: agentApiKeyName ?? '',
      network, status: 'active',
    });
    res.json({ sessionId });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? 'Failed to start session' });
  }
});

// POST /api/mirror/copy/stop
mirrorRouter.post('/copy/stop', (req: Request, res: Response) => {
  const { sessionId, action } = req.body;
  const session = store.getSession(sessionId);
  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
  if (action === 'pause') store.setSessionStatus(sessionId, 'paused');
  else if (action === 'resume') store.setSessionStatus(sessionId, 'active');
  else if (action === 'revoke') store.setSessionStatus(sessionId, 'revoked');
  res.json({ ok: true });
});

// POST /api/mirror/copy/delete
mirrorRouter.post('/copy/delete', (req: Request, res: Response) => {
  const { sessionId } = req.body;
  if (!store.getSession(sessionId)) { res.status(404).json({ error: 'Session not found' }); return; }
  store.deleteSession(sessionId);
  res.json({ ok: true });
});

// GET /api/mirror/copy/sessions
mirrorRouter.get('/copy/sessions', (_req: Request, res: Response) => {
  const all = store.getAllSessions().map(s => ({
    id: s.id, userAccountId: s.userAccountId, sourceAccountId: s.sourceAccountId,
    network: s.network, status: s.status, createdAt: s.createdAt,
  }));
  res.json({ sessions: all });
});

// GET /api/mirror/copy/sessions/:id/log
mirrorRouter.get('/copy/sessions/:id/log', (req: Request, res: Response) => {
  const log = store.getTradeLog(req.params.id as string);
  res.json({ log });
});

// GET /api/mirror/copy/pending
mirrorRouter.get('/copy/pending', (_req: Request, res: Response) => {
  res.json(store.getPendingTrades());
});

// POST /api/mirror/copy/pending/action
mirrorRouter.post('/copy/pending/action', (req: Request, res: Response) => {
  const { pendingTradeId, action } = req.body;
  const pt = store.getPendingTrade(pendingTradeId);
  if (!pt) { res.status(404).json({ error: 'Pending trade not found' }); return; }

  if (action === 'reject') {
    store.setPendingTradeStatus(pendingTradeId, 'rejected');
    store.logMirroredTrade(pt.sessionId, {
      sessionId: pt.sessionId, sourceTradeJson: pt.sourceTradeJson,
      decisionJson: JSON.stringify({ reason: 'Manually rejected', sizedQuantity: '0' }),
      status: 'rejected', errorMessage: null,
    });
    res.json({ ok: true });
    return;
  }

  if (action === 'approve') {
    store.setPendingTradeStatus(pendingTradeId, 'approved');
    const ai = JSON.parse(pt.aiAnalysisJson);
    store.logMirroredTrade(pt.sessionId, {
      sessionId: pt.sessionId, sourceTradeJson: pt.sourceTradeJson,
      decisionJson: JSON.stringify({ reason: 'Approved by user', sizedQuantity: ai.sizedQuantity ?? '0' }),
      status: 'executed', errorMessage: null,
    });
    res.json({ ok: true });
    return;
  }

  res.status(400).json({ error: 'Invalid action' });
});
