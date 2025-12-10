/**
 * Verifica impostazioni B2B di Theme Prime
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
  const data: any = await res.json();
  return data.result || data.error;
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

  // Tutti i campi di dr.theme.config
  console.log('=== DR.THEME.CONFIG - CAMPI B2B/VISIBILITY ===');
  const fields = await fieldsGet('dr.theme.config');

  const relevantKeys = Object.keys(fields).filter(k =>
    k.includes('b2b') || k.includes('public') || k.includes('visibility') ||
    k.includes('guest') || k.includes('restrict') || k.includes('shop') ||
    k.includes('price') || k.includes('cart') || k.includes('login') ||
    k.includes('categ') || k.includes('product'));

  for (const k of relevantKeys) {
    const v = fields[k];
    console.log(`${k} (${v.type}): ${v.string}`);
    if (v.help) console.log(`  → ${v.help}`);
    if (v.selection) console.log(`  options: ${JSON.stringify(v.selection)}`);
  }

  // Valori attuali
  console.log('\n=== DR.THEME.CONFIG - VALORI ATTUALI ===');
  const config = await searchRead('dr.theme.config', [], relevantKeys);
  console.log(JSON.stringify(config, null, 2));

  // Verifichiamo anche website.sale settings
  console.log('\n=== WEBSITE CONFIG ===');
  const websites = await searchRead('website', [], [
    'id', 'name', 'auth_signup_uninvited', 'specific_user_account',
    'shop_ppg', 'shop_ppr', 'shop_default_sort'
  ]);
  console.log(JSON.stringify(websites, null, 2));
}

main().catch(console.error);
