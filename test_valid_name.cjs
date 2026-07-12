const axios = require('axios');
axios.post('https://mainnet-gw.sodex.dev/api/v1/spot/accounts/api-keys', {
  accountID: 1234,
  name: 'Terminal_123',
  type: 1,
  publicKey: '0x1234567890123456789012345678901234567890',
  expiresAt: 0
}, {
  headers: {
    'X-API-Nonce': Date.now().toString(),
    'X-API-Sign': '0x02' + '00'.repeat(64)
  }
}).then(res => console.log('DATA:', res.data)).catch(err => console.log('ERROR:', err.response ? err.response.data : err.message));
