import fetch from 'node-fetch';

const ODOO_CONFIG = {
  url: 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com',
  db: 'lapadevadmin-lapa-v2-main-7268478',
  username: 'paul@lapa.ch',
  password: 'lapa201180'
};

let sessionId: string = '';

async function authenticate(): Promise<void> {
  const response = await fetch(`${ODOO_CONFIG.url}/web/session/authenticate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        db: ODOO_CONFIG.db,
        login: ODOO_CONFIG.username,
        password: ODOO_CONFIG.password
      },
      id: Date.now()
    })
  });

  const data: any = await response.json();
  const cookies = response.headers.get('set-cookie');

  if (cookies) {
    const sessionMatch = cookies.match(/session_id=([^;]+)/);
    if (sessionMatch) {
      sessionId = sessionMatch[1];
    }
  }
}

async function callOdoo(endpoint: string, params: any) {
  const response = await fetch(`${ODOO_CONFIG.url}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_id=${sessionId}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: params,
      id: Date.now()
    })
  });

  const data: any = await response.json();
  return data;
}

async function main() {
  try {
    console.log('🔐 Authenticating...');
    await authenticate();
    console.log('✅ Authenticated with session:', sessionId.substring(0, 20) + '...\n');

    // Method 1: Using search_read directly
    console.log('Method 1: Direct search_read');
    const result1 = await callOdoo('/web/dataset/search_read', {
      model: 'blog.post',
      fields: ['id', 'name'],
      domain: [],
      limit: 10
    });
    console.log('Result 1:', JSON.stringify(result1, null, 2));

    // Method 2: Using call_kw with search_read
    console.log('\nMethod 2: call_kw search_read');
    const result2 = await callOdoo('/web/dataset/call_kw', {
      model: 'blog.post',
      method: 'search_read',
      args: [[]],
      kwargs: {
        fields: ['id', 'name'],
        limit: 10
      }
    });
    console.log('Result 2:', JSON.stringify(result2, null, 2));

    // Method 3: Search then read
    console.log('\nMethod 3: Search then read');
    const searchResult = await callOdoo('/web/dataset/call_kw', {
      model: 'blog.post',
      method: 'search',
      args: [[['id', '>=', 70], ['id', '<=', 90]]],
      kwargs: { limit: 20 }
    });
    console.log('Search result:', JSON.stringify(searchResult, null, 2));

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main();
