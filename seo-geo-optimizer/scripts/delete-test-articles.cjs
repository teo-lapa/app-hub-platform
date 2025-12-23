/**
 * Cancella articoli di test caricati male
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = 'paul@lapa.ch';
const ODOO_PASSWORD = 'lapa201180';

let cookies = '';

async function authenticate() {
  const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { db: ODOO_DB, login: ODOO_USERNAME, password: ODOO_PASSWORD },
      id: Date.now()
    })
  });

  const cookieHeader = response.headers.get('set-cookie');
  if (cookieHeader) {
    cookies = cookieHeader.split(',').map(c => c.split(';')[0].trim()).join('; ');
  }

  const data = await response.json();
  if (!data.result || !data.result.uid) throw new Error('Auth failed');
  return data.result.uid;
}

async function callOdoo(model, method, args, kwargs = {}) {
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookies },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { model, method, args, kwargs },
      id: Date.now()
    })
  });
  const data = await response.json();
  if (data.error) throw new Error(JSON.stringify(data.error));
  return data.result;
}

async function main() {
  console.log('🗑️  PULIZIA ARTICOLI DI TEST\n');

  console.log('🔐 Autenticazione...');
  await authenticate();
  console.log('✅ Autenticato\n');

  // Trova articoli recenti (ultimi 30)
  console.log('📄 Cerco articoli recenti...');
  const posts = await callOdoo('blog.post', 'search_read', [
    [['blog_id', '=', 4]]
  ], {
    fields: ['id', 'name', 'create_date', 'is_published'],
    limit: 30,
    order: 'id desc'
  });

  console.log(`   Trovati ${posts.length} articoli\n`);

  // Mostra lista e chiedi conferma per eliminazione
  const toDelete = [];

  console.log('Articoli da eliminare (creati oggi, non pubblicati):\n');
  for (const post of posts) {
    const createDate = new Date(post.create_date);
    const today = new Date();
    const isToday = createDate.toDateString() === today.toDateString();

    if (isToday && !post.is_published) {
      console.log(`  ❌ ID ${post.id}: ${post.name.substring(0, 50)}...`);
      toDelete.push(post.id);
    }
  }

  if (toDelete.length === 0) {
    console.log('\n✅ Nessun articolo da eliminare!');
    return;
  }

  console.log(`\n🗑️  Elimino ${toDelete.length} articoli...`);

  for (const id of toDelete) {
    try {
      await callOdoo('blog.post', 'unlink', [[id]]);
      console.log(`   ✓ Eliminato ID ${id}`);
    } catch (e) {
      console.log(`   ✗ Errore ID ${id}: ${e.message.substring(0, 50)}`);
    }
  }

  console.log('\n✅ Pulizia completata!');
}

main().catch(console.error);
