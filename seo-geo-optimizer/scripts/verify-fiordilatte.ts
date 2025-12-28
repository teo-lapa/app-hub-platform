/**
 * Verifica articolo Fiordilatte in dettaglio
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

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          VERIFICA DETTAGLIATA FIORDILATTE                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('🔐 Autenticazione...');
  await authenticate();
  console.log('✅\n');

  // First find Fiordilatte article
  console.log('🔍 Cerco articolo Fiordilatte...\n');

  const posts = await callOdoo('blog.post', 'search_read', [
    [['blog_id', '=', 4], ['name', 'ilike', 'Fiordilatte']],
    ['id', 'name', 'create_date']
  ], { context: { lang: 'it_IT' } });

  if (posts.length === 0) {
    console.log('❌ Nessun articolo Fiordilatte trovato!\n');
    return;
  }

  console.log(`Trovati ${posts.length} articoli Fiordilatte:\n`);
  for (const post of posts) {
    console.log(`   ID ${post.id}: ${post.name}`);
    console.log(`   Creato: ${new Date(post.create_date).toLocaleString('it-IT')}\n`);
  }

  // Check the most recent one
  const postId = posts.sort((a, b) => b.id - a.id)[0].id;
  console.log(`\n📋 Verifico ID ${postId} (più recente):\n`);
  console.log('='.repeat(70));

  const languages = {
    'it_IT': 'ITALIANO 🇮🇹',
    'de_CH': 'TEDESCO 🇩🇪',
    'fr_CH': 'FRANCESE 🇫🇷',
    'en_US': 'INGLESE 🇬🇧'
  };

  for (const [lang, langName] of Object.entries(languages)) {
    console.log(`\n${langName}:`);
    console.log('-'.repeat(70));

    const post = await callOdoo('blog.post', 'read', [[postId], ['name', 'subtitle', 'content']], {
      context: { lang }
    });

    if (post && post.length > 0) {
      const p = post[0];

      console.log(`\n📝 TITOLO:`);
      console.log(`   ${p.name}\n`);

      console.log(`📄 SOTTOTITOLO:`);
      console.log(`   ${p.subtitle || 'N/A'}\n`);

      if (p.content) {
        const textContent = p.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        console.log(`📖 CONTENUTO (primi 500 caratteri):`);
        console.log(`   ${textContent.substring(0, 500)}...\n`);
      } else {
        console.log(`📖 CONTENUTO: VUOTO\n`);
      }
    }
  }

  console.log('='.repeat(70));
  console.log('\n❓ ANALISI:\n');

  // Check if contents are different
  const contents: string[] = [];
  for (const lang of Object.keys(languages)) {
    const post = await callOdoo('blog.post', 'read', [[postId], ['content']], {
      context: { lang }
    });
    if (post && post.length > 0 && post[0].content) {
      const textContent = post[0].content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      contents.push(textContent.substring(0, 200));
    }
  }

  const uniqueContents = new Set(contents);

  if (uniqueContents.size === 1) {
    console.log('❌ PROBLEMA: Tutti i contenuti sono IDENTICI!');
    console.log('   Tutte le lingue mostrano lo stesso testo.\n');
  } else if (uniqueContents.size === 4) {
    console.log('✅ OK: Tutti i contenuti sono DIVERSI!');
    console.log('   Ogni lingua ha il suo testo.\n');
  } else {
    console.log(`⚠️  PARZIALE: ${uniqueContents.size}/4 contenuti diversi`);
    console.log('   Alcune lingue condividono lo stesso testo.\n');
  }
}

main().catch(console.error);
