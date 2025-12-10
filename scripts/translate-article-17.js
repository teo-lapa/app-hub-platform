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

const POST_ID = 17;

const TITLE_TRANSLATIONS = {
  it_IT: "🔥 \"Arancini Esplosivi: Scopri gli Irresistibili Arancini di Riso al Sugo di LAPA e Conquista i Tuoi Clienti!\" 🍊🍚💣",
  de_CH: "🔥 \"Explosive Arancini: Entdecken Sie die unwiderstehlichen Reis-Arancini mit Soße von LAPA und begeistern Sie Ihre Kunden!\" 🍊🍚💣",
  fr_CH: "🔥 \"Arancini Explosifs : Découvrez les Irrésistibles Arancini de Riz à la Sauce de LAPA et Conquérez vos Clients !\" 🍊🍚💣",
  en_US: "🔥 \"Explosive Arancini: Discover the Irresistible Rice Arancini with Sauce from LAPA and Win Over Your Customers!\" 🍊🍚💣"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Ecco l\'Arancino di Riso al Sugo')) {
      t[src] = {
        de_CH: '🍊🍚🎉 Hier ist das Reis-Arancino mit Soße, das Ihre Geschmacksknospen verzaubern wird!',
        fr_CH: '🍊🍚🎉 Voici l\'Arancino de Riz à la Sauce qui va bouleverser vos papilles gustatives !',
        en_US: '🍊🍚🎉 Here\'s the Rice Arancino with Sauce that will amaze your taste buds!'
      };
    }
    else if (src.includes('Ehi, amico! Smetti un attimo')) {
      t[src] = {
        de_CH: 'Hey, Freund! Hör mal auf, dir die Finger zu lecken und hör zu! LAPA - Finest Italian Food bringt direkt auf die Tische deiner Kunden ein kulinarisches Meisterwerk: das Reis-Arancino mit Soße! 😋',
        fr_CH: 'Hey, ami ! Arrête un instant de te lécher les doigts et écoute ici ! LAPA - Finest Italian Food t\'apporte directement sur les tables de tes clients un chef-d\'œuvre culinaire : l\'Arancino de Riz à la Sauce ! 😋',
        en_US: 'Hey, friend! Stop licking your fingers for a moment and listen up! LAPA - Finest Italian Food brings directly to your customers\' tables a culinary masterpiece: the Rice Arancino with Sauce! 😋'
      };
    }
    else if (src.includes('Sai cosa rende speciale questo arancino')) {
      t[src] = {
        de_CH: 'Weißt du, was dieses Arancino so besonders macht? Na, ich sag\'s dir! Es ist die perfekte Kombination aus cremigem Reis, köstlicher Soße und herzhaftem Fleisch, eingehüllt in eine knusprige frittierte Kruste. Kurz gesagt, eine Geschmacksexplosion!',
        fr_CH: 'Tu sais ce qui rend cet arancino spécial ? Eh bien, je vais te le dire ! C\'est le mariage parfait entre riz crémeux, sauce délicieuse et viande savoureuse, le tout enveloppé dans une croûte croustillante frite. Bref, une explosion de saveurs !',
        en_US: 'You know what makes this arancino special? Well, I\'ll tell you! It\'s the perfect combination of creamy rice, delicious sauce and flavorful meat, wrapped in a crispy fried crust. In short, a flavor explosion!'
      };
    }
    else if (src.includes('E per te, caro ristoratore')) {
      t[src] = {
        de_CH: 'Und für dich, lieber Gastronom, was haben wir auf Lager? Nun, wir bieten dir Lieferservices 6 von 7 Tagen 🚚💨, also mach dir keine Sorgen, wenn du heute vergisst, die Arancini zu bestellen, denn morgen kommen sie an!',
        fr_CH: 'Et pour toi, cher restaurateur, qu\'avons-nous en réserve ? Eh bien, nous t\'offrons des services de livraison 6 jours sur 7 🚚💨, donc ne t\'inquiète pas si tu oublies de commander les arancini aujourd\'hui, car demain ils arriveront !',
        en_US: 'And for you, dear restaurateur, what do we have in store? Well, we offer you delivery services 6 out of 7 days 🚚💨, so don\'t worry if you forget to order the arancini today, because tomorrow they\'ll arrive!'
      };
    }
    else if (src.includes('E non finisce qui! Ti trattiamo come un V.I.P.')) {
      t[src] = {
        de_CH: 'Und das ist noch nicht alles! Wir behandeln dich wie einen V.I.P. 🌟, denn dein Erfolg ist unser Erfolg. Und weißt du, was es bedeutet, ein besonderer LAPA-Kunde zu sein? Es bedeutet personalisierte Preise 💰, dedizierte Unterstützung und vieles mehr!',
        fr_CH: 'Et ce n\'est pas fini ! Nous te traitons comme un V.I.P. 🌟, parce que ton succès est notre succès. Et tu sais ce que signifie être un client spécial LAPA ? Cela signifie prix personnalisés 💰, assistance dédiée et bien plus encore !',
        en_US: 'And it doesn\'t end there! We treat you like a V.I.P. 🌟, because your success is our success. And you know what it means to be a special LAPA customer? It means personalized prices 💰, dedicated assistance and much more!'
      };
    }
    else if (src.includes('Ti stai ancora chiedendo se l\'Arancino')) {
      t[src] = {
        de_CH: 'Fragst du dich immer noch, ob das Reis-Arancino mit Soße das ist, was du brauchst? Komm schon, mach keine Witze! Es ist das perfekte Produkt für Restaurants, Pizzerien, Pubs und was du dir noch vorstellen kannst! 🍕🍻🍝',
        fr_CH: 'Tu te demandes encore si l\'Arancino de Riz à la Sauce est ce qu\'il te faut ? Allez, on ne plaisante pas ! C\'est le produit parfait pour restaurants, pizzerias, pubs et qui plus est ! 🍕🍻🍝',
        en_US: 'Are you still wondering if the Rice Arancino with Sauce is what you need? Come on, don\'t joke! It\'s the perfect product for restaurants, pizzerias, pubs and whatever else you can think of! 🍕🍻🍝'
      };
    }
    else if (src.includes('Ordina oggi stesso')) {
      t[src] = {
        de_CH: 'Bestelle noch heute und mach deine Kunden glücklich mit dem Reis-Arancino mit Soße von LAPA - Finest Italian Food! 🎯🔥😎',
        fr_CH: 'Commande aujourd\'hui même et fais plaisir à tes clients avec l\'Arancino de Riz à la Sauce signé LAPA - Finest Italian Food ! 🎯🔥😎',
        en_US: 'Order today and make your customers happy with the Rice Arancino with Sauce from LAPA - Finest Italian Food! 🎯🔥😎'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 17: ARANCINI ESPLOSIVI ===\n');

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

  console.log('\n✅ ARTICOLO 17 COMPLETATO!');
}

main();
