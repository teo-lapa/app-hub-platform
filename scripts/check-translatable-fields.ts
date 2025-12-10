/**
 * Check which fields are actually translatable
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

async function fieldsGet(model: string): Promise<any> {
  const response = await fetch(`${ODOO_CONFIG.url}/web/dataset/call_kw/${model}/fields_get`, {
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
        method: 'fields_get',
        args: [],
        kwargs: {
          attributes: ['string', 'type', 'translate']
        }
      },
      id: Date.now()
    })
  });

  const data = await response.json();
  return data.result;
}

async function main() {
  await authenticate();

  console.log('🔍 Checking which fields in blog.post are translatable:\n');

  const fields = await fieldsGet('blog.post');

  const relevantFields = ['name', 'subtitle', 'content', 'website_meta_title', 'website_meta_description', 'website_meta_keywords'];

  console.log('Field Name                      | Type      | Translatable');
  console.log('-'.repeat(70));

  for (const fieldName of relevantFields) {
    if (fields[fieldName]) {
      const field = fields[fieldName];
      const translatable = field.translate ? '✅ YES' : '❌ NO';
      console.log(`${fieldName.padEnd(31)} | ${field.type.padEnd(9)} | ${translatable}`);
    }
  }
}

main().catch(console.error);
