/**
 * Check random articles for translation issues
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

async function checkArticle(postId: number) {
  const languages = {
    'it_IT': 'IT',
    'de_CH': 'DE',
    'fr_CH': 'FR',
    'en_US': 'EN'
  };

  const contents: string[] = [];
  let articleName = '';

  for (const [lang, langCode] of Object.entries(languages)) {
    const post = await callOdoo('blog.post', 'read', [[postId], ['name', 'content']], {
      context: { lang }
    });

    if (post && post.length > 0) {
      if (lang === 'it_IT') articleName = post[0].name;
      const textContent = post[0].content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      contents.push(textContent.substring(0, 150));
    }
  }

  const uniqueContents = new Set(contents);
  const status = uniqueContents.size === 1 ? '❌ TUTTE UGUALI' : '✅ DIVERSE';

  console.log(`ID ${postId}: ${status} - ${articleName.substring(0, 50)}`);

  return uniqueContents.size;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         CONTROLLO ARTICOLI PER PROBLEMI TRADUZIONI         ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('🔐 Autenticazione...');
  await authenticate();
  console.log('✅\n');

  // Check a sample of articles from different ranges
  const testArticles = [
    350, // Guanciale
    355, // Cioccolato (chocolat)
    360, // Metà
    365, // Burrata
    370, //
    375,
    380,
    385,
    390,
    395,
    400,
    405,
    406,
    421  // Fiordilatte (fixed)
  ];

  console.log('📋 Controllo campione di articoli:\n');

  let problemCount = 0;
  let okCount = 0;

  for (const id of testArticles) {
    try {
      const uniqueCount = await checkArticle(id);
      if (uniqueCount === 1) {
        problemCount++;
      } else {
        okCount++;
      }
      await new Promise(r => setTimeout(r, 300));
    } catch (e: any) {
      console.log(`ID ${id}: ⚠️  ERRORE - ${e.message}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('📊 RIEPILOGO:');
  console.log(`   ❌ Articoli con problema: ${problemCount}`);
  console.log(`   ✅ Articoli OK: ${okCount}`);
  console.log('');

  if (problemCount > 0) {
    console.log('⚠️  PROBLEMA CONFERMATO!');
    console.log('   Gli articoli hanno tutte le lingue con lo stesso contenuto.');
    console.log('   Necessario riprocessare con il metodo di matching strutturale.\n');
  } else {
    console.log('✅ Tutti gli articoli controllati sono OK!\n');
  }
}

main().catch(console.error);
