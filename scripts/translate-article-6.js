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

const POST_ID = 6;

// Traduzioni titolo
const TITLE_TRANSLATIONS = {
  it_IT: "Conosco e lavoro con Lapa da 6 anni, l'ho conosciuto tramite una mia vecchia conoscenza professionale, e l'ho portato con me anche in questa",
  de_CH: "Ich kenne Lapa und arbeite seit 6 Jahren mit ihnen zusammen, ich habe sie durch eine alte berufliche Bekanntschaft kennengelernt und habe sie auch hierher mitgebracht",
  fr_CH: "Je connais et travaille avec Lapa depuis 6 ans, je les ai connus grâce à une ancienne connaissance professionnelle, et je les ai emmenés avec moi ici aussi",
  en_US: "I've known and worked with Lapa for 6 years, I met them through an old professional acquaintance, and I brought them with me here too"
};

// Traduzioni contenuto - chiavi definite come funzione per matchare esattamente
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
    // Segmento testimonianza 1
    else if (src.includes('punto forte di Lapa è la polivalenza')) {
      translations[src] = {
        de_CH: "«Die Stärke von Lapa ist die Vielseitigkeit der Dienstleistungen, Lapa kann verschiedene Probleme für dich lösen.<br>Neben den Basisprodukten, wenn du etwas Besonderes brauchst, das nicht zu finden ist oder das andere Unternehmen nicht haben, kann Lapa es für dich finden. Ein weiterer Gewinnergrund von Lapa ist der Lieferservice. Sie können jeden Tag liefern, und im Notfall auch an Tagen und zu Zeiten, an denen andere Unternehmen nicht liefern, und das ist ein großartiger Service, da eines der Hauptprobleme in der Gastronomie die Bestellungen sind. Eine falsche Bestellung verursacht ein großes Serviceproblem, und da einer der Hauptfehler, den Mitarbeiter abends machen, weil sie es eilig haben zu gehen, genau die Bestellungen sind, habe ich mit Lapa diesen Stress nicht mehr.»",
        fr_CH: "«Le point fort de Lapa est la polyvalence des services, Lapa est capable de résoudre divers problèmes pour toi.<br>En plus des produits de base, si tu as besoin de quelque chose de particulier qui ne se trouve pas ou que les autres entreprises n'ont pas, Lapa est capable de te le trouver. Une autre raison gagnante de Lapa est le service de livraison. Ils peuvent te livrer tous les jours, et en cas d'urgence même les jours et heures où les autres entreprises ne livrent pas, et c'est un excellent service vu qu'un des principaux problèmes de la gastronomie sont les commandes. Se tromper de commande crée un gros problème au service, et vu qu'une des principales erreurs que font les collaborateurs le soir, parce qu'ils ont hâte de partir, sont justement les commandes, avec Lapa je n'ai plus ce stress.»",
        en_US: "«Lapa's strong point is the versatility in services, Lapa is able to solve various problems for you.<br>Besides the basic products, if you need something special that can't be found or that other companies don't have, Lapa is able to find it for you. Another winning reason for Lapa is the delivery service. They can deliver every day, and in emergencies even on days and hours when other companies don't deliver, and this is a great service since one of the main problems in gastronomy is orders. Making a wrong order creates a big service problem, and since one of the main mistakes employees make in the evening, because they're in a hurry to leave, are the orders themselves, with Lapa I no longer have this stress.»"
      };
    }
    // Segmento testimonianza 2
    else if (src.includes('tutto molto meno stressante')) {
      translations[src] = {
        de_CH: "«Es ist alles viel weniger stressig, andere Unternehmen bieten diesen Service nicht an, sie liefern ein paar Mal pro Woche, was größere Bestellungen und mehr Lagerplatz bedeutet, mit Lapa kann ich jeden Tag wenig bestellen und brauche keinen großen Bestand, keine große Bestellung, die mich für 3 Tage abdeckt, sondern wenig pro Tag ohne das Risiko, etwas wegzuwerfen.»",
        fr_CH: "«Tout est beaucoup moins stressant, les autres entreprises n'offrent pas ce service, elles livrent quelques fois par semaine, ce qui implique des commandes plus importantes, un stockage plus grand, avec Lapa je peux commander peu chaque jour et je n'ai pas besoin d'un grand stock, de faire une grosse commande qui me couvre 3 jours, mais peu par jour sans risquer de jeter quoi que ce soit.»",
        en_US: "«Everything is much less stressful, other companies don't offer this service, they deliver a couple of times a week, which means larger orders, more storage, with Lapa I can order little each day and don't need a large stock, to make a big order that covers me for 3 days, but little each day without risking throwing anything away.»"
      };
    }
    // Segmento firma
    else if (src.includes('DONATO MATASSINO')) {
      translations[src] = {
        de_CH: "<strong>DONATO MATASSINO</strong><br>Küchenchef/Verantwortlicher<br>",
        fr_CH: "<strong>DONATO MATASSINO</strong><br>Chef/Responsable<br>",
        en_US: "<strong>DONATO MATASSINO</strong><br>Chef/Manager<br>"
      };
    }
  }

  return translations;
};

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 6: TESTIMONIANZA DONATO MATASSINO ===\n');

  // 1. Aggiorno titolo per ogni lingua
  console.log('1. Aggiorno titolo...');
  for (const lang of ['it_IT', 'de_CH', 'fr_CH', 'en_US']) {
    await callOdoo('blog.post', 'write',
      [[POST_ID], { name: TITLE_TRANSLATIONS[lang] }],
      { context: { lang } }
    );
    console.log(`   ${lang}: OK`);
  }

  // 2. Leggo i segmenti ESATTI dall'API
  console.log('2. Leggo segmenti...');
  const segmentData = await callOdoo('blog.post', 'get_field_translations', [[POST_ID], 'content']);
  const segments = segmentData[0];
  const sourceTexts = [...new Set(segments.map(s => s.source))];
  console.log(`   Trovati ${sourceTexts.length} segmenti`);

  // 3. Genero traduzioni basate sui source esatti
  const TRANSLATIONS = getTranslations(sourceTexts);

  // 4. Applico traduzioni per ogni lingua
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

  console.log('\n✅ ARTICOLO 6 COMPLETATO!');
}

main();
