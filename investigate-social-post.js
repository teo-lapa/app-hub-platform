/**
 * Investigazione: Analizza i campi del modello social.post in Odoo
 * per capire come pubblicare correttamente
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const USERNAME = 'apphubplatform@lapa.ch';
const PASSWORD = 'apphubplatform2025';

let cookies = null;

async function authenticate() {
  console.log('🔐 Autenticazione...');

  const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { db: ODOO_DB, login: USERNAME, password: PASSWORD },
      id: 1
    })
  });

  let setCookies = [];
  if (typeof response.headers.getSetCookie === 'function') {
    setCookies = response.headers.getSetCookie();
  }

  if (setCookies.length > 0) {
    cookies = setCookies.map(c => c.split(';')[0]).join('; ');
  }

  const data = await response.json();

  if (data.result && data.result.uid) {
    if (!cookies) cookies = `session_id=${data.result.session_id}`;
    console.log(`✅ Autenticato: UID ${data.result.uid}\n`);
    return true;
  }

  throw new Error('Auth failed: ' + JSON.stringify(data));
}

async function callOdoo(model, method, args, kwargs = {}) {
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookies },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { model, method, args, kwargs },
      id: Math.floor(Math.random() * 1000000)
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.data?.message || data.error.message);
  return data.result;
}

async function main() {
  await authenticate();

  // 1. Ottieni tutti i campi di social.post
  console.log('📋 CAMPI DEL MODELLO social.post:\n');
  console.log('='.repeat(60));

  const fields = await callOdoo('social.post', 'fields_get', [], {
    attributes: ['string', 'type', 'required', 'selection', 'relation', 'help']
  });

  // Ordina e mostra i campi
  const sortedFields = Object.entries(fields).sort((a, b) => {
    // Prima i required, poi alfabetico
    if (a[1].required && !b[1].required) return -1;
    if (!a[1].required && b[1].required) return 1;
    return a[0].localeCompare(b[0]);
  });

  for (const [name, info] of sortedFields) {
    const req = info.required ? '⭐ REQUIRED' : '';
    console.log(`\n${name} ${req}`);
    console.log(`  Label: ${info.string}`);
    console.log(`  Tipo: ${info.type}`);
    if (info.relation) console.log(`  Relazione: ${info.relation}`);
    if (info.selection) console.log(`  Opzioni: ${JSON.stringify(info.selection)}`);
    if (info.help) console.log(`  Help: ${info.help.substring(0, 100)}...`);
  }

  // 2. Ottieni gli account social disponibili
  console.log('\n\n📱 ACCOUNT SOCIAL DISPONIBILI:\n');
  console.log('='.repeat(60));

  const accounts = await callOdoo('social.account', 'search_read', [[]], {
    fields: ['id', 'name', 'media_type', 'is_media_disconnected', 'social_account_handle'],
    limit: 20
  });

  for (const acc of accounts) {
    const status = acc.is_media_disconnected ? '❌' : '✅';
    console.log(`${status} [${acc.id}] ${acc.name} (${acc.media_type}) - ${acc.social_account_handle || 'N/A'}`);
  }

  // 3. Guarda un post esistente come esempio
  console.log('\n\n📝 ESEMPIO POST ESISTENTE:\n');
  console.log('='.repeat(60));

  const posts = await callOdoo('social.post', 'search_read', [[]], {
    fields: ['id', 'message', 'state', 'post_method', 'account_ids', 'image_ids', 'scheduled_date', 'published_date'],
    limit: 1,
    order: 'id DESC'
  });

  if (posts.length > 0) {
    console.log(JSON.stringify(posts[0], null, 2));
  }

  // 4. Verifica i metodi disponibili per pubblicare
  console.log('\n\n🔧 METODI DISPONIBILI SU social.post:\n');
  console.log('='.repeat(60));

  // Prova a leggere le azioni disponibili
  try {
    const actions = await callOdoo('ir.model', 'search_read', [[['model', '=', 'social.post']]], {
      fields: ['id', 'name']
    });
    console.log('Modello trovato:', actions);
  } catch (e) {
    console.log('Errore:', e.message);
  }
}

main().catch(console.error);
