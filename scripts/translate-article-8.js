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

const POST_ID = 8;

const TITLE_TRANSLATIONS = {
  it_IT: "LAPA per noi è sinonimo di garanzia e soddisfazione",
  de_CH: "LAPA ist für uns ein Synonym für Garantie und Zufriedenheit",
  fr_CH: "LAPA est pour nous synonyme de garantie et satisfaction",
  en_US: "LAPA for us is synonymous with guarantee and satisfaction"
};

const getTranslations = (sources) => {
  const translations = {};

  for (const src of sources) {
    if (src.includes('o_stars o_five_stars')) {
      translations[src] = { de_CH: src, fr_CH: src, en_US: src };
    }
    else if (src.includes("All'inizio mi è stato presentato")) {
      translations[src] = {
        de_CH: "«Am Anfang wurde er mir wie alle anderen Lieferanten vorgestellt, aber von Beginn an haben wir die Verfügbarkeit, die Seriosität und die Pünktlichkeit bemerkt. Sie haben sehr viel Kompetenz und können dir das richtige Produkt empfehlen...",
        fr_CH: "«Au début il m'a été présenté comme tous les autres fournisseurs, mais dès le départ nous avons remarqué la disponibilité, le sérieux et la ponctualité. Ils ont énormément de compétence et savent te conseiller le produit...",
        en_US: "«At the beginning he was introduced to me like all the other suppliers, but right away we noticed the availability, the seriousness and the punctuality. They have a lot of expertise and know how to recommend the right product..."
      };
    }
    else if (src.includes('LAPA Zero pensieri')) {
      translations[src] = {
        de_CH: "«Wir scherzen immer über LAPA Null Sorgen, aber es ist wirklich so, ich mache einen Anruf und das Produkt kommt an, auch wenn der Fehler bei mir lag.",
        fr_CH: "«On plaisante toujours sur LAPA Zéro soucis, mais c'est vraiment comme ça, je passe un coup de fil et le produit arrive même si l'erreur était la mienne.",
        en_US: "«We always joke about LAPA Zero worries, but it's really like that, I make a phone call and the product arrives even if the mistake was mine."
      };
    }
    else if (src.includes('Ieri per sbaglio non ho inviato')) {
      translations[src] = {
        de_CH: "Gestern habe ich versehentlich die Bestellung nicht abgeschickt und heute Morgen, als ich ohne Produkte da stand, habe ich angerufen und nach einer halben Stunde hatte ich die Ware im Restaurant»",
        fr_CH: "Hier par erreur je n'ai pas envoyé la commande et ce matin quand je me suis retrouvé sans produits, j'ai passé un coup de fil et après une demi-heure j'avais la marchandise au restaurant»",
        en_US: "Yesterday I accidentally didn't send the order and this morning when I found myself without products, I made a phone call and after half an hour I had the goods at the restaurant»"
      };
    }
    else if (src.includes('ROBERTO MAGRO')) {
      translations[src] = {
        de_CH: "ROBERTO MAGRO<br>Küchenchef/Verantwortlicher<br>",
        fr_CH: "ROBERTO MAGRO<br>Chef/Responsable<br>",
        en_US: "ROBERTO MAGRO<br>Chef/Manager<br>"
      };
    }
  }

  return translations;
};

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 8: TESTIMONIANZA ROBERTO MAGRO ===\n');

  console.log('1. Aggiorno titolo...');
  for (const lang of ['it_IT', 'de_CH', 'fr_CH', 'en_US']) {
    await callOdoo('blog.post', 'write',
      [[POST_ID], { name: TITLE_TRANSLATIONS[lang] }],
      { context: { lang } }
    );
    console.log(`   ${lang}: OK`);
  }

  console.log('2. Leggo segmenti...');
  const segmentData = await callOdoo('blog.post', 'get_field_translations', [[POST_ID], 'content']);
  const segments = segmentData[0];
  const sourceTexts = [...new Set(segments.map(s => s.source))];
  console.log(`   Trovati ${sourceTexts.length} segmenti`);

  const TRANSLATIONS = getTranslations(sourceTexts);

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

  console.log('\n✅ ARTICOLO 8 COMPLETATO!');
}

main();
