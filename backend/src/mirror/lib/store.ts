import { randomUUID } from 'crypto';
import { CopyConfig } from './riskEngine';

export interface CopySessionRow {
  id: string;
  userAccountId: string;
  sourceAccountId: string;
  config: CopyConfig;
  agentPrivateKeyEnc: string;
  agentApiKeyName: string;
  isDemoMode: boolean;
  status: 'active' | 'paused' | 'revoked';
  createdAt: number;
}

export interface MirroredTradeRow {
  id: string;
  sessionId: string;
  sourceTradeJson: string;
  decisionJson: string;
  status: 'executed' | 'rejected' | 'error' | 'pending';
  errorMessage: string | null;
  createdAt: number;
}

export interface PendingTradeRow {
  id: string;
  sessionId: string;
  sourceTradeJson: string;
  aiAnalysisJson: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
}

const sessions = new Map<string, CopySessionRow>();
const trades = new Map<string, MirroredTradeRow[]>();
const pending = new Map<string, PendingTradeRow>();

export const store = {
  insertSession(row: Omit<CopySessionRow, 'id' | 'createdAt'>): string {
    const id = randomUUID();
    sessions.set(id, { ...row, id, createdAt: Date.now() });
    trades.set(id, []);
    return id;
  },

  getSession(id: string) { return sessions.get(id) ?? null; },

  getAllSessions(): CopySessionRow[] { return Array.from(sessions.values()); },

  getActiveSessions(): CopySessionRow[] {
    return Array.from(sessions.values()).filter(s => s.status === 'active');
  },

  setSessionStatus(id: string, status: CopySessionRow['status']) {
    const s = sessions.get(id);
    if (s) s.status = status;
  },

  deleteSession(id: string) {
    sessions.delete(id);
    trades.delete(id);
    for (const [pid, pt] of pending) {
      if (pt.sessionId === id) pending.delete(pid);
    }
  },

  logMirroredTrade(sessionId: string, row: Omit<MirroredTradeRow, 'id' | 'createdAt'>) {
    const log = trades.get(sessionId) ?? [];
    log.push({ ...row, id: randomUUID(), createdAt: Date.now() });
    if (log.length > 500) log.splice(0, log.length - 500);
    trades.set(sessionId, log);
  },

  getTradeLog(sessionId: string, limit = 100): MirroredTradeRow[] {
    return (trades.get(sessionId) ?? []).slice(-limit);
  },

  insertPendingTrade(row: Omit<PendingTradeRow, 'id' | 'createdAt'>): string {
    const id = randomUUID();
    pending.set(id, { ...row, id, createdAt: Date.now() });
    return id;
  },

  getPendingTrades(): PendingTradeRow[] {
    return Array.from(pending.values()).filter(p => p.status === 'pending');
  },

  getPendingTrade(id: string) { return pending.get(id) ?? null; },

  setPendingTradeStatus(id: string, status: PendingTradeRow['status']) {
    const p = pending.get(id);
    if (p) p.status = status;
  },
};
