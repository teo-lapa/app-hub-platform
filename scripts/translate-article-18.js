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

const POST_ID = 18;

const TITLE_TRANSLATIONS = {
  it_IT: "🥃🎂 \"Il Baba al Rhum di iMarigliano: il Piacere Proibito che Conquisterà i Tuoi Clienti!\" 🌟",
  de_CH: "🥃🎂 \"Der Rum-Baba von iMarigliano: Das verbotene Vergnügen, das Ihre Kunden erobern wird!\" 🌟",
  fr_CH: "🥃🎂 \"Le Baba au Rhum de iMarigliano : le Plaisir Interdit qui Conquerra vos Clients !\" 🌟",
  en_US: "🥃🎂 \"The Rum Baba from iMarigliano: the Forbidden Pleasure that Will Win Over Your Customers!\" 🌟"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Ehi, tu! Sì, proprio tu')) {
      t[src] = {
        de_CH: 'Hey, du! Ja, genau du, Gastronomie-Liebhaber und erfolgreicher Gastronom! LAPA - Finest Italian Food hat etwas so Gutes, so Sündhaftes, dass es deine Kunden verrückt machen wird: der Rum-Baba!',
        fr_CH: 'Hey, toi ! Oui, exactement toi, amateur de gastronomie et restaurateur à succès ! LAPA - Finest Italian Food a quelque chose de si bon, de si pécheur, que ça rendra tes clients fous : le Baba au Rhum !',
        en_US: 'Hey, you! Yes, exactly you, gastronomy lover and successful restaurateur! LAPA - Finest Italian Food has something so good, so sinful, that it will drive your customers crazy: the Rum Baba!'
      };
    }
    else if (src.includes('Immagina una soffice e deliziosa brioche')) {
      t[src] = {
        de_CH: 'Stell dir eine weiche und köstliche Brioche vor, getränkt in der Flüssigkeit der Götter: Rum! Ein Dessert, das dich von der Karibik träumen lässt, während du die Schweizer Gastfreundschaft von LAPA genießt. Das ist eine Gewinnerkombination, mein Freund!',
        fr_CH: 'Imagine une brioche moelleuse et délicieuse baignée dans le liquide des dieux : le rhum ! Un dessert qui te fera rêver des Caraïbes, tout en profitant de l\'hospitalité suisse de LAPA. C\'est une combo gagnante, mon ami !',
        en_US: 'Imagine a soft and delicious brioche soaked in the liquid of the gods: rum! A dessert that will make you dream of the Caribbean, while enjoying LAPA\'s Swiss hospitality. It\'s a winning combo, my friend!'
      };
    }
    else if (src.includes('E ora, preparati a stupirti')) {
      t[src] = {
        de_CH: 'Und jetzt, mach dich bereit zu staunen, denn LAPA ist nicht nur ein Paradies für Köstlichkeiten. Wir bieten auch einen Lieferservice 6 von 7 Tagen 🚚💨, also mach dir keine Sorgen, wenn du vergisst, die Rum-Babas zu bestellen!',
        fr_CH: 'Et maintenant, prépare-toi à être étonné, car LAPA n\'est pas seulement un paradis de délices. Nous offrons aussi un service de livraisons 6 jours sur 7 🚚💨, donc ne t\'inquiète pas si tu oublies de commander les Baba au Rhum !',
        en_US: 'And now, get ready to be amazed, because LAPA is not just a paradise of delicacies. We also offer delivery service 6 out of 7 days 🚚💨, so don\'t worry if you forget to order the Rum Babas!'
      };
    }
    else if (src.includes('Non solo, con LAPA hai l\'opportunità')) {
      t[src] = {
        de_CH: 'Nicht nur das, mit LAPA hast du die Möglichkeit, ein V.I.P. zu werden 🌟 und Vorteile wie personalisierte Preislisten 💰, dedizierte Unterstützung 👩‍💼 und keinen Mindestbestellwert zu genießen! Ja, du hast richtig gehört: bestelle das, was du brauchst!',
        fr_CH: 'Pas seulement, avec LAPA tu as l\'opportunité de devenir V.I.P. 🌟 et de profiter d\'avantages comme des tarifs personnalisés 💰, une assistance dédiée 👩‍💼 et pas de minimum de commande ! Oui, tu as bien compris : commande ce dont tu as besoin !',
        en_US: 'Not only that, with LAPA you have the opportunity to become a V.I.P. 🌟 and enjoy benefits like personalized price lists 💰, dedicated assistance 👩‍💼 and no minimum order! Yes, you heard right: order what you need!'
      };
    }
    else if (src.includes('Il Baba al Rhum è il dolce perfetto')) {
      t[src] = {
        de_CH: 'Der Rum-Baba ist das perfekte Dessert für Restaurants, Pizzerien, Pubs und alle Lokale, die ihre Kunden mit etwas wirklich Besonderem überraschen wollen! 🍕🍻🍝',
        fr_CH: 'Le Baba au Rhum est le dessert parfait pour restaurants, pizzerias, pubs et tous les établissements qui veulent surprendre leurs clients avec quelque chose de vraiment spécial ! 🍕🍻🍝',
        en_US: 'The Rum Baba is the perfect dessert for restaurants, pizzerias, pubs and all venues that want to amaze their customers with something truly special! 🍕🍻🍝'
      };
    }
    else if (src.includes('Allora, cosa aspetti?')) {
      t[src] = {
        de_CH: 'Also, worauf wartest du? Bestelle noch heute die Rum-Babas von LAPA - Finest Italian Food und schenke deinen Kunden ein unvergessliches Erlebnis! 🥇🔥😍',
        fr_CH: 'Alors, qu\'attends-tu ? Commande aujourd\'hui même les Baba au Rhum signés LAPA - Finest Italian Food et offre à tes clients une expérience inoubliable ! 🥇🔥😍',
        en_US: 'So, what are you waiting for? Order today the Rum Babas from LAPA - Finest Italian Food and give your customers an unforgettable experience! 🥇🔥😍'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 18: BABA AL RHUM ===\n');

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

  console.log('\n✅ ARTICOLO 18 COMPLETATO!');
}

main();
