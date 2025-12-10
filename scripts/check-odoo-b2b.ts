/**
 * Verifica impostazioni B2B/visibilità in Odoo
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
  console.log('✅ Connesso\n');
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
  if (data.error) {
    console.log(`Errore su ${model}:`, data.error.message);
    return [];
  }
  return data.result || [];
}

async function main() {
  await auth();

  // 1. Website config
  console.log('=== WEBSITE CONFIG ===');
  const websites = await searchRead('website', [],
    ['id', 'name', 'auth_signup_uninvited', 'specific_user_account']);
  for (const w of websites) {
    console.log(`Website ${w.id}: ${w.name}`);
    console.log(`  auth_signup_uninvited: ${w.auth_signup_uninvited}`);
    console.log(`  specific_user_account: ${w.specific_user_account}`);
  }

  // 2. res.config.settings - cerca B2B
  console.log('\n=== RES.CONFIG.SETTINGS ===');
  try {
    const settings = await searchRead('res.config.settings', [],
      ['id', 'website_id', 'auth_signup_uninvited', 'group_product_pricelist']);
    console.log(JSON.stringify(settings.slice(0, 3), null, 2));
  } catch (e) {
    console.log('Non accessibile');
  }

  // 3. Cerca moduli B2B installati
  console.log('\n=== MODULI B2B/VISIBILITY ===');
  const modules = await searchRead('ir.module.module',
    [['state', '=', 'installed'], ['name', 'ilike', 'b2b']],
    ['name', 'shortdesc']);
  if (modules.length === 0) {
    console.log('Nessun modulo B2B trovato');
  } else {
    for (const m of modules) {
      console.log(`  ${m.name}: ${m.shortdesc}`);
    }
  }

  // 4. Cerca moduli theme_prime (visto nel config JS)
  console.log('\n=== MODULI THEME PRIME ===');
  const primeModules = await searchRead('ir.module.module',
    [['state', '=', 'installed'], ['name', 'ilike', 'prime']],
    ['name', 'shortdesc']);
  for (const m of primeModules) {
    console.log(`  ${m.name}: ${m.shortdesc}`);
  }

  // 5. Config parameters
  console.log('\n=== CONFIG PARAMETERS (b2b/visibility/public) ===');
  const params = await searchRead('ir.config_parameter',
    ['|', '|', ['key', 'ilike', 'b2b'], ['key', 'ilike', 'public'], ['key', 'ilike', 'visibility']],
    ['key', 'value']);
  for (const p of params) {
    console.log(`  ${p.key}: ${p.value}`);
  }
}

main().catch(console.error);
