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

const POST_ID = 44;

const TITLE_TRANSLATIONS = {
  it_IT: "🚀 Scopri i Frutti del Cappero e Rivoluziona la tua Cucina! 🌶️",
  de_CH: "🚀 Entdecke die Kapernfrüchte und revolutioniere deine Küche! 🌶️",
  fr_CH: "🚀 Découvre les Fruits du Câprier et Révolutionne ta Cuisine ! 🌶️",
  en_US: "🚀 Discover Caper Berries and Revolutionize Your Kitchen! 🌶️"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Ehi, amico della cucina! 👋 Ti sei mai chiesto come dare quel tocco in più')) {
      t[src] = {
        de_CH: 'Hey, Küchenfreund! 👋 Hast du dich jemals gefragt, wie du deinen Gerichten das gewisse Extra geben kannst? Die Antwort könnte kleiner und überraschender sein, als du denkst: die Kapernfrüchte in Essig! 🌿 Nein, wir sprechen nicht von gewöhnlichen Kapern, sondern von ihren fantastischen Früchten. Eine Geschmacksbombe, bereit, in deinen kulinarischen Kreationen zu explodieren!',
        fr_CH: 'Hé, ami de la cuisine ! 👋 Tu t\'es déjà demandé comment donner ce petit plus à tes plats ? La réponse pourrait être plus petite et surprenante que tu ne le penses : les Fruits du Câprier au Vinaigre ! 🌿 Non, on ne parle pas des câpres habituelles, mais de leurs fantastiques fruits. Une bombe de saveur prête à exploser dans tes créations culinaires !',
        en_US: 'Hey, kitchen friend! 👋 Have you ever wondered how to give that extra touch to your dishes? The answer might be smaller and more surprising than you think: Caper Berries in Vinegar! 🌿 No, we\'re not talking about regular capers, but their fantastic berries. A flavor bomb ready to explode in your culinary creations!'
      };
    }
    else if (src.includes('Immagina di aggiungere questa magia nei tuoi piatti e BOOM!')) {
      t[src] = {
        de_CH: 'Stell dir vor, du fügst diese Magie zu deinen Gerichten hinzu und BOOM! 💥 Eine Lawine mediterraner Aromen wird deine Kunden überrollen und sie sprachlos und hungrig nach mehr zurücklassen.',
        fr_CH: 'Imagine ajouter cette magie dans tes plats et BOOM ! 💥 Une avalanche de saveurs méditerranéennes va submerger tes clients, les laissant bouche bée et désireux d\'en avoir plus.',
        en_US: 'Imagine adding this magic to your dishes and BOOM! 💥 An avalanche of Mediterranean flavors will overwhelm your customers, leaving them speechless and craving for more.'
      };
    }
    else if (src.includes('Ma aspetta, la magia di LAPA non finisce qui!')) {
      t[src] = {
        de_CH: 'Aber warte, die Magie von LAPA endet hier nicht! Weißt du, dass du heute bestellen und morgen erhalten kannst? 🚚 Ja, genau so, keine endlosen Wartezeiten. Und wenn du denkst, es gibt einen Mindestbestellwert, liegst du total falsch! Bestelle so viel du willst, wann du willst, und wir sind hier, um dir mit einem Lächeln zu dienen. 😃',
        fr_CH: 'Mais attends, la magie de LAPA ne s\'arrête pas là ! Tu sais que tu peux commander aujourd\'hui et recevoir demain ? 🚚 Oui, exactement, pas d\'attentes interminables. Et si tu penses qu\'il y a un minimum pour commander, tu te trompes lourdement ! Commande ce que tu veux, quand tu veux, et nous sommes là pour te servir avec le sourire. 😃',
        en_US: 'But wait, LAPA\'s magic doesn\'t end here! You know you can order today and receive tomorrow? 🚚 Yes, that\'s right, no endless waiting. And if you think there\'s a minimum order, you\'re dead wrong! Order as much as you want, whenever you want, and we\'re here to serve you with a smile. 😃'
      };
    }
    else if (src.includes('Ah, e a proposito di servizio, preparati a essere trattato come un vero VIP')) {
      t[src] = {
        de_CH: 'Ah, und apropos Service, mach dich bereit, wie ein echter VIP behandelt zu werden. 🌟 Mit unserer super APP ist das Bestellen ein Kinderspiel. Und wenn du auf ein Problem stößt, keine Panik! Wir haben ein Superhelden-Team, das bereit ist, dir zu Hilfe zu eilen. 🦸',
        fr_CH: 'Ah, et à propos du service, prépare-toi à être traité comme un vrai VIP. 🌟 Avec notre super APP, passer ta commande est un jeu d\'enfant. Et si tu rencontres un problème, pas de panique ! On a une équipe de super-héros prêts à voler à ton secours. 🦸',
        en_US: 'Ah, and speaking of service, get ready to be treated like a real VIP. 🌟 With our super APP, placing your order is child\'s play. And if you run into a problem, no panic! We have a superhero team ready to fly to your rescue. 🦸'
      };
    }
    else if (src.includes('Allora, sei pronto a dare una scossa elettrizzante alla tua cucina')) {
      t[src] = {
        de_CH: 'Also, bist du bereit, deiner Küche mit den Kapernfrüchten einen elektrischen Schock zu geben? Teile deine Ideen und deine verrücktesten Rezepte, und lass uns zusammen die italienische Küche zum Strahlen bringen! 🚀🍽️🔥',
        fr_CH: 'Alors, tu es prêt à donner une secousse électrisante à ta cuisine avec les Fruits du Câprier ? Partage tes idées et tes recettes les plus folles, et faisons briller ensemble la cuisine italienne ! 🚀🍽️🔥',
        en_US: 'So, are you ready to give an electrifying shock to your kitchen with Caper Berries? Share your ideas and your craziest recipes, and let\'s make Italian cuisine shine together! 🚀🍽️🔥'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 44: FRUTTI DEL CAPPERO ===\n');

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

  console.log('\n✅ ARTICOLO 44 COMPLETATO!');
}

main();
