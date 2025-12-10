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

const POST_ID = 27;

const TITLE_TRANSLATIONS = {
  it_IT: "💥 Boom! Il Cornetto Stile 1980 da LAPA - Fottiti, Anni '90! 👊",
  de_CH: "💥 Boom! Das Croissant im Stil von 1980 von LAPA - Vergiss die 90er! 👊",
  fr_CH: "💥 Boom ! Le Croissant Style 1980 de LAPA - Au diable les Années 90 ! 👊",
  en_US: "💥 Boom! The 1980 Style Croissant from LAPA - Take That, '90s! 👊"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Ciao, amico! Senti un po\', abbiamo un annuncio')) {
      t[src] = {
        de_CH: 'Hallo, Freund! Hör mal, wir haben eine Ankündigung, die deine Kunden vom Stuhl springen lässt! 😲 Hier ist unser Croissant im Stil von 1980 - eine geschwungene Köstlichkeit, genau wie in den 80ern. 🥐',
        fr_CH: 'Salut, ami ! Écoute un peu, nous avons une annonce qui fera sauter de leur chaise tes clients ! 😲 Voici notre Croissant Style 1980 - un délice courbé, exactement comme dans les années 80. 🥐',
        en_US: 'Hello, friend! Listen up, we have an announcement that will make your customers jump off their chairs! 😲 Here\'s our 1980 Style Croissant - a curved delight, just like in the \'80s. 🥐'
      };
    }
    else if (src.includes('Ti ricordi quei cornetti scialbi e insipidi')) {
      t[src] = {
        de_CH: 'Erinnerst du dich an diese faden und geschmacklosen Croissants, die deine Kunden in den letzten Jahren runterwürgen mussten? Ja, genau die meine ich. Ich will nicht gemein sein, aber es ist Zeit, Klarheit zu schaffen: nicht alle Croissants sind gleich.',
        fr_CH: 'Tu te souviens de ces croissants fades et insipides que tes clients ont dû avaler ces dernières années ? Oui, je parle exactement de ceux-là. Je ne veux pas être méchant, mais il est temps de mettre les choses au clair : tous les croissants ne sont pas égaux.',
        en_US: 'Remember those bland and tasteless croissants your customers had to swallow in recent years? Yes, I\'m talking about those. I don\'t want to be mean, but it\'s time to set things straight: not all croissants are created equal.'
      };
    }
    else if (src.includes('Il Cornetto Stile 1980 non è uno di quei cornetti da quattro soldi')) {
      t[src] = {
        de_CH: 'Das Croissant im Stil von 1980 ist nicht eines dieser billigen Croissants. Jeder Biss ist ein Schuss purer Nostalgie, eine Rückkehr zu jener Einfachheit und jenem Geschmack, die für immer verloren schienen. Das ist nicht nur ein Croissant, das ist ein One-Way-Ticket für eine Zeitreise! 🚀',
        fr_CH: 'Le Croissant Style 1980 n\'est pas un de ces croissants de pacotille. Chaque bouchée est une décharge de pure nostalgie, un retour à cette simplicité et à ce goût qui semblaient perdus à jamais. Ce n\'est pas seulement un croissant, c\'est un billet aller simple pour un voyage dans le temps ! 🚀',
        en_US: 'The 1980 Style Croissant is not one of those cheap croissants. Every bite is a shot of pure nostalgia, a return to that simplicity and taste that seemed lost forever. This is not just a croissant, it\'s a one-way ticket for a trip through time! 🚀'
      };
    }
    else if (src.includes('E il bello? Non devi aspettare il weekend')) {
      t[src] = {
        de_CH: 'Und das Beste? Du musst nicht auf das Wochenende warten, um deine Kunden dieses Meisterwerk genießen zu lassen. Dank uns bei LAPA liefern wir sechs Tage von sieben! Klingt unglaublich? Aber es ist die reine Wahrheit, mein Freund! Du musst nicht mehr planen, wann du bestellst, denn bei uns kannst du das jederzeit tun! 🚚💨',
        fr_CH: 'Et le plus beau ? Tu n\'as pas besoin d\'attendre le week-end pour faire profiter tes clients de ce chef-d\'œuvre. Grâce à nous chez LAPA, nous livrons six jours sur sept ! Ça te semble incroyable ? Et pourtant c\'est la pure vérité, mon ami ! Tu n\'as plus besoin de programmer quand commander, car avec nous tu peux le faire tout le temps ! 🚚💨',
        en_US: 'And the best part? You don\'t have to wait for the weekend to let your customers enjoy this masterpiece. Thanks to us at LAPA, we deliver six days out of seven! Does it seem incredible? Well, it\'s the pure truth, my friend! You no longer need to schedule when to order, because with us you can do it anytime! 🚚💨'
      };
    }
    else if (src.includes('Ma non è finita qui! Puoi fare il tuo ordine comodamente')) {
      t[src] = {
        de_CH: 'Aber das ist noch nicht alles! Du kannst deine Bestellung bequem und schnell mit unserer praktischen WEB APP aufgeben. Und wenn du etwas vergisst? Kein Problem, bestelle heute und morgen bringen wir es dir! Und keine Sorge, es gibt keinen Mindestbestellwert. Bestelle was du willst, so viel du willst. Auch nur ein Croissant, wenn du magst! 📱💻',
        fr_CH: 'Mais ce n\'est pas fini ! Tu peux passer ta commande confortablement et rapidement avec notre pratique WEB APP. Et si tu oublies quelque chose ? Pas de problème, commande aujourd\'hui et demain on te l\'apporte ! Et ne t\'inquiète pas, il n\'y a pas de minimum de commande. Commande ce que tu veux, autant que tu veux. Même juste un croissant, si tu veux ! 📱💻',
        en_US: 'But it doesn\'t end there! You can place your order comfortably and quickly with our convenient WEB APP. And if you forget something? No problem, order today and tomorrow we\'ll bring it to you! And don\'t worry, there\'s no minimum order. Order what you want, as much as you want. Even just one croissant, if you like! 📱💻'
      };
    }
    else if (src.includes('E per i nostri clienti VIP, abbiamo dei servizi speciali')) {
      t[src] = {
        de_CH: 'Und für unsere VIP-Kunden haben wir spezielle Services nur für euch. Warum wie ein gewöhnlicher Kunde behandelt werden, wenn du ein VIP sein kannst? Bei uns bist du immer die Nummer eins! 🥇👑',
        fr_CH: 'Et pour nos clients VIP, nous avons des services spéciaux rien que pour vous. Pourquoi être traité comme un client ordinaire quand tu peux être un VIP ? Avec nous, tu es toujours le numéro un ! 🥇👑',
        en_US: 'And for our VIP customers, we have special services just for you. Why be treated like an ordinary customer when you can be a VIP? With us, you\'re always number one! 🥇👑'
      };
    }
    else if (src.includes('Quindi, che cazzo stai aspettando?')) {
      t[src] = {
        de_CH: 'Also, worauf zum Teufel wartest du noch? Gib dich nicht mit weniger zufrieden. Lass deine Kunden unser Croissant im Stil von 1980 entdecken. Lass sie in die Vergangenheit reisen und den Genuss probieren, der war, ist und immer sein wird. 🥐🔙',
        fr_CH: 'Alors, qu\'est-ce que tu attends bon sang ? Ne te contente pas de moins. Fais découvrir à tes clients notre Croissant Style 1980. Fais-leur faire un saut dans le passé et savourer le délice qui était, est et sera toujours. 🥐🔙',
        en_US: 'So, what the heck are you waiting for? Don\'t settle for less. Let your customers discover our 1980 Style Croissant. Let them take a trip back in time and taste the delight that was, is and always will be. 🥐🔙'
      };
    }
    else if (src.includes('E tu, che ne pensi? Sei pronto a far rivivere')) {
      t[src] = {
        de_CH: 'Und du, was denkst du? Bist du bereit, den Geschmack der 80er für deine Kunden mit dem Croissant im Stil von 1980 wieder aufleben zu lassen? Hinterlasse unten einen Kommentar, wir wollen deine Meinung hören! Und denk daran, hier bei LAPA sind wir immer bereit, dir bei jeder Frage oder jedem Problem zu helfen. Unser dedizierter Support-Service ist immer bereit, dir zu helfen. 🤝🔧',
        fr_CH: 'Et toi, qu\'en penses-tu ? Es-tu prêt à faire revivre les goûts des années 80 à tes clients avec le Croissant Style 1980 ? Laisse un commentaire ci-dessous, nous voulons entendre ta voix ! Et rappelle-toi, ici chez LAPA, nous sommes toujours prêts à t\'aider avec toute question ou problème que tu pourrais avoir. Notre service d\'assistance dédié est toujours prêt à te donner un coup de main. 🤝🔧',
        en_US: 'And you, what do you think? Are you ready to bring back the flavors of the \'80s for your customers with the 1980 Style Croissant? Leave a comment below, we want to hear your voice! And remember, here at LAPA, we\'re always ready to help you with any question or problem you might have. Our dedicated support service is always ready to give you a hand. 🤝🔧'
      };
    }
    else if (src.includes('Ah, e una cosa in più... se hai un look stile anni')) {
      t[src] = {
        de_CH: 'Ah, und noch etwas... wenn du einen 80er-Jahre-Look hast, während du unser Croissant im Stil von 1980 servierst, wollen wir deine Fotos sehen! Teile deine nostalgischen Momente mit uns! 📸🕺',
        fr_CH: 'Ah, et une chose de plus... si tu as un look style années 80 pendant que tu serviras notre Croissant Style 1980, nous voulons voir tes photos ! Partage avec nous tes moments de nostalgie ! 📸🕺',
        en_US: 'Ah, and one more thing... if you have an \'80s style look while serving our 1980 Style Croissant, we want to see your photos! Share your nostalgic moments with us! 📸🕺'
      };
    }
    else if (src.includes('LAPA - Finest Italian Food. Perché tu e i tuoi clienti')) {
      t[src] = {
        de_CH: 'LAPA - Finest Italian Food. Weil du und deine Kunden nur das Beste verdienen.',
        fr_CH: 'LAPA - Finest Italian Food. Parce que toi et tes clients méritez seulement le meilleur.',
        en_US: 'LAPA - Finest Italian Food. Because you and your customers deserve only the best.'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 27: CORNETTO STILE 1980 ===\n');

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

  console.log('\n✅ ARTICOLO 27 COMPLETATO!');
}

main();
