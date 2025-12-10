/**
 * Check the ir.translation table directly
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

async function searchRead(model: string, domain: any[], fields: string[], limit?: number): Promise<any[]> {
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
        kwargs: { fields, limit: limit || 100 }
      },
      id: Date.now()
    })
  });

  const data = await response.json();
  return data.result || [];
}

async function main() {
  await authenticate();

  console.log('🔍 Checking translations for article 76 in ir.translation table:\n');

  const translations = await searchRead('ir.translation', [
    ['res_id', '=', 76],
    ['name', 'like', 'blog.post,%']
  ], ['name', 'lang', 'source', 'value', 'state'], 100);

  console.log(`Found ${translations.length} translation records:\n`);

  for (const trans of translations) {
    console.log(`Field: ${trans.name}`);
    console.log(`Language: ${trans.lang}`);
    console.log(`Value: ${trans.value?.substring(0, 100)}...`);
    console.log(`State: ${trans.state}`);
    console.log('-'.repeat(70));
  }

  // Now check specifically for Italian content
  console.log('\n🇮🇹 Italian (it_IT) translations:');
  const itTranslations = translations.filter(t => t.lang === 'it_IT');
  console.log(`Count: ${itTranslations.length}`);
  for (const trans of itTranslations) {
    const fieldName = trans.name.split(',')[1];
    console.log(`  - ${fieldName}: ${trans.value ? 'HAS VALUE' : 'NO VALUE'} (${trans.value?.length || 0} chars)`);
  }
}

main().catch(console.error);
