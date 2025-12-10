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

const POST_ID = 40;

const TITLE_TRANSLATIONS = {
  it_IT: "Peperoni a Filetti Grigliati: Perché Mangiare 💩 Quando Puoi Avere il Top? 🌶️🔥",
  de_CH: "Gegrillte Paprikastreifen: Warum 💩 essen, wenn du das Beste haben kannst? 🌶️🔥",
  fr_CH: "Poivrons Grillés en Filets : Pourquoi Manger 💩 Quand tu Peux Avoir le Top ? 🌶️🔥",
  en_US: "Grilled Pepper Strips: Why Eat 💩 When You Can Have the Best? 🌶️🔥"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('So cosa stai pensando. "Peperoni in latta?')) {
      t[src] = {
        de_CH: 'Ich weiß, was du denkst. "Paprika aus der Dose? Komm schon!" Aber warte einen Moment, bevor du dieses Gesicht machst. Ich habe etwas, das deine Meinung ändern könnte. Und wenn nicht, gebe ich eine Runde Bier aus. 🍻',
        fr_CH: 'Je sais ce que tu penses. "Des poivrons en boîte ? Allez !" Mais attends un moment avant de faire cette tête. J\'ai quelque chose qui pourrait te faire changer d\'avis. Et si ça ne marche pas, j\'offre une tournée de bière. 🍻',
        en_US: 'I know what you\'re thinking. "Canned peppers? Come on!" But wait a moment before making that face. I have something that might change your mind. And if it doesn\'t, I\'ll buy a round of beers. 🍻'
      };
    }
    else if (src.includes('Immagina un peperone. Rosso, carnoso, grigliato alla perfezione')) {
      t[src] = {
        de_CH: 'Stell dir eine Paprika vor. Rot, fleischig, perfekt gegrillt. Jeder Bissen ist ein Tanz der Aromen auf deinem Gaumen. Stell dir jetzt vor, du könntest dieses Meisterwerk direkt an die Tür deines Lokals geliefert bekommen. Nein, ich scherze nicht.',
        fr_CH: 'Imagine un poivron. Rouge, charnu, grillé à la perfection. Chaque bouchée est une danse de saveurs sur ton palais. Maintenant imagine pouvoir avoir ce chef-d\'œuvre directement à la porte de ton établissement. Non, je ne plaisante pas.',
        en_US: 'Imagine a pepper. Red, meaty, grilled to perfection. Every bite is a dance of flavors on your palate. Now imagine being able to have this masterpiece delivered right to your venue\'s door. No, I\'m not kidding.'
      };
    }
    else if (src.includes('Perché Scegliere i Peperoni a Filetti Grigliati LAPA?')) {
      t[src] = {
        de_CH: 'Warum LAPA Gegrillte Paprikastreifen wählen?',
        fr_CH: 'Pourquoi Choisir les Poivrons Grillés en Filets LAPA ?',
        en_US: 'Why Choose LAPA Grilled Pepper Strips?'
      };
    }
    else if (src.includes('1. Innanzitutto, questi peperoni non sono il solito schifo')) {
      t[src] = {
        de_CH: '1. Zunächst einmal sind diese Paprika nicht der übliche Dosenmist, den du überall findest. Es sind ausgewählte Paprika, perfekt gereift, meisterhaft gegrillt und in einer 800g-Dose verpackt, bereit, deine Geschmacksknospen und die deiner Kunden zu kitzeln.',
        fr_CH: '1. D\'abord, ces poivrons ne sont pas la merde habituelle en boîte que tu trouves partout. Ce sont des poivrons sélectionnés, mûrs à point, grillés avec maîtrise, et enfermés dans une boîte de 800g prêts à chatouiller tes papilles et celles de tes clients.',
        en_US: '1. First of all, these peppers aren\'t the usual canned crap you find everywhere. They\'re selected peppers, perfectly ripe, masterfully grilled, and packed in an 800g can ready to tickle your taste buds and those of your customers.'
      };
    }
    else if (src.includes('2. Scommetto che a volte ti ritrovi a corto di ingredienti')) {
      t[src] = {
        de_CH: '2. Ich wette, manchmal gehen dir die Zutaten aus, genau wenn du sie am meisten brauchst, oder? Bestelle heute und puff, morgen hast du alles, was du brauchst. Und ja, auch samstags. Also keine Sonntagspanik. 😉',
        fr_CH: '2. Je parie que parfois tu te retrouves à court d\'ingrédients pile quand tu en as le plus besoin, non ? Commande aujourd\'hui et pouf, demain tu as tout ce qu\'il te faut. Et oui, même le samedi. Donc pas de panique dominicale. 😉',
        en_US: '2. I bet sometimes you run short of ingredients right when you need them most, right? Order today and poof, tomorrow you have everything you need. And yes, even on Saturday. So no Sunday panic. 😉'
      };
    }
    else if (src.includes('3. E quei fornitori che ti costringono a comprare 10.000 lattine')) {
      t[src] = {
        de_CH: '3. Und diese Lieferanten, die dich zwingen, 10.000 Dosen zu kaufen, wenn du nur eine willst? Bei LAPA gibt es keinen Mindestbestellwert. Nimm, was du brauchst, wann du es brauchst. Und Schluss mit dieser Geschichte, zum Discounter zu gehen und mit leeren Händen zurückzukommen!',
        fr_CH: '3. Et ces fournisseurs qui t\'obligent à acheter 10 000 boîtes quand tu en veux qu\'une ? Avec LAPA, pas de minimum de commande. Prends ce qu\'il te faut, quand il te le faut. Et fini cette histoire d\'aller au discount et de revenir les mains vides !',
        en_US: '3. And those suppliers who force you to buy 10,000 cans when you only want one? With LAPA there\'s no minimum order. Take what you need, when you need it. And enough with this story of going to the discount store and coming back empty-handed!'
      };
    }
    else if (src.includes('4. Hai bisogno di un aiuto? Una domanda?')) {
      t[src] = {
        de_CH: '4. Brauchst du Hilfe? Eine Frage? Oder vielleicht nur, um Dampf abzulassen, weil Inter wieder verloren hat? 😜 Wir haben einen dedizierten Support, der bereit ist, dir zuzuhören. Und ja, wir sind auch gut darin, Fußball-Beschwerden anzuhören.',
        fr_CH: '4. Tu as besoin d\'aide ? Une question ? Ou peut-être juste de te défouler parce que l\'Inter a encore perdu ? 😜 On a une assistance dédiée prête à t\'écouter. Et oui, on est aussi bons pour écouter les plaintes sur le foot.',
        en_US: '4. Need help? A question? Or maybe just to vent about Inter losing again? 😜 We have dedicated support ready to hear you. And yes, we\'re also good at listening to football complaints.'
      };
    }
    else if (src.includes('5. E la ciliegina sulla torta? Una super pratica WEB APP')) {
      t[src] = {
        de_CH: '5. Und das i-Tüpfelchen? Eine super praktische WEB APP. Bestellen, kontrollieren, lächeln und wiederholen. Und keine verlorenen Bestellungen mehr auf klebrigen Papierzetteln!',
        fr_CH: '5. Et la cerise sur le gâteau ? Une WEB APP super pratique. Commandes, contrôles, souris et répète. Et fini les commandes perdues sur des bouts de papier collants !',
        en_US: '5. And the cherry on top? A super practical WEB APP. Order, check, smile and repeat. And no more lost orders on sticky pieces of paper!'
      };
    }
    else if (src.includes('Ora, so cosa stai pensando. "Ehi, questo suona proprio bene!"')) {
      t[src] = {
        de_CH: 'Jetzt weiß ich, was du denkst. "Hey, das klingt wirklich gut!" Und du hast recht! Also, mein Freund, warum sich mit weniger zufrieden geben, wenn du die besten Gegrillten Paprikastreifen direkt von LAPA haben kannst?',
        fr_CH: 'Maintenant, je sais ce que tu penses. "Hé, ça sonne vraiment bien !" Et tu as raison ! Donc, mon ami, pourquoi se contenter de moins quand tu peux avoir les meilleurs Poivrons Grillés en Filets directement de LAPA ?',
        en_US: 'Now, I know what you\'re thinking. "Hey, this sounds really good!" And you\'re right! So, my friend, why settle for less when you can have the best Grilled Pepper Strips directly from LAPA?'
      };
    }
    else if (src.includes('Dimmi, sei pronto a dire addio a quei peperoni tristi')) {
      t[src] = {
        de_CH: 'Sag mir, bist du bereit, dich von diesen traurigen, schlaffen Paprika zu verabschieden und den explosiven Geschmack unserer gegrillten Paprika in deinem Lokal willkommen zu heißen? Hinterlasse einen Kommentar, und wenn sie dir nicht gefallen, wie ich schon sagte, oder',
        fr_CH: 'Dis-moi, tu es prêt à dire adieu à ces poivrons tristes et flétris et à accueillir dans ton établissement la saveur explosive de nos poivrons grillés ? Laisse un commentaire, et s\'ils ne te plaisent pas, comme j\'ai dit avant, ou',
        en_US: 'Tell me, are you ready to say goodbye to those sad, wilted peppers and welcome the explosive flavor of our grilled peppers into your venue? Leave a comment, and if you don\'t like them, as I said before, or'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 40: PEPERONI A FILETTI GRIGLIATI ===\n');

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

  console.log('\n✅ ARTICOLO 40 COMPLETATO!');
}

main();
