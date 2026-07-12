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

export const Settings: React.FC = () => {
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
        <div className="animate-fade-in space-y-5 max-w-xl">
          {/* Web3 Wallet Connection Card */}
          <Card className="border-primary/30 bg-primary/5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Wallet size={18} className="text-primary" />
                <h3 className="text-sm font-bold text-text-primary">Web3 Wallet Connection (Recommended)</h3>
              </div>
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
