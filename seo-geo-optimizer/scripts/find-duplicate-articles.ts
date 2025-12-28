/**
 * Trova articoli duplicati nel blog
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

async function checkTranslations(postId: number): Promise<boolean> {
  const langs = ['it_IT', 'de_CH', 'fr_CH', 'en_US'];
  const contents: string[] = [];

  for (const lang of langs) {
    const post = await callOdoo('blog.post', 'read', [[postId], ['content']], {
      context: { lang }
    });

    if (post && post.length > 0) {
      const textContent = post[0].content ? post[0].content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 100) : '';
      contents.push(textContent);
    }
  }

  const uniqueContents = new Set(contents);
  return uniqueContents.size > 1;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║              RICERCA ARTICOLI DUPLICATI                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('🔐 Autenticazione...');
  await authenticate();
  console.log('✅\n');

  console.log('📋 Recupero TUTTI gli articoli del blog...\n');

  const allPosts = await callOdoo('blog.post', 'search_read', [
    [['blog_id', '=', 4]],
    ['id', 'name', 'create_date', 'write_date']
  ], {
    context: { lang: 'it_IT' },
    order: 'id asc'
  });

  console.log(`Trovati ${allPosts.length} articoli totali\n`);

  // Group by normalized title
  const titleGroups: Record<string, any[]> = {};

  for (const post of allPosts) {
    // Normalize title: remove special chars, lowercase, trim
    const normalizedTitle = post.name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!titleGroups[normalizedTitle]) {
      titleGroups[normalizedTitle] = [];
    }
    titleGroups[normalizedTitle].push(post);
  }

  // Find duplicates
  const duplicates: any[] = [];

  for (const [title, posts] of Object.entries(titleGroups)) {
    if (posts.length > 1) {
      duplicates.push({
        title: posts[0].name,
        normalizedTitle: title,
        count: posts.length,
        posts: posts
      });
    }
  }

  console.log(`🔍 Trovati ${duplicates.length} titoli duplicati\n`);
  console.log('='.repeat(70));

  for (const dup of duplicates) {
    console.log(`\n📝 "${dup.title}" (${dup.count} copie):`);
    console.log('');

    for (const post of dup.posts) {
      const createDate = new Date(post.create_date).toLocaleString('it-IT');
      const hasTranslations = await checkTranslations(post.id);
      const status = hasTranslations ? '✅' : '❌';

      console.log(`   ${status} ID ${post.id.toString().padStart(3)} - Creato: ${createDate}`);

      // Small delay to not overload
      await new Promise(r => setTimeout(r, 200));
    }

    console.log('\n   RACCOMANDAZIONE:');

    // Find the best one to keep
    const withTranslations = [];
    for (const post of dup.posts) {
      const hasTranslations = await checkTranslations(post.id);
      if (hasTranslations) {
        withTranslations.push(post);
      }
    }

    if (withTranslations.length > 0) {
      // Keep the most recent one with translations
      const bestPost = withTranslations.sort((a, b) =>
        new Date(b.write_date).getTime() - new Date(a.write_date).getTime()
      )[0];

      const toDelete = dup.posts.filter(p => p.id !== bestPost.id).map(p => p.id);

      console.log(`   ✅ MANTIENI: ID ${bestPost.id} (ha traduzioni, più recente)`);
      console.log(`   🗑️  ELIMINA: ${toDelete.join(', ')}`);
    } else {
      // Keep the most recent one
      const bestPost = dup.posts.sort((a, b) =>
        new Date(b.write_date).getTime() - new Date(a.write_date).getTime()
      )[0];

      const toDelete = dup.posts.filter(p => p.id !== bestPost.id).map(p => p.id);

      console.log(`   ⚠️  MANTIENI: ID ${bestPost.id} (più recente, ma senza traduzioni)`);
      console.log(`   🗑️  ELIMINA: ${toDelete.join(', ')}`);
    }

    console.log('');
  }

  console.log('='.repeat(70));
  console.log('\n📊 RIEPILOGO:');
  console.log(`   Articoli totali: ${allPosts.length}`);
  console.log(`   Titoli duplicati: ${duplicates.length}`);
  console.log(`   Articoli da eliminare: ${duplicates.reduce((sum, d) => sum + (d.count - 1), 0)}`);
  console.log('');
}

main().catch(console.error);
