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

const POST_ID = 3;

// Traduzioni titolo
const TITLE_TRANSLATIONS = {
  it_IT: "Disponibili, veloci, persone umane, qualità eccezionale.",
  de_CH: "Verfügbar, schnell, menschlich, außergewöhnliche Qualität.",
  fr_CH: "Disponibles, rapides, humains, qualité exceptionnelle.",
  en_US: "Available, fast, human, exceptional quality."
};

// Traduzioni dei segmenti - usando i SOURCE ESATTI da Odoo
const TRANSLATIONS = {
  // Segmento 1 - stelle (HTML, copio identico)
  "​<span class=\"o_stars o_five_stars\" id=\"checkId-1\"><i class=\"fa fa-star-o\" aria-hidden=\"true\"></i><i class=\"fa fa-star-o\" aria-hidden=\"true\"></i><i class=\"fa fa-star-o\" aria-hidden=\"true\"></i><i class=\"fa fa-star-o\" aria-hidden=\"true\"></i><i class=\"fa fa-star-o\" aria-hidden=\"true\"></i></span><br>": {
    de_CH: "​<span class=\"o_stars o_five_stars\" id=\"checkId-1\"><i class=\"fa fa-star-o\" aria-hidden=\"true\"></i><i class=\"fa fa-star-o\" aria-hidden=\"true\"></i><i class=\"fa fa-star-o\" aria-hidden=\"true\"></i><i class=\"fa fa-star-o\" aria-hidden=\"true\"></i><i class=\"fa fa-star-o\" aria-hidden=\"true\"></i></span><br>",
    fr_CH: "​<span class=\"o_stars o_five_stars\" id=\"checkId-1\"><i class=\"fa fa-star-o\" aria-hidden=\"true\"></i><i class=\"fa fa-star-o\" aria-hidden=\"true\"></i><i class=\"fa fa-star-o\" aria-hidden=\"true\"></i><i class=\"fa fa-star-o\" aria-hidden=\"true\"></i><i class=\"fa fa-star-o\" aria-hidden=\"true\"></i></span><br>",
    en_US: "​<span class=\"o_stars o_five_stars\" id=\"checkId-1\"><i class=\"fa fa-star-o\" aria-hidden=\"true\"></i><i class=\"fa fa-star-o\" aria-hidden=\"true\"></i><i class=\"fa fa-star-o\" aria-hidden=\"true\"></i><i class=\"fa fa-star-o\" aria-hidden=\"true\"></i><i class=\"fa fa-star-o\" aria-hidden=\"true\"></i></span><br>"
  },

  // Segmento 2 - prima testimonianza (source italiano)
  "«Lavoro con Lapa praticamente dall'inizio 6/7 anni, e ho continuato a scegliere Lapa per tutti questi anni perchè : è disponibile e perché ormai sono amici, non siamo più ristoratore e fornitore, lavoriamo insieme, se ho bisogno di qualcosa di particolare me la trova, i prodotti sono eccezionali, infatti gli faccio tanta pubblicità, e ci troviamo benissimo.»": {
    de_CH: "«Ich arbeite praktisch von Anfang an mit Lapa zusammen, seit 6/7 Jahren, und ich habe mich all diese Jahre weiterhin für Lapa entschieden, weil: sie verfügbar sind und weil wir inzwischen Freunde sind, wir sind nicht mehr Restaurateur und Lieferant, wir arbeiten zusammen, wenn ich etwas Besonderes brauche, findet er es für mich, die Produkte sind außergewöhnlich, tatsächlich mache ich viel Werbung für sie, und wir verstehen uns bestens.»",
    fr_CH: "«Je travaille avec Lapa pratiquement depuis le début, 6/7 ans, et j'ai continué à choisir Lapa toutes ces années parce que : ils sont disponibles et parce que maintenant nous sommes amis, nous ne sommes plus restaurateur et fournisseur, nous travaillons ensemble, si j'ai besoin de quelque chose de particulier il me le trouve, les produits sont exceptionnels, en fait je leur fais beaucoup de publicité, et nous nous entendons très bien.»",
    en_US: "«I've been working with Lapa practically from the beginning, 6/7 years, and I've continued to choose Lapa all these years because: they're available and because we're now friends, we're no longer restaurateur and supplier, we work together, if I need something special they find it for me, the products are exceptional, in fact I give them a lot of publicity, and we get along great.»"
  },

  // Segmento 3 - seconda testimonianza (source INGLESE!)
  "«Many companies came, even bigger ones, but I'm not interested, I want few suppliers but good ones who treat me well, with whom I can have a relationship of sincerity, transparency and friendship»": {
    de_CH: "«Es kamen viele Firmen, auch größere, aber das interessiert mich nicht, ich möchte wenige Lieferanten, aber gute, die mich gut behandeln, mit denen ich eine Beziehung von Aufrichtigkeit, Transparenz und Freundschaft haben kann»",
    fr_CH: "«Beaucoup d'entreprises sont venues, même de plus grandes, mais ça ne m'intéresse pas, je veux peu de fournisseurs mais bons qui me traitent bien, avec qui avoir une relation de sincérité, de transparence et d'amitié»",
    it_IT: "«Sono venute tante ditte anche più grosse, ma a me non interessa, voglio pochi fornitori ma buoni che mi trattano bene, con cui avere un rapporto di sincerità, trasparenza e amicizia»"
  },

  // Segmento 4 - firma
  "<strong>FAUSTO D'AGOSTINO</strong> <em>Co-Proprietario/Chef</em>\n\n<br>": {
    de_CH: "<strong>FAUSTO D'AGOSTINO</strong> <em>Mitinhaber/Küchenchef</em>\n\n<br>",
    fr_CH: "<strong>FAUSTO D'AGOSTINO</strong> <em>Co-propriétaire/Chef</em>\n\n<br>",
    en_US: "<strong>FAUSTO D'AGOSTINO</strong> <em>Co-Owner/Chef</em>\n\n<br>"
  }
};

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 3: TESTIMONIANZA FAUSTO D\'AGOSTINO ===\n');

  // 1. Aggiorno titolo per ogni lingua
  console.log('1. Aggiorno titolo...');
  for (const lang of ['it_IT', 'de_CH', 'fr_CH', 'en_US']) {
    await callOdoo('blog.post', 'write',
      [[POST_ID], { name: TITLE_TRANSLATIONS[lang] }],
      { context: { lang } }
    );
    console.log(`   ${lang}: OK`);
  }

  // 2. Leggo i segmenti
  console.log('2. Leggo segmenti...');
  const segmentData = await callOdoo('blog.post', 'get_field_translations', [[POST_ID], 'content']);
  const segments = segmentData[0];
  const sourceTexts = [...new Set(segments.map(s => s.source))];
  console.log(`   Trovati ${sourceTexts.length} segmenti`);

  // 3. Applico traduzioni per ogni lingua
  console.log('3. Applico traduzioni contenuto...');
  for (const lang of ['it_IT', 'de_CH', 'fr_CH', 'en_US']) {
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
      console.log(`   ${lang}: ${count} segmenti tradotti`);
    } else {
      console.log(`   ${lang}: 0 segmenti`);
    }
  }

  // 4. Verifica
  console.log('\n--- VERIFICA ---\n');
  for (const lang of ['it_IT', 'de_CH', 'fr_CH', 'en_US']) {
    const data = await callOdoo('blog.post', 'read',
      [[POST_ID], ['name', 'content']],
      { context: { lang } }
    );
    const title = data?.[0]?.name || '';
    const text = (data?.[0]?.content || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().substring(0, 60);
    console.log(`[${lang}] ${title}`);
    console.log(`        ${text}...`);
  }

  console.log('\n✅ ARTICOLO 3 COMPLETATO!');
}

main();
