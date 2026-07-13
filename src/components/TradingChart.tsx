import React, { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, createSeriesMarkers, type IChartApi, type ISeriesApi, type CandlestickData, type Time, ColorType, type SeriesMarker } from 'lightweight-charts';
import { fetchKlines } from '../api/services';
import { cn } from '../lib/utils';

interface TradingChartProps {
  symbol: string;
  market?: 'spot' | 'perps';
  height?: number;
  className?: string;
  markers?: SeriesMarker<Time>[];
}

const INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;

export const TradingChart: React.FC<TradingChartProps> = ({
  symbol,
  market = 'perps',
  height = 400,
  className,
  markers = [],
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const markersPrimitiveRef = useRef<{ detach: () => void } | null>(null);
  const [selectedInterval, setSelectedInterval] = useState<string>('1h');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize chart + series together in one effect to avoid race condition
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight || height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#8E99A8',
        fontFamily: "var(--font-sans)",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: 'rgba(30, 35, 42, 0.5)' },
        horzLines: { color: 'rgba(30, 35, 42, 0.5)' },
      },
      crosshair: {
        vertLine: { color: 'rgba(48, 115, 236, 0.25)', labelBackgroundColor: '#3073EC' },
        horzLine: { color: 'rgba(48, 115, 236, 0.25)', labelBackgroundColor: '#3073EC' },
      },
      rightPriceScale: {
        borderColor: '#1E232A',
      },
      timeScale: {
        borderColor: '#1E232A',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#00B574',
      downColor: '#EF454A',
      borderUpColor: '#00B574',
      borderDownColor: '#EF454A',
      wickUpColor: '#00B574',
      wickDownColor: '#EF454A',
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ 
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight || height
        });
      }
    };
    
    // Add resize listener
    window.addEventListener('resize', handleResize);
    
    // Dynamic size observer to guarantee height calculation is correct
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    if (containerRef.current.parentElement) {
      resizeObserver.observe(containerRef.current.parentElement);
    }

    // Trigger initial layout
    setTimeout(handleResize, 50);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      if (markersPrimitiveRef.current) {
        markersPrimitiveRef.current.detach();
        markersPrimitiveRef.current = null;
      }
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
     
  }, [height]);

  useEffect(() => {
    if (!seriesRef.current) return;
    // Remove previous markers primitive if it exists
    if (markersPrimitiveRef.current) {
      markersPrimitiveRef.current.detach();
      markersPrimitiveRef.current = null;
    }
    // Create new markers primitive if we have markers to show
    if (markers.length > 0) {
      markersPrimitiveRef.current = createSeriesMarkers(seriesRef.current, markers);
    }
  }, [markers]);

  // Load/refresh data whenever symbol, interval, or market changes
  useEffect(() => {
    let cancelled = false;

    // Immediately clear old data and show loading when inputs change
    if (seriesRef.current) {
      seriesRef.current.setData([]);
    }
    setLoading(true);
    setError(null);

    const loadData = async () => {
      try {
        const rawKlines = await fetchKlines(symbol, selectedInterval, 200, market);
        if (cancelled || !seriesRef.current) return;

        const klines = Array.isArray(rawKlines) ? rawKlines : [];

        /** Convert any timestamp value (ms-number, s-number, or string of either) → Unix seconds */
        const toUnixSeconds = (v: unknown): number => {
          const n = typeof v === 'number' ? v : parseFloat(String(v ?? '0'));
          if (!isFinite(n) || n <= 0) return 0;
          return n > 1e12 ? Math.floor(n / 1000) : Math.floor(n);
        };

        const candlesticks: CandlestickData<Time>[] = klines
          .map((k: Record<string, unknown>) => {
            const ts = toUnixSeconds(k.time ?? k.openTime ?? k.t);
            const o = parseFloat(String(k.open ?? k.o ?? k.close ?? k.c ?? 0));
            const h = parseFloat(String(k.high ?? k.h ?? k.open ?? k.o ?? 0));
            const l = parseFloat(String(k.low  ?? k.l ?? k.open ?? k.o ?? 0));
            const c = parseFloat(String(k.close ?? k.c ?? k.open ?? k.o ?? 0));
            return { ts, o, h, l, c };
          })
          .filter((x) => x.ts > 0 && x.o > 0 && x.c > 0)
          .sort((a, b) => a.ts - b.ts)
          .map((x) => ({ time: x.ts as Time, open: x.o, high: x.h, low: x.l, close: x.c }));

        if (!cancelled && seriesRef.current) {
          if (candlesticks.length > 0) {
            seriesRef.current.setData(candlesticks);
            chartRef.current?.timeScale().fitContent();
            setError(null);
          } else {
            setError('No chart data available');
          }
        }

      } catch (err) {
        if (!cancelled) {
          console.warn('[TradingChart] Failed to load data:', err);
          setError('Failed to load chart data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    // Small delay to ensure chart/series are mounted before first fetch
    const init = setTimeout(loadData, 50);
    const timer = globalThis.setInterval(loadData, 30_000);

    return () => {
      cancelled = true;
      clearTimeout(init);
      clearInterval(timer);
    };
  }, [symbol, selectedInterval, market]);

  return (
    <div className={cn('flex flex-col bg-surface overflow-hidden', className)}>
      {/* Interval Selector */}
      <div className="h-9 shrink-0 flex items-center justify-between px-4 border-b border-border bg-[#0B0E11] select-none">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-text-primary">{symbol}</span>
          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-sm bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">{market}</span>
        </div>
        <div className="flex gap-0.5">
          {INTERVALS.map((iv) => (
            <button
              key={iv}
              onClick={() => setSelectedInterval(iv)}
              className={cn(
                'px-2.5 py-1 text-[10px] font-bold transition-all duration-150 rounded-sm cursor-pointer',
                selectedInterval === iv
                  ? 'bg-primary-soft/10 text-primary border border-primary/20'
                  : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.02]',
              )}
            >
              {iv}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Container */}
      <div className="flex-1 min-h-0 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#08090C]/50">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#08090C]/30">
            <div className="text-center">
              <p className="text-xs text-text-muted">{error}</p>
              <button
                onClick={() => {
                  setError(null);
                  setLoading(true);
                  setSelectedInterval((prev) => prev);
                }}
                className="mt-2 text-[10px] text-primary hover:underline"
              >
                Retry
              </button>
            </div>
          </div>
        )}
        <div ref={containerRef} className="w-full h-full" />
      </div>
    </div>
  );
};
