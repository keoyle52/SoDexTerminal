import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { ChevronDown, Check } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  hint,
  icon,
  className,
  ...props
}) => {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-[11px] font-medium text-text-secondary uppercase tracking-wider">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
            {icon}
          </div>
        )}
        <input
          className={cn(
            'w-full bg-background/60 border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary',
            'placeholder:text-text-muted transition-all duration-200',
            'hover:border-border-hover focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20',
            icon && 'pl-9',
            className,
          )}
          {...props}
        />
      </div>
      {hint && (
        <p className="text-[10px] text-text-muted">{hint}</p>
      )}
    </div>
  );
};

interface SelectProps {
  label?: string;
  value: string;
  onChange: (e: { target: { value: string } }) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  className?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  value,
  onChange,
  options,
  disabled,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find(opt => opt.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={cn("space-y-1.5 relative", className)} ref={containerRef}>
      {label && (
        <label className="block text-[11px] font-medium text-text-secondary uppercase tracking-wider">
          {label}
        </label>
      )}
      
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between bg-background/60 border rounded-lg px-3 py-2.5 text-sm transition-all duration-300',
          isOpen ? 'border-primary/50 ring-2 ring-primary/10' : 'border-border hover:border-border-hover',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
          'text-text-primary'
        )}
      >
        <span className="font-medium truncate">{selectedOption?.label}</span>
        <ChevronDown 
          size={16} 
          className={cn(
            "text-text-muted transition-transform duration-300", 
            isOpen && "rotate-180 text-primary"
          )} 
        />
      </button>

      {/* Custom Dropdown Panel */}
      <div 
        className={cn(
          "absolute left-0 right-0 mt-2 z-[100] glass-panel rounded-xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5)] border border-white/10 transition-all duration-300 origin-top",
          isOpen 
            ? "opacity-100 visible translate-y-0 scale-100" 
            : "opacity-0 invisible -translate-y-2 scale-95 pointer-events-none"
        )}
      >
        <div className="p-1.5 flex flex-col gap-1 max-h-60 overflow-y-auto scrollbar-thin">
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange({ target: { value: opt.value } });
                  setIsOpen(false);
                }}
                className={cn(
                  "flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-200 group/opt",
                  isSelected 
                    ? "bg-primary/20 text-primary font-bold shadow-[inset_0_0_10px_rgba(0,225,255,0.1)]" 
                    : "text-text-secondary hover:bg-white/5 hover:text-text-primary"
                )}
              >
                <span>{opt.label}</span>
                {isSelected && (
                  <Check size={14} className="text-primary drop-shadow-[0_0_5px_var(--color-primary)] animate-in zoom-in-50 duration-300" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

interface ToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export const Toggle: React.FC<ToggleProps> = ({ label, description, checked, onChange }) => {
  return (
    <div
      className="flex items-center justify-between p-3.5 bg-background/40 border border-border rounded-lg hover:border-border-hover transition-colors cursor-pointer"
      onClick={() => onChange(!checked)}
    >
      <div>
        <span className="text-sm text-text-primary">{label}</span>
        {description && <p className="text-[10px] text-text-muted mt-0.5">{description}</p>}
      </div>
      <div className={cn(
        'w-11 h-6 rounded-full relative transition-all duration-300 shrink-0',
        checked ? 'bg-primary' : 'bg-border',
      )}>
        <div className={cn(
          'w-4 h-4 rounded-full bg-white absolute top-1 transition-all duration-300 shadow-sm',
          checked ? 'left-6' : 'left-1',
        )} />
      </div>
    </div>
  );
};
