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

const POST_ID = 19;

const TITLE_TRANSLATIONS = {
  it_IT: "🧀🔥 La Burrata di LAPA: Quando il Gusto Diventa Pura Magia nel tuo Locale! 🌟💫",
  de_CH: "🧀🔥 Die Burrata von LAPA: Wenn der Geschmack zur puren Magie in Ihrem Lokal wird! 🌟💫",
  fr_CH: "🧀🔥 La Burrata de LAPA : Quand le Goût Devient Pure Magie dans votre Établissement ! 🌟💫",
  en_US: "🧀🔥 LAPA's Burrata: When Taste Becomes Pure Magic in Your Venue! 🌟💫"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Ciao amico ristoratore! Oggi vogliamo raccontarti')) {
      t[src] = {
        de_CH: 'Hallo Gastronom-Freund! Heute möchten wir dir von einem Produkt erzählen, das die Macht hat, deine Kunden verrückt zu machen und sie immer hungriger zurückkommen zu lassen: unsere köstliche Burrata! 🤤😍',
        fr_CH: 'Salut ami restaurateur ! Aujourd\'hui nous voulons te parler d\'un produit qui a le pouvoir de rendre tes clients fous et de les faire revenir toujours plus affamés : notre délicieuse Burrata ! 🤤😍',
        en_US: 'Hello restaurateur friend! Today we want to tell you about a product that has the power to drive your customers crazy and keep them coming back hungrier: our delicious Burrata! 🤤😍'
      };
    }
    else if (src.includes('Se pensi che mozzarella e burrata')) {
      t[src] = {
        de_CH: 'Wenn du denkst, dass Mozzarella und Burrata praktisch das Gleiche sind, liegst du völlig falsch! Die Burrata von LAPA ist ein einzigartiges kulinarisches Erlebnis aus Cremigkeit und explosivem Geschmack. Und weißt du, was das Beste daran ist?',
        fr_CH: 'Si tu penses que mozzarella et burrata sont pratiquement la même chose, tu te trompes lourdement ! La burrata de LAPA est une expérience culinaire unique, faite de crémosité et de saveur explosive. Et tu sais quel est le meilleur ?',
        en_US: 'If you think mozzarella and burrata are practically the same thing, you\'re dead wrong! LAPA\'s burrata is a unique culinary experience, made of creaminess and explosive flavor. And you know what\'s the best part?'
      };
    }
    else if (src.includes('Con la nostra app per ordini')) {
      t[src] = {
        de_CH: 'Mit unserer Bestell-App musst du dir nicht einmal Sorgen machen, etwas zu vergessen: du bestellst heute und morgen kommt unsere exquisite Burrata direkt zu dir nach Hause! 📲😎 Es gibt keine Ausreden, nicht zu probieren!',
        fr_CH: 'Avec notre app pour commandes, tu n\'as même pas à te soucier d\'oublier quelque chose : tu commandes aujourd\'hui et demain notre exquise burrata arrive directement chez toi ! 📲😎 Il n\'y a pas d\'excuses pour ne pas essayer !',
        en_US: 'With our ordering app, you don\'t even have to worry about forgetting something: order today and tomorrow our exquisite burrata arrives directly at your place! 📲😎 There are no excuses not to try it!'
      };
    }
    else if (src.includes('Ma non è tutto! Con LAPA, non hai un minimo')) {
      t[src] = {
        de_CH: 'Aber das ist nicht alles! Mit LAPA hast du keinen Mindestbestellwert zu beachten. Möchtest du nur ein Stückchen Burrata? Das haben wir! 🎯 Bestelle, was du willst, wie viel du willst, und wir bringen es dir mit einem Lächeln im Gesicht!',
        fr_CH: 'Mais ce n\'est pas tout ! Avec LAPA, tu n\'as pas de minimum de commande à respecter. Tu veux juste un petit morceau de burrata ? Nous l\'avons ! 🎯 Commande ce que tu veux, autant que tu veux, et nous te l\'apportons avec le sourire !',
        en_US: 'But that\'s not all! With LAPA, you don\'t have a minimum order to meet. Want just a little piece of burrata? We have it! 🎯 Order what you want, how much you want, and we\'ll bring it to you with a smile!'
      };
    }
    else if (src.includes('E per i clienti speciali come te')) {
      t[src] = {
        de_CH: 'Und für besondere Kunden wie dich haben wir auch unsere V.I.P.-Services, die darauf ausgelegt sind, dich so zu behandeln, wie du es verdienst. 🌟💼 Warum sich damit zufrieden geben, ein gewöhnlicher Kunde zu sein, wenn du ein echter VIP sein kannst?',
        fr_CH: 'Et pour les clients spéciaux comme toi, nous avons aussi nos services V.I.P., pensés pour te traiter comme tu le mérites. 🌟💼 Pourquoi se contenter d\'être un client ordinaire quand tu peux être un vrai VIP ?',
        en_US: 'And for special customers like you, we also have our V.I.P. services, designed to treat you as you deserve. 🌟💼 Why settle for being an ordinary customer when you can be a real VIP?'
      };
    }
    else if (src.includes('Insomma, se vuoi offrire ai tuoi clienti')) {
      t[src] = {
        de_CH: 'Kurz gesagt, wenn du deinen Kunden ein kulinarisches Erlebnis bieten möchtest, das sie träumen lässt und die Reservierungen in deinem Lokal in die Höhe schnellen lässt, ist die Burrata von LAPA die Antwort, die du gesucht hast. 🚀🍽️',
        fr_CH: 'Bref, si tu veux offrir à tes clients une expérience culinaire qui les fasse rêver et faire monter en flèche les réservations dans ton établissement, la Burrata de LAPA est la réponse que tu cherchais. 🚀🍽️',
        en_US: 'In short, if you want to offer your customers a culinary experience that makes them dream and skyrocket reservations at your venue, LAPA\'s Burrata is the answer you were looking for. 🚀🍽️'
      };
    }
    else if (src.includes('Quindi, che aspetti?')) {
      t[src] = {
        de_CH: 'Also, worauf wartest du? Nimm unsere Burrata in dein Menü auf und mach dich bereit, deine Kunden mit einem Geschmack zu überraschen, der sie beim ersten Bissen erobern wird! 🧀💥',
        fr_CH: 'Alors, qu\'attends-tu ? Mets notre burrata dans ton menu et prépare-toi à surprendre tes clients avec une saveur qui les conquerra dès la première bouchée ! 🧀💥',
        en_US: 'So, what are you waiting for? Put our burrata on your menu and get ready to amaze your customers with a flavor that will win them over at first bite! 🧀💥'
      };
    }
    else if (src.includes('Non dimenticare: se hai bisogno di assistenza')) {
      t[src] = {
        de_CH: 'Vergiss nicht: Wenn du Unterstützung oder Beratung brauchst, sind wir immer bereit zu helfen. Kontaktiere unser Team von engagierten Beratern und entdecke, wie du dein Lokal mit LAPA zum Erfolg führst! 📞🔝',
        fr_CH: 'N\'oublie pas : si tu as besoin d\'assistance ou de conseils, nous sommes toujours prêts à t\'aider. Contacte notre équipe de conseillers dédiés et découvre comment mener ton établissement au succès avec LAPA ! 📞🔝',
        en_US: 'Don\'t forget: if you need assistance or advice, we\'re always ready to help. Contact our team of dedicated consultants and discover how to lead your venue to success with LAPA! 📞🔝'
      };
    }
    else if (src.includes('#BurrataDiLAPA')) {
      t[src] = {
        de_CH: '#BurrataVonLAPA #PureMagie #ExplosierenderGeschmack #ErfolgreicheGastronomie #LAPAfood',
        fr_CH: '#BurrataDeLAPA #PureMagie #GoûtExplosif #RestaurationÀSuccès #LAPAfood',
        en_US: '#LAPABurrata #PureMagic #ExplosiveFlavor #SuccessfulDining #LAPAfood'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 19: BURRATA DI LAPA ===\n');

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

  console.log('\n✅ ARTICOLO 19 COMPLETATO!');
}

main();
