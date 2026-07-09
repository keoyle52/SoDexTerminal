/**
 * SoDEX request signer — TypeScript port of the Go SDK.
 * Rules: payloadHash = keccak256(compactJSON({ type, params })),
 * keys in exact Go struct field order, signature prefixed with 0x01.
 */
import { keccak256, toBytes, toHex, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

export type SodexDomainName = 'spot' | 'futures';

export const CHAIN_IDS = {
  mainnet: 286623,
  testnet: 138565,
} as const;

export type SodexNetwork = keyof typeof CHAIN_IDS;

export interface PerpsOrderItem {
  clOrdID: string;
  modifier: number;
  side: number;
  type: number;
  timeInForce: number;
  price?: string;
  quantity?: string;
  funds?: string;
  stopPrice?: string | null;
  stopType?: number;
  triggerType?: number;
  reduceOnly: boolean;
  positionSide: number;
}

export function buildPerpsNewOrderParams(args: {
  accountID: number;
  symbolID: number;
  orders: PerpsOrderItem[];
}) {
  const orderedOrders = args.orders.map((o) => {
    const item: Record<string, unknown> = {
      clOrdID: o.clOrdID,
      modifier: o.modifier,
      side: o.side,
      type: o.type,
      timeInForce: o.timeInForce,
    };
    if (o.price !== undefined) item.price = o.price;
    if (o.quantity !== undefined) item.quantity = o.quantity;
    if (o.funds !== undefined) item.funds = o.funds;
    if (o.stopPrice !== undefined && o.stopPrice !== null) item.stopPrice = o.stopPrice;
    if (o.stopType !== undefined) item.stopType = o.stopType;
    if (o.triggerType !== undefined) item.triggerType = o.triggerType;
    item.reduceOnly = o.reduceOnly;
    item.positionSide = o.positionSide;
    return item;
  });

  return {
    accountID: args.accountID,
    symbolID: args.symbolID,
    orders: orderedOrders,
  };
}

export function computePayloadHash(actionType: string, params: unknown): Hex {
  const payload = { type: actionType, params };
  const json = JSON.stringify(payload);
  return keccak256(toBytes(json));
}

export async function signSodexAction(opts: {
  privateKey: Hex;
  domainName: SodexDomainName;
  network: SodexNetwork;
  actionType: string;
  params: Record<string, unknown>;
  nonce?: number;
}) {
  const account = privateKeyToAccount(opts.privateKey);
  const nonce = opts.nonce ?? Date.now();
  const payloadHash = computePayloadHash(opts.actionType, opts.params);

  const signature = await account.signTypedData({
    domain: {
      name: opts.domainName,
      version: '1',
      chainId: CHAIN_IDS[opts.network],
      verifyingContract: '0x0000000000000000000000000000000000000000',
    },
    types: {
      ExchangeAction: [
        { name: 'payloadHash', type: 'bytes32' },
        { name: 'nonce', type: 'uint64' },
      ],
    },
    primaryType: 'ExchangeAction',
    message: {
      payloadHash,
      nonce: BigInt(nonce),
    },
  });

  const typedSignature = ('0x01' + signature.slice(2)) as Hex;

  return {
    apiKey: account.address,
    signature: typedSignature,
    nonce,
    body: opts.params,
  };
}
