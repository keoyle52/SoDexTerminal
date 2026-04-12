import React from 'react';
import clsx from 'clsx';
import { useSettingsStore } from '../../store/settingsStore';

interface Props {
  value: number | string;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  colorize?: boolean;
}

export const NumberDisplay: React.FC<Props> = ({ value, decimals, prefix, suffix, className, colorize }) => {
  const { priceDecimals } = useSettingsStore();

  const num = typeof value === 'string' ? parseFloat(value) : value;
  const isNaN = Number.isNaN(num);

  const appliedDecimals = decimals ?? priceDecimals ?? 2;
  const formatted = isNaN ? '-' : (prefix || '') + num.toLocaleString(undefined, { minimumFractionDigits: Math.max(0, appliedDecimals), maximumFractionDigits: Math.max(0, appliedDecimals) }) + (suffix || '');

  return (
    <span className={clsx(
      'tabular-nums font-mono',
      colorize && !isNaN && num > 0 && 'text-[#00c853]', // Custom SoDEX green
      colorize && !isNaN && num < 0 && 'text-[#f44336]', // Custom SoDEX red
      className
    )}>
      {formatted}
    </span>
  );
};
