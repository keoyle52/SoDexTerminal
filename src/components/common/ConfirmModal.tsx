import React from 'react';
import clsx from 'clsx';
import { X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  onConfirm: () => void;
  confirmText?: string;
  confirmColor?: 'green' | 'red' | 'blue';
  children: React.ReactNode;
}

export const ConfirmModal: React.FC<Props> = ({ isOpen, title, onClose, onConfirm, confirmText = 'Confirm', confirmColor = 'blue', children }) => {
  if (!isOpen) return null;

  const colorClass = {
    green: 'bg-[#00c853] hover:bg-[#00c853]/90 text-white',
    red: 'bg-[#f44336] hover:bg-[#f44336]/90 text-white',
    blue: 'bg-[#4285f4] hover:bg-[#4285f4]/90 text-white',
  }[confirmColor];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-[#111318] border border-[#1e2028] shadow-2xl rounded-md w-full max-w-sm overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2028] bg-black/20">
          <h3 className="text-sm font-semibold text-[#e8eaed] uppercase tracking-wider">{title}</h3>
          <button onClick={onClose} className="text-[#9aa0a6] hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="p-4 text-sm text-[#9aa0a6] leading-relaxed">
          {children}
        </div>
        <div className="flex px-4 py-3 bg-black/20 border-t border-[#1e2028] justify-end space-x-3">
          <button 
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-[#9aa0a6] hover:text-white transition-colors rounded"
          >
            Cancel
          </button>
          <button 
            onClick={() => { onConfirm(); onClose(); }}
            className={clsx('px-4 py-1.5 text-xs font-bold rounded shadow transition-colors', colorClass)}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
