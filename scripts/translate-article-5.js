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

const POST_ID = 5;

// Traduzioni titolo
const TITLE_TRANSLATIONS = {
  it_IT: "Come qualità che come prezzo ci conveniva di più, e il fatto che siamo qui vicino ci agevola molto, sono sempre disponibili.",
  de_CH: "Sowohl bei der Qualität als auch beim Preis war es für uns günstiger, und die Tatsache, dass wir hier in der Nähe sind, erleichtert uns sehr, sie sind immer verfügbar.",
  fr_CH: "Tant en qualité qu'en prix c'était plus avantageux pour nous, et le fait que nous soyons ici à proximité nous facilite beaucoup, ils sont toujours disponibles.",
  en_US: "Both in quality and price it was more convenient for us, and the fact that we are nearby makes it much easier, they are always available."
};

// Traduzioni dei segmenti
const TRANSLATIONS = {
  "«Abbiamo cominciato solo con alcuni prodotti e adesso abbiamo quasi tutto da voi, a qualsiasi ora veramente mi serve qualcosa, mando un messaggio e loro sono pronti, l'altra volta ho chiesto della mozzarella di bufala che mi doveva arrivare l'indomani ho chiesto che me la consegnassero la stessa sera e loro dopo 15 min erano qui e mi hanno portato la merce»": {
    de_CH: "«Wir haben nur mit einigen Produkten angefangen und jetzt haben wir fast alles von euch, zu jeder Zeit wenn ich wirklich etwas brauche, schicke ich eine Nachricht und sie sind bereit, neulich habe ich nach Büffelmozzarella gefragt, die am nächsten Tag ankommen sollte, ich habe gebeten, dass sie mir am selben Abend geliefert wird und sie waren nach 15 Minuten hier und haben mir die Ware gebracht»",
    fr_CH: "«Nous avons commencé avec seulement quelques produits et maintenant nous avons presque tout chez vous, à n'importe quelle heure si j'ai vraiment besoin de quelque chose, j'envoie un message et ils sont prêts, l'autre fois j'ai demandé de la mozzarella di bufala qui devait arriver le lendemain, j'ai demandé qu'ils me la livrent le soir même et ils étaient là après 15 minutes et m'ont apporté la marchandise»",
    en_US: "«We started with just a few products and now we have almost everything from you, at any hour if I really need something, I send a message and they are ready, the other time I asked for buffalo mozzarella that was supposed to arrive the next day, I asked them to deliver it the same evening and they were here after 15 minutes and brought me the goods»"
  },

  "<strong>GIUSY</strong><br>Responsabile<br>": {
    de_CH: "<strong>GIUSY</strong><br>Verantwortliche<br>",
    fr_CH: "<strong>GIUSY</strong><br>Responsable<br>",
    en_US: "<strong>GIUSY</strong><br>Manager<br>"
  }
};

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 5: TESTIMONIANZA GIUSY ===\n');

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
    console.log(`   ${lang}: ${count} segmenti tradotti`);
  }

  // 4. Verifica
  console.log('\n--- VERIFICA ---\n');
  for (const lang of ['it_IT', 'de_CH', 'fr_CH', 'en_US']) {
    const data = await callOdoo('blog.post', 'read',
      [[POST_ID], ['name', 'content']],
      { context: { lang } }
    );
    const title = data?.[0]?.name || '';
    const text = (data?.[0]?.content || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().substring(0, 50);
    console.log(`[${lang}] ${title.substring(0, 60)}...`);
    console.log(`        ${text}...`);
  }

  console.log('\n✅ ARTICOLO 5 COMPLETATO!');
}

main();
