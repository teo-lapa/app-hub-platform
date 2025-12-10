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

const POST_ID = 21;

const TITLE_TRANSLATIONS = {
  it_IT: "🚀 Scopri il lusso nel tuo piatto con il nostro Carpaccio di Tartufo a Fette! 🤩",
  de_CH: "🚀 Entdecken Sie den Luxus auf Ihrem Teller mit unserem Trüffel-Carpaccio in Scheiben! 🤩",
  fr_CH: "🚀 Découvrez le luxe dans votre assiette avec notre Carpaccio de Truffe en Tranches ! 🤩",
  en_US: "🚀 Discover luxury on your plate with our Sliced Truffle Carpaccio! 🤩"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Ciao, amici del sapore')) {
      t[src] = {
        de_CH: '🎉🎉🎉 Hallo, Freunde des Geschmacks! Es ist Zeit, euch ein Produkt vorzustellen, das euch vor Freude schreien lässt: das Trüffel-Carpaccio in Scheiben in nativem Olivenöl Extra! 😍🤯',
        fr_CH: '🎉🎉🎉 Salut, amis de la saveur ! Le moment est venu de vous présenter un produit qui vous fera crier de joie : le Carpaccio de Truffe en Tranches à l\'Huile d\'Olive Extra Vierge ! 😍🤯',
        en_US: '🎉🎉🎉 Hello, friends of flavor! It\'s time to introduce you to a product that will make you scream with joy: the Sliced Truffle Carpaccio in Extra Virgin Olive Oil! 😍🤯'
      };
    }
    else if (src.includes("Ma andiamo con ordine: cos'è il tartufo")) {
      t[src] = {
        de_CH: '🍽️ Aber gehen wir der Reihe nach vor: Was ist ein Trüffel? Und warum ist er so besonders? Nun, der Trüffel ist ein sehr wertvoller Pilz, der im Boden wächst, in der Nähe der Baumwurzeln. Trüffel auf einem Gericht zu haben, ist ein echtes Luxuserlebnis!',
        fr_CH: '🍽️ Mais allons dans l\'ordre : qu\'est-ce que la truffe ? Et pourquoi est-elle si spéciale ? Eh bien, la truffe est un champignon très précieux qui pousse dans le sol, près des racines des arbres. Avoir de la truffe dans un plat est une vraie expérience de luxe !',
        en_US: '🍽️ But let\'s go in order: what is truffle? And why is it so special? Well, truffle is a very precious fungus that grows in the ground, near tree roots. Having truffle on a dish is a real luxury experience!'
      };
    }
    else if (src.includes('E ora, preparatevi a decollare nel mondo del gusto')) {
      t[src] = {
        de_CH: '🚀 Und jetzt, macht euch bereit, in die Welt des Geschmacks abzuheben, denn unser Trüffel-Carpaccio in Scheiben in nativem Olivenöl Extra ist eine echte Geschmacksbombe! Stell dir vor, du kannst deinen Gerichten einen Hauch von Luxus hinzufügen!',
        fr_CH: '🚀 Et maintenant, préparez-vous à décoller dans le monde du goût, car notre Carpaccio de Truffe en Tranches à l\'Huile d\'Olive Extra Vierge est une véritable bombe de saveur ! Imagine pouvoir ajouter une touche de luxe à tes plats !',
        en_US: '🚀 And now, get ready to take off into the world of taste, because our Sliced Truffle Carpaccio in Extra Virgin Olive Oil is a true flavor bomb! Imagine being able to add a touch of luxury to your dishes!'
      };
    }
    else if (src.includes('Con LAPA - Finest Italian Food, potrai avere questo tesoro')) {
      t[src] = {
        de_CH: '📦 Mit LAPA - Finest Italian Food kannst du diesen Schatz direkt in deiner Küche haben, ohne einen Finger zu rühren. Wir liefern dir alles, was du brauchst, von Montag bis Samstag, praktisch jeden Tag!',
        fr_CH: '📦 Avec LAPA - Finest Italian Food, tu pourras avoir ce trésor directement dans ta cuisine, sans même bouger un doigt. Nous te livrons tout ce dont tu as besoin, du lundi au samedi, pratiquement tous les jours !',
        en_US: '📦 With LAPA - Finest Italian Food, you can have this treasure directly in your kitchen, without lifting a finger. We deliver everything you need, from Monday to Saturday, practically every day!'
      };
    }
    else if (src.includes('E se vuoi essere ancora più figo, usa la nostra comodissima WEB APP')) {
      t[src] = {
        de_CH: '📱 Und wenn du noch cooler sein willst, nutze unsere super praktische WEB APP, um in einem Moment zu bestellen! Ohne wertvolle Zeit zu verlieren, kannst du Bestellungen und Waren verfolgen, Dokumente einsehen und vieles mehr!',
        fr_CH: '📱 Et si tu veux être encore plus cool, utilise notre très pratique WEB APP pour commander en un instant ! Sans perdre de temps précieux, tu pourras suivre les commandes et la marchandise, consulter des documents et bien plus !',
        en_US: '📱 And if you want to be even cooler, use our super convenient WEB APP to order in an instant! Without wasting precious time, you can track orders and goods, view documents and much more!'
      };
    }
    else if (src.includes('Il nostro Carpaccio di Tartufo a Fette')) {
      t[src] = {
        de_CH: '💎 Unser Trüffel-Carpaccio in Scheiben in nativem Olivenöl Extra wird sorgfältig ausgewählt und zubereitet, um dir die Qualität und den Geschmack zu garantieren, die du verdienst. Und weißt du, was das Sahnehäubchen ist? Kein Mindestbestellwert!',
        fr_CH: '💎 Notre Carpaccio de Truffe en Tranches à l\'Huile d\'Olive Extra Vierge est sélectionné et préparé avec soin, pour te garantir la qualité et la saveur que tu mérites. Et tu sais quelle est la cerise sur le gâteau ? Pas de minimum de commande !',
        en_US: '💎 Our Sliced Truffle Carpaccio in Extra Virgin Olive Oil is carefully selected and prepared to guarantee you the quality and flavor you deserve. And you know what\'s the cherry on top? No minimum order!'
      };
    }
    else if (src.includes('Non dimenticare che con LAPA - Finest Italian Food, sei un cliente speciale')) {
      t[src] = {
        de_CH: '🌟 Vergiss nicht, dass du mit LAPA - Finest Italian Food ein besonderer Kunde bist! Greife auf unsere V.I.P.-Services zu und genieße eine königliche Behandlung! 👑',
        fr_CH: '🌟 N\'oublie pas qu\'avec LAPA - Finest Italian Food, tu es un client spécial ! Accède à nos Services V.I.P. et profite d\'un traitement de vrai roi ! 👑',
        en_US: '🌟 Don\'t forget that with LAPA - Finest Italian Food, you\'re a special customer! Access our V.I.P. Services and enjoy a royal treatment! 👑'
      };
    }
    else if (src.includes('Allora, sei pronto a dare una svolta ai tuoi piatti')) {
      t[src] = {
        de_CH: 'Also, bist du bereit, deinen Gerichten eine Wendung zu geben und deine Kunden mit unserem Trüffel-Carpaccio in Scheiben in nativem Olivenöl Extra zu überraschen? 🎉🎉🎉',
        fr_CH: 'Alors, es-tu prêt à donner un tournant à tes plats et à surprendre tes clients avec notre Carpaccio de Truffe en Tranches à l\'Huile d\'Olive Extra Vierge ? 🎉🎉🎉',
        en_US: 'So, are you ready to give your dishes a twist and amaze your customers with our Sliced Truffle Carpaccio in Extra Virgin Olive Oil? 🎉🎉🎉'
      };
    }
    else if (src.includes('Contattaci subito e unisciti alla famiglia LAPA')) {
      t[src] = {
        de_CH: '📞💌 Kontaktiere uns sofort und werde Teil der LAPA-Familie! Denk daran, wir haben dedizierte Unterstützung bereit, dir zu helfen, wenn du uns brauchst. Egal welches Problem du hast, wir sind hier, um es zu lösen! 💪',
        fr_CH: '📞💌 Contacte-nous tout de suite et rejoins la famille LAPA ! Rappelle-toi, nous avons une assistance dédiée prête à t\'aider si tu as besoin de nous. Peu importe le problème, nous sommes là pour le résoudre ! 💪',
        en_US: '📞💌 Contact us right away and join the LAPA family! Remember, we have dedicated assistance ready to help you if you need us. No matter what problem you have, we\'re here to solve it! 💪'
      };
    }
    else if (src.includes('P.S. Non aspettare troppo')) {
      t[src] = {
        de_CH: 'P.S. Warte nicht zu lange, Trüffel ist eine begehrte Zutat und deine Kunden können es kaum erwarten, sie zu probieren! 🤩🚀',
        fr_CH: 'P.S. N\'attends pas trop longtemps, la truffe est un ingrédient prisé et tes clients ont hâte de la goûter ! 🤩🚀',
        en_US: 'P.S. Don\'t wait too long, truffle is a sought-after ingredient and your customers can\'t wait to try it! 🤩🚀'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 21: CARPACCIO DI TARTUFO ===\n');

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

  console.log('\n✅ ARTICOLO 21 COMPLETATO!');
}

main();
