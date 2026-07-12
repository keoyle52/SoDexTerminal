import React, { useState, useMemo } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { perpsClient } from '../api/perpsClient';
import { wsService } from '../api/websocket';
import { clearServiceCaches } from '../api/services';
import { deriveAddressFromPrivateKey } from '../api/signer';
import toast from 'react-hot-toast';
import { ethers } from 'ethers';
import { Shield, Settings2, Info, Wifi, Unplug, Globe, Sun, Wallet, Key, Bell, Hash, FlaskConical } from 'lucide-react';
import { Card } from '../components/common/Card';
import { Input } from '../components/common/Input';
import { Toggle } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { cn } from '../lib/utils';
import WalletConnect from '../components/WalletConnect';

const TABS = [
  { id: 'api' as const, label: 'API Connection', icon: Key },
  { id: 'preferences' as const, label: 'Preferences', icon: Settings2 },
  { id: 'about' as const, label: 'About', icon: Info },
];

export const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'api' | 'preferences' | 'about'>('api');
  const store = useSettingsStore();
  const [testing, setTesting] = useState(false);

  // Derive the address that corresponds to the active private key. On
  // testnet this IS the master wallet; on mainnet this is the agent /
  // API-key wallet (and the dedicated Master EVM Address is separate).
  const derivedAddress = useMemo(() => deriveAddressFromPrivateKey(store.privateKey), [store.privateKey]);

  // Address used in REST URL paths (balances / orders / positions / state):
  const effectiveAddress = useMemo(() => {
    const explicit = (store.evmAddress ?? '').trim();
    if (explicit && ethers.isAddress(explicit)) return explicit;
    return derivedAddress;
  }, [store.evmAddress, derivedAddress]);

  const evmAddressLooksValid = !store.evmAddress || ethers.isAddress(store.evmAddress.trim());

  const credentialsMissing = !store.isWalletConnected && (!store.apiKeyName || !store.privateKey || !store.evmAddress);

  const handleTestConnection = async () => {
    if (!effectiveAddress) {
      toast.error('Enter a valid mainnet Master EVM Address.');
      return;
    }
    setTesting(true);
    try {
      // Use the perps /state endpoint — it returns `aid` (accountID) and
      // validates that the address actually has a SoDEX account on the
      // current network. Public GETs are unsigned so we don't need a key.
      await perpsClient.get(`/accounts/${effectiveAddress}/state`);
      toast.success('Connection successful.');
    } catch (error: unknown) {
      const e = error as { response?: { data?: { error?: string; message?: string } } };
      const msg = e?.response?.data?.error
        ?? e?.response?.data?.message
        ?? (error instanceof Error ? error.message : 'Connection failed.');
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="p-3 sm:p-5 md:p-6 h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-surface/50 border border-border rounded-xl w-fit">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-lg transition-all duration-200',
                activeTab === tab.id
                  ? 'bg-primary/10 text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover',
              )}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="animate-fade-in">
          {activeTab === 'api' && (
            <div className="space-y-5 max-w-xl">
              {/* Web3 Wallet Connection Card */}
              <Card className="border-primary/30 bg-primary/5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Wallet size={18} className="text-primary" />
                    <h3 className="text-sm font-bold text-text-primary">Web3 Wallet Connection (Recommended)</h3>
                  </div>
                  <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded font-bold uppercase">Non-Custodial</span>
                </div>
                <p className="text-xs text-text-secondary mb-4 leading-relaxed">
                  Connect your MetaMask or browser Web3 wallet to sign SoDEX orders directly via EIP-712. No private keys are stored or persisted.
                </p>
                <WalletConnect />
              </Card>

              {credentialsMissing && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-danger/10 border border-danger/25">
                  <FlaskConical size={14} className="text-danger shrink-0 mt-0.5" />
                  <p className="text-xs text-danger leading-snug">
                    <strong>Required credentials missing.</strong> Connect your Web3 wallet above or fill in the private key fields below to place orders and use bot features.
                  </p>
                </div>
              )}




              <div className="flex items-center gap-3 pt-2">
                <Button
                  variant="outline"
                  icon={<Wifi size={14} />}
                  onClick={handleTestConnection}
                  loading={testing}
                  disabled={testing || !effectiveAddress}
                >
                  Test Connection
                </Button>
                <Button
                  variant="danger"
                  icon={<Unplug size={14} />}
                  onClick={store.disconnect}
                  className="ml-auto"
                  title="Clears mainnet credentials only"
                >
                  Disconnect Mainnet
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="space-y-5 max-w-xl">
              <Card>
                <div className="flex items-center gap-2 mb-5">
                  <Key size={16} className="text-primary" />
                  <h3 className="text-sm font-semibold">External API Keys</h3>
                </div>
                <div className="space-y-4">
                  <Input
                    label="SoSoValue API Key"
                    type="password"
                    value={store.sosoApiKey}
                    onChange={(e) => store.setSosoApiKey(e.target.value)}
                    placeholder="Enter SoSoValue key for ETF flows & Intelligence"
                    hint="Bypasses the backend to directly fetch Spot ETF flows and Market Intelligence from SoSoValue."
                  />
                  <Input
                    label="Gemini API Key"
                    type="password"
                    value={store.geminiApiKey}
                    onChange={(e) => store.setGeminiApiKey(e.target.value)}
                    placeholder="Enter Google Gemini key for AI features"
                    hint="Required for AI Price Predictor and AI Alpha Matrix."
                  />
                </div>
              </Card>

              <Card>
                <div className="flex items-center gap-2 mb-5">
                  <Hash size={16} className="text-primary" />
                  <h3 className="text-sm font-semibold">Defaults</h3>
                </div>
                <Input
                  label="Default Symbol"
                  type="text"
                  value={store.defaultSymbol}
                  onChange={(e) => store.setDefaultSymbol(e.target.value)}
                  placeholder="BTC-USD"
                />
              </Card>

              <Card>
                <div className="flex items-center gap-2 mb-5">
                  <Bell size={16} className="text-primary" />
                  <h3 className="text-sm font-semibold">Notifications & Confirmations</h3>
                </div>
                <div className="space-y-3">
                  <Toggle
                    label="Order Confirmation Dialog"
                    description="Show confirmation modal before placing orders"
                    checked={store.confirmOrders}
                    onChange={store.setConfirmOrders}
                  />
                  <Toggle
                    label="Toast Notifications"
                    description="Show order results as toast notifications"
                    checked={store.toastsEnabled}
                    onChange={store.setToastsEnabled}
                  />
                </div>
              </Card>

              <Card>
                <div className="flex items-center gap-2 mb-5">
                  <Sun size={16} className="text-primary" />
                  <h3 className="text-sm font-semibold">Appearance</h3>
                </div>
                <div className="space-y-3">
                  <Toggle
                    label="Light Theme"
                    description="Switch between dark and light color scheme"
                    checked={store.theme === 'light'}
                    onChange={(val) => store.setTheme(val ? 'light' : 'dark')}
                  />
                </div>
              </Card>

              <Card>
                <div className="flex items-center gap-2 mb-5">
                  <FlaskConical size={16} className="text-amber-400" />
                  <h3 className="text-sm font-semibold">Demo Mode</h3>
                </div>
                <div className="space-y-3">
                  <Toggle
                    label="Enable Demo Mode"
                    description="Explore the terminal with simulated data — no API key required"
                    checked={store.isDemoMode}
                    onChange={store.setIsDemoMode}
                  />
                  {store.isDemoMode && (
                    <div className="flex items-start gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                      <FlaskConical size={14} className="text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-400 leading-relaxed">
                        Demo mode active. Prices fluctuate in real-time via simulation. No real orders will be placed.
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="max-w-xl">
              <Card>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Info size={22} className="text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold gradient-text inline-block">SoDEX Toolset Terminal</h2>
                    <p className="text-sm text-text-secondary mt-2 leading-relaxed">
                      A professional-grade toolset for advanced algorithmic trading on SoDEX DEX,
                      featuring Grid Bot, TWAP Bot, DCA Bot, Copy Trading, and portfolio monitoring.
                    </p>
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="badge badge-primary">v1.0.0</div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
