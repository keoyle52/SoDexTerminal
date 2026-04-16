import axios from 'axios';

const BASE_URL = 'https://openapi.sosovalue.com';
const API_KEY = process.argv[2] || '';

console.log('Testing with API KEY:', API_KEY ? 'PROVIDED' : 'NONE');

const client = axios.create({
  baseURL: BASE_URL,
  headers: API_KEY ? { 'x-soso-api-key': API_KEY } : {}
});

async function main() {
  try {
    console.log('\n1. Test Coin List');
    const btc = await client.post('/openapi/v1/data/default/coin/list', {});
    console.log('Coin List Response:', btc.data?.code, btc.data?.msg || 'SUCCESS');
  } catch(e) {
    console.log('Coin List ERROR:', e.response?.status, e.response?.data || e.message);
  }

  try {
    console.log('\n2. Test News');
    const news = await client.get('/api/v1/news/featured');
    console.log('News Response:', news.data?.code, news.data?.msg || 'SUCCESS');
  } catch(e) {
    console.log('News ERROR:', e.response?.status, e.response?.data || e.message);
  }

  try {
    console.log('\n3. Test ETF Metrics');
    const etf = await client.post('/openapi/v2/etf/currentEtfDataMetrics', { type: 'us-btc-spot' });
    console.log('ETF Response:', etf.data?.code, etf.data?.msg || 'SUCCESS');
  } catch(e) {
    console.log('ETF ERROR:', e.response?.status, e.response?.data || e.message);
  }
}

main();
