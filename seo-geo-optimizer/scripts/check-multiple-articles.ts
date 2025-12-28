/**
 * Check multiple existing articles to find ones with working translations
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

async function checkArticle(postId: number): Promise<boolean> {
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

  // Check if all contents are different (translations working)
  const uniqueContents = new Set(contents);
  return uniqueContents.size > 1;
}

async function main() {
  console.log('🔐 Autenticazione...\n');
  await authenticate();

  console.log('📋 Cerco TUTTI gli articoli del blog...\n');

  const allPosts = await callOdoo('blog.post', 'search_read', [
    [['blog_id', '=', 4]],
    ['id', 'name']
  ], { context: { lang: 'it_IT' } });

  console.log(`Trovati ${allPosts.length} articoli totali\n`);

  console.log('🔍 Controllo quali hanno traduzioni funzionanti...\n');

  const workingArticles: any[] = [];
  const brokenArticles: any[] = [];

  for (const post of allPosts) {
    const hasWorkingTranslations = await checkArticle(post.id);

    if (hasWorkingTranslations) {
      workingArticles.push(post);
      console.log(`✅ ID ${post.id}: ${post.name.substring(0, 50)}...`);
    } else {
      brokenArticles.push(post);
    }

    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\n' + '='.repeat(70));
  console.log('📊 RISULTATI');
  console.log('='.repeat(70) + '\n');

  console.log(`✅ Articoli con traduzioni FUNZIONANTI: ${workingArticles.length}`);
  console.log(`❌ Articoli con traduzioni NON funzionanti: ${brokenArticles.length}\n`);

  if (workingArticles.length > 0) {
    console.log('📝 Articoli con traduzioni funzionanti:\n');
    for (const post of workingArticles.slice(0, 10)) {
      console.log(`   ID ${post.id}: ${post.name}`);
    }
  }

  if (workingArticles.length > 0) {
    console.log('\n🔎 Esamino il primo articolo funzionante (ID ' + workingArticles[0].id + '):\n');

    const testId = workingArticles[0].id;
    const languages = {
      'it_IT': 'Italiano 🇮🇹',
      'de_CH': 'Tedesco 🇩🇪',
      'fr_CH': 'Francese 🇫🇷',
      'en_US': 'Inglese 🇬🇧'
    };

    for (const [lang, langName] of Object.entries(languages)) {
      const post = await callOdoo('blog.post', 'read', [[testId], ['name', 'content']], {
        context: { lang }
      });

      if (post && post.length > 0) {
        const p = post[0];
        const textContent = p.content ? p.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : 'VUOTO';

        console.log(`${langName}:`);
        console.log(`   Titolo: ${p.name}`);
        console.log(`   Content: ${textContent.substring(0, 150)}...\n`);
      }
    }
  }
}

main().catch(console.error);
