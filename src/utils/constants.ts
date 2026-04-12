export const API_URLS = {
  mainnet: {
    spotRest: 'https://mainnet-gw.sodex.dev/api/v1/spot',
    perpsRest: 'https://mainnet-gw.sodex.dev/api/v1/perps',
    spotWS: 'wss://mainnet-gw.sodex.dev/ws/spot',
    perpsWS: 'wss://mainnet-gw.sodex.dev/ws/perps'
  },
  testnet: {
    spotRest: 'https://testnet-gw.sodex.dev/api/v1/spot',
    perpsRest: 'https://testnet-gw.sodex.dev/api/v1/perps',
    spotWS: 'wss://testnet-gw.sodex.dev/ws/spot',
    perpsWS: 'wss://testnet-gw.sodex.dev/ws/perps'
  }
};

export const ORDER_TYPES = {
  LIMIT: 'LIMIT',
  MARKET: 'MARKET',
  STOP: 'STOP',
  STOP_LIMIT: 'STOP_LIMIT',
  TRAILING_STOP: 'TRAILING_STOP'
};

export const ORDER_SIDES = {
  BUY: 'BUY',
  SELL: 'SELL',
  LONG: 'LONG',
  SHORT: 'SHORT'
};

export const POSITION_SIDES = {
  LONG: 'LONG',
  SHORT: 'SHORT',
  BOTH: 'BOTH'
};

export const TRANSFER_TYPES = {
  PERPS_WITHDRAW: 'PERPS_WITHDRAW',
  SPOT_WITHDRAW: 'SPOT_WITHDRAW',
  EVM_WITHDRAW: 'EVM_WITHDRAW'
};

export const TIME_IN_FORCE = {
  GTC: 'GTC', // Good Till Cancelled
  IOC: 'IOC', // Immediate or Cancel
  GTX: 'GTX'  // Post-Only
};
