import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, LineChart, FlaskConical, Settings, Menu, X, BarChart2,
  Brain, MessageSquare, Layers, Award,
} from 'lucide-react';
import { cn } from '../lib/utils';

const NAV_SECTIONS = [
  {
    label: 'Trading & Execution',
    items: [
      { to: '/terminal',      icon: LayoutDashboard, label: 'Terminal' },
      { to: '/trading-bots',  icon: Layers,         label: 'Trading Bots', badge: '5 Bots' },
      { to: '/positions',     icon: LineChart,       label: 'Positions' },
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
      <div className="flex items-center gap-3 px-4 h-16 shrink-0 border-b border-border bg-white/[0.01]">
        <div className="relative w-8 h-8 rounded-xl bg-surface-2 border border-primary/30 p-1 flex items-center justify-center shadow-md shadow-primary/10 group cursor-pointer">
          <img src="/favicon.svg" alt="SoDEX Logo" className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-110" />
          <span className="absolute inset-0 rounded-xl bg-primary/15 blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold tracking-tight text-text-primary">SoDEX</span>
            <span className="text-[9px] font-extrabold uppercase tracking-widest px-1.5 py-0.2 rounded bg-primary/20 text-primary border border-primary/30">
              PRO
            </span>
          </div>
          <span className="text-[10px] font-medium text-text-muted tracking-wide">Institutional PowerOps</span>
        </div>
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
