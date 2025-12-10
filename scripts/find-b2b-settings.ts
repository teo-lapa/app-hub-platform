/**
 * Cerca TUTTE le impostazioni relative a visibilità/B2B/public in Odoo
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
  const data: any = await res.json();
  if (!cookies) cookies = `session_id=${data.result.session_id}`;
}

async function searchRead(model: string, domain: any[], fields: string[], limit = 100) {
  const res = await fetch(`${ODOO_CONFIG.url}/web/dataset/call_kw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookies || '' },
    body: JSON.stringify({
      jsonrpc: '2.0', method: 'call',
      params: { model, method: 'search_read', args: [], kwargs: { domain, fields, limit } },
      id: 2
    })
  });
  const data: any = await res.json();
  if (data.error) {
    console.log(`Errore su ${model}:`, data.error.data?.message || data.error.message);
    return [];
  }
  return data.result || [];
}

async function fieldsGet(model: string) {
  const res = await fetch(`${ODOO_CONFIG.url}/web/dataset/call_kw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookies || '' },
    body: JSON.stringify({
      jsonrpc: '2.0', method: 'call',
      params: { model, method: 'fields_get', args: [], kwargs: {} },
      id: 3
    })
  });
  const data: any = await res.json();
  return data.result || {};
}

async function main() {
  await auth();
  console.log('✅ Connesso\n');

  // 1. Moduli installati con "visibility", "public", "b2b", "guest"
  console.log('=== MODULI INSTALLATI (visibility/public/b2b/guest/ecommerce) ===');
  const modules = await searchRead('ir.module.module',
    [['state', '=', 'installed'], '|', '|', '|', '|', '|',
     ['name', 'ilike', 'visibility'],
     ['name', 'ilike', 'public'],
     ['name', 'ilike', 'b2b'],
     ['name', 'ilike', 'guest'],
     ['name', 'ilike', 'website_sale'],
     ['name', 'ilike', 'ecommerce']],
    ['name', 'shortdesc'], 50);
  for (const m of modules) {
    console.log(`  ${m.name}: ${m.shortdesc}`);
  }

  // 2. Moduli Theme Prime
  console.log('\n=== MODULI THEME PRIME ===');
  const primeModules = await searchRead('ir.module.module',
    [['state', '=', 'installed'], '|', ['name', 'ilike', 'prime'], ['name', 'ilike', 'droggol']],
    ['name', 'shortdesc'], 50);
  for (const m of primeModules) {
    console.log(`  ${m.name}: ${m.shortdesc}`);
  }

  // 3. Config parameters
  console.log('\n=== CONFIG PARAMETERS (shop/product/public/guest/visibility) ===');
  const params = await searchRead('ir.config_parameter',
    ['|', '|', '|', '|', '|',
     ['key', 'ilike', 'shop'],
     ['key', 'ilike', 'product'],
     ['key', 'ilike', 'public'],
     ['key', 'ilike', 'guest'],
     ['key', 'ilike', 'visibility'],
     ['key', 'ilike', 'b2b']],
    ['key', 'value'], 100);
  for (const p of params) {
    const val = p.value ? p.value.substring(0, 80) : '';
    console.log(`  ${p.key}: ${val}`);
  }

  // 4. Website fields
  console.log('\n=== WEBSITE - TUTTI I CAMPI ===');
  const websiteFields = await fieldsGet('website');
  const relevantFields = Object.entries(websiteFields)
    .filter(([k, v]: [string, any]) =>
      k.includes('public') || k.includes('guest') || k.includes('b2b') ||
      k.includes('shop') || k.includes('visibility') || k.includes('auth') ||
      k.includes('user') || k.includes('access') || k.includes('restrict'))
    .map(([k, v]: [string, any]) => `${k} (${v.type}): ${v.string}`);
  for (const f of relevantFields) {
    console.log(`  ${f}`);
  }

  // 5. Website values
  console.log('\n=== WEBSITE VALUES ===');
  const websites = await searchRead('website', [],
    ['id', 'name', 'auth_signup_uninvited', 'specific_user_account',
     'is_public_user', 'user_id', 'company_id']);
  console.log(JSON.stringify(websites, null, 2));

  // 6. Access rules per product.template
  console.log('\n=== ACCESS RULES PRODUCT.TEMPLATE ===');
  const rules = await searchRead('ir.rule',
    [['model_id.model', '=', 'product.template']],
    ['name', 'domain_force', 'active', 'perm_read']);
  for (const r of rules) {
    console.log(`  ${r.name} (active: ${r.active}, read: ${r.perm_read})`);
    console.log(`    domain: ${r.domain_force}`);
  }

  // 7. res.groups con "public" o "portal"
  console.log('\n=== GRUPPI PUBLIC/PORTAL ===');
  const groups = await searchRead('res.groups',
    ['|', ['name', 'ilike', 'public'], ['name', 'ilike', 'portal']],
    ['name', 'full_name', 'implied_ids']);
  for (const g of groups) {
    console.log(`  ${g.full_name || g.name}`);
  }

  // 8. Cerca impostazioni specifiche Theme Prime B2B
  console.log('\n=== CERCA MODELLI dr_ (Theme Prime) ===');
  const models = await searchRead('ir.model',
    [['model', 'ilike', 'dr_']],
    ['model', 'name'], 50);
  for (const m of models) {
    console.log(`  ${m.model}: ${m.name}`);
  }

  // 9. Cerca tutti i campi "visibility" in product.template
  console.log('\n=== PRODUCT.TEMPLATE VISIBILITY FIELDS ===');
  const productFields = await fieldsGet('product.template');
  const visFields = Object.entries(productFields)
    .filter(([k, v]: [string, any]) =>
      k.includes('visibility') || k.includes('public') || k.includes('website'))
    .map(([k, v]: [string, any]) => `${k} (${v.type}): ${v.string}`);
  for (const f of visFields) {
    console.log(`  ${f}`);
  }
}

main().catch(console.error);
