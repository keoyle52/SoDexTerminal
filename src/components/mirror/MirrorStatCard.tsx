import React from 'react';
import { cn } from '../../lib/utils';
import type { LucideIcon } from 'lucide-react';

interface MirrorStatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  accentColor?: string;
}

export const MirrorStatCard: React.FC<MirrorStatCardProps> = ({ label, value, icon: Icon, accentColor }) => {
  return (
    <div className="stat-card group">
      {/* Glow effect on hover */}
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none" 
        style={{ background: `radial-gradient(circle at right top, ${accentColor ?? 'var(--color-primary)'}, transparent 70%)` }} 
      />
      <div
        className="absolute left-0 top-0 bottom-0 w-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: accentColor ?? 'var(--color-primary)' }}
      />
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-text-muted text-xs mb-2 uppercase tracking-wider font-medium">{label}</p>
          <p className="font-mono text-2xl font-bold tabular-nums text-text-primary">{value}</p>
        </div>
        {Icon && (
          <div className="p-2 rounded-lg bg-surface-2 border border-border text-text-muted group-hover:text-primary group-hover:border-primary/20 transition-colors">
            <Icon size={16} />
          </div>
        )}
      </div>
    </div>
  );
};
