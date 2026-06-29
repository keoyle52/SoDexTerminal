import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Grid2X2, Clock, Repeat, Layers, Activity, Play, Sparkles, Newspaper } from 'lucide-react';
import { GridBot } from './GridBot';
import { DcaBot } from './DcaBot';
import { TwapBot } from './TwapBot';
import { MarketMakerBot } from './MarketMakerBot';
import { SignalBot } from './SignalBot';
import { NewsBot } from './NewsBot';
import { cn } from '../lib/utils';

type BotTab = 'grid' | 'dca' | 'twap' | 'marketmaker' | 'signal' | 'news';

const BOTS_CONFIG: Record<BotTab, {
  label: string;
  desc: string;
  icon: React.ElementType;
  component: React.ComponentType;
  color: string;
}> = {
  grid: {
    label: 'Grid Bot',
    desc: 'High-frequency price volatility grid trading.',
    icon: Grid2X2,
    component: GridBot,
    color: 'from-cyan-500 to-blue-600',
  },
  dca: {
    label: 'DCA Bot',
    desc: 'Automated Dollar Cost Averaging capital accumulation.',
    icon: Repeat,
    component: DcaBot,
    color: 'from-emerald-500 to-teal-600',
  },
  twap: {
    label: 'TWAP Bot',
    desc: 'Time Weighted Average Price institutional execution.',
    icon: Clock,
    component: TwapBot,
    color: 'from-indigo-500 to-purple-600',
  },
  marketmaker: {
    label: 'Market Maker',
    desc: 'Bid-Ask spread liquidity provisioning and volume farming.',
    icon: Layers,
    component: MarketMakerBot,
    color: 'from-pink-500 to-rose-600',
  },
  signal: {
    label: 'Signal Bot',
    desc: 'Technical analysis and indicator-driven automatic triggers.',
    icon: Activity,
    component: SignalBot,
    color: 'from-amber-500 to-orange-600',
  },
  news: {
    label: 'News Bot',
    desc: 'AI-powered news sentiment analysis and trading signals.',
    icon: Newspaper,
    component: NewsBot,
    color: 'from-blue-500 to-cyan-600',
  },
};

export const TradingBots: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get('bot') as BotTab) || 'grid';

  const selectTab = (tab: BotTab) => {
    setSearchParams({ bot: tab });
  };

  const activeBot = BOTS_CONFIG[currentTab] || BOTS_CONFIG.grid;
  const ActiveComponent = activeBot.component;

  return (
    <div className="p-4 md:p-6 h-full flex flex-col gap-5 overflow-y-auto bg-background">
      {/* Header Studio Banner */}
      <div className="shrink-0 flex items-center justify-between flex-wrap gap-4 border border-border bg-surface rounded-2xl p-5 relative overflow-hidden shadow-xl">
        <div className={cn(
          "absolute -right-32 -top-32 w-64 h-64 rounded-full bg-gradient-to-br blur-3xl opacity-15 transition-all duration-700 pointer-events-none",
          activeBot.color
        )} />
        
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shadow-lg shadow-primary/10">
            <Play size={22} />
          </div>
          <div>
            <h2 className="text-xl font-extrabold flex items-center gap-2 text-text-primary">
              Automated Execution Studio
              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-widest bg-primary/20 text-primary px-2.5 py-0.5 rounded-full border border-primary/30">
                <Sparkles size={10} /> Algorithmic
              </span>
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Deploy zero-latency quantitative strategies signed non-custodially via EIP-712 session keys.
            </p>
          </div>
        </div>

        {/* Tab Selection Pills */}
        <div className="flex gap-1.5 p-1.5 bg-background border border-border rounded-xl relative z-10 w-fit shrink-0 overflow-x-auto max-w-full shadow-inner">
          {(Object.keys(BOTS_CONFIG) as BotTab[]).map((tab) => {
            const bot = BOTS_CONFIG[tab];
            const isActive = currentTab === tab;
            const Icon = bot.icon;
            return (
              <button
                key={tab}
                onClick={() => selectTab(tab)}
                className={cn(
                  'flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-all duration-200 whitespace-nowrap shrink-0',
                  isActive
                    ? 'bg-primary text-background shadow-md shadow-primary/20 scale-[1.02]'
                    : 'text-text-muted hover:text-text-primary hover:bg-white/[0.04]'
                )}
              >
                <Icon size={14} />
                {bot.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Bot Rationale Strip */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 rounded-xl bg-surface border border-border/80 text-xs leading-relaxed shadow-sm">
        <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
          <activeBot.icon size={16} />
        </div>
        <div className="flex-1">
          <strong className="text-text-primary font-bold">{activeBot.label} Strategy: </strong>
          <span className="text-text-secondary">{activeBot.desc}</span>
        </div>
      </div>

      {/* Active Bot Studio Container */}
      <div className="flex-1 min-h-0 bg-surface border border-border rounded-2xl p-4 md:p-6 shadow-xl overflow-y-auto animate-fade-in">
        <ActiveComponent />
      </div>
    </div>
  );
};
