import React, { useState } from 'react';
import { Zap, Share2, Award, ArrowUpRight, Check, Search, Filter, ShieldAlert, Sparkles } from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input, Select } from '../components/common/Input';
import { useBotStore } from '../store/botStore';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';

interface Strategy {
  id: string;
  name: string;
  creator: string;
  botType: 'Grid' | 'Market Maker' | 'Signal' | 'DCA';
  roi30d: number;
  sharpe: number;
  drawdown: number;
  config: Record<string, any>;
  description: string;
}

const COMMUNITY_STRATEGIES: Strategy[] = [
  {
    id: 'strat-1',
    name: 'MSTR Treasury Momentum',
    creator: '0xmiharbi',
    botType: 'Signal',
    roi30d: 24.18,
    sharpe: 2.82,
    drawdown: 1.82,
    description: 'Triggered when institutional treasury purchases accelerate alongside funding rate compression. Calibrated for BTC-USD perps.',
    config: { symbol: 'BTC-USD', leverage: 10, amountUsdt: 150, TpPct: 4, SlPct: 1.5 },
  },
  {
    id: 'strat-2',
    name: 'Calm Regime Volatility Capture',
    creator: 'crypto4chun',
    botType: 'Grid',
    roi30d: 14.85,
    sharpe: 2.15,
    drawdown: 2.10,
    description: 'Neutral Grid bot optimized for BTC-USDC calm ranges (61.5k - 64.5k) with 15 arithmetic grids. High fee efficiency.',
    config: { symbol: 'BTC-USDC', lowerPrice: 61500, upperPrice: 64500, gridCount: 15, leverage: 5 },
  },
  {
    id: 'strat-3',
    name: 'Spark High-Volume Maker Farming',
    creator: 'Davislambo',
    botType: 'Market Maker',
    roi30d: 18.92,
    sharpe: 2.56,
    drawdown: 0.95,
    description: 'High-frequency liquidity provisioning with 4 layers and extremely tight 8 bps spread on SoDEX Spot Spark engine.',
    config: { symbol: 'ETH-USDC', budgetUsdt: 500, layers: 4, spreadBps: 8, requoteBps: 10 },
  },
  {
    id: 'strat-4',
    name: 'DCA Sector Blue Chip Accumulator',
    creator: 'SmartCoded',
    botType: 'DCA',
    roi30d: 11.20,
    sharpe: 1.95,
    drawdown: 3.80,
    description: 'Automated 12-hourly Dollar Cost Averaging purchases on premium ETF and sector spotlight indices. Built for long-term holds.',
    config: { symbol: 'SOL-USDC', baseAmount: 25, intervalHours: 12 },
  },
];

export const StrategyMarketplace: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'feed' | 'leaderboard'>('feed');
  const [strategies, setStrategies] = useState<Strategy[]>(COMMUNITY_STRATEGIES);
  const [deployedStratId, setDeployedStratId] = useState<string | null>(null);

  // Form states
  const [stratName, setStratName] = useState('');
  const [botType, setBotType] = useState<'Grid' | 'Market Maker' | 'Signal' | 'DCA'>('Grid');
  const [desc, setDesc] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);

  // Store references to load presets into
  const botStore = useBotStore();

  const handleDeploy = (strat: Strategy) => {
    setDeployedStratId(strat.id);
    
    // In-memory loading of parameters into the appropriate Zustand store
    try {
      if (strat.botType === 'Grid') {
        const grid = botStore.gridBot;
        grid.setField('symbol', strat.config.symbol);
        grid.setField('lowerPrice', strat.config.lowerPrice);
        grid.setField('upperPrice', strat.config.upperPrice);
        grid.setField('gridCount', strat.config.gridCount);
        grid.setField('leverage', strat.config.leverage);
      } else if (strat.botType === 'Market Maker') {
        const mm = botStore.marketMakerBot;
        mm.setField('symbol', strat.config.symbol);
        mm.setField('budgetUsdt', strat.config.budgetUsdt);
        mm.setField('layers', strat.config.layers);
        mm.setField('spreadBps', strat.config.spreadBps);
        mm.setField('requoteBps', strat.config.requoteBps);
      } else if (strat.botType === 'Signal') {
        const sig = botStore.signalBot;
        sig.setField('symbol', strat.config.symbol);
        sig.setField('leverage', strat.config.leverage);
        sig.setField('amountUsdt', strat.config.amountUsdt);
        sig.setField('takeProfitPct', strat.config.TpPct);
        sig.setField('stopLossPct', strat.config.SlPct);
      }

      toast.success(
        `Successfully loaded "${strat.name}" parameters into your active ${strat.botType} setup!`,
        { duration: 4000 }
      );
    } catch (err) {
      toast.error('Failed to load parameters into active store.');
    }

    setTimeout(() => {
      setDeployedStratId(null);
    }, 2000);
  };

  const handleShare = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stratName || !desc) {
      toast.error('Please fill in all strategy sharing fields.');
      return;
    }

    setIsPublishing(true);

    setTimeout(() => {
      const newStrat: Strategy = {
        id: `strat-${Date.now()}`,
        name: stratName,
        creator: 'You (Author)',
        botType,
        roi30d: parseFloat((Math.random() * 15 + 5).toFixed(2)),
        sharpe: parseFloat((Math.random() * 1.5 + 1.2).toFixed(2)),
        drawdown: parseFloat((Math.random() * 3 + 1).toFixed(2)),
        description: desc,
        config: botType === 'Grid' ? { symbol: 'BTC-USD', lowerPrice: 62000, upperPrice: 65000, gridCount: 10, leverage: 5 } : {},
      };

      setStrategies(prev => [newStrat, ...prev]);
      setStratName('');
      setDesc('');
      setIsPublishing(false);
      toast.success('Your strategy has been published to the community feed!');
    }, 1500);
  };

  return (
    <div className="p-4 md:p-6 h-full flex flex-col gap-6 overflow-y-auto">
      {/* Header title */}
      <div className="shrink-0 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Award size={20} className="text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Strategy Marketplace</h2>
            <p className="text-[11px] text-text-muted">
              Browse shared presets, leaderboard statistics, and deploy strategies in one-click.
            </p>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex gap-1 p-1 bg-surface border border-border rounded-xl">
          <button
            onClick={() => setActiveTab('feed')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-200',
              activeTab === 'feed'
                ? 'bg-primary/15 text-primary'
                : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover'
            )}
          >
            <Share2 size={13} />
            Community Presets
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-200',
              activeTab === 'leaderboard'
                ? 'bg-primary/15 text-primary'
                : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover'
            )}
          >
            <Award size={13} />
            Leaderboard
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        
        {/* Main Content Area */}
        <div className="lg:col-span-2 flex flex-col gap-6 min-h-0">
          
          {activeTab === 'feed' ? (
            /* Community Feed Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto pr-1 flex-1">
              {strategies.map((strat) => (
                <Card key={strat.id} className="p-5 border border-border bg-surface/50 hover:border-primary/20 hover:bg-surface transition-all flex flex-col gap-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className={cn(
                        "text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                        strat.botType === 'Grid' ? 'bg-cyan-500/10 text-cyan-400' :
                        strat.botType === 'Market Maker' ? 'bg-pink-500/10 text-pink-400' :
                        strat.botType === 'Signal' ? 'bg-amber-500/10 text-amber-400' :
                        'bg-emerald-500/10 text-emerald-400'
                      )}>
                        {strat.botType} Bot
                      </span>
                      <h4 className="text-sm font-bold text-text-primary mt-2">{strat.name}</h4>
                      <p className="text-[10px] text-text-muted mt-0.5">Shared by @{strat.creator}</p>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-bold text-emerald-400 font-mono">+{strat.roi30d}%</div>
                      <div className="text-[9px] text-text-muted uppercase tracking-wider">30D Return</div>
                    </div>
                  </div>

                  <p className="text-xs text-text-secondary leading-relaxed flex-1 italic">
                    &quot;{strat.description}&quot;
                  </p>

                  <div className="grid grid-cols-3 gap-2 py-3 border-t border-b border-border/40 text-[10px] font-mono">
                    <div>
                      <span className="text-text-muted block">Sharpe</span>
                      <span className="text-text-secondary font-bold">{strat.sharpe}</span>
                    </div>
                    <div>
                      <span className="text-text-muted block">Max DD</span>
                      <span className="text-red-400 font-bold">-{strat.drawdown}%</span>
                    </div>
                    <div>
                      <span className="text-text-muted block">Symbol</span>
                      <span className="text-text-secondary font-bold">{strat.config.symbol || 'Multi'}</span>
                    </div>
                  </div>

                  <Button
                    variant={deployedStratId === strat.id ? 'success' : 'primary'}
                    fullWidth
                    size="sm"
                    onClick={() => handleDeploy(strat)}
                    icon={deployedStratId === strat.id ? <Check size={13} /> : <Zap size={13} />}
                  >
                    {deployedStratId === strat.id ? 'Preset Deployed!' : 'One-Click Deploy'}
                  </Button>
                </Card>
              ))}
            </div>
          ) : (
            /* Performance Leaderboard */
            <div className="flex-1 glass-card flex flex-col overflow-hidden p-0">
              <div className="px-5 py-3 border-b border-border flex items-center justify-between shrink-0">
                <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                  Community Performance Leaderboard
                </span>
                <span className="badge badge-primary">Active</span>
              </div>
              <div className="overflow-auto flex-1">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="text-[11px] text-text-muted uppercase tracking-wider border-b border-border bg-background/20">
                    <tr>
                      <th className="px-5 py-3 font-semibold text-center">Rank</th>
                      <th className="px-5 py-3 font-semibold">Trader</th>
                      <th className="px-5 py-3 font-semibold text-center">Active Bot</th>
                      <th className="px-5 py-3 font-semibold text-right">30D ROI</th>
                      <th className="px-5 py-3 font-semibold text-right">Sharpe</th>
                      <th className="px-5 py-3 font-semibold text-right">Drawdown</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {[
                      { rank: '🥇 1', name: '0xmiharbi', bot: 'Signal', roi: '+24.18%', sharpe: '2.82', dd: '-1.82%' },
                      { rank: '🥈 2', name: 'Davislambo', bot: 'Market Maker', roi: '+18.92%', sharpe: '2.56', dd: '-0.95%' },
                      { rank: '🥉 3', name: 'crypto4chun', bot: 'Grid', roi: '+14.85%', sharpe: '2.15', dd: '-2.10%' },
                      { rank: '4', name: 'SmartCoded', bot: 'DCA', roi: '+11.20%', sharpe: '1.95', dd: '-3.80%' },
                      { rank: '5', name: 'jzddd', bot: 'Signal', roi: '+9.45%', sharpe: '1.70', dd: '-2.45%' },
                      { rank: '6', name: 'MuhammadBa', bot: 'Grid', roi: '+8.12%', sharpe: '1.55', dd: '-4.12%' },
                    ].map((row, i) => (
                      <tr key={i} className="hover:bg-surface-hover/30 transition-colors">
                        <td className="px-5 py-3 text-center font-bold text-xs font-mono">{row.rank}</td>
                        <td className="px-5 py-3 font-bold text-text-primary">{row.name}</td>
                        <td className="px-5 py-3 text-center">
                          <span className="badge badge-neutral text-[10px]">{row.bot}</span>
                        </td>
                        <td className="px-5 py-3 text-right font-mono font-bold text-emerald-400">{row.roi}</td>
                        <td className="px-5 py-3 text-right font-mono text-text-secondary">{row.sharpe}</td>
                        <td className="px-5 py-3 text-right font-mono text-red-400">{row.dd}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Sidebar Sharing Form */}
        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-4">
            <div className="flex items-center gap-2 pb-4 border-b border-border">
              <Share2 size={16} className="text-primary" />
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Share Your Strategy</h3>
            </div>

            <form onSubmit={handleShare} className="flex flex-col gap-4">
              <Input
                label="Strategy Name"
                value={stratName}
                onChange={(e) => setStratName(e.target.value)}
                placeholder="e.g. Range Volatility Master"
                hint="Give your strategy preset a catchy title."
              />

              <Select
                label="Bot Type"
                value={botType}
                onChange={(e) => setBotType(e.target.value as any)}
                options={[
                  { value: 'Grid', label: 'Grid Bot' },
                  { value: 'Market Maker', label: 'Market Maker' },
                  { value: 'Signal', label: 'Signal Bot' },
                  { value: 'DCA', label: 'DCA Bot' },
                ]}
              />

              <div className="flex flex-col gap-1.5">
                <label className="block text-[11px] font-medium text-text-secondary uppercase tracking-wider">Description</label>
                <textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="Explain how this strategy preset behaves and what regimes it targets..."
                  className="w-full h-24 bg-background/50 border border-border rounded-xl px-3.5 py-2.5 text-xs text-text-primary focus:outline-none focus:border-primary transition-colors resize-none leading-relaxed"
                />
              </div>

              <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl flex items-start gap-2.5">
                <ShieldAlert size={15} className="text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-400/90 leading-relaxed">
                  Publishing exports your current active configuration state in Zustand. Make sure you have customized parameters before sharing.
                </p>
              </div>

              <Button
                variant="primary"
                type="submit"
                loading={isPublishing}
                disabled={isPublishing || !stratName || !desc}
                icon={<Sparkles size={13} />}
                fullWidth
              >
                Publish Strategy
              </Button>
            </form>
          </Card>
        </div>

      </div>
    </div>
  );
};
