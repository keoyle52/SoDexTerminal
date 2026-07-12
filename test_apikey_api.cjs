const axios = require('axios');
axios.post('https://mainnet-gw.sodex.dev/api/v1/spot/accounts/api-keys', {
  accountID: 0,
  name: 'test',
  type: 1,
  publicKey: '0x123',
  expiresAt: 0
}).then(res => console.log('STATUS:', res.status, 'DATA:', res.data)).catch(err => console.log('ERROR:', err.response ? err.response.data : err.message));
