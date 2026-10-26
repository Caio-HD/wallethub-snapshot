const axios = require('axios');

async function test() {
  try {
    const res = await axios.post('http://localhost:3001/api/auth/validate-identifier', {
      identifier: 'admin'
    });
    console.log('SUCCESS:', res.data);
  } catch (err) {
    console.error('ERROR:', err.response ? err.response.data : err.message);
  }
}

test();
