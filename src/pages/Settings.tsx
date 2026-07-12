import React, { useState, useMemo } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { perpsClient } from '../api/perpsClient';
import toast from 'react-hot-toast';
import { ethers } from 'ethers';
import { Wallet, Wifi, FlaskConical } from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import WalletConnect from '../components/WalletConnect';
import { deriveAddressFromPrivateKey } from '../api/signer';

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

  const credentialsMissing = !store.isWalletConnected && (!store.apiKeyName || !store.privateKey || !store.evmAddress);

  const handleTestConnection = async () => {
    if (!effectiveAddress) {
      toast.error('Enter a valid mainnet Master EVM Address.');
      return;
    }
    setTesting(true);
    try {
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
                <strong>Required credentials missing.</strong> Connect your Web3 wallet above to place orders and use bot features.
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
          </div>
        </div>
      </div>
    </div>
  );
};
