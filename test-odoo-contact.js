const ODOO_URL = 'https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-staging-2406-25408900';
const ODOO_USERNAME = 'paul@lapa.ch';
const ODOO_PASSWORD = 'lapa201180';

async function testOdoo() {
  console.log('Testing Odoo connection...');
  console.log('URL:', ODOO_URL);
  console.log('DB:', ODOO_DB);
  console.log('User:', ODOO_USERNAME);

  try {
    // 1. Authenticate
    const authRes = await fetch(ODOO_URL + '/web/session/authenticate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: { db: ODOO_DB, login: ODOO_USERNAME, password: ODOO_PASSWORD },
        id: 1
      })
    });

    const authData = await authRes.json();

    if (authData.error) {
      console.log('\nAUTH ERROR:', JSON.stringify(authData.error, null, 2));
      return;
    }

    if (!authData.result || !authData.result.uid) {
      console.log('\nAUTH FAILED - Response:', JSON.stringify(authData, null, 2));
      return;
    }

    const sessionId = authData.result.session_id;
    console.log('\nAuthenticated! UID:', authData.result.uid);

    // 2. Search for contact by email
    console.log('\n--- Searching for paul@lapa.ch ---');
    const searchRes = await fetch(ODOO_URL + '/web/dataset/call_kw', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'session_id=' + sessionId
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'res.partner',
          method: 'search_read',
          args: [],
          kwargs: {
            domain: [['email', '=', 'paul@lapa.ch']],
            fields: ['id', 'name', 'email', 'parent_id', 'is_company'],
            limit: 10
          }
        },
        id: 2
      })
    });

    const searchData = await searchRes.json();

    if (searchData.error) {
      console.log('SEARCH ERROR:', JSON.stringify(searchData.error, null, 2));
    } else {
      console.log('Found contacts:', JSON.stringify(searchData.result, null, 2));
    }

    // 3. Try searching with ilike
    console.log('\n--- Searching with ilike ---');
    const ilikeRes = await fetch(ODOO_URL + '/web/dataset/call_kw', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'session_id=' + sessionId
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'res.partner',
          method: 'search_read',
          args: [],
          kwargs: {
            domain: [['email', 'ilike', 'paul@lapa']],
            fields: ['id', 'name', 'email'],
            limit: 10
          }
        },
        id: 3
      })
    });

    const ilikeData = await ilikeRes.json();
    if (ilikeData.error) {
      console.log('ILIKE ERROR:', JSON.stringify(ilikeData.error, null, 2));
    } else {
      console.log('Found with ilike:', JSON.stringify(ilikeData.result, null, 2));
    }

  } catch (err) {
    console.log('ERROR:', err.message, err.stack);
  }
}

testOdoo();
