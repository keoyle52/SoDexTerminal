import { ethers } from 'ethers';
import { perpsClient } from './perpsClient';
import { spotClient } from './spotClient';
import { useSettingsStore } from '../store/settingsStore';

function extractAccountId(raw: any): number | null {
  if (!raw) return null;
  const obj = raw.data ?? raw;
  if (typeof obj !== 'object') return null;
  const keys = ['aid', 'accountID', 'accountId', 'AccountID', 'account_id'];
  for (const k of keys) {
    const v = obj[k];
    if (v != null && v !== '') {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  if (Array.isArray(obj.balances)) {
    for (const b of obj.balances) {
      const id = extractAccountId(b);
      if (id) return id;
    }
  }
  return null;
}

/**
 * Service to handle the automated creation of SoDEX API Keys via EIP-712.
 */
export async function createAndRegisterApiKey(
  days: number,
  walletAddress: string
): Promise<{ privateKey: string; apiKeyName: string }> {
  // Validate days
  if (days < 1 || days > 180 || isNaN(days)) {
    throw new Error('Invalid authorization duration. Please select between 1 and 180 days.');
  }

  const isDemoMode = useSettingsStore.getState().isDemoMode;

  // 1. Fetch accountID using the public /state endpoint.
  let accountID: number | null = null;
  try {
    const spotState: any = await spotClient.get(`/accounts/${walletAddress}/state`).catch(() => null);
    accountID = extractAccountId(spotState);

    if (!accountID) {
      const perpsState: any = await perpsClient.get(`/accounts/${walletAddress}/state`).catch(() => null);
      accountID = extractAccountId(perpsState);
    }

    if (!accountID || accountID <= 0) {
      if (isDemoMode) {
        accountID = 999999;
      } else {
        throw new Error("ACCOUNT_NOT_FOUND");
      }
    }
  } catch (err: any) {
    if (isDemoMode) {
      accountID = 999999;
    } else {
      if (err?.message === 'ACCOUNT_NOT_FOUND' || err?.message?.includes('account not found')) {
        throw new Error("SoDEX Mainnet account not found. Please deposit funds on SoDEX first to create your on-chain account, or switch to Demo Mode.");
      }
      throw new Error(`Failed to fetch account ID from SoDEX: ${err?.message || 'Unknown Error'}`);
    }
  }

  // 2. Generate new agent wallet
  const agentWallet = ethers.Wallet.createRandom();
  const apiKeyName = agentWallet.address.toLowerCase();

  // 3. Compute expiresAt (Unix milliseconds)
  const expiresAt = Date.now() + days * 86400 * 1000;
  
  // 4. Get a monotonic nonce
  const nonce = Date.now();

  // 5. Build EIP-712 Signature Payload (Mainnet ChainID: 286623)
  const domain = {
    name: "universal",
    version: "1",
    chainId: 286623,
    verifyingContract: "0x0000000000000000000000000000000000000000"
  };

  const types = {
    AddAPIKey: [
      { name: "accountID", type: "uint64" },
      { name: "name", type: "string" },
      { name: "keyType", type: "uint8" },
      { name: "publicKey", type: "bytes" },
      { name: "expiresAt", type: "uint64" },
      { name: "nonce", type: "uint64" }
    ]
  };

  const message = {
    accountID: accountID,
    name: apiKeyName,
    keyType: 1, // 1 for EVM
    publicKey: agentWallet.address,
    expiresAt: expiresAt,
    nonce: nonce
  };

  const win = window as any;
  if (!win.ethereum) {
    throw new Error("MetaMask not found.");
  }

  const typedData = {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' }
      ],
      AddAPIKey: types.AddAPIKey
    },
    domain,
    primaryType: 'AddAPIKey',
    message
  };

  // Request signature from user's connected wallet
  const rawSignature = await win.ethereum.request({
    method: 'eth_signTypedData_v4',
    params: [walletAddress, JSON.stringify(typedData)]
  });

  // Convert raw signature to X-API-Sign (add 0x02 prefix, adjust recovery ID)
  const rawSigBytes = ethers.getBytes(rawSignature);
  const recoveryId = rawSigBytes[64];
  if (recoveryId === 27 || recoveryId === 28) {
    rawSigBytes[64] = recoveryId - 27;
  } else if (recoveryId !== 0 && recoveryId !== 1) {
    throw new Error(`Unexpected ECDSA recovery id: ${recoveryId}`);
  }
  const normalizedRawSignature = ethers.hexlify(rawSigBytes);
  const xApiSign = '0x02' + normalizedRawSignature.slice(2);

  if (isDemoMode) {
    console.log('[DEMO MODE] Skipped actual API Key registration.');
    return {
      privateKey: agentWallet.privateKey,
      apiKeyName: apiKeyName
    };
  }

  // 6. Submit POST request to SoDEX /accounts/api-keys
  const spotEndpoint = 'https://mainnet-gw.sodex.dev/api/v1/spot';
  const perpsEndpoint = 'https://mainnet-gw.sodex.dev/api/v1/perps';
  
  const payload = {
    accountID: accountID,
    name: apiKeyName,
    keyType: 1,
    publicKey: agentWallet.address,
    expiresAt: expiresAt
  };

  const fetchOpts = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-API-Sign': xApiSign,
      'X-API-Nonce': nonce.toString()
    },
    body: JSON.stringify(payload)
  };

  // Register on SPOT
  const spotRes = await fetch(`${spotEndpoint}/accounts/api-keys`, fetchOpts);
  if (!spotRes.ok) {
    const errorText = await spotRes.text();
    throw new Error(`Failed to authorize API key (Spot HTTP Error): ${errorText}`);
  }
  const spotJson = await spotRes.json();
  if (spotJson.code !== 0) {
    throw new Error(`Failed to authorize API key (Spot): ${spotJson.error || spotJson.msg || JSON.stringify(spotJson)}`);
  }

  // Register on PERPS
  const perpsRes = await fetch(`${perpsEndpoint}/accounts/api-keys`, fetchOpts);
  if (!perpsRes.ok) {
    const errorText = await perpsRes.text();
    throw new Error(`Failed to authorize API key (Perps HTTP Error): ${errorText}`);
  }
  const perpsJson = await perpsRes.json();
  if (perpsJson.code !== 0) {
    throw new Error(`Failed to authorize API key (Perps): ${perpsJson.error || perpsJson.msg || JSON.stringify(perpsJson)}`);
  }

  // Return the newly created agent credentials
  return {
    privateKey: agentWallet.privateKey,
    apiKeyName: apiKeyName
  };
}
