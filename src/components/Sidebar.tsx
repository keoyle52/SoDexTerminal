import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Grid2X2, Clock, Repeat, Users, LineChart, Coins,
  TimerOff, Bell, FlaskConical, Settings, Menu, X, BarChart2,
  Brain, Newspaper, Calendar, Building, Banknote, Flame, Building2,
  MessageSquare, Layers, Zap, Activity,
} from 'lucide-react';
import { cn } from '../lib/utils';

const NAV_SECTIONS = [
  {
    label: 'AI Agents',
    items: [
      { to: '/btc-predictor', icon: Brain,         label: 'BTC Predictor', badge: 'Headline' },
      { to: '/news-bot',      icon: Newspaper,     label: 'News Bot'      },
      { to: '/ai-console',    icon: MessageSquare, label: 'AI Console'    },
    ],
  },
  {
    label: 'Overview',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/positions',  icon: LineChart,       label: 'Positions'  },
    ],
  },
  {
    label: 'Trade Bots',
    items: [
      { to: '/trading-bots',    icon: Layers,   label: 'Trading Bots' },
      { to: '/schedule-cancel', icon: TimerOff, label: 'Scheduler'    },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { to: '/ssi-indices',      icon: BarChart2, label: 'SSI Indices'      },
      { to: '/btc-treasuries',   icon: Building2, label: 'BTC Treasuries'   },
      { to: '/sector-spotlight', icon: Flame,     label: 'Sector Spotlight' },
      { to: '/fundraising',      icon: Banknote,  label: 'Fundraising'      },
      { to: '/crypto-stocks',    icon: Building,  label: 'Crypto Stocks'    },
    ],
  },
  {
    label: 'Market Data',
    items: [
      { to: '/funding',     icon: Coins,    label: 'Funding Rates'  },
      { to: '/etf-tracker', icon: BarChart2, label: 'ETF Tracker'   },
      { to: '/macro',       icon: Calendar, label: 'Macro Calendar' },
    ],
  },
  {
    label: 'Pro Tools',
    items: [
      { to: '/telegram',    icon: MessageSquare, label: 'Telegram Bot', badge: 'New' },
      { to: '/marketplace', icon: Zap,          label: 'Marketplace', badge: 'New' },
      { to: '/copy-trader', icon: Users,        label: 'Copy Trader' },
      { to: '/alerts',      icon: Bell,         label: 'Price Alerts' },
      { to: '/backtesting', icon: FlaskConical, label: 'Backtesting', badge: 'Wave 2'  },
    ],
  },
];

const NavItem: React.FC<{ to: string; icon: React.ElementType; label: string; badge?: string; onClick?: () => void }> = ({
  to, icon: Icon, label, badge, onClick,
}) => (
  <NavLink
    to={to}
    onClick={onClick}
    className={({ isActive }) =>
      cn(
        'group flex items-center gap-3 px-3 py-[7px] rounded-md text-sm transition-colors duration-150',
        isActive
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.04]',
      )
    }
  >
    {({ isActive }) => (
      <>
        <Icon
          size={15}
          className={cn(
            'shrink-0 transition-colors duration-150',
            isActive ? 'text-primary' : 'text-text-muted group-hover:text-text-secondary',
          )}
        />
        <span className="truncate">{label}</span>
        {badge && (
          <span className={cn(
            "ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-widest leading-none scale-90 shrink-0",
            badge === 'Headline' ? "bg-primary/20 text-primary" :
            badge === 'Wave 2' ? "bg-violet-500/20 text-violet-400" :
            "bg-emerald-500/20 text-emerald-400 animate-pulse"
          )}>
            {badge}
          </span>
        )}
        {isActive && !badge && (
          <span className="ml-auto w-1 h-1 rounded-full bg-primary shrink-0" />
        )}
      </>
    )}
  </NavLink>
);

export const Sidebar: React.FC = () => {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const close = () => setMobileOpen(false);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-14 shrink-0 border-b border-border">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/15 shrink-0">
          <Zap size={14} className="text-primary" />
        </div>
        <span className="text-sm font-semibold tracking-tight text-text-primary">SoDEX Terminal</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {NAV_SECTIONS.map((section, i) => (
          <div key={i}>
            {section.label && (
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-text-muted select-none">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavItem key={item.to} {...item} onClick={close} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Settings */}
      <div className="shrink-0 px-2 py-3 border-t border-border">
        <NavLink
          to="/settings"
          onClick={close}
          className={({ isActive }) =>
            cn(
              'group flex items-center gap-3 px-3 py-[7px] rounded-md text-sm transition-colors duration-150',
              isActive
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.04]',
            )
          }
        >
          {({ isActive }) => (
            <>
              <Settings
                size={15}
                className={cn(
                  'shrink-0 transition-all duration-300',
                  isActive ? 'text-primary' : 'text-text-muted group-hover:text-text-secondary group-hover:rotate-45',
                )}
              />
              <span>Settings</span>
            </>
          )}
        </NavLink>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3.5 left-3.5 z-50 w-9 h-9 rounded-lg bg-surface border border-border flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
        aria-label="Open menu"
      >
        <Menu size={16} />
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40 animate-backdrop"
          onClick={close}
        />
      )}

      {/* Mobile close button */}
      {mobileOpen && (
        <button
          onClick={close}
          className="md:hidden fixed top-3.5 left-[252px] z-[60] w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
        >
          <X size={14} />
        </button>
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'w-[240px] shrink-0 border-r border-border bg-surface z-50',
          'hidden md:block',
          mobileOpen && 'block fixed inset-y-0 left-0',
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
};
