/**
 * Corregge gli articoli blog: elimina i duplicati e aggiunge traduzioni corrette
 *
 * Gli articoli IT sono: 75-89 (15 articoli)
 * Gli articoli EN separati da eliminare: 90-94
 * Gli articoli FR separati da eliminare: 95-99
 * Gli articoli DE separati da eliminare: 100-104
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

async function unlink(model: string, ids: number[]): Promise<boolean> {
  const response = await fetch(`${ODOO_CONFIG.url}/web/dataset/call_kw/${model}/unlink`, {
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
        method: 'unlink',
        args: [ids],
        kwargs: {}
      },
      id: Date.now()
    })
  });

  const data: any = await response.json();
  if (data.error) {
    console.log(`❌ Errore eliminazione: ${data.error.data?.message || data.error.message}`);
    return false;
  }
  return data.result === true;
}

async function main() {
  console.log('🔧 CORREZIONE ARTICOLI BLOG - RIMOZIONE DUPLICATI');
  console.log('='.repeat(60));

  await authenticate();

  // ID degli articoli da eliminare (quelli creati separatamente in EN, FR, DE)
  const idsToDelete = [
    // EN articles (90-94)
    90, 91, 92, 93, 94,
    // FR articles (95-99)
    95, 96, 97, 98, 99,
    // DE articles (100-104)
    100, 101, 102, 103, 104
  ];

  console.log(`\n🗑️ Articoli da eliminare: ${idsToDelete.length}`);

  // Verifica prima quali esistono
  const existingPosts = await searchRead('blog.post',
    [['id', 'in', idsToDelete]],
    ['id', 'name']
  );

  console.log(`\n📋 Articoli trovati da eliminare: ${existingPosts.length}`);
  for (const post of existingPosts) {
    console.log(`   - ID ${post.id}: ${post.name.substring(0, 50)}...`);
  }

  if (existingPosts.length === 0) {
    console.log('\n✅ Nessun articolo duplicato da eliminare!');
    return;
  }

  // Elimina gli articoli duplicati
  console.log('\n🗑️ Eliminazione in corso...');

  const existingIds = existingPosts.map((p: any) => p.id);
  const success = await unlink('blog.post', existingIds);

  if (success) {
    console.log(`\n✅ Eliminati ${existingIds.length} articoli duplicati!`);
  } else {
    console.log('\n❌ Errore durante l\'eliminazione');
  }

  // Verifica articoli italiani rimanenti
  console.log('\n📝 ARTICOLI ITALIANI RIMASTI:');
  const italianPosts = await searchRead('blog.post',
    [['id', '>=', 75], ['id', '<=', 89]],
    ['id', 'name', 'website_url']
  );

  for (const post of italianPosts) {
    console.log(`   - ID ${post.id}: ${post.name.substring(0, 50)}...`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('💡 PROSSIMO PASSO:');
  console.log('='.repeat(60));
  console.log(`
Per aggiungere le traduzioni agli articoli italiani,
devi andare nel backend Odoo:

1. Vai a Website > Blog > Posts
2. Apri un articolo italiano
3. Clicca sull'icona "Traduzioni" (bandiera)
4. Seleziona la lingua (DE, FR, EN)
5. Inserisci titolo e contenuto tradotto

Oppure posso creare uno script che usa il context 'lang'
per scrivere le traduzioni via API.
`);
}

main();
