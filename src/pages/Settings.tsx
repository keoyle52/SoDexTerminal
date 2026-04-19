import React, { useState, useMemo } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { perpsClient } from '../api/perpsClient';
import { wsService } from '../api/websocket';
import { clearServiceCaches } from '../api/services';
import { deriveAddressFromPrivateKey } from '../api/signer';
import toast from 'react-hot-toast';
import { ethers } from 'ethers';
import { Key, Shield, Settings2, Info, Wifi, Unplug, Globe, Bell, Hash, Zap, FlaskConical, Sun, Wallet } from 'lucide-react';
import { Card } from '../components/common/Card';
import { Input } from '../components/common/Input';
import { Toggle } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { cn } from '../lib/utils';

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
  //  - Mainnet: the explicit Master EVM Address (required).
  //  - Testnet: the optional override if set, else the derived address.
  const effectiveAddress = useMemo(() => {
    const explicit = (store.evmAddress ?? '').trim();
    if (explicit && ethers.isAddress(explicit)) return explicit;
    return store.isTestnet ? derivedAddress : '';
  }, [store.evmAddress, derivedAddress, store.isTestnet]);

  const evmAddressLooksValid = !store.evmAddress || ethers.isAddress(store.evmAddress.trim());

  const handleTestConnection = async () => {
    if (!effectiveAddress) {
      toast.error(
        store.isTestnet
          ? 'Enter a valid testnet Private Key.'
          : 'Enter a valid mainnet Master EVM Address.',
      );
      return;
    }
    setTesting(true);
    try {
      // Use the perps /state endpoint — it returns `aid` (accountID) and
      // validates that the address actually has a SoDEX account on the
      // current network. Public GETs are unsigned so we don't need a key.
      await perpsClient.get(`/accounts/${effectiveAddress}/state`);
      toast.success(`Connection successful (${store.isTestnet ? 'testnet' : 'mainnet'}).`);
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
    <div className="p-6 h-[calc(100vh-52px)] overflow-y-auto">
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
              {/* Network selector — primary choice that controls which
                  credential set below is active. Shown FIRST so the user
                  sees the right fields without toggling back. */}
              <Card>
                <div className="flex items-center gap-2 mb-5">
                  <Globe size={16} className="text-primary" />
                  <h3 className="text-sm font-semibold">Network</h3>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      store.setIsTestnet(false);
                      wsService.switchNetwork(false);
                      clearServiceCaches();
                    }}
                    className={`flex-1 py-3 text-sm rounded-lg border transition-all duration-200 font-medium ${
                      !store.isTestnet
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background/40 text-text-muted hover:border-border-hover'
                    }`}
                  >
                    Mainnet
                  </button>
                  <button
                    onClick={() => {
                      store.setIsTestnet(true);
                      wsService.switchNetwork(true);
                      clearServiceCaches();
                    }}
                    className={`flex-1 py-3 text-sm rounded-lg border transition-all duration-200 font-medium ${
                      store.isTestnet
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background/40 text-text-muted hover:border-border-hover'
                    }`}
                  >
                    Testnet
                  </button>
                </div>

                {!store.isTestnet && (
                  <div className="mt-3 flex items-start gap-2 p-3 bg-warning/5 border border-warning/20 rounded-lg">
                    <Info size={14} className="text-warning shrink-0 mt-0.5" />
                    <p className="text-xs text-warning leading-relaxed">
                      Mainnet: real assets are used. Sign requests with your registered API
                      key's private key (agent wallet, not the master) and set the Master
                      EVM Address to your master wallet. Mainnet and testnet account IDs
                      are independent.
                    </p>
                  </div>
                )}

                {store.isTestnet && (
                  <div className="mt-3 flex items-start gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                    <Info size={14} className="text-primary shrink-0 mt-0.5" />
                    <p className="text-xs text-primary leading-relaxed">
                      Testnet: paste your master wallet private key — writes are signed
                      with it. By default its derived address is used as X-API-Key. If
                      the gateway rejects it with “api key not found”, register an API
                      key on testnet and paste its name below. Mainnet credentials stay
                      safely in a separate slot and are restored when you switch back.
                    </p>
                  </div>
                )}
              </Card>

              {/* ───── Mainnet credentials (hidden on testnet) ───── */}
              {!store.isTestnet && (
                <Card>
                  <div className="flex items-center gap-2 mb-5">
                    <Shield size={16} className="text-primary" />
                    <h3 className="text-sm font-semibold">Mainnet Credentials</h3>
                  </div>

                  <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
                    <Input
                      label="API Key Name (X-API-Key)"
                      type="text"
                      value={store.mainnetApiKeyName}
                      onChange={(e) => store.setMainnetApiKeyName(e.target.value)}
                      placeholder="Name chosen when creating the API key (typically an EVM address)"
                      icon={<Key size={14} />}
                      hint="The name of the SoDEX API key you registered — sent as `X-API-Key` on every signed request."
                    />

                    <Input
                      label="Agent Private Key (NOT your master wallet key)"
                      type="password"
                      value={store.mainnetPrivateKey}
                      onChange={(e) => store.setMainnetPrivateKey(e.target.value)}
                      placeholder="0x..."
                      hint="Paste the API key's private key from the keypair you were given when creating the API key. Stored only in memory — never persisted to localStorage."
                    />

                    <Input
                      label="Master EVM Address (used in REST URL paths)"
                      type="text"
                      value={store.mainnetEvmAddress}
                      onChange={(e) => store.setMainnetEvmAddress(e.target.value)}
                      placeholder="0x... (required on mainnet)"
                      icon={<Wallet size={14} />}
                      hint="Your master wallet address — the one actually connected to SoDEX. Required because the private key above belongs to the agent, not the master."
                    />
                    {!evmAddressLooksValid && (
                      <p className="text-[10px] text-danger">Invalid EVM address format.</p>
                    )}

                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-medium text-text-secondary uppercase tracking-wider">
                        Derived address (from agent private key)
                      </label>
                      <div className="w-full bg-background/60 border border-border rounded-lg px-3 py-2.5 text-sm text-text-muted font-mono truncate">
                        {derivedAddress || 'Will appear once a valid private key is entered...'}
                      </div>
                      {derivedAddress && store.mainnetEvmAddress && store.mainnetEvmAddress.toLowerCase() !== derivedAddress.toLowerCase() && (
                        <p className="text-[10px] text-text-muted">
                          Derived address (API agent) differs from master EVM address — this is expected on mainnet.
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-medium text-text-secondary uppercase tracking-wider">
                        Effective URL address (used in GETs)
                      </label>
                      <div className="w-full bg-background/60 border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary font-mono truncate">
                        {effectiveAddress || '—'}
                      </div>
                    </div>
                  </form>
                </Card>
              )}

              {/* ───── Testnet credentials (hidden on mainnet) ───── */}
              {store.isTestnet && (
                <Card>
                  <div className="flex items-center gap-2 mb-5">
                    <Shield size={16} className="text-primary" />
                    <h3 className="text-sm font-semibold">Testnet Credentials</h3>
                  </div>

                  <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
                    <Input
                      label="Master Wallet Private Key"
                      type="password"
                      value={store.testnetPrivateKey}
                      onChange={(e) => store.setTestnetPrivateKey(e.target.value)}
                      placeholder="0x..."
                      hint="Paste your master EVM wallet private key. Testnet signs every write with this key directly. Stored only in memory — never persisted."
                    />

                    <Input
                      label="API Key Name (X-API-Key) — optional"
                      type="text"
                      value={store.testnetApiKeyName}
                      onChange={(e) => store.setTestnetApiKeyName(e.target.value)}
                      placeholder="Only needed if ‘api key not found’ errors appear"
                      icon={<Key size={14} />}
                      hint="Leave empty to use the derived address (legacy behaviour). Fill in only if the testnet gateway requires a registered API key — paste the name you used when registering it."
                    />

                    <Input
                      label="Master EVM Address (optional)"
                      type="text"
                      value={store.testnetEvmAddress}
                      onChange={(e) => store.setTestnetEvmAddress(e.target.value)}
                      placeholder="Optional — defaults to derived address"
                      icon={<Wallet size={14} />}
                      hint="By default the address derived from the private key above is used in REST URL paths. Set this only if your testnet master wallet differs from the signing key's derived address."
                    />
                    {!evmAddressLooksValid && (
                      <p className="text-[10px] text-danger">Invalid EVM address format.</p>
                    )}

                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-medium text-text-secondary uppercase tracking-wider">
                        Derived address (from private key)
                      </label>
                      <div className="w-full bg-background/60 border border-border rounded-lg px-3 py-2.5 text-sm text-text-muted font-mono truncate">
                        {derivedAddress || 'Will appear once a valid private key is entered...'}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-medium text-text-secondary uppercase tracking-wider">
                        Effective URL address (used in GETs)
                      </label>
                      <div className="w-full bg-background/60 border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary font-mono truncate">
                        {effectiveAddress || '—'}
                      </div>
                    </div>
                  </form>
                </Card>
              )}

              {/* SosoValue API */}
              <Card>
                <div className="flex items-center gap-2 mb-5">
                  <Hash size={16} className="text-primary" />
                  <div>
                    <h3 className="text-sm font-semibold">SosoValue API Key</h3>
                    <p className="text-[11px] text-text-muted mt-0.5">Required for ETF Tracker, Crypto News &amp; News Bot</p>
                  </div>
                </div>
                <Input
                  label="SosoValue API Key"
                  type="password"
                  value={store.sosoApiKey}
                  onChange={(e) => store.setSosoApiKey(e.target.value)}
                  placeholder="Enter your SosoValue API key..."
                  icon={<Key size={14} />}
                  hint="Get your key at sosovalue.com → API. Stored in localStorage."
                />
              </Card>

              {/* Gemini API */}
              <Card>
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 overflow-hidden flex items-center justify-center">
                    <Zap size={10} className="text-white fill-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Gemini AI API Key</h3>
                    <p className="text-[11px] text-text-muted mt-0.5">Powering "News Bot" intelligent sentiment analysis</p>
                  </div>
                </div>
                <Input
                  label="Gemini API Key"
                  type="password"
                  value={store.geminiApiKey}
                  onChange={(e) => store.setGeminiApiKey(e.target.value)}
                  placeholder="Enter your Gemini API key..."
                  icon={<Zap size={14} />}
                  hint="Get your key at aistudio.google.com/app/apikey"
                />
              </Card>

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
                  title={store.isTestnet ? 'Clears testnet credentials only' : 'Clears mainnet credentials only'}
                >
                  Disconnect {store.isTestnet ? 'Testnet' : 'Mainnet'}
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="space-y-5 max-w-xl">
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
