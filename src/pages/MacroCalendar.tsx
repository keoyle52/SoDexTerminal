import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, RefreshCw, AlertTriangle, Flame, Activity } from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { fetchMacroEvents, classifyMacroImpact, type MacroEvent, type MacroImpact } from '../api/sosoExtraServices';
import { useSettingsStore } from '../store/settingsStore';
import { cn } from '../lib/utils';

const IMPACT_STYLES: Record<MacroImpact, { badge: string; cell: string; label: string; icon: typeof Flame }> = {
  High:   { badge: 'bg-red-500/15 text-red-400 border-red-500/30',         cell: 'bg-red-500/5',     label: 'High',   icon: Flame },
  Medium: { badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',   cell: 'bg-amber-500/5',   label: 'Medium', icon: Activity },
  Low:    { badge: 'bg-sky-500/15 text-sky-300 border-sky-500/30',         cell: 'bg-sky-500/5',     label: 'Low',    icon: Activity },
};

/**
 * Render an entire month grid with macro events plotted into the
 * appropriate weekdays. Events ordered by impact tier so the highest
 * priority sits on top of each cell.
 */
function buildMonthCells(year: number, month: number): { date: Date; iso: string }[] {
  const first = new Date(year, month, 1);
  const startOffset = first.getDay(); // 0=Sun
  const cells: { date: Date; iso: string }[] = [];
  // Pad days from the previous month so weeks line up.
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    cells.push({ date: d, iso: d.toISOString().slice(0, 10) });
  }
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(year, month, i);
    cells.push({ date: d, iso: d.toISOString().slice(0, 10) });
  }
  // Pad to 6 rows × 7 cols = 42 cells so the grid stays aligned.
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    const d = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
    cells.push({ date: d, iso: d.toISOString().slice(0, 10) });
  }
  while (cells.length < 42) {
    const last = cells[cells.length - 1].date;
    const d = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
    cells.push({ date: d, iso: d.toISOString().slice(0, 10) });
  }
  return cells;
}

export const MacroCalendar: React.FC = () => {
  const { isDemoMode, sosoApiKey } = useSettingsStore();
  const [events, setEvents] = useState<MacroEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  // Anchor month — defaults to today.
  const [anchor, setAnchor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const refresh = async () => {
    setLoading(true);
    setErrMsg(null);
    try {
      const data = await fetchMacroEvents(60); // 2-month horizon
      setEvents(data);
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Failed to load macro events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [isDemoMode, sosoApiKey]);

  // Index events by date for O(1) cell lookup.
  const eventsByDate = useMemo(() => {
    const m = new Map<string, MacroEvent>();
    for (const e of events) m.set(e.date, e);
    return m;
  }, [events]);

  const monthCells = useMemo(
    () => buildMonthCells(anchor.year, anchor.month),
    [anchor.year, anchor.month],
  );

  const monthName = new Date(anchor.year, anchor.month, 1).toLocaleString(undefined, {
    month: 'long', year: 'numeric',
  });

  // Lazy-initialised cutoffs — useState's initializer is pure under
  // React-Compiler so we sidestep the "Date.now is impure" rule cleanly.
  const [today] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [horizon] = useState(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 14); return d;
  });
  const upcoming = useMemo(() => {
    return events
      .filter((e) => {
        const d = new Date(e.date);
        return d >= today && d <= horizon;
      })
      .slice(0, 12);
  }, [events, today, horizon]);

  const stepMonth = (delta: number) => {
    setAnchor((prev) => {
      const d = new Date(prev.year, prev.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  return (
    <div className="flex flex-col gap-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-red-500 flex items-center justify-center shadow-[0_0_20px_rgba(249,115,22,0.4)]">
            <Calendar size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">Macro Calendar</h1>
            <p className="text-xs text-text-muted">
              Fed decisions, CPI, NFP and more — sourced from SoSoValue with BTC-impact labelling.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" icon={<ChevronLeft size={14} />} onClick={() => stepMonth(-1)}>Prev</Button>
          <span className="px-3 py-1.5 rounded-lg bg-surface border border-border text-sm font-mono font-semibold text-text-primary min-w-[150px] text-center">
            {monthName}
          </span>
          <Button variant="outline" size="sm" icon={<ChevronRight size={14} />} onClick={() => stepMonth(1)}>Next</Button>
          <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={() => void refresh()} disabled={loading}>
            Refresh
          </Button>
        </div>
      </div>

      {errMsg && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
          <AlertTriangle size={13} /> {errMsg}
        </div>
      )}

      {/* Impact legend */}
      <div className="flex items-center flex-wrap gap-2">
        {(['High', 'Medium', 'Low'] as MacroImpact[]).map((tier) => {
          const Icon = IMPACT_STYLES[tier].icon;
          return (
            <span key={tier} className={cn('flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] font-semibold', IMPACT_STYLES[tier].badge)}>
              <Icon size={11} />
              <span>{tier} BTC impact</span>
            </span>
          );
        })}
        <span className="text-[11px] text-text-muted ml-auto">
          {(isDemoMode || !sosoApiKey)
            ? 'Demo mode — synthesized calendar, no API calls.'
            : 'Live — fetched once per page mount.'}
        </span>
      </div>

      {/* Calendar grid */}
      <Card className="p-0 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-white/5">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
            <div key={d} className="px-3 py-2 text-[10px] uppercase tracking-wider text-text-muted text-center font-bold">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 grid-rows-6 min-h-[640px]">
          {monthCells.map((c, i) => {
            const cellEvent = eventsByDate.get(c.iso);
            const isCurrentMonth = c.date.getMonth() === anchor.month;
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const isToday = c.iso === today.toISOString().slice(0, 10);
            // Highest impact in the cell, used for colour wash.
            const topImpact: MacroImpact | null = cellEvent
              ? cellEvent.impacts?.reduce<MacroImpact>((acc, im) => {
                  if (im === 'High') return 'High';
                  if (acc !== 'High' && im === 'Medium') return 'Medium';
                  return acc;
                }, 'Low') ?? null
              : null;
            return (
              <div
                key={i}
                className={cn(
                  'border-r border-b border-white/5 p-2 flex flex-col gap-1 min-h-[100px] transition-colors',
                  !isCurrentMonth && 'opacity-40',
                  topImpact && IMPACT_STYLES[topImpact].cell,
                  isToday && 'ring-1 ring-inset ring-primary/40',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={cn(
                    'text-xs font-mono font-semibold',
                    isToday ? 'text-primary' : isCurrentMonth ? 'text-text-secondary' : 'text-text-muted',
                  )}>
                    {c.date.getDate()}
                  </span>
                  {cellEvent && cellEvent.events.length > 0 && (
                    <span className="text-[9px] text-text-muted font-mono">{cellEvent.events.length}</span>
                  )}
                </div>
                {cellEvent && cellEvent.events.slice(0, 3).map((ev, idx) => {
                  const impact = (cellEvent.impacts?.[idx] ?? classifyMacroImpact(ev));
                  return (
                    <div
                      key={`${c.iso}-${idx}`}
                      className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded border truncate font-semibold',
                        IMPACT_STYLES[impact].badge,
                      )}
                      title={`${ev} — ${impact} BTC impact`}
                    >
                      {ev}
                    </div>
                  );
                })}
                {cellEvent && cellEvent.events.length > 3 && (
                  <span className="text-[9px] text-text-muted">+{cellEvent.events.length - 3} more</span>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Upcoming list — quick read for the next 14 days */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
          <Activity size={16} className="text-primary" />
          <h2 className="text-sm font-bold text-text-primary uppercase tracking-wide">Next 14 Days</h2>
          <span className="ml-auto text-[10px] text-text-muted font-mono">{upcoming.length} dates</span>
        </div>
        {upcoming.length === 0 ? (
          <div className="p-8 text-center text-text-muted text-sm">
            {loading ? 'Loading…' : 'No upcoming macro events in the next two weeks.'}
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {upcoming.map((day) => (
              <div key={day.date} className="px-5 py-3 flex items-center gap-4 flex-wrap">
                <div className="w-28 shrink-0">
                  <div className="text-sm font-bold font-mono text-text-primary">
                    {new Date(day.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </div>
                  <div className="text-[10px] text-text-muted">
                    {new Date(day.date).toLocaleDateString(undefined, { weekday: 'long' })}
                  </div>
                </div>
                <div className="flex-1 flex items-center flex-wrap gap-2">
                  {day.events.map((ev, idx) => {
                    const impact = day.impacts?.[idx] ?? classifyMacroImpact(ev);
                    return (
                      <span
                        key={`${day.date}-${idx}`}
                        className={cn(
                          'text-[11px] px-2 py-1 rounded-md border font-semibold',
                          IMPACT_STYLES[impact].badge,
                        )}
                      >
                        {ev}
                        <span className="ml-1.5 opacity-70">· {impact}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
