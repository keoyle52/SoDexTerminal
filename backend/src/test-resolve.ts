import axios from 'axios';

const address = '0x9f8a3dc88568ccd58f89ed7b32d8329c6e037a45'; // Example active wallet
const networks = ['mainnet', 'testnet'] as const;

async function test() {
  for (const net of networks) {
    const spot = `https://${net === 'mainnet' ? 'mainnet' : 'testnet'}-gw.sodex.dev/api/v1/spot/accounts/${address}/state`;
    const perps = `https://${net === 'mainnet' ? 'mainnet' : 'testnet'}-gw.sodex.dev/api/v1/perps/accounts/${address}/state`;
    
    console.log(`--- Testing ${net.toUpperCase()} ---`);
    try {
      const res = await axios.get(spot);
      console.log(`[SPOT] Success:`, JSON.stringify(res.data));
    } catch (err: any) {
      console.log(`[SPOT] Failed:`, err.message, err.response?.data ? JSON.stringify(err.response.data) : '');
    }

    try {
      const res = await axios.get(perps);
      console.log(`[PERPS] Success:`, JSON.stringify(res.data));
    } catch (err: any) {
      console.log(`[PERPS] Failed:`, err.message, err.response?.data ? JSON.stringify(err.response.data) : '');
    }
  }
}

test();
