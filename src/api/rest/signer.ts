import { ethers, keccak256, toUtf8Bytes } from 'ethers';

// EIP-712 Domain types
export const EIP712_DOMAIN_TYPES = {
  ExchangeAction: [
    { name: 'payloadHash', type: 'bytes32' },
    { name: 'nonce', type: 'uint64' }
  ]
};

// Domain definitions based on network and market type
export const getDomain = (network: 'mainnet' | 'testnet', marketMode: 'spot' | 'perps') => {
  const chainId = network === 'mainnet' ? 286623 : 138565;
  const name = marketMode === 'spot' ? 'spot' : 'futures'; // spot: "spot", perps: "futures"
  return {
    name,
    version: '1',
    chainId,
    verifyingContract: '0x0000000000000000000000000000000000000000'
  };
};

/**
 * Formats a single Perps order item following the strict key rules and decimal stringification.
 */
function formatSinglePerpsOrder(orderItem: any): any {
  const orderedParams: any = {};
  
  // Perps order payload key strict order as defined by specifications:
  const keyOrder = [
    'clOrdID', 'modifier', 'side', 'type', 'timeInForce', 
    'price', 'quantity', 'funds', 'stopPrice', 'stopType', 
    'triggerType', 'reduceOnly', 'positionSide'
  ];

  // These fields must NEVER be omitted, even if they are 0 or false.
  const ALWAYS_INCLUDE = ['modifier', 'reduceOnly', 'positionSide'];

  // Iterating specifically through the defined order first
  keyOrder.forEach((key) => {
    // omitempty logic: skip if undefined/null, BUT ALWAYS include the 3 special fields
    if (ALWAYS_INCLUDE.includes(key) || (orderItem[key] !== undefined && orderItem[key] !== null)) {
      // Decimal string conversion check
      if (['price', 'quantity', 'funds', 'stopPrice'].includes(key) && typeof orderItem[key] === 'number') {
         orderedParams[key] = orderItem[key].toString();
      } else {
         // Ensure we don't accidentally drop it if it is falsy
         // If a required field is completely missing (undefined), we still set it so JSON stringify sees it
         if (orderItem[key] === undefined && ALWAYS_INCLUDE.includes(key)) {
             // Fallbacks to default zero values just in case they were completely undefined
             if (key === 'reduceOnly') orderedParams[key] = false;
             if (key === 'modifier') orderedParams[key] = 0;
             if (key === 'positionSide') orderedParams[key] = 'BOTH';
         } else {
             orderedParams[key] = orderItem[key];
         }
      }
    }
  });

  // Copy any missing params that aren't in the explicit order
  Object.keys(orderItem).forEach(key => {
    if (!keyOrder.includes(key) && orderItem[key] !== undefined && orderItem[key] !== null) {
      if (['price', 'quantity', 'funds', 'stopPrice'].includes(key) && typeof orderItem[key] === 'number') {
        orderedParams[key] = orderItem[key].toString();
      } else {
        orderedParams[key] = orderItem[key];
      }
    }
  });

  return orderedParams;
}

/**
 * Ensures object keys are strictly ordered for Perps orders to match Go struct representation.
 * Handles nested 'orders' array inside params securely.
 */
function orderPerpsPayload(payload: any): any {
  if (payload.type && payload.params) {
    const params = payload.params;
    const orderedParams: any = {};
    
    if (params.accountID !== undefined && params.accountID !== null) {
      orderedParams.accountID = params.accountID;
    }
    if (params.symbolID !== undefined && params.symbolID !== null) {
      orderedParams.symbolID = params.symbolID;
    }
    
    // Extract orders array and format it strictly item by item
    if (params.orders && Array.isArray(params.orders)) {
      orderedParams.orders = params.orders.map((item: any) => formatSinglePerpsOrder(item));
    }

    return { type: payload.type, params: orderedParams };
  }
  
  // Recursively clean non-order payloads
  return cleanPayload(payload);
}

/**
 * General function to recursively apply `omitempty` logic and decimal stringification
 */
function cleanPayload(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(cleanPayload).filter(v => v !== undefined && v !== null);
  } else if (obj !== null && typeof obj === 'object') {
    const cleaned: any = {};
    const ALWAYS_INCLUDE = ['modifier', 'reduceOnly', 'positionSide'];

    for (const key of Object.keys(obj)) {
      if (ALWAYS_INCLUDE.includes(key) || (obj[key] !== undefined && obj[key] !== null)) {
        if (['price', 'quantity', 'funds', 'stopPrice'].includes(key) && typeof obj[key] === 'number') {
           cleaned[key] = obj[key].toString();
        } else {
           // Provide fallback if undefined but always include
           if (obj[key] === undefined && ALWAYS_INCLUDE.includes(key)) {
             if (key === 'reduceOnly') cleaned[key] = false;
             if (key === 'modifier') cleaned[key] = 0;
             if (key === 'positionSide') cleaned[key] = 'BOTH';
           } else {
             cleaned[key] = cleanPayload(obj[key]);
           }
        }
      }
    }
    return cleaned;
  }
  return obj;
}

/**
 * Signs an exchange action payload securely using EIP-712 and Sodex Terminal rules.
 * 
 * @param privateKey - The user's private key (hex string)
 * @param network - 'mainnet' or 'testnet'
 * @param marketMode - 'spot' or 'perps'
 * @param payload - The literal payload object to be signed
 * @param nonce - Current Unix ms timestamp (BigInt)
 * @returns The signature prepended with `0x01`
 */
export async function signExchangeAction(
  privateKey: string,
  network: 'mainnet' | 'testnet',
  marketMode: 'spot' | 'perps',
  payload: any,
  nonce: bigint
): Promise<string> {
  const wallet = new ethers.Wallet(privateKey);
  const domain = getDomain(network, marketMode);

  // 1. Process Payload: Clean missing values, struct key order, arrays, and numbers-to-strings
  const processedPayload = marketMode === 'perps' ? orderPerpsPayload(payload) : cleanPayload(payload);

  // 2. Compact JSON
  const compactJsonString = JSON.stringify(processedPayload);

  // 3. Payload Hash
  const payloadHash = keccak256(toUtf8Bytes(compactJsonString));

  // 4. Construct EIP-712 Message
  const message = {
    payloadHash,
    nonce
  };

  // 5. Sign Typed Data
  const types = {
    ExchangeAction: EIP712_DOMAIN_TYPES.ExchangeAction
  };

  const rawSignature = await wallet.signTypedData(domain, types, message);

  // 6. Signature Formatting
  const customSignature = '0x01' + rawSignature.slice(2);

  return customSignature;
}
