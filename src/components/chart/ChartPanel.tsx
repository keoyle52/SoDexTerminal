import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, CrosshairMode, CandlestickSeries } from 'lightweight-charts';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import { useMarketStore } from '../../store/marketStore';
import { useCandles } from '../../hooks/useCandles';
import clsx from 'clsx';
import { NumberDisplay } from '../common/NumberDisplay';

export const ChartPanel: React.FC = () => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  
  const { markPrice, fundingRate, activeMarket } = useMarketStore();
  const { interval, setChartInterval, data } = useCandles('15m');
  const intervals = ['1m', '5m', '15m', '1h', '4h', '1D'];

  useEffect(() => {
    if (!chartContainerRef.current) return;

    chartRef.current = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9aa0a6',
      },
      grid: {
        vertLines: { color: '#1e2028', style: 1 },
        horzLines: { color: '#1e2028', style: 1 },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      timeScale: {
        borderColor: '#1e2028',
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: '#1e2028',
      },
    });

    seriesRef.current = chartRef.current.addSeries(CandlestickSeries, {
      upColor: '#00c853',
      downColor: '#f44336',
      borderVisible: false,
      wickUpColor: '#00c853',
      wickDownColor: '#f44336',
    });

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
           width: chartContainerRef.current.clientWidth,
           height: chartContainerRef.current.clientHeight
        });
      }
    };

    window.addEventListener('resize', handleResize);
    
    // Resize observers hook nicely into react-grid-layout changes
    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(chartContainerRef.current);

    setTimeout(handleResize, 50);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartContainerRef.current) resizeObserver.unobserve(chartContainerRef.current);
      if (chartRef.current) chartRef.current.remove();
    };
  }, []);

  // Update Data
  useEffect(() => {
    if (seriesRef.current && data && data.length > 0) {
      const formatted = data.map(c => {
        const isArray = Array.isArray(c);
        return {
          time: Math.floor((isArray ? c[0] : c.openTime) / 1000) as import('lightweight-charts').Time,
          open: parseFloat(isArray ? c[1] : c.open),
          high: parseFloat(isArray ? c[2] : c.high),
          low: parseFloat(isArray ? c[3] : c.low),
          close: parseFloat(isArray ? c[4] : c.close),
        };
      });
      // ensure strictly ascending time order
      const sorted = formatted.sort((a,b) => (a.time as number) - (b.time as number));
      // Filter duplicates by time (lightweight-charts throws on dupes)
      const unique = sorted.filter((v,i,a)=>a.findIndex(t=>(t.time === v.time))===i);

      try {
        seriesRef.current.setData(unique);
      } catch (e) {
        console.warn("[ChartPanel] Data validation error", e);
      }
    }
  }, [data]);

  return (
    <div className="w-full h-full flex flex-col bg-[#111318] relative">
      <div className="flex items-center justify-between px-3 h-8 border-b border-[#1e2028] shrink-0 bg-[#0a0b0d]/30">
        <div className="flex items-center space-x-1">
          {intervals.map(inv => (
            <button 
              key={inv}
              onClick={() => setChartInterval(inv)}
              className={clsx(
                "px-2 py-0.5 text-[11px] font-bold rounded mx-0.5 transition outline-none",
                interval === inv ? "bg-[#1e2028] text-[#e8eaed] shadow" : "text-[#9aa0a6] hover:text-white hover:bg-white/5"
              )}
            >
              {inv}
            </button>
          ))}
        </div>

        {activeMarket === 'perps' && (
          <div className="flex space-x-4 text-[10px] uppercase tracking-wider font-semibold">
           <div className="flex space-x-1.5">
              <span className="text-[#9aa0a6]">Mark</span>
              <NumberDisplay value={markPrice || 0} className="text-[#e8eaed]" />
           </div>
           <div className="flex space-x-1.5">
              <span className="text-[#9aa0a6]">Funding</span>
              <NumberDisplay value={fundingRate || 0} colorize suffix="%" />
           </div>
          </div>
        )}
      </div>
      <div ref={chartContainerRef} className="flex-1 w-full relative" />
    </div>
  );
};
