/**
 * Verify that previously problematic articles are now fixed
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

async function verifyArticle(postId: number) {
  const languages = {
    'it_IT': 'IT 🇮🇹',
    'de_CH': 'DE 🇩🇪',
    'fr_CH': 'FR 🇫🇷',
    'en_US': 'EN 🇬🇧'
  };

  let articleName = '';
  const contents: string[] = [];

  for (const [lang, langName] of Object.entries(languages)) {
    const post = await callOdoo('blog.post', 'read', [[postId], ['name', 'content']], {
      context: { lang }
    });

    if (post && post.length > 0) {
      if (lang === 'it_IT') articleName = post[0].name;
      const textContent = post[0].content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      contents.push(textContent.substring(0, 100));
    }
  }

  const uniqueContents = new Set(contents);

  console.log(`\nID ${postId}: ${articleName.substring(0, 60)}`);
  console.log(`   Contenuti unici: ${uniqueContents.size}/4`);

  if (uniqueContents.size === 4) {
    console.log(`   ✅ PERFETTO - Tutte le lingue diverse`);
  } else if (uniqueContents.size === 1) {
    console.log(`   ❌ PROBLEMA - Tutte le lingue identiche`);
  } else {
    console.log(`   ⚠️  PARZIALE - Solo ${uniqueContents.size} versioni diverse`);
  }

  return uniqueContents.size;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          VERIFICA ARTICOLI SISTEMATI                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('🔐 Autenticazione...');
  await authenticate();
  console.log('✅\n');

  // Articles that were previously problematic
  const articlesToCheck = [
    355, // Speck Alto Adige (era problematico)
    360, // Cacio e Pepe (era problematico)
    365, // Burrata (era problematico)
    390, // Gestione Inventario (era problematico)
    400, // Menu Vegetariano (era problematico)
    350, // Guanciale (era OK)
    421, // Fiordilatte (nuovo, OK)
  ];

  console.log('📋 Verifica articoli:\n');
  console.log('='.repeat(70));

  let perfectCount = 0;
  let problemCount = 0;

  for (const id of articlesToCheck) {
    const uniqueCount = await verifyArticle(id);
    if (uniqueCount === 4) perfectCount++;
    else if (uniqueCount === 1) problemCount++;
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('\n' + '='.repeat(70));
  console.log('📊 RIEPILOGO VERIFICA:');
  console.log(`   ✅ Articoli perfetti (4/4 lingue diverse): ${perfectCount}`);
  console.log(`   ❌ Articoli con problema: ${problemCount}`);
  console.log('');

  if (problemCount === 0) {
    console.log('🎉 SUCCESSO! Tutti gli articoli hanno traduzioni corrette!\n');
  } else {
    console.log('⚠️  Alcuni articoli hanno ancora problemi.\n');
  }
}

main().catch(console.error);
