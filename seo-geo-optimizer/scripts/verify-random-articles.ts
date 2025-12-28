/**
 * Verifica articoli random per confermare traduzioni al 100%
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

async function checkArticle(postId: number): Promise<void> {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`ARTICOLO ID ${postId}`);
  console.log('='.repeat(70));

  const languages = {
    'it_IT': 'IT 🇮🇹',
    'de_CH': 'DE 🇩🇪',
    'fr_CH': 'FR 🇫🇷',
    'en_US': 'EN 🇬🇧'
  };

  const contents: string[] = [];

  for (const [lang, langName] of Object.entries(languages)) {
    const post = await callOdoo('blog.post', 'read', [[postId], ['name', 'content']], {
      context: { lang }
    });

    if (post && post.length > 0) {
      const p = post[0];
      const textContent = p.content ? p.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : 'VUOTO';
      contents.push(textContent.substring(0, 100));

      console.log(`\n${langName}:`);
      console.log(`  Titolo: ${p.name.substring(0, 70)}...`);
      console.log(`  Content: ${textContent.substring(0, 120)}...`);
    }
  }

  // Check if contents are different
  const uniqueContents = new Set(contents);
  if (uniqueContents.size > 1) {
    console.log(`\n✅ TRADUZIONI FUNZIONANTI (${uniqueContents.size}/4 contenuti diversi)`);
  } else {
    console.log(`\n❌ PROBLEMA: Tutti i contenuti sono uguali!`);
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           VERIFICA TRADUZIONI ARTICOLI RANDOM              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  console.log('\n🔐 Autenticazione...');
  await authenticate();
  console.log('✅\n');

  // Check 5 random articles from different ranges
  const testArticles = [
    350, // Inizio (Guanciale)
    365, // Metà (Burrata conservazione)
    380, // Fine prima metà (Controllo Qualità LAPA)
    395, // Fine seconda metà (Wine Pairing)
    406  // Ultimo (Arte del Caffè)
  ];

  console.log('📋 Controllo 5 articoli random:\n');
  for (const id of testArticles) {
    console.log(`   - ID ${id}`);
  }

  for (const postId of testArticles) {
    await checkArticle(postId);
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n' + '='.repeat(70));
  console.log('🎉 VERIFICA COMPLETATA!');
  console.log('='.repeat(70) + '\n');
}

main().catch(console.error);
