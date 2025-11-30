// Test del rpcClient session manager
const ODOO_URL = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24517859.dev.odoo.com';

// Simula quello che fa il sessionManager
async function testRPCClient() {
  console.log('Testing RPC Client...');
  console.log('ODOO_URL:', ODOO_URL);

  // Credenziali da env o default
  const credentials = {
    url: ODOO_URL,
    db: process.env.ODOO_DB || 'lapadevadmin-lapa-v2-staging-2406-24517859',
    login: process.env.ODOO_USERNAME || 'paul@lapa.ch',
    password: process.env.ODOO_PASSWORD || 'lapa201180'
  };

  console.log('Credentials:', { ...credentials, password: '***' });

  try {
    // 1. Authenticate
    console.log('\n1. Authenticating...');
    const authRes = await fetch(`${credentials.url}/web/session/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        params: {
          db: credentials.db,
          login: credentials.login,
          password: credentials.password
        }
      })
    });

    const authData = await authRes.json();

    if (authData.error) {
      console.log('AUTH ERROR:', authData.error);
      return;
    }

    if (!authData.result || !authData.result.uid) {
      console.log('AUTH FAILED - no uid. Response:', JSON.stringify(authData, null, 2).substring(0, 500));
      return;
    }

    console.log('Authenticated! UID:', authData.result.uid);

    // Estrai session_id dal Set-Cookie header
    const setCookie = authRes.headers.get('set-cookie');
    console.log('Set-Cookie header:', setCookie);

    let sessionId = authData.result.session_id;
    console.log('Session ID from response:', sessionId);

    // 2. Test search_read usando callKw come fa il rpcClient
    console.log('\n2. Testing search_read via callKw...');

    const searchRes = await fetch(`${credentials.url}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'res.partner',
          method: 'search_read',
          args: [[['email', '=', 'paul@lapa.ch']]],
          kwargs: {
            fields: ['id', 'name', 'email'],
            limit: 5
          }
        },
        id: Math.floor(Math.random() * 1000000)
      })
    });

    const searchData = await searchRes.json();

    if (searchData.error) {
      console.log('SEARCH ERROR:', JSON.stringify(searchData.error, null, 2));
    } else {
      console.log('SUCCESS! Found:', JSON.stringify(searchData.result, null, 2));
    }

  } catch (err) {
    console.log('ERROR:', err.message, err.stack);
  }
}

testRPCClient();
