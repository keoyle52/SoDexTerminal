import { useEffect, useState } from 'react';
import { useAccountStore } from '../store/accountStore';
import { useSettingsStore } from '../store/settingsStore';
import { useMarketStore } from '../store/marketStore';
import { spotClient } from '../api/rest/spotClient';
import { perpsClient } from '../api/rest/perpsClient';
import { ethers } from 'ethers';

export function useAccount() {
  const { apiKeyName, privateKey } = useSettingsStore();
  const { activeMarket } = useMarketStore();
  const accountState = useAccountStore();
  const [loading, setLoading] = useState(false);

  // Derive EVM Address natively from stored private key in memory
  useEffect(() => {
    if (privateKey) {
      try {
        const wallet = new ethers.Wallet(privateKey);
        accountState.setAddress(wallet.address);
      } catch (err) {
        console.error("[Account Hook] Invalid local private key provided", err);
        accountState.setAddress(null);
      }
    } else {
      accountState.setAddress(null);
      accountState.resetAccountData();
    }
    // Intentionally skipped accountState to limit strict hooks linting triggers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [privateKey]);

  // Fetch REST base state initially if address is configured
  useEffect(() => {
    if (!accountState.address || !privateKey || !apiKeyName) return;

    let isMounted = true;
    const fetchAccountData = async () => {
      setLoading(true);
      try {
        const addr = accountState.address as string;
        const client = activeMarket === 'spot' ? spotClient : perpsClient;
        
        const [balances, openOrders, history, trades, feeRate] = await Promise.all([
           client.getBalances(addr).catch(() => null),
           client.getOrders(addr).catch(() => []),
           client.getOrderHistory(addr).catch(() => []),
           client.getTradeHistory(addr).catch(() => []),
           client.getFeeRate(addr).catch(() => null)
        ]);
        
        if (isMounted) {
          accountState.setBalances(balances);
          // If valid arrays, populate them, reducing visual breakage when api offline
          if (Array.isArray(openOrders)) accountState.setOpenOrders(openOrders);
          if (Array.isArray(history)) accountState.setOrderHistory(history);
          if (Array.isArray(trades)) accountState.setTradeHistory(trades);
          accountState.setFeeRate(feeRate);
          
          if (activeMarket === 'perps') {
             const [perpsPositions, perpsFunding] = await Promise.all([
               perpsClient.getPositions(addr).catch(() => []),
               perpsClient.getFundings(addr).catch(() => [])
             ]);
             if (Array.isArray(perpsPositions)) accountState.setPositions(perpsPositions);
             if (Array.isArray(perpsFunding)) accountState.setFundingHistory(perpsFunding);
          }
        }
      } catch (error) {
        console.error("[Account Hook] Failed to fetch initial account state", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchAccountData();
  }, [accountState.address, activeMarket, apiKeyName, privateKey]);

  return { loading, accountState };
}
