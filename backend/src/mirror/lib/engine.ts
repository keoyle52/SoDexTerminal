import { randomUUID } from 'crypto';
import { AccountTradeWatcher, type SodexAccountTrade } from './wsClient';
import { decryptSecret } from './secretBox';
import { evaluateCopyTrade, type AccountSnapshot, type CopyConfig } from './riskEngine';
import { store, type CopySessionRow } from './store';
import { OrderSide, OrderType, TimeInForce, PositionSide } from './enums';
import { signSodexAction, buildPerpsNewOrderParams, type SodexNetwork, type SodexDomainName } from './signer';
import { SoSoValueClient } from './sosoValueClient';
import { auditTradeWithAI } from './coPilot';
import * as sodex from './sodexClient';
import type { Hex } from 'viem';
import axios from 'axios';

const PERPS_ENDPOINTS = {
  mainnet: 'https://mainnet-gw.sodex.dev/api/v1/perps',
  testnet: 'https://testnet-gw.sodex.dev/api/v1/perps',
};

interface RunningWatcher {
  watcher: AccountTradeWatcher;
  sessionIds: Set<string>;
}

// Symbol registry cache
let symbolRegistry: Map<string, number> | null = null;
async function resolveSymbolId(symbolName: string, network: SodexNetwork): Promise<number> {
  if (!symbolRegistry) {
    symbolRegistry = new Map();
    try {
      const perpsBase = PERPS_ENDPOINTS[network];
      const res = await axios.get(`${perpsBase}/market/symbols`);
      const symbols = res.data?.data ?? [];
      for (const sym of symbols) {
        if (sym.symbol && sym.symbolID !== undefined) {
          symbolRegistry.set(sym.symbol, sym.symbolID);
        }
      }
    } catch { /* empty */ }
  }
  const id = symbolRegistry.get(symbolName);
  if (id !== undefined) return id;
  const normalized = symbolName.replace('-', '_').toUpperCase();
  for (const [k, v] of symbolRegistry.entries()) {
    if (k.replace('-', '_').toUpperCase() === normalized) return v;
  }
  throw new Error(`Symbol ID not found for: ${symbolName}`);
}

async function placePerpsOrder(args: {
  privateKey: Hex; accountID: number; symbolID: number;
  order: any; apiKeyName: string; network: SodexNetwork;
}) {
  const params = buildPerpsNewOrderParams({
    accountID: args.accountID, symbolID: args.symbolID, orders: [args.order],
  });

  const signed = await signSodexAction({
    privateKey: args.privateKey,
    domainName: 'futures' as SodexDomainName,
    network: args.network,
    actionType: 'newOrder',
    params,
  });

  const base = PERPS_ENDPOINTS[args.network];
  const res = await axios.post(`${base}/trade/orders`, signed.body, {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': args.apiKeyName,
      'X-API-Sign': signed.signature,
      'X-API-Nonce': String(signed.nonce),
    },
  });
  return res.data;
}

export class CopyEngineRunner {
  private watchers = new Map<string, RunningWatcher>();
  private sosoClient = new SoSoValueClient(process.env.SOSOVALUE_API_KEY);
  private accountSnapshots = new Map<string, { snapshot: AccountSnapshot; ts: number }>();
  private pollInterval: NodeJS.Timeout | null = null;

  private async getAccountSnapshotCached(userAccountId: number, network: SodexNetwork): Promise<AccountSnapshot> {
    const key = `${network}:${userAccountId}`;
    const now = Date.now();
    const entry = this.accountSnapshots.get(key);
    if (entry && now - entry.ts < 3000) return entry.snapshot;

    const balances = await sodex.getPerpsBalances(userAccountId, network);
    const snapshot = summarizeAccount(balances);
    this.accountSnapshots.set(key, { snapshot, ts: now });
    return snapshot;
  }

  /** Start polling for session changes every 10s */
  startPolling() {
    this.loadFromStore();
    this.pollInterval = setInterval(() => this.loadFromStore(), 10_000);
    console.log('[Mirror Engine] Started — polling for sessions every 10s');
  }

  stopPolling() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    for (const [, entry] of this.watchers) entry.watcher.stop();
    this.watchers.clear();
    console.log('[Mirror Engine] Stopped');
  }

  loadFromStore() {
    const active = store.getActiveSessions();
    const activeIds = new Set(active.map((s) => s.id));

    // Detach sessions that are no longer active
    for (const [key, entry] of this.watchers) {
      for (const sessionId of Array.from(entry.sessionIds)) {
        if (!activeIds.has(sessionId)) entry.sessionIds.delete(sessionId);
      }
      if (entry.sessionIds.size === 0) {
        entry.watcher.stop();
        this.watchers.delete(key);
      }
    }

    for (const session of active) this.attach(session);
  }

  attach(session: CopySessionRow) {
    const key = `${session.network}:${session.sourceAccountId}`;
    let entry = this.watchers.get(key);
    if (!entry) {
      const watcher = new AccountTradeWatcher(
        session.network,
        'perps',
        session.sourceAccountId,
        (trade) => this.onSourceTrade(key, trade),
        (status, detail) => console.log(`[Mirror watcher ${key}] ${status}`, detail ?? '')
      );
      entry = { watcher, sessionIds: new Set() };
      this.watchers.set(key, entry);
      watcher.start();
      console.log(`[Mirror Engine] Watching source wallet: ${session.sourceAccountId} on ${session.network}`);
    }
    entry.sessionIds.add(session.id);
  }

  detach(sessionId: string, session: CopySessionRow) {
    const key = `${session.network}:${session.sourceAccountId}`;
    const entry = this.watchers.get(key);
    if (!entry) return;
    entry.sessionIds.delete(sessionId);
    if (entry.sessionIds.size === 0) {
      entry.watcher.stop();
      this.watchers.delete(key);
    }
  }

  private async onSourceTrade(watcherKey: string, trade: SodexAccountTrade) {
    const entry = this.watchers.get(watcherKey);
    if (!entry) return;

    console.log(`[Mirror Engine] Source trade detected: ${trade.S} ${trade.s} @ ${trade.p} qty ${trade.q}`);

    for (const sessionId of entry.sessionIds) {
      const session = store.getSession(sessionId);
      if (!session || session.status !== 'active') continue;
      await this.tryMirror(session, trade);
    }
  }

  private async tryMirror(session: CopySessionRow, trade: SodexAccountTrade) {
    const config: CopyConfig = session.config;

    // Pull fresh account state
    let account: AccountSnapshot;
    try {
      account = await this.getAccountSnapshotCached(Number(session.userAccountId), session.network);
    } catch (err) {
      this.logResult(session.id, trade, { allow: false, reason: 'Failed to fetch account state' }, 'error', String(err));
      return;
    }

    const decision = evaluateCopyTrade(trade, config, account);
    if (!decision.allow) {
      this.logResult(session.id, trade, decision, 'rejected');
      return;
    }

    // AI Co-Pilot logic
    const coPilotMode = config.aiCoPilotMode ?? 'disabled';

    if (coPilotMode === 'auto' || coPilotMode === 'manual') {
      try {
        const aiAudit = await auditTradeWithAI(
          { symbol: trade.s, side: trade.S, price: Number(trade.p), quantity: Number(decision.sizedQuantity ?? trade.q) },
          this.sosoClient
        );

        if (coPilotMode === 'auto') {
          const threshold = config.aiRiskThreshold ?? 70;
          if (aiAudit.score > threshold) {
            this.logResult(session.id, trade,
              { allow: false, reason: `AI Co-Pilot rejected (Score: ${aiAudit.score} > ${threshold}). ${aiAudit.reason}` },
              'rejected');
            return;
          }
        } else if (coPilotMode === 'manual') {
          store.insertPendingTrade({
            sessionId: session.id,
            sourceTradeJson: JSON.stringify(trade),
            aiAnalysisJson: JSON.stringify({
              score: aiAudit.score, reason: aiAudit.reason,
              sizedQuantity: decision.sizedQuantity, stopPrice: decision.appliedStopLossPrice,
            }),
            status: 'pending',
          });
          this.logResult(session.id, trade,
            { allow: true, reason: `Manual approval pending. AI Score: ${aiAudit.score}` },
            'pending');
          return;
        }
      } catch (aiErr) {
        console.error('[Mirror Engine] AI Co-Pilot error, proceeding:', aiErr);
      }
    }

    // Execute the mirrored trade
    try {
      const privateKey = decryptSecret(session.agentPrivateKeyEnc) as Hex;
      const isBuy = trade.S === 'BUY';
      const symbolID = await resolveSymbolId(trade.s, session.network);

      await placePerpsOrder({
        privateKey,
        accountID: Number(session.userAccountId),
        symbolID,
        apiKeyName: session.agentApiKeyName,
        network: session.network,
        order: {
          clOrdID: `mirror-${randomUUID()}`,
          modifier: 0,
          side: isBuy ? OrderSide.BUY : OrderSide.SELL,
          type: OrderType.MARKET,
          timeInForce: TimeInForce.IOC,
          quantity: decision.sizedQuantity!,
          stopPrice: decision.appliedStopLossPrice,
          reduceOnly: false,
          positionSide: isBuy ? PositionSide.LONG : PositionSide.SHORT,
        },
      });

      console.log(`[Mirror Engine] ✓ Order placed: ${trade.S} ${trade.s} qty ${decision.sizedQuantity}`);
      this.logResult(session.id, trade, decision, 'executed');
    } catch (err) {
      console.error(`[Mirror Engine] ✕ Order failed:`, err);
      this.logResult(session.id, trade, decision, 'error', String(err));
    }
  }

  private logResult(
    sessionId: string, trade: SodexAccountTrade,
    decision: { allow: boolean; reason?: string; sizedQuantity?: string },
    status: 'executed' | 'rejected' | 'error' | 'pending',
    errorMessage?: string
  ) {
    store.logMirroredTrade(sessionId, {
      sessionId,
      sourceTradeJson: JSON.stringify(trade),
      decisionJson: JSON.stringify(decision),
      status,
      errorMessage: errorMessage ?? null,
    });
  }
}

function summarizeAccount(balances: any): AccountSnapshot {
  const vUsdcBalance = (balances?.balances || []).find((b: any) => b.coin === 'vUSDC' || b.coin === 'USDC');
  const equityUsd = vUsdcBalance ? Number(vUsdcBalance.total) : Number(balances?.totalEquityUsd ?? balances?.equity ?? 0);
  const todayRealizedPnlUsd = Number(balances?.todayRealizedPnl ?? 0);
  const openNotionalUsd = 0; // Simplified for now
  return { equityUsd, todayRealizedPnlUsd, openNotionalUsd };
}

// Singleton engine instance
export const copyEngine = new CopyEngineRunner();
