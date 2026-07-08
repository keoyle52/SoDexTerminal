import React, { useEffect, useState, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { Activity, Pause, Play, Trash2, XCircle, CheckCircle2, Loader2, Zap, AlertTriangle } from 'lucide-react';
import { fetchCopySessions, fetchSessionLog, fetchPendingTrades, stopCopySession, deleteCopySession, handlePendingAction } from '../../api/mirrorClient';

interface SessionSummary {
  id: string; userAccountId: string; sourceAccountId: string;
  network: string; status: 'active' | 'paused' | 'revoked'; createdAt: number;
}

interface LogRow {
  id: string; sessionId: string; sourceTradeJson: string;
  decisionJson: string; status: string; errorMessage: string | null; createdAt: number;
}

interface PendingTrade {
  id: string; sessionId: string; sourceTradeJson: string;
  aiAnalysisJson: string; status: string; createdAt: number;
}

export const MirrorDashboard: React.FC = () => {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [log, setLog] = useState<LogRow[]>([]);
  const [pendingTrades, setPendingTrades] = useState<PendingTrade[]>([]);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [sessRes, pendRes] = await Promise.all([fetchCopySessions(), fetchPendingTrades()]);
      setSessions(sessRes.sessions ?? []);
      setPendingTrades(Array.isArray(pendRes) ? pendRes : []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadData();
    const t = setInterval(loadData, 5000);
    return () => clearInterval(t);
  }, [loadData]);

  useEffect(() => {
    if (!activeId) return;
    const loadLog = async () => {
      try {
        const res = await fetchSessionLog(activeId);
        setLog(res.log ?? []);
      } catch { /* ignore */ }
    };
    loadLog();
    const t = setInterval(loadLog, 3000);
    return () => clearInterval(t);
  }, [activeId]);

  async function doAction(sessionId: string, action: 'pause' | 'resume' | 'revoke') {
    setLoadingAction(`${sessionId}-${action}`);
    await stopCopySession(sessionId, action);
    await loadData();
    setLoadingAction(null);
  }

  async function doDelete(sessionId: string) {
    if (!confirm('Delete this session and all its trade logs?')) return;
    setLoadingAction(`${sessionId}-delete`);
    await deleteCopySession(sessionId);
    setActiveId(null);
    await loadData();
    setLoadingAction(null);
  }

  async function doPendingAction(pendingTradeId: string, action: 'approve' | 'reject') {
    setLoadingAction(`pending-${pendingTradeId}`);
    await handlePendingAction(pendingTradeId, action);
    await loadData();
    if (activeId) {
      const res = await fetchSessionLog(activeId);
      setLog(res.log ?? []);
    }
    setLoadingAction(null);
  }

  const activeSession = sessions.find(s => s.id === activeId);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          <Activity size={20} className="text-primary" />
          Live Dashboard
        </h2>
        <p className="text-text-muted text-sm mt-1">Source wallet trades and your mirrored trades side by side.</p>
      </div>

      {/* Pending Approvals */}
      {pendingTrades.length > 0 && (
        <div className="rounded-2xl border border-warning/30 bg-surface p-5 space-y-4 shadow-lg shadow-warning/5">
          <div className="flex items-center gap-2 text-warning font-bold text-sm">
            <Zap size={14} />
            <span>AI Co-Pilot: Pending Trade Approvals</span>
            <span className="w-2 h-2 rounded-full bg-warning animate-ping" />
          </div>
          <div className="space-y-3">
            {pendingTrades.map(p => {
              let trade: any = {}, ai: any = {};
              try { trade = JSON.parse(p.sourceTradeJson); ai = JSON.parse(p.aiAnalysisJson); } catch {}
              return (
                <div key={p.id} className="flex flex-col md:flex-row md:items-center justify-between border border-border bg-surface-2 rounded-xl p-4 gap-4">
                  <div className="space-y-1">
                    <div className="font-mono text-sm text-text-primary">
                      <span className={trade.S === 'BUY' ? 'text-success font-bold' : 'text-danger font-bold'}>{trade.S}</span>{' '}
                      <span className="font-bold">{trade.s}</span>{' '}
                      <span className="text-text-muted">Qty: {ai.sizedQuantity ?? trade.q} @ {trade.p}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-bold',
                        ai.score > 60 ? 'bg-danger/10 text-danger' : ai.score > 30 ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success')}>
                        AI Risk: {ai.score}/100
                      </span>
                      <span className="text-xs text-text-muted italic">"{ai.reason}"</span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => doPendingAction(p.id, 'approve')} disabled={loadingAction === `pending-${p.id}`}
                      className="px-4 py-2 bg-success text-background font-bold text-xs rounded-lg hover:brightness-110 transition disabled:opacity-50 flex items-center gap-1">
                      <CheckCircle2 size={13} /> Approve
                    </button>
                    <button onClick={() => doPendingAction(p.id, 'reject')} disabled={loadingAction === `pending-${p.id}`}
                      className="px-4 py-2 border border-border text-text-muted font-bold text-xs rounded-lg hover:text-text-primary hover:bg-surface-2 transition disabled:opacity-50 flex items-center gap-1">
                      <XCircle size={13} /> Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-12 text-center">
          <div className="w-12 h-12 rounded-xl bg-surface-2 border border-border flex items-center justify-center mx-auto mb-4">
            <Activity size={20} className="text-text-muted" />
          </div>
          <p className="text-text-muted text-sm">No active copy-trading sessions yet.</p>
          <p className="text-text-muted text-xs mt-1">Start one from a wallet analysis report.</p>
        </div>
      ) : (
        <>
          {/* Session pills */}
          <div className="flex gap-2 flex-wrap">
            {sessions.map(s => (
              <button key={s.id} onClick={() => setActiveId(s.id)}
                className={cn('px-4 py-2.5 rounded-xl text-xs font-mono border transition-all',
                  activeId === s.id
                    ? 'border-primary text-primary bg-primary/5 font-bold shadow-sm shadow-primary/10'
                    : 'border-border text-text-muted hover:text-text-primary hover:border-border-hover')}>
                {s.sourceAccountId.slice(0, 8)}... · {s.network}
                <StatusDot status={s.status} />
              </button>
            ))}
          </div>

          {/* Session controls */}
          {activeSession && (
            <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 flex-wrap gap-3">
              <div className="font-mono text-sm text-text-muted">
                Session <span className="text-text-primary">{activeSession.id.slice(0, 8)}</span> · status:{' '}
                <span className={activeSession.status === 'active' ? 'text-success font-bold' : 'text-warning font-bold'}>{activeSession.status}</span>
              </div>
              <div className="flex gap-2">
                {activeSession.status === 'active' ? (
                  <button onClick={() => doAction(activeSession.id, 'pause')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-warning/50 text-warning text-xs font-semibold hover:bg-warning/10 transition">
                    <Pause size={12} /> Pause
                  </button>
                ) : activeSession.status === 'paused' ? (
                  <button onClick={() => doAction(activeSession.id, 'resume')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-success/50 text-success text-xs font-semibold hover:bg-success/10 transition">
                    <Play size={12} /> Resume
                  </button>
                ) : null}
                <button onClick={() => doAction(activeSession.id, 'revoke')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-danger/40 text-danger text-xs font-semibold hover:bg-danger/10 transition">
                  <XCircle size={12} /> Revoke
                </button>
                <button onClick={() => doDelete(activeSession.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-danger text-background text-xs font-bold hover:brightness-110 transition">
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </div>
          )}

          {/* Trade Ledger */}
          <div className="grid md:grid-cols-2 gap-4">
            <Ledger title="Source Wallet Trades" rows={log} side="source" />
            <Ledger title="Your Mirrored Trades" rows={log} side="mirror" />
          </div>
        </>
      )}
    </div>
  );
};

function StatusDot({ status }: { status: string }) {
  const c = status === 'active' ? 'bg-success' : status === 'paused' ? 'bg-warning' : 'bg-danger';
  return <span className={cn('inline-block w-1.5 h-1.5 rounded-full ml-2', c)} />;
}

function Ledger({ title, rows, side }: { title: string; rows: LogRow[]; side: 'source' | 'mirror' }) {
  return (
    <div className="rounded-2xl border border-border bg-surface overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <h3 className="font-bold text-sm text-text-primary">{title}</h3>
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
      </div>
      <div className="divide-y divide-border/40 max-h-[420px] overflow-y-auto">
        {rows.length === 0 && <p className="p-8 text-text-muted text-sm text-center">No trades yet.</p>}
        {rows.map(r => {
          let trade: any = {}, decision: any = {};
          try { trade = JSON.parse(r.sourceTradeJson); decision = JSON.parse(r.decisionJson); } catch {}
          return (
            <div key={r.id} className="px-5 py-3 font-mono text-xs flex items-center justify-between text-text-primary hover:bg-surface-2/50 transition-colors">
              <div>
                <span className={trade.S === 'BUY' ? 'text-success font-bold' : 'text-danger font-bold'}>{trade.S}</span>{' '}
                <span>{trade.s}</span> <span className="text-text-muted">@ {trade.p}</span>
              </div>
              {side === 'source' ? (
                <span className="text-text-muted">{trade.q}</span>
              ) : (
                <TradeStatusBadge status={r.status} qty={decision.sizedQuantity} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TradeStatusBadge({ status, qty }: { status: string; qty?: string }) {
  if (status === 'executed') return <span className="text-success font-bold">{qty} ✓</span>;
  if (status === 'rejected') return <span className="text-text-muted">Skipped ✕</span>;
  if (status === 'pending') return <span className="text-warning font-bold">Pending ⏰</span>;
  return <span className="text-danger">Error ⚠</span>;
}
