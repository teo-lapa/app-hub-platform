/**
 * Controllo COMPLETO articolo in tutte le lingue
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = 'paul@lapa.ch';
const ODOO_PASSWORD = 'lapa201180';

let cookies = '';

async function authenticate() {
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
  return data.result.uid;
}

async function callOdoo(model, method, args, kwargs = {}) {
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
  return data.result;
}

function extractTextSamples(html) {
  // Estrai diversi campioni dal testo
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
  const h2Match = html.match(/<h2[^>]*>([^<]+)<\/h2>/);
  const firstP = html.match(/<p>([^<]+)</);
  const liMatches = html.match(/<li>([^<]+)<\/li>/g);

  return {
    h1: h1Match ? h1Match[1] : null,
    h2: h2Match ? h2Match[1] : null,
    firstParagraph: firstP ? firstP[1].substring(0, 100) : null,
    firstListItem: liMatches ? liMatches[0].replace(/<\/?li>/g, '') : null,
    totalLength: html.length
  };
}

async function main() {
  const postId = 178;

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   CONTROLLO COMPLETO ARTICOLO 178 IN TUTTE LE LINGUE      ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  await authenticate();

  const langs = [
    { code: 'it_IT', name: 'Italiano', flag: '🇮🇹' },
    { code: 'de_CH', name: 'Tedesco', flag: '🇩🇪' },
    { code: 'fr_CH', name: 'Francese', flag: '🇫🇷' },
    { code: 'en_US', name: 'Inglese', flag: '🇬🇧' }
  ];

  const results = {};

  for (const lang of langs) {
    const data = await callOdoo('blog.post', 'read', [[postId]], {
      fields: ['name', 'content'],
      context: { lang: lang.code }
    });

    const post = data[0];
    const samples = extractTextSamples(post.content);

    results[lang.code] = {
      title: post.name,
      samples
    };

    console.log(`${lang.flag} ${lang.name.toUpperCase()} (${lang.code})`);
    console.log('─'.repeat(60));
    console.log(`Title: ${post.name}`);
    console.log(`\nCampioni testo:`);
    console.log(`  H1: ${samples.h1}`);
    console.log(`  H2: ${samples.h2}`);
    console.log(`  Primo paragrafo: ${samples.firstParagraph}...`);
    console.log(`  Prima lista: ${samples.firstListItem}`);
    console.log(`  Lunghezza totale HTML: ${samples.totalLength} caratteri`);
    console.log('');
  }

  console.log('═'.repeat(60));
  console.log('ANALISI TRADUZIONI:\n');

  // Controlla se il content è veramente diverso tra le lingue
  const itH1 = results['it_IT'].samples.h1;
  const deH1 = results['de_CH'].samples.h1;
  const frH1 = results['fr_CH'].samples.h1;
  const enH1 = results['en_US'].samples.h1;

  const itP = results['it_IT'].samples.firstParagraph;
  const deP = results['de_CH'].samples.firstParagraph;
  const frP = results['fr_CH'].samples.firstParagraph;
  const enP = results['en_US'].samples.firstParagraph;

  console.log('✓ H1 tradotti:');
  console.log(`  IT ≠ DE: ${itH1 !== deH1 ? '✅ SÌ' : '❌ NO'}`);
  console.log(`  IT ≠ FR: ${itH1 !== frH1 ? '✅ SÌ' : '❌ NO'}`);
  console.log(`  IT ≠ EN: ${itH1 !== enH1 ? '✅ SÌ' : '❌ NO'}`);

  console.log('\n✓ Paragrafi tradotti:');
  console.log(`  IT ≠ DE: ${itP !== deP ? '✅ SÌ' : '❌ NO'}`);
  console.log(`  IT ≠ FR: ${itP !== frP ? '✅ SÌ' : '❌ NO'}`);
  console.log(`  IT ≠ EN: ${itP !== enP ? '✅ SÌ' : '❌ NO'}`);

  console.log('\n✓ Lunghezza content:');
  console.log(`  IT: ${results['it_IT'].samples.totalLength} chars`);
  console.log(`  DE: ${results['de_CH'].samples.totalLength} chars`);
  console.log(`  FR: ${results['fr_CH'].samples.totalLength} chars`);
  console.log(`  EN: ${results['en_US'].samples.totalLength} chars`);

  const allSameLength =
    results['it_IT'].samples.totalLength === results['de_CH'].samples.totalLength &&
    results['it_IT'].samples.totalLength === results['fr_CH'].samples.totalLength &&
    results['it_IT'].samples.totalLength === results['en_US'].samples.totalLength;

  console.log(`\n${allSameLength ? '⚠️  TUTTE STESSA LUNGHEZZA = PROBABILMENTE NON TRADOTTO!' : '✅ LUNGHEZZE DIVERSE = TRADOTTO'}`);

  console.log('\n═'.repeat(60));
}

main().catch(console.error);
