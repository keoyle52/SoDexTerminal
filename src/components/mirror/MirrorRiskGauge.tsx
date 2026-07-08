import React, { useEffect, useRef, useState } from 'react';

interface MirrorRiskGaugeProps {
  score: number;
}

export const MirrorRiskGauge: React.FC<MirrorRiskGaugeProps> = ({ score }) => {
  const clamped = Math.max(0, Math.min(100, score));
  const [animatedScore, setAnimatedScore] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    let start: number | null = null;
    const duration = 1200;
    const animate = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(eased * clamped));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [clamped]);

  const angle = (animatedScore / 100) * 180;
  const color = animatedScore < 34 ? '#10B981' : animatedScore < 67 ? '#F59E0B' : '#EF4444';
  const glowColor = animatedScore < 34 ? 'rgba(16,185,129,0.35)' : animatedScore < 67 ? 'rgba(245,158,11,0.35)' : 'rgba(239,68,68,0.35)';
  const label = animatedScore < 34 ? 'Low Risk' : animatedScore < 67 ? 'Medium Risk' : 'High Risk';

  const r = 80;
  const cx = 100;
  const cy = 100;
  const rad = (Math.PI * angle) / 180;
  const needleX = cx - r * Math.cos(rad);
  const needleY = cy - r * Math.sin(rad);
  const arcLen = (animatedScore / 100) * 251.2;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        <svg viewBox="0 0 200 115" className="w-52">
          {/* Background arc */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="16" strokeLinecap="round"
          />
          {/* Colored arc */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none" stroke={color} strokeWidth="16" strokeLinecap="round"
            strokeDasharray={`${arcLen} 251.2`}
            style={{ filter: `drop-shadow(0 0 8px ${glowColor})` }}
          />
          {/* Needle */}
          <line
            x1={cx} y1={cy} x2={needleX} y2={needleY}
            stroke="#FAFBFC" strokeWidth="2.5" strokeLinecap="round"
          />
          <circle cx={cx} cy={cy} r="5" fill="#FAFBFC" />
          <circle cx={cx} cy={cy} r="2.5" fill={color} />
        </svg>
        {/* Glow effect behind gauge */}
        <div
          className="absolute inset-0 rounded-full blur-2xl opacity-30 pointer-events-none"
          style={{ background: `radial-gradient(circle, ${glowColor}, transparent 70%)` }}
        />
      </div>
      <p className="font-mono text-3xl font-bold tabular-nums" style={{ color }}>{animatedScore}</p>
      <p className="text-text-muted text-sm font-medium">{label}</p>
    </div>
  );
};
