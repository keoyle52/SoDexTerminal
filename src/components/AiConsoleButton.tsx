import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';

/**
 * AI Console Floating Button
 * 
 * Appears in bottom-right corner of the screen
 * Opens AI Console in a modal or navigates to full page
 */

export const AiConsoleButton: React.FC = () => {
  const [isHovered, setIsHovered] = useState(false);
  const navigate = useNavigate();

  const handleClick = () => {
    navigate('/ai-console');
  };

  return (
    <>
      {/* Main Floating Button */}
      <button
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full",
          "bg-primary text-white shadow-lg shadow-primary/30",
          "transition-all duration-300 ease-out",
          "hover:scale-105 hover:shadow-xl hover:shadow-primary/40",
          "active:scale-95",
          isHovered ? "pr-5 pl-4" : "px-4"
        )}
      >
        <div className="relative">
          <MessageSquare size={20} className="relative z-10" />
          {/* Pulse animation ring */}
          <div className="absolute inset-0 rounded-full bg-white/20 animate-ping" />
        </div>
        
        <span className={cn(
          "font-medium text-sm whitespace-nowrap transition-all duration-300",
          isHovered ? "opacity-100 max-w-[100px] ml-1" : "opacity-0 max-w-0 overflow-hidden"
        )}>
          AI Console
        </span>
        
        {/* AI Badge */}
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-success rounded-full border-2 border-background" />
      </button>

      {/* Tooltip on hover */}
      <div className={cn(
        "fixed bottom-20 right-6 z-40 px-3 py-2 rounded-lg",
        "bg-surface-2 border border-border shadow-lg",
        "text-xs text-text-secondary",
        "transition-all duration-200",
        isHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
      )}>
        <div className="flex items-center gap-1.5">
          <Sparkles size={12} className="text-primary" />
          <span>Ask AI about markets</span>
        </div>
      </div>
    </>
  );
};

export default AiConsoleButton;
