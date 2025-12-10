/**
 * Verifica come funzionano le traduzioni degli articoli blog in Odoo
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

  const data: any = await response.json();
  if (!data.result?.uid) throw new Error('Auth failed');
  console.log(`✅ Connesso come ${ODOO_CONFIG.username}`);
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

  const data: any = await response.json();
  return data.result || [];
}

async function main() {
  console.log('🔍 VERIFICA TRADUZIONI BLOG ODOO');
  console.log('='.repeat(60));

  await authenticate();

  // 1. Verifica lingue disponibili
  console.log('\n🌐 LINGUE DISPONIBILI:');
  const languages = await searchRead('res.lang', [['active', '=', true]], ['code', 'name', 'iso_code']);
  languages.forEach(l => console.log(`   - ${l.code}: ${l.name}`));

  // 2. Guarda un articolo esistente con traduzioni
  console.log('\n📄 ESEMPIO ARTICOLO CON TRADUZIONI:');
  const posts = await searchRead('blog.post',
    [['is_published', '=', true]],
    ['id', 'name', 'website_url', 'create_date'],
    5
  );

  if (posts.length > 0) {
    const post = posts[0];
    console.log(`\n   Articolo: ${post.name}`);
    console.log(`   ID: ${post.id}`);
    console.log(`   URL: ${post.website_url}`);
  }

  // 3. Cerca nella tabella ir.translation
  console.log('\n🔍 SISTEMA TRADUZIONI ODOO:');
  const translations = await searchRead('ir.translation',
    [['name', 'ilike', 'blog.post'], ['res_id', '!=', false]],
    ['name', 'lang', 'src', 'value', 'res_id'],
    10
  );

  if (translations.length > 0) {
    console.log(`   Trovate ${translations.length} traduzioni per blog.post`);
    for (const t of translations.slice(0, 5)) {
      console.log(`   - Campo: ${t.name}, Lingua: ${t.lang}`);
    }
  } else {
    console.log('   ⚠️ Nessuna traduzione trovata in ir.translation');
  }

  // 4. Verifica articoli appena creati
  console.log('\n📝 ARTICOLI APPENA CREATI (ultimi 20):');
  const recentPosts = await searchRead('blog.post',
    [],
    ['id', 'name', 'website_url', 'create_date'],
    20
  );

  // Ordina per ID decrescente
  recentPosts.sort((a, b) => b.id - a.id);

  for (const p of recentPosts.slice(0, 15)) {
    console.log(`   ID ${p.id}: ${p.name.substring(0, 50)}...`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('💡 COME FUNZIONANO LE TRADUZIONI IN ODOO:');
  console.log('='.repeat(60));
  console.log(`
In Odoo, le traduzioni NON sono pagine separate.
Ogni record ha UN ID e le traduzioni sono salvate in:
1. ir.translation (per campi traducibili)
2. O direttamente nel campo con context lang

Per aggiungere traduzioni a un articolo esistente:
- Metodo 1: Usare write() con context={'lang': 'de_CH'}
- Metodo 2: Creare record in ir.translation
- Metodo 3: Dal backend Odoo, cliccare sull'icona traduzione

Gli articoli creati separatamente in DE/FR/EN sono SBAGLIATI!
Dovrebbero essere traduzioni dello STESSO articolo italiano.
`);
}

main();
