import { ethers } from 'ethers';
import { perpsClient } from './perpsClient';
import { useSettingsStore } from '../store/settingsStore';

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
  let accountID: number;
  try {
    const state: any = await perpsClient.get(`/accounts/${walletAddress}/state`);
    const dataObj = state.data || state;
    const accountStr = dataObj.account?.aid || dataObj.account?.accountID || dataObj.aid || dataObj.accountID || '0';
    accountID = parseInt(accountStr, 10);
    if (!accountID) {
      if (isDemoMode) {
        accountID = 999999;
      } else {
        throw new Error(`Could not parse account ID from SoDEX response: ${JSON.stringify(state)}`);
      }
    }
  } catch (err: any) {
    if (isDemoMode) {
      accountID = 999999;
    } else {
      throw new Error(
        err?.message?.includes('account not found') 
          ? "Account not found on SoDEX. Please deposit funds or interact with SoDEX first to create an account."
          : "Failed to fetch account ID from SoDEX."
      );
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
    type: 1,
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
    throw new Error(`Failed to authorize API key (Spot): ${errorText}`);
  }

  // Register on PERPS
  const perpsRes = await fetch(`${perpsEndpoint}/accounts/api-keys`, fetchOpts);
  if (!perpsRes.ok) {
    const errorText = await perpsRes.text();
    throw new Error(`Failed to authorize API key (Perps): ${errorText}`);
  }

  // Return the newly created agent credentials
  return {
    privateKey: agentWallet.privateKey,
    apiKeyName: apiKeyName
  };
}
