const ODOO = {
  url: 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com',
  db: 'lapadevadmin-lapa-v2-main-7268478',
  user: 'paul@lapa.ch',
  pass: 'lapa201180'
};

let sid = '';

async function auth() {
  const r = await fetch(ODOO.url + '/web/session/authenticate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { db: ODOO.db, login: ODOO.user, password: ODOO.pass }, id: 1 })
  });
  const cookie = r.headers.get('set-cookie');
  if (cookie) {
    const match = cookie.match(/session_id=([^;]+)/);
    if (match) sid = match[1];
  }
  console.log('Auth:', sid ? 'OK' : 'FAILED');
}

async function callOdoo(model, method, args, kwargs = {}) {
  const r = await fetch(ODOO.url + '/web/dataset/call_kw', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': 'session_id=' + sid,
      'X-Requested-With': 'XMLHttpRequest'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { model, method, args, kwargs: kwargs || {} },
      id: Math.floor(Math.random() * 1000000000)
    })
  });
  const data = await r.json();
  if (data.error) {
    console.error('ERRORE:', data.error.data?.message || data.error.message);
    return null;
  }
  return data.result;
}

const POST_ID = 7;

// Traduzioni titolo
const TITLE_TRANSLATIONS = {
  it_IT: "Essendo nuovo il ristorante, collaboro da poco con Lapa, ma sono contento di poter parlare con loro, che mi danno dei consigli sui prodotti e da cui traggo ispirazione",
  de_CH: "Da das Restaurant neu ist, arbeite ich erst seit kurzem mit Lapa zusammen, aber ich bin froh, mit ihnen sprechen zu können, die mir Ratschläge zu Produkten geben und von denen ich Inspiration beziehe",
  fr_CH: "Le restaurant étant nouveau, je collabore depuis peu avec Lapa, mais je suis content de pouvoir parler avec eux, qui me donnent des conseils sur les produits et dont je tire de l'inspiration",
  en_US: "Being a new restaurant, I've only recently started working with Lapa, but I'm happy to be able to talk with them, who give me advice on products and from whom I draw inspiration"
};

// Traduzioni contenuto
const getTranslations = (sources) => {
  const translations = {};

  for (const src of sources) {
    // Segmento stelle - copia identico
    if (src.includes('o_stars o_five_stars')) {
      translations[src] = {
        de_CH: src,
        fr_CH: src,
        en_US: src
      };
    }
    // Testimonianza
    else if (src.includes('capitato di fare degli ordini anche molto tardi')) {
      translations[src] = {
        de_CH: "«……es ist vorgekommen, dass ich auch sehr spät Bestellungen aufgegeben habe, um ein Uhr nachts, und trotzdem alles am nächsten Morgen erhalten habe……..»",
        fr_CH: "«……il m'est arrivé de passer des commandes même très tard, à une heure du matin et de recevoir quand même tout le lendemain matin……..»",
        en_US: "«……it has happened that I placed orders even very late, at one in the morning, and still received everything the next morning……..»"
      };
    }
    // Firma
    else if (src.includes('DOMENICO AMATO')) {
      translations[src] = {
        de_CH: "DOMENICO AMATO<br>Küchenchef<br>",
        fr_CH: "DOMENICO AMATO<br>Chef<br>",
        en_US: "DOMENICO AMATO<br>Chef<br>"
      };
    }
  }

  return translations;
};

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 7: TESTIMONIANZA DOMENICO AMATO ===\n');

  // 1. Aggiorno titolo
  console.log('1. Aggiorno titolo...');
  for (const lang of ['it_IT', 'de_CH', 'fr_CH', 'en_US']) {
    await callOdoo('blog.post', 'write',
      [[POST_ID], { name: TITLE_TRANSLATIONS[lang] }],
      { context: { lang } }
    );
    console.log(`   ${lang}: OK`);
  }

  // 2. Leggo segmenti
  console.log('2. Leggo segmenti...');
  const segmentData = await callOdoo('blog.post', 'get_field_translations', [[POST_ID], 'content']);
  const segments = segmentData[0];
  const sourceTexts = [...new Set(segments.map(s => s.source))];
  console.log(`   Trovati ${sourceTexts.length} segmenti`);

  // 3. Traduzioni
  const TRANSLATIONS = getTranslations(sourceTexts);

  // 4. Applico
  console.log('3. Applico traduzioni...');
  for (const lang of ['de_CH', 'fr_CH', 'en_US']) {
    const langTranslations = {};
    let count = 0;
    for (const src of sourceTexts) {
      if (TRANSLATIONS[src] && TRANSLATIONS[src][lang]) {
        langTranslations[src] = TRANSLATIONS[src][lang];
        count++;
      }
    }
    if (Object.keys(langTranslations).length > 0) {
      await callOdoo('blog.post', 'update_field_translations',
        [[POST_ID], 'content', { [lang]: langTranslations }]
      );
    }
    console.log(`   ${lang}: ${count} segmenti`);
  }

  // 5. Verifica
  console.log('\n--- VERIFICA ---\n');
  for (const lang of ['it_IT', 'de_CH', 'fr_CH', 'en_US']) {
    const data = await callOdoo('blog.post', 'read',
      [[POST_ID], ['name', 'content']],
      { context: { lang } }
    );
    const title = data?.[0]?.name || '';
    const text = (data?.[0]?.content || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().substring(0, 60);
    console.log(`[${lang}] ${title.substring(0, 50)}...`);
    console.log(`        ${text}...`);
  }

  console.log('\n✅ ARTICOLO 7 COMPLETATO!');
}

main();
