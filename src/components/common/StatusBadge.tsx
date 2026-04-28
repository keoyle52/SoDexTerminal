import React from 'react';
import { cn } from '../../lib/utils';

interface StatusBadgeProps {
  /** Bot lifecycle. `ARMED` = waiting for a conditional trigger price. */
  status: 'STOPPED' | 'RUNNING' | 'ERROR' | 'ARMED';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const config = {
    RUNNING: {
      dotColor: 'bg-success',
      text: 'RUNNING',
      badgeClass: 'badge-success',
    },
    ARMED: {
      dotColor: 'bg-amber-400',
      text: 'ARMED',
      badgeClass: 'badge-warning',
    },
    ERROR: {
      dotColor: 'bg-danger',
      text: 'ERROR',
      badgeClass: 'badge-danger',
    },
    STOPPED: {
      dotColor: 'bg-text-muted',
      text: 'STOPPED',
      badgeClass: 'badge-neutral',
    },
  }[status];

  return (
    <div className={cn('badge', config.badgeClass, className)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', config.dotColor, status === 'RUNNING' && 'animate-pulse-dot')} />
      {config.text}
    </div>
  );
};
