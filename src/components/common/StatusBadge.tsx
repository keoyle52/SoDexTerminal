import React from 'react';
import clsx from 'clsx';

interface Props {
  status: string;
}

export const StatusBadge: React.FC<Props> = ({ status }) => {
  const normalized = status.toUpperCase();
  const isSuccess = ['FILLED', 'COMPLETED', 'ACTIVE'].includes(normalized);
  const isWarning = ['PARTIALLY_FILLED', 'PENDING'].includes(normalized);
  const isDanger = ['CANCELLED', 'REJECTED', 'FAILED'].includes(normalized);

  return (
    <span className={clsx(
      'px-2 py-0.5 text-[10px] uppercase font-semibold rounded-sm tracking-wider',
      isSuccess && 'bg-[#00c853]/20 text-[#00c853]',
      isWarning && 'bg-[#fbbc04]/20 text-[#fbbc04]',
      isDanger && 'bg-[#f44336]/20 text-[#f44336]',
      !isSuccess && !isWarning && !isDanger && 'bg-[#1e2028] text-[#9aa0a6]'
    )}>
      {status}
    </span>
  );
};
