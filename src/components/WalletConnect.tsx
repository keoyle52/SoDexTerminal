import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { Button } from './common/Button';
import { Wallet, AlertCircle, Key, CheckCircle, Clock } from 'lucide-react';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';
import { createAndRegisterApiKey } from '../api/apiKeyService';

/**
 * WalletConnect Button & API Key Wizard Component
 * 
 * Flow:
 * 1. Connect Web3 Wallet (MetaMask)
 * 2. If no valid API Key exists, prompt to authorize one for N days.
 * 3. Once authorized, show connected state.
 */

export const WalletConnect: React.FC<{ className?: string }> = ({ className }) => {
  const store = useSettingsStore();
  const { isWalletConnected, walletAddress, connectWallet, disconnectWallet, privateKey, apiKeyExpiry } = store;
  
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasMetaMask, setHasMetaMask] = useState(false);
  
  // API Key Wizard state
  const [authDays, setAuthDays] = useState<number | string>(30);
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  useEffect(() => {
    const checkWallet = async () => {
      const win = window as any;
      const available = !!win.ethereum;
      setHasMetaMask(available);

      if (available && win.ethereum.request) {
        try {
          const accounts = await win.ethereum.request({ method: 'eth_accounts' });
          if (accounts && accounts[0]) {
            connectWallet(accounts[0]);
          }
        } catch {
          // Ignore error on silent check
        }

        const handleAccountsChanged = (accs: string[]) => {
          if (accs && accs.length > 0) {
            connectWallet(accs[0]);
          } else {
            disconnectWallet();
          }
        };

        win.ethereum.on?.('accountsChanged', handleAccountsChanged);
        return () => {
          win.ethereum.removeListener?.('accountsChanged', handleAccountsChanged);
        };
      }
    };
    checkWallet();
  }, [connectWallet, disconnectWallet]);

  const handleConnect = async () => {
    const win = window as any;
    
    if (!win.ethereum) {
      toast.error('MetaMask or Web3 wallet not found. Please install MetaMask.');
      return;
    }

    setIsConnecting(true);
    try {
      // Request account access
      const accounts = await win.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      if (accounts && accounts[0]) {
        const address = accounts[0];
        connectWallet(address);
        toast.success(`Wallet Connected!`);
      }
    } catch (error: any) {
      if (error.code === 4001) {
        toast.error('Connection rejected by user');
      } else {
        toast.error(error.message || 'Failed to connect wallet');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    store.disconnect();
    toast.success('Disconnected');
  };

  const handleAuthorize = async () => {
    const days = typeof authDays === 'string' ? parseInt(authDays, 10) : authDays;
    
    if (isNaN(days) || days < 1 || days > 180) {
      toast.error('Please enter a valid duration between 1 and 180 days.');
      return;
    }
    
    setIsAuthorizing(true);
    try {
      const { privateKey: newPk, apiKeyName } = await createAndRegisterApiKey(days, walletAddress);
      
      // Save to store
      store.setPrivateKey(newPk);
      store.setApiKeyName(apiKeyName);
      store.setEvmAddress(walletAddress);
      
      const expiry = Date.now() + days * 86400 * 1000;
      store.setApiKeyExpiry(expiry);
      toast.success('Wallet successfully authorized!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to authorize API key.');
    } finally {
      setIsAuthorizing(false);
    }
  };

  const handleDaysChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '') {
      setAuthDays('');
      return;
    }
    const num = parseInt(val, 10);
    if (!isNaN(num)) {
      setAuthDays(num);
    }
  };

  const isAuthorized = !!privateKey && (!apiKeyExpiry || apiKeyExpiry > Date.now());

  // --- Render State 2: Fully Connected and Authorized ---
  if (isWalletConnected && walletAddress && isAuthorized) {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <div className="flex flex-col gap-1 w-full">
          <div className="flex items-center justify-between px-3 py-2 bg-success/10 border border-success/30 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle size={14} className="text-success" />
              <span className="text-sm font-mono text-success">
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </span>
            </div>
            <span className="text-xs text-success font-medium flex items-center gap-1">
              <Key size={12} /> Authorized
            </span>
          </div>
          {apiKeyExpiry && (
             <div className="flex justify-end pr-1">
               <span className="text-[10px] text-text-muted flex items-center gap-1">
                  <Clock size={10} /> Exp: {new Date(apiKeyExpiry).toLocaleDateString()}
               </span>
             </div>
          )}
        </div>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleDisconnect}
          className="shrink-0"
        >
          Disconnect
        </Button>
      </div>
    );
  }

  // --- Render State 1.5: Connected but NOT Authorized (API Key Wizard) ---
  if (isWalletConnected && walletAddress && !isAuthorized) {
    return (
      <div className={cn("flex flex-col gap-4", className)}>
        <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-4">
          <div className="flex items-center gap-2 text-primary mb-2">
            <Key size={16} />
            <h4 className="text-sm font-bold">Authorize your wallet</h4>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">
            Select days to authorize your wallet. This generates a secure local key so bots can trade automatically without asking for MetaMask signatures every time.
          </p>
          
          <div className="flex items-center gap-2">
            {[1, 7, 30].map(d => (
              <button
                key={d}
                onClick={() => setAuthDays(d)}
                className={cn(
                  "flex-1 py-2 text-xs font-semibold rounded-lg border transition-all",
                  authDays === d 
                    ? "bg-primary/20 border-primary text-primary" 
                    : "bg-surface border-border text-text-muted hover:border-border-hover"
                )}
              >
                {d} {d === 1 ? 'Day' : 'Days'}
              </button>
            ))}
            
            <div className="relative flex-1">
              <input
                type="text"
                value={authDays}
                onChange={handleDaysChange}
                placeholder="Days"
                className="w-full py-2 pl-3 pr-8 text-xs font-semibold rounded-lg border border-border bg-surface text-text-primary focus:outline-none focus:border-primary/50 text-center"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-text-muted">
                d
              </span>
            </div>
          </div>

          {(typeof authDays === 'number' && (authDays < 1 || authDays > 180)) && (
            <p className="text-[10px] text-danger mt-1">Duration must be between 1 and 180 days.</p>
          )}

          <div className="flex gap-2 pt-2">
             <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                className="flex-1"
                disabled={isAuthorizing}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleAuthorize}
                loading={isAuthorizing}
                disabled={isAuthorizing || (typeof authDays === 'number' && (authDays < 1 || authDays > 180))}
                className="flex-[2]"
              >
                Proceed & Sign
              </Button>
          </div>
        </div>
      </div>
    );
  }

  // --- Render State 0: Not Connected ---
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Button
        variant="primary"
        size="lg"
        onClick={handleConnect}
        loading={isConnecting}
        disabled={isConnecting}
        icon={<Wallet size={18} />}
        fullWidth
      >
        {hasMetaMask ? 'Connect MetaMask' : 'Connect Wallet'}
      </Button>
      
      {!hasMetaMask && (
        <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg">
          <AlertCircle size={14} className="text-warning shrink-0 mt-0.5" />
          <p className="text-xs text-warning">
            MetaMask not detected.{' '}
            <a 
              href="https://metamask.io/download/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="underline hover:no-underline"
            >
              Install MetaMask
            </a>
          </p>
        </div>
      )}
    </div>
  );
};

export default WalletConnect;
