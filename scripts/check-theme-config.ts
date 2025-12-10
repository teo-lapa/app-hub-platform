/**
 * Controlla dr.theme.config e website settings per B2B
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

  // 1. Tutti i campi di dr.theme.config
  console.log('=== DR.THEME.CONFIG - TUTTI I CAMPI ===');
  const themeFields = await fieldsGet('dr.theme.config');
  const fieldsList = Object.entries(themeFields)
    .map(([k, v]: [string, any]) => `${k} (${v.type}): ${v.string}`)
    .sort();
  for (const f of fieldsList) {
    console.log(`  ${f}`);
  }

  // 2. Valori attuali dr.theme.config
  console.log('\n=== DR.THEME.CONFIG - VALORI ATTUALI ===');
  const themeConfigs = await searchRead('dr.theme.config', [], Object.keys(themeFields), 10);
  console.log(JSON.stringify(themeConfigs, null, 2));

  // 3. Website con tutti i campi shop
  console.log('\n=== WEBSITE - TUTTI I VALORI SHOP ===');
  const websiteFields = await fieldsGet('website');
  const shopFields = Object.keys(websiteFields).filter(k =>
    k.includes('shop') || k.includes('product') || k.includes('auth') ||
    k.includes('b2b') || k.includes('guest') || k.includes('public') ||
    k.includes('visibility') || k.includes('restrict')
  );
  console.log('Campi cercati:', shopFields);
  const websites = await searchRead('website', [], shopFields);
  console.log(JSON.stringify(websites, null, 2));

  // 4. auth_signup_uninvited dettagli
  console.log('\n=== DETTAGLI auth_signup_uninvited ===');
  const field = themeFields['auth_signup_uninvited'] || websiteFields['auth_signup_uninvited'];
  console.log(JSON.stringify(field, null, 2));

  // 5. Cerca impostazioni res.config.settings
  console.log('\n=== RES.CONFIG.SETTINGS FIELDS (b2b/shop/product) ===');
  const settingsFields = await fieldsGet('res.config.settings');
  const relevantSettings = Object.entries(settingsFields)
    .filter(([k, v]: [string, any]) =>
      k.includes('b2b') || k.includes('shop') || k.includes('product') ||
      k.includes('guest') || k.includes('public') || k.includes('visibility') ||
      k.includes('auth') || k.includes('restrict') || k.includes('website'))
    .map(([k, v]: [string, any]) => `${k} (${v.type}): ${v.string}`);
  for (const f of relevantSettings.slice(0, 50)) {
    console.log(`  ${f}`);
  }
}

main().catch(console.error);
