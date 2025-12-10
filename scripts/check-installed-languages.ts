/**
 * Check which languages are installed and active
 */

const ODOO_CONFIG = {
  url: 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com',
  db: 'lapadevadmin-lapa-v2-main-7268478',
  username: 'paul@lapa.ch',
  password: 'lapa201180'
};

let sessionId: string | null = null;

async function authenticate(): Promise<number> {
  const response = await fetch(`${ODOO_CONFIG.url}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

  const cookies = response.headers.get('set-cookie');
  if (cookies) {
    const match = cookies.match(/session_id=([^;]+)/);
    if (match) sessionId = match[1];
  }

  const data = await response.json();
  return data.result.uid;
}

async function searchRead(model: string, domain: any[], fields: string[]): Promise<any[]> {
  const response = await fetch(`${ODOO_CONFIG.url}/web/dataset/call_kw/${model}/search_read`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_id=${sessionId}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model,
        method: 'search_read',
        args: [domain],
        kwargs: { fields, limit: 100 }
      },
      id: Date.now()
    })
  });

  const data = await response.json();
  return data.result || [];
}

async function main() {
  await authenticate();

  console.log('🌍 Checking installed languages:\n');

  const languages = await searchRead('res.lang', [
    ['active', '=', true]
  ], ['code', 'name', 'active']);

  console.log(`Found ${languages.length} active languages:\n`);

  for (const lang of languages) {
    console.log(`  ${lang.code.padEnd(10)} - ${lang.name}`);
  }

  console.log('\n🔍 Checking if our target languages are installed:');
  const targets = ['it_IT', 'de_CH', 'fr_CH', 'en_US'];
  for (const code of targets) {
    const found = languages.find(l => l.code === code);
    console.log(`  ${code.padEnd(10)} - ${found ? '✅ INSTALLED' : '❌ NOT INSTALLED'}`);
  }
}

main().catch(console.error);
