import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { Button } from './common/Button';
import { Wallet, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';

/**
 * WalletConnect Button Component
 * 
 * Supports:
 * - MetaMask (window.ethereum)
 * - Other EIP-1193 compatible wallets
 * 
 * Uses ethers.js v6 BrowserProvider for signing.
 */

export const WalletConnect: React.FC<{ className?: string }> = ({ className }) => {
  const { isWalletConnected, walletAddress, connectWallet, disconnectWallet } = useSettingsStore();
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasMetaMask, setHasMetaMask] = useState(false);

  useEffect(() => {
    // Check if MetaMask or any EIP-1193 wallet is available
    const checkWallet = () => {
      const win = window as any;
      setHasMetaMask(!!win.ethereum);
    };
    checkWallet();
  }, []);

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
        toast.success(`Connected: ${address.slice(0, 6)}...${address.slice(-4)}`);
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
    disconnectWallet();
    toast.success('Wallet disconnected');
  };

  // Connected state
  if (isWalletConnected && walletAddress) {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <div className="flex items-center gap-2 px-3 py-2 bg-success/10 border border-success/30 rounded-lg">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span className="text-sm font-mono text-success">
            {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
          </span>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleDisconnect}
        >
          Disconnect
        </Button>
      </div>
    );
  }

  // Disconnected state
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
