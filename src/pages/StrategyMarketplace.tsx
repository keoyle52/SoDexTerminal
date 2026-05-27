import React, { useState } from 'react';
import { Zap, Share2, Award, Check, ShieldAlert, Sparkles } from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input, Select } from '../components/common/Input';
import { useBotStore } from '../store/botStore';
import { useSettingsStore } from '../store/settingsStore';
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
    name: 'BTC-USD Range Sniper',
    creator: 'keolehunter',
    botType: 'Grid',
    roi30d: 18.42,
    sharpe: 2.45,
    drawdown: 1.90,
    description: 'Arithmetic Neutral Grid optimized for BTC range consolidation. Deploys 20 grid layers with tight 1.0% width around the 62k-68k baseline. Designed to farm sideways volatility with maximum fee rebate efficiency.',
    config: { symbol: 'BTC-USD', lowerPrice: 62000, upperPrice: 68000, gridCount: 20, leverage: 5 },
  },
  {
    id: 'strat-2',
    name: 'Perp Funding Arbitrage Scalper',
    creator: 'keolehunter',
    botType: 'Signal',
    roi30d: 27.85,
    sharpe: 3.12,
    drawdown: 1.25,
    description: 'An indicator-driven momentum signal strategy that executes LONG entries on RSI oversold (under 35) and SHORT entries on RSI overbought (above 65) with 10x leverage. Extremely fast risk protection cooldowns.',
    config: { symbol: 'BTC-USD', leverage: 10, amountUsdt: 200, TpPct: 3, SlPct: 1.5 },
  },
  {
    id: 'strat-3',
    name: 'High-Frequency BBO Market Maker',
    creator: 'keolehunter',
    botType: 'Market Maker',
    roi30d: 22.60,
    sharpe: 3.40,
    drawdown: 0.75,
    description: 'Pure market-making script that joins the best bid-ask queue (0 spread bps) with a 3-layer ladder. Quotes are automatically replaced if the BBO moves more than 4 bps. Perfect for spot volume farming.',
    config: { symbol: 'BTC-USD', budgetUsdt: 500, layers: 3, spreadBps: 0, requoteBps: 4 },
  },
  {
    id: 'strat-4',
    name: 'ETH Volatility Breakout Rider',
    creator: 'keolehunter',
    botType: 'Signal',
    roi30d: 31.20,
    sharpe: 2.89,
    drawdown: 2.15,
    description: 'Fires high-leverage positions on ETH when volatility spikes. Uses 3x ATR target locks and tight 1.5x ATR stops to capture explosive breakout moves during high-volume sessions.',
    config: { symbol: 'ETH-USD', leverage: 5, amountUsdt: 300, TpPct: 5, SlPct: 2 },
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
  const settings = useSettingsStore();

  const handleDeploy = (strat: Strategy) => {
    setDeployedStratId(strat.id);
    
    // In-memory loading of parameters into the appropriate Zustand store
    try {
      if (strat.botType === 'Grid') {
        const grid = botStore.gridBot;
        grid.setField('symbol', String(strat.config.symbol ?? ''));
        grid.setField('lowerPrice', String(strat.config.lowerPrice ?? ''));
        grid.setField('upperPrice', String(strat.config.upperPrice ?? ''));
        grid.setField('gridCount', String(strat.config.gridCount ?? ''));
        grid.setField('leverage', String(strat.config.leverage ?? ''));
      } else if (strat.botType === 'Market Maker') {
        const mm = botStore.marketMakerBot;
        mm.setField('symbol', String(strat.config.symbol ?? ''));
        mm.setField('budgetUsdt', String(strat.config.budgetUsdt ?? ''));
        mm.setField('layers', String(strat.config.layers ?? ''));
        mm.setField('spreadBps', String(strat.config.spreadBps ?? ''));
        mm.setField('requoteBps', String(strat.config.requoteBps ?? ''));
      } else if (strat.botType === 'Signal') {
        const sig = botStore.signalBot;
        sig.setField('symbol', String(strat.config.symbol ?? ''));
        sig.setField('leverage', String(strat.config.leverage ?? ''));
        sig.setField('amountUsdt', String(strat.config.amountUsdt ?? ''));
        sig.setField('takeProfitPct', String(strat.config.TpPct ?? ''));
        sig.setField('stopLossPct', String(strat.config.SlPct ?? ''));
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
      const creatorName = settings.isWalletConnected && settings.walletAddress
        ? `${settings.walletAddress.slice(0, 6)}...${settings.walletAddress.slice(-4)}`
        : '0x71C7...976F';

      let config: Record<string, any> = {};
      if (botType === 'Grid') {
        const grid = botStore.gridBot;
        config = {
          symbol: grid.symbol,
          lowerPrice: grid.lowerPrice,
          upperPrice: grid.upperPrice,
          gridCount: grid.gridCount,
          leverage: grid.leverage,
        };
      } else if (botType === 'Market Maker') {
        const mm = botStore.marketMakerBot;
        config = {
          symbol: mm.symbol,
          budgetUsdt: mm.budgetUsdt,
          layers: mm.layers,
          spreadBps: mm.spreadBps,
          requoteBps: mm.requoteBps,
        };
      } else if (botType === 'Signal') {
        const sig = botStore.signalBot;
        config = {
          symbol: sig.symbol,
          leverage: sig.leverage,
          amountUsdt: sig.amountUsdt,
          TpPct: sig.takeProfitPct,
          SlPct: sig.stopLossPct,
        };
      }

      const newStrat: Strategy = {
        id: `strat-${Date.now()}`,
        name: stratName,
        creator: creatorName,
        botType,
        roi30d: parseFloat((Math.random() * 15 + 5).toFixed(2)),
        sharpe: parseFloat((Math.random() * 1.5 + 1.2).toFixed(2)),
        drawdown: parseFloat((Math.random() * 3 + 1).toFixed(2)),
        description: desc,
        config,
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
                      <p className="text-[10px] text-text-muted mt-0.5">
                        Shared by {strat.creator.startsWith('0x') ? strat.creator : '@' + strat.creator}
                      </p>
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
                    variant="primary"
                    fullWidth
                    size="sm"
                    onClick={() => handleDeploy(strat)}
                    disabled={deployedStratId === strat.id}
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
                      { rank: '🥇 1', name: 'keolehunter', bot: 'Signal', roi: '+31.20%', sharpe: '2.89', dd: '-2.15%' },
                      { rank: '🥈 2', name: 'keolehunter', bot: 'Signal', roi: '+27.85%', sharpe: '3.12', dd: '-1.25%' },
                      { rank: '🥉 3', name: 'keolehunter', bot: 'Market Maker', roi: '+22.60%', sharpe: '3.40', dd: '-0.75%' },
                      { rank: '4', name: 'keolehunter', bot: 'Grid', roi: '+18.42%', sharpe: '2.45', dd: '-1.90%' },
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
