const axios = require('axios');
axios.get('https://mainnet-gw.sodex.dev/api/v1/perps/accounts/0x8D38eEBEF75471F8E1d4B58E97E2519965aBdf62/state')
  .then(res => console.log(JSON.stringify(res.data, null, 2)))
  .catch(err => console.log('ERROR:', err.response ? err.response.data : err.message));
