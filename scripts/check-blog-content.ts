/**
 * Verifica contenuti blog e pagine informative su lapa.ch
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

  const data = await response.json();
  return data.result || [];
}

async function searchCount(model: string, domain: any[]): Promise<number> {
  const response = await fetch(`${ODOO_CONFIG.url}/web/dataset/call_kw/${model}/search_count`, {
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
        method: 'search_count',
        args: [domain],
        kwargs: {}
      },
      id: Date.now()
    })
  });

  const data = await response.json();
  return data.result || 0;
}

async function main() {
  console.log('📝 VERIFICA CONTENUTI BLOG E PAGINE INFORMATIVE');
  console.log('='.repeat(60));

  await authenticate();

  // 1. Cerca articoli di blog
  console.log('\n🔍 Cerco articoli di blog...');

  const blogPosts = await searchRead('blog.post',
    [['is_published', '=', true]],
    ['id', 'name', 'subtitle', 'website_url', 'visits', 'create_date'],
    50
  );

  console.log(`\n📰 ARTICOLI BLOG PUBBLICATI: ${blogPosts.length}`);

  if (blogPosts.length > 0) {
    console.log('\n' + '─'.repeat(60));
    for (const post of blogPosts.slice(0, 20)) {
      console.log(`📄 ${post.name}`);
      console.log(`   URL: ${post.website_url}`);
      console.log(`   Visite: ${post.visits || 0}`);
      console.log(`   Data: ${post.create_date}`);
      console.log('');
    }
  } else {
    console.log('   ❌ Nessun articolo di blog trovato!');
  }

  // 2. Cerca pagine informative
  console.log('\n🔍 Cerco pagine informative...');

  const pages = await searchRead('website.page',
    [['is_published', '=', true]],
    ['id', 'name', 'url', 'website_meta_title'],
    100
  );

  // Filtra pagine che potrebbero essere contenuti informativi
  const infoPages = pages.filter((p: any) => {
    const url = (p.url || '').toLowerCase();
    const name = (p.name || '').toLowerCase();
    return url.includes('blog') || url.includes('guida') || url.includes('come') ||
           url.includes('consigli') || url.includes('faq') || url.includes('risorse') ||
           name.includes('guida') || name.includes('come') || name.includes('consigli');
  });

  console.log(`\n📄 PAGINE INFORMATIVE TROVATE: ${infoPages.length}`);

  for (const page of infoPages) {
    console.log(`   - ${page.name} (${page.url})`);
  }

  // 3. Conta blog totali
  const blogCount = await searchCount('blog.post', []);
  const publishedBlogCount = await searchCount('blog.post', [['is_published', '=', true]]);

  console.log('\n' + '='.repeat(60));
  console.log('📊 RIEPILOGO CONTENUTI');
  console.log('='.repeat(60));
  console.log(`📰 Articoli blog totali: ${blogCount}`);
  console.log(`📰 Articoli blog pubblicati: ${publishedBlogCount}`);
  console.log(`📄 Pagine totali: ${pages.length}`);

  // 4. Suggerimenti
  console.log('\n' + '='.repeat(60));
  console.log('💡 SUGGERIMENTI PER APPARIRE NELLE RICERCHE INFORMATIVE');
  console.log('='.repeat(60));
  console.log(`
Per apparire quando qualcuno cerca "come aprire una pizzeria"
o "fornitore prodotti italiani", servono CONTENUTI INFORMATIVI:

📝 ARTICOLI DA CREARE:
   1. "Come scegliere il fornitore giusto per la tua pizzeria"
   2. "Guida completa: aprire un ristorante italiano in Svizzera"
   3. "I 10 prodotti italiani indispensabili per una pizzeria"
   4. "Mozzarella di bufala vs fior di latte: quale scegliere?"
   5. "Come conservare correttamente i prodotti freschi italiani"
   6. "Guida ai salumi italiani per ristoratori"
   7. "Pasta fresca vs secca: guida per ristoratori"

📋 FAQ DA AGGIUNGERE:
   - Quali sono i vantaggi di un grossista come LAPA?
   - Come funziona la consegna?
   - Quali certificazioni avete?
   - Posso ordinare piccole quantità?

🎯 BENEFICI:
   - Google mostra questi contenuti nelle ricerche informative
   - Attira clienti che stanno cercando soluzioni
   - Posiziona LAPA come esperto del settore
`);
}

main();
