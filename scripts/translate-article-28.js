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

const POST_ID = 28;

const TITLE_TRANSLATIONS = {
  it_IT: "Coulant al Pistacchio di iMarigliano: Ti Sfido a Non Innamorartene!",
  de_CH: "Pistazien-Coulant von iMarigliano: Ich fordere dich heraus, dich nicht zu verlieben!",
  fr_CH: "Coulant à la Pistache d'iMarigliano : Je te Défie de Ne Pas en Tomber Amoureux !",
  en_US: "Pistachio Coulant by iMarigliano: I Dare You Not to Fall in Love!"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Hai pensato di aver assaggiato tutti i dolci possibili')) {
      t[src] = {
        de_CH: 'Hast du gedacht, du hättest alle möglichen Desserts in deinem Restaurant probiert? Glaubst du, dass nichts mehr deinen Gaumen überraschen kann? Gut, ich fordere dich heraus, etwas zu probieren, das die Spielregeln ändern wird: das Pistazien-Coulant Einzelportion von Imarigliano.',
        fr_CH: 'Tu pensais avoir goûté tous les desserts possibles dans ton restaurant ? Tu crois que rien ne peut plus surprendre ton palais ? Bien, je te défie d\'essayer quelque chose qui changera les règles du jeu : le Coulant à la Pistache Monoportion d\'Imarigliano.',
        en_US: 'Did you think you\'d tasted all possible desserts in your restaurant? Do you believe nothing can surprise your palate anymore? Well, I challenge you to try something that will change the rules of the game: the Single-Portion Pistachio Coulant by Imarigliano.'
      };
    }
    else if (src.includes('Ti presento una prelibatezza che ribalta le convenzioni')) {
      t[src] = {
        de_CH: 'Ich präsentiere dir eine Delikatesse, die alle Konventionen auf den Kopf stellt: stelle dir eine kühne Umarmung zwischen hochwertiger dunkler Schokolade 🍫, einem warmen Herz aus Pistazie 🍈 und weißer Schokolade 🍨 vor. Das Ganze verschmilzt zu einem Feuerwerk der Sinne: die äußere Knusprigkeit der dunklen Schokolade, ihr intensiver Geschmack und tiefes Aroma, die cremige Süße der weißen Schokolade und schließlich die umhüllende Explosion der Pistazie.',
        fr_CH: 'Je te présente une gourmandise qui renverse les conventions : imagine une étreinte audacieuse entre du chocolat noir 🍫 de haute qualité, un cœur chaud de pistache 🍈 et de chocolat blanc 🍨. Le tout se fond en une explosion de sensations : le croustillant extérieur du chocolat noir, son goût intense et son arôme profond, la douceur crémeuse du chocolat blanc et enfin, l\'explosion enveloppante de la pistache.',
        en_US: 'Let me present a delicacy that overturns conventions: imagine a bold embrace between high-quality dark chocolate 🍫, a warm heart of pistachio 🍈 and white chocolate 🍨. Everything merges into an explosion of sensations: the external crispness of dark chocolate, its intense taste and deep aroma, the creamy sweetness of white chocolate and finally, the enveloping explosion of pistachio.'
      };
    }
    else if (src.includes('Questa è la provocazione che Imarigliano ha creato')) {
      t[src] = {
        de_CH: 'Das ist die Provokation, die Imarigliano geschaffen hat. Es ist eine Herausforderung an die Tradition, eine Einladung zu wagen. Das ist nicht nur ein Dessert, das ist eine gastronomische Revolution!',
        fr_CH: 'C\'est la provocation qu\'Imarigliano a créée. C\'est un défi à la tradition, une invitation à oser. Ce n\'est pas seulement un dessert, c\'est une révolution gastronomique !',
        en_US: 'This is the provocation that Imarigliano has created. It\'s a challenge to tradition, an invitation to dare. It\'s not just a dessert, it\'s a gastronomic revolution!'
      };
    }
    else if (src.includes('E ora, grazie a LAPA - Finest Italian Food')) {
      t[src] = {
        de_CH: 'Und jetzt, dank LAPA - Finest Italian Food, 🚚 kann dieses Meisterwerk der Konditorei direkt in dein Restaurant kommen und zum neuen Star deiner Speisekarte werden. Wir sind bereit, dir dieses Wunder 6 Tage von 7 zu liefern, von Montag bis Samstag, dank unserer **"Heute bestellen, morgen geliefert"** Politik 📦.',
        fr_CH: 'Et maintenant, grâce à LAPA - Finest Italian Food, 🚚 ce chef-d\'œuvre de la pâtisserie peut arriver directement dans ton restaurant, et devenir la nouvelle star de ton menu. Nous sommes prêts à te livrer cette merveille 6 jours sur 7, du lundi au samedi, grâce à notre politique **"Commande aujourd\'hui pour demain"** 📦.',
        en_US: 'And now, thanks to LAPA - Finest Italian Food, 🚚 this pastry masterpiece can arrive directly in your restaurant, and become the new star of your menu. We\'re ready to deliver this wonder 6 days out of 7, from Monday to Saturday, thanks to our **"Order today for tomorrow"** policy 📦.'
      };
    }
    else if (src.includes('E se hai bisogno di un ordine personalizzato')) {
      t[src] = {
        de_CH: 'Und wenn du eine personalisierte Bestellung brauchst, kein Problem! Wir bieten personalisierte Preislisten basierend auf der Häufigkeit und dem Volumen der Bestellungen, ohne Mindestbestellwert.',
        fr_CH: 'Et si tu as besoin d\'une commande personnalisée, pas de problème ! Nous offrons des tarifs personnalisés en fonction de la fréquence et du volume des commandes, sans minimum de commande.',
        en_US: 'And if you need a customized order, no problem! We offer customized price lists based on order frequency and volume, with no minimum order.'
      };
    }
    else if (src.includes('Ricorda, con LAPA, non sei solo un cliente')) {
      t[src] = {
        de_CH: 'Die Verwaltung deiner Bestellungen war noch nie so einfach, dank unserer WEB APP 📱. Denke daran, mit LAPA bist du nicht nur ein Kunde. Du bist ein privilegierter Partner, und du hast Zugang zu V.I.P. Services 🥇 und dediziertem Support für alle deine Bedürfnisse.',
        fr_CH: 'Gérer tes commandes n\'a jamais été aussi simple, grâce à notre WEB APP 📱. Rappelle-toi, avec LAPA, tu n\'es pas seulement un client. Tu es un partenaire privilégié, et tu auras accès à des services V.I.P. 🥇 et à une assistance dédiée pour chacun de tes besoins.',
        en_US: 'Managing your orders has never been so simple, thanks to our WEB APP 📱. Remember, with LAPA, you\'re not just a customer. You\'re a privileged partner, and you\'ll have access to V.I.P. services 🥇 and dedicated support for all your needs.'
      };
    }
    else if (src.includes('Ti sfido a provarlo, a lasciare un commento con le tue impressioni')) {
      t[src] = {
        de_CH: 'Ich fordere dich heraus, es zu probieren, einen Kommentar mit deinen Eindrücken zu hinterlassen, etwas völlig Neues zu erleben. Mit LAPA ist jeder Tag eine Gelegenheit, etwas Neues zu entdecken 🌟.',
        fr_CH: 'Je te défie de l\'essayer, de laisser un commentaire avec tes impressions, d\'expérimenter quelque chose de totalement nouveau. Avec LAPA, chaque jour est une opportunité de découvrir quelque chose de nouveau 🌟.',
        en_US: 'I challenge you to try it, to leave a comment with your impressions, to experience something totally new. With LAPA, every day is an opportunity to discover something new 🌟.'
      };
    }
    else if (src.includes('Allora, sei pronto a sorprendere i tuoi clienti')) {
      t[src] = {
        de_CH: 'Also, bist du bereit, deine Kunden mit diesem außergewöhnlichen Dessert zu überraschen? Das Pistazien-Coulant wartet auf dich! 🍮🍈👑',
        fr_CH: 'Alors, es-tu prêt à surprendre tes clients avec cet extraordinaire dessert ? Le Coulant à la Pistache t\'attend ! 🍮🍈👑',
        en_US: 'So, are you ready to surprise your customers with this extraordinary dessert? The Pistachio Coulant is waiting for you! 🍮🍈👑'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 28: COULANT AL PISTACCHIO ===\n');

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

  console.log('\n✅ ARTICOLO 28 COMPLETATO!');
}

main();
