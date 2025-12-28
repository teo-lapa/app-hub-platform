/**
 * Delete duplicate articles - keep only V10 uploads (286-346) with 100% translations
 * Remove old uploads (247-285) with partial translations
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = 'paul@lapa.ch';
const ODOO_PASSWORD = 'lapa201180';

let cookies = '';

async function authenticate(): Promise<number> {
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
  if (!data.result?.uid) throw new Error('Auth failed');
  return data.result.uid;
}

async function callOdoo(model: string, method: string, args: any[], kwargs: any = {}): Promise<any> {
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
  if (data.error) {
    throw new Error(data.error.data?.message || data.error.message || JSON.stringify(data.error));
  }
  return data.result;
}

async function deleteDuplicates() {
  console.log('🔐 Autenticazione...');
  await authenticate();
  console.log('✅\n');

  // Get all blog posts in blog_id 4
  console.log('📋 Recupero tutti gli articoli...');
  const allPosts = await callOdoo('blog.post', 'search_read', [
    [['blog_id', '=', 4]],
    ['id', 'name', 'create_date']
  ], {});

  console.log(`   Trovati ${allPosts.length} articoli totali\n`);

  // Group by title to find duplicates
  const titleMap: Map<string, any[]> = new Map();
  for (const post of allPosts) {
    const title = post.name;
    if (!titleMap.has(title)) {
      titleMap.set(title, []);
    }
    titleMap.get(title)!.push(post);
  }

  // Find duplicates
  const duplicates = Array.from(titleMap.entries()).filter(([_, posts]) => posts.length > 1);

  console.log(`📊 Analisi duplicati:`);
  console.log(`   Titoli unici: ${titleMap.size}`);
  console.log(`   Titoli duplicati: ${duplicates.length}\n`);

  if (duplicates.length === 0) {
    console.log('✅ Nessun duplicato trovato!');
    return;
  }

  // Delete older duplicates (keep the newest one)
  const toDelete: number[] = [];

  for (const [title, posts] of duplicates) {
    // Sort by ID descending (newest first)
    posts.sort((a, b) => b.id - a.id);

    // Keep the first (newest), delete the rest
    const keep = posts[0];
    const deleteList = posts.slice(1);

    console.log(`📝 "${title.substring(0, 50)}..."`);
    console.log(`   Mantieni: ID ${keep.id} (più recente)`);
    console.log(`   Elimina: ${deleteList.map(p => `ID ${p.id}`).join(', ')}`);

    toDelete.push(...deleteList.map(p => p.id));
  }

  console.log(`\n🗑️  Elimino ${toDelete.length} articoli duplicati...\n`);

  // Delete in batches of 10
  for (let i = 0; i < toDelete.length; i += 10) {
    const batch = toDelete.slice(i, i + 10);
    console.log(`   Batch ${Math.floor(i / 10) + 1}: IDs ${batch.join(', ')}`);

    await callOdoo('blog.post', 'unlink', [batch], {});

    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\n✅ Duplicati eliminati con successo!`);
  console.log(`📊 Rimangono ${titleMap.size} articoli unici`);
}

deleteDuplicates().catch(console.error);
