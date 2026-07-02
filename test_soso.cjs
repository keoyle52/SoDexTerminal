const https = require('https');

function check(url, label) {
  https.get(url, res => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
      const parsed = JSON.parse(data);
      const soso = parsed.data.filter(t => t.symbol.toUpperCase().includes('SOSO'));
      console.log(label, soso);
    });
  }).on('error', console.error);
}

check('https://mainnet-gw.sodex.dev/api/v1/spot/markets/tickers', 'MAINNET SPOT:');
check('https://testnet-gw.sodex.dev/api/v1/spot/markets/tickers', 'TESTNET SPOT:');
