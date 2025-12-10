/**
 * Cerca impostazioni Theme Prime B2B
 */
const ODOO_CONFIG = {
  url: 'https://www.lapa.ch',
  db: 'lapadevadmin-lapa-v2-main-7268478',
  username: 'paul@lapa.ch',
  password: 'lapa201180'
};

let cookies: string | null = null;

async function auth() {
  const res = await fetch(`${ODOO_CONFIG.url}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', method: 'call',
      params: { db: ODOO_CONFIG.db, login: ODOO_CONFIG.username, password: ODOO_CONFIG.password },
      id: 1
    })
  });
  const cookieHeader = res.headers.get('set-cookie');
  if (cookieHeader) cookies = cookieHeader.split(',').map(c => c.split(';')[0].trim()).join('; ');
  const data = await res.json();
  if (!cookies) cookies = `session_id=${data.result.session_id}`;
}

async function searchRead(model: string, domain: any[], fields: string[]) {
  const res = await fetch(`${ODOO_CONFIG.url}/web/dataset/call_kw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookies || '' },
    body: JSON.stringify({
      jsonrpc: '2.0', method: 'call',
      params: { model, method: 'search_read', args: [], kwargs: { domain, fields, limit: 100 } },
      id: 2
    })
  });
  const data = await res.json();
  return data.result || [];
}

async function main() {
  await auth();
  console.log('✅ Connesso\n');

  // 1. Cerca config Theme Prime
  console.log('=== CONFIG THEME PRIME ===');
  const primeConfigs = await searchRead('ir.config_parameter',
    [['key', 'ilike', 'prime']],
    ['key', 'value']);
  for (const c of primeConfigs) {
    console.log(`  ${c.key}: ${c.value?.substring(0, 100)}`);
  }

  // 2. Cerca config dr_ (droggol - theme prime vendor)
  console.log('\n=== CONFIG DROGGOL (dr_) ===');
  const drConfigs = await searchRead('ir.config_parameter',
    [['key', 'ilike', 'dr_']],
    ['key', 'value']);
  for (const c of drConfigs) {
    console.log(`  ${c.key}: ${c.value?.substring(0, 100)}`);
  }

  // 3. Cerca website fields B2B
  console.log('\n=== WEBSITE FIELDS ===');
  const websites = await searchRead('website', [['id', '=', 1]],
    ['id', 'name', 'auth_signup_uninvited', 'specific_user_account',
     'is_public_user', 'user_id']);
  console.log(JSON.stringify(websites, null, 2));

  // 4. Cerca access rules per product
  console.log('\n=== ACCESS RULES PRODUCT ===');
  const accessRules = await searchRead('ir.rule',
    [['model_id.model', '=', 'product.template']],
    ['name', 'domain_force', 'active']);
  for (const r of accessRules) {
    console.log(`  ${r.name}: ${r.domain_force} (active: ${r.active})`);
  }
}

main().catch(console.error);
