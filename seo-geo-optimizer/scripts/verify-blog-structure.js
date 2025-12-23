/**
 * Verifica struttura blog Odoo e traduzioni
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

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
  console.log('🔐 Autenticazione Odoo...');
  await authenticate();
  console.log('✅ Autenticato\n');

  // 1. Controlla blog esistenti
  console.log('📚 Blog disponibili:');
  const blogs = await callOdoo('blog.blog', 'search_read', [[]], { fields: ['id', 'name'], limit: 10 });
  blogs.forEach(b => console.log(`   • ID ${b.id}: ${b.name}`));

  // 2. Prendi un articolo esistente per vedere la struttura
  console.log('\n📄 Ultimi 5 articoli blog:');
  const posts = await callOdoo('blog.post', 'search_read', [
    [['blog_id', '=', 4]]
  ], {
    fields: ['id', 'name', 'blog_id', 'website_meta_title', 'is_published'],
    limit: 5,
    order: 'id desc'
  });

  posts.forEach(p => {
    console.log(`   • ID ${p.id}: ${p.name.substring(0, 50)}... [Published: ${p.is_published}]`);
  });

  if (posts.length > 0) {
    const postId = posts[0].id;
    console.log(`\n🔍 Dettagli articolo ID ${postId}:`);

    // Leggi tutti i campi disponibili
    const fullPost = await callOdoo('blog.post', 'read', [[postId]], {
      fields: ['name', 'subtitle', 'content', 'website_meta_title', 'website_meta_description', 'website_meta_keywords']
    });

    console.log('   Campi:');
    console.log(`   - name: ${fullPost[0].name}`);
    console.log(`   - subtitle: ${fullPost[0].subtitle || 'N/A'}`);
    console.log(`   - content: ${fullPost[0].content ? fullPost[0].content.substring(0, 100) + '...' : 'N/A'}`);
    console.log(`   - meta_title: ${fullPost[0].website_meta_title || 'N/A'}`);

    // Verifica traduzioni disponibili
    console.log(`\n🌐 Traduzioni disponibili per ID ${postId}:`);
    for (const lang of ['it_IT', 'de_CH', 'fr_CH', 'en_US']) {
      try {
        const translated = await callOdoo('blog.post', 'read', [[postId]], {
          fields: ['name'],
          context: { lang }
        });
        console.log(`   - ${lang}: ${translated[0].name.substring(0, 40)}...`);
      } catch (e) {
        console.log(`   - ${lang}: Errore`);
      }
    }

    // Controlla system di traduzioni per il content
    console.log(`\n📝 Sistema traduzioni content:`);
    try {
      const fieldTrans = await callOdoo('blog.post', 'get_field_translations', [[postId], 'content'], {});
      console.log(`   - Metodo get_field_translations disponibile: SÌ`);
      console.log(`   - Blocchi trovati: ${fieldTrans[0] ? fieldTrans[0].length : 0}`);
      if (fieldTrans[0] && fieldTrans[0].length > 0) {
        console.log(`   - Esempio blocco:`, JSON.stringify(fieldTrans[0][0], null, 2));
      }
    } catch (e) {
      console.log(`   - get_field_translations: NON disponibile o errore`);
    }
  }

  console.log('\n✅ Verifica completata!');
}

main().catch(console.error);
