import axios from 'axios';

async function test() {
  const address = '0x9f8a3dc88568ccd58f89ed7b32d8329c6e037a45';
  const url = `https://sodexterminal-production.up.railway.app/api/mirror/wallet/resolve?address=${address}&network=mainnet`;
  console.log(`Querying resolve endpoint: ${url}`);
  try {
    const res = await axios.get(url);
    console.log(`Success:`, JSON.stringify(res.data));
  } catch (err: any) {
    console.log(`Failed:`, err.message, err.response?.data ? JSON.stringify(err.response.data) : '');
  }
}

test();
