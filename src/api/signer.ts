import { ethers } from 'ethers';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const CHAIN_ID_MAINNET = 286623;

export type DomainType = 'spot' | 'futures';

export const getDomain = (type: DomainType) => ({
  name: type,
  version: '1',
  chainId: CHAIN_ID_MAINNET,
  verifyingContract: ZERO_ADDRESS,
});

export const EIP712_TYPES = {
  ExchangeAction: [
    { name: 'payloadHash', type: 'bytes32' },
    { name: 'nonce', type: 'uint64' },
  ],
};

export function normalizePrivateKey(pk: string): string {
  const trimmed = (pk ?? '').trim();
  if (!trimmed) return '';
  return trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;
}

export function deriveAddressFromPrivateKey(pk: string): string {
  const normalised = normalizePrivateKey(pk);
  if (!normalised) return '';
  try {
    return new ethers.Wallet(normalised).address;
  } catch {
    return '';
  }
}

const _nonceMap = new Map<string, bigint>();

export function getMonotonicNonce(apiKey?: string): string {
  const key = (apiKey ?? '__default__').toLowerCase();
  const now = BigInt(Date.now());
  const last = _nonceMap.get(key) ?? 0n;
  const next = now > last ? now : last + 1n;
  _nonceMap.set(key, next);
  return next.toString();
}

export function deriveActionType(method: string, url: string): string {
  const m = method.toUpperCase();
  if (url.includes('/trade/orders/schedule-cancel')) return 'scheduleCancel';
  if (url.includes('/trade/orders/replace')) return 'replaceOrder';
  if (url.includes('/trade/orders/modify')) return 'modifyOrder';
  if (url.includes('/trade/orders/batch')) {
    return m === 'DELETE' ? 'batchCancelOrder' : 'batchNewOrder';
  }
  if (url.includes('/trade/orders') && m === 'DELETE') return 'cancelOrder';
  if (url.includes('/trade/orders')) return 'newOrder';
  if (url.includes('/accounts/transfers')) return 'transferAsset';
  if (url.includes('/trade/leverage')) return 'updateLeverage';
  if (url.includes('/trade/margin')) return 'updateMargin';
  return 'action';
}

export async function signPayload(
  actionType: string,
  payload: Record<string, unknown>,
  privateKey: string,
  type: DomainType,
  apiKey?: string,
  useBrowserWallet = false,
): Promise<{ signature: string; nonce: string }> {
  let nonce: string;
  let rawSignature: string;

  const signingPayload = { type: actionType, params: payload ?? {} };
  const payloadString = JSON.stringify(signingPayload);
  const payloadHash = ethers.keccak256(ethers.toUtf8Bytes(payloadString));

  const domain = getDomain(type);

  if (useBrowserWallet) {
    const win = window as any;
    if (!win.ethereum) {
      throw new Error('MetaMask or another compatible browser wallet was not found.');
    }
    const accounts = await win.ethereum.request({ method: 'eth_accounts' });
    const address = accounts[0];
    if (!address) {
      throw new Error('Please connect your browser wallet via the Topbar or Settings first.');
    }
    nonce = getMonotonicNonce(apiKey ?? address);
    const values = { payloadHash, nonce };

    const typedData = {
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' }
        ],
        ExchangeAction: EIP712_TYPES.ExchangeAction
      },
      domain,
      primaryType: 'ExchangeAction',
      message: values
    };

    rawSignature = await win.ethereum.request({
      method: 'eth_signTypedData_v4',
      params: [address, JSON.stringify(typedData)]
    });
  } else {
    const normalisedPk = normalizePrivateKey(privateKey);
    if (!normalisedPk) throw new Error('Private key is required to sign requests');
    const wallet = new ethers.Wallet(normalisedPk);
    nonce = getMonotonicNonce(apiKey ?? wallet.address);
    const values = { payloadHash, nonce };
    rawSignature = await wallet.signTypedData(domain, EIP712_TYPES, values);
  }

  const rawSigBytes = ethers.getBytes(rawSignature);
  const recoveryId = rawSigBytes[64];
  if (recoveryId === 27 || recoveryId === 28) {
    rawSigBytes[64] = recoveryId - 27;
  } else if (recoveryId !== 0 && recoveryId !== 1) {
    throw new Error(`Unexpected ECDSA recovery id: ${recoveryId}`);
  }
  const normalizedRawSignature = ethers.hexlify(rawSigBytes);
  const signature = '0x01' + normalizedRawSignature.slice(2);

  return { signature, nonce };
}

export function resolveApiKey(params: {
  apiKeyName?: string;
  privateKey?: string;
  walletAddress?: string;
}): string {
  const { apiKeyName, privateKey, walletAddress } = params;
  const derived = deriveAddressFromPrivateKey(privateKey ?? '').toLowerCase() || (walletAddress ?? '').toLowerCase();
  const rawName = (apiKeyName ?? '').trim();
  const name = /^0x[0-9a-fA-F]{40}$/.test(rawName) ? rawName.toLowerCase() : rawName;
  return name || derived;
}
