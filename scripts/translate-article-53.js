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

const POST_ID = 53;

const TITLE_TRANSLATIONS = {
  it_IT: "🌿 Spinaci? No Grazie... A Meno Che Non Siano di un Altro Pianeta! 🚀",
  de_CH: "🌿 Spinat? Nein danke... Es sei denn, er kommt von einem anderen Planeten! 🚀",
  fr_CH: "🌿 Épinards ? Non Merci... À Moins qu'ils ne Viennent d'une Autre Planète ! 🚀",
  en_US: "🌿 Spinach? No Thanks... Unless It's From Another Planet! 🚀"
};

const SUBTITLE_TRANSLATIONS = {
  it_IT: "Amico mio, lascia che ti racconti una storia. Una storia che inizia con un prodotto che potrebbe sembrare noioso come gli spinaci, ma finisce con un'esplosione di sapore e qualità che ti lascerà a bocca aperta.",
  de_CH: "Mein Freund, lass mich dir eine Geschichte erzählen. Eine Geschichte, die mit einem Produkt beginnt, das so langweilig wie Spinat erscheinen könnte, aber mit einer Explosion von Geschmack und Qualität endet, die dich sprachlos machen wird.",
  fr_CH: "Mon ami, laisse-moi te raconter une histoire. Une histoire qui commence avec un produit qui pourrait sembler ennuyeux comme les épinards, mais qui finit avec une explosion de saveur et de qualité qui te laissera bouche bée.",
  en_US: "My friend, let me tell you a story. A story that begins with a product that might seem as boring as spinach, but ends with an explosion of flavor and quality that will leave you speechless."
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Sto parlando degli Spinaci in Foglie Cubo Belgio Surg')) {
      t[src] = {
        de_CH: 'Ich spreche vom Blattspinat Würfel Belgien TK 2,5kg Pkg 10kg. Aber das ist nicht der traurige Spinat, den du im Supermarkt findest, nein nein! Das ist der Spinat, der sogar Popeye verrückt machen würde! 💪',
        fr_CH: 'Je parle des Épinards en Feuilles Cube Belgique Surg 2,5kg Conf 10kg. Mais ce ne sont pas les épinards tristes habituels que tu trouves au supermarché, non non ! Ce sont les épinards qui rendraient fou même Popeye ! 💪',
        en_US: 'I\'m talking about the Belgian Leaf Spinach Cube Frozen 2.5kg Pack 10kg. But these aren\'t the usual sad spinach you find at the supermarket, no no! These are the spinach that would drive even Popeye crazy! 💪'
      };
    }
    else if (src.includes('Prima di tutto, scordati di aspettare per le consegne')) {
      t[src] = {
        de_CH: 'Erstens, vergiss das Warten auf Lieferungen. Bei uns fliegt der Spinat 6 Tage die Woche zu dir! 🚚 Montag, Dienstag, Mittwoch... jeder Tag ist gut für etwas frisches Grün. Und weißt du was? Dank unserer personalisierten Preisliste wirst du dich nie über den Tisch gezogen fühlen. Die Preise? Maßgeschneidert für dich, wie ein Maßanzug. 🕴️',
        fr_CH: 'D\'abord, oublie d\'attendre pour les livraisons. Chez nous, les épinards volent vers toi 6 jours sur 7 ! 🚚 Lundi, mardi, mercredi... chaque jour est bon pour un peu de vert frais. Et tu sais quoi ? Grâce à notre tarif personnalisé, tu ne te sentiras jamais arnaqué. Les prix ? Sur mesure pour toi, comme un costume de tailleur. 🕴️',
        en_US: 'First of all, forget about waiting for deliveries. With us, spinach flies to you 6 days a week! 🚚 Monday, Tuesday, Wednesday... every day is good for some fresh green. And you know what? Thanks to our personalized price list, you\'ll never feel ripped off. The prices? Tailored for you, like a bespoke suit. 🕴️'
      };
    }
    else if (src.includes('E se pensi che ordinare sia una seccatura, ti sbagli di grosso')) {
      t[src] = {
        de_CH: 'Und wenn du denkst, Bestellen ist lästig, liegst du total falsch. Unsere Bestell-APP ist so intuitiv, dass sogar dein Opa sie benutzen könnte! 👴📱 Ein Tap hier, ein Tap da, und der Spinat ist schon auf dem Weg in deine Küche.',
        fr_CH: 'Et si tu penses que commander c\'est une corvée, tu te trompes lourdement. Notre APP pour les commandes est tellement intuitive que même ton grand-père saurait l\'utiliser ! 👴📱 Un tap ici, un tap là, et les épinards sont déjà en route vers ta cuisine.',
        en_US: 'And if you think ordering is a hassle, you\'re dead wrong. Our ordering APP is so intuitive that even your grandpa could use it! 👴📱 One tap here, one tap there, and the spinach is already on its way to your kitchen.'
      };
    }
    else if (src.includes('Sei un tipo esigente? Perfetto, ti trattiamo come un VIP')) {
      t[src] = {
        de_CH: 'Bist du ein anspruchsvoller Typ? Perfekt, wir behandeln dich wie einen VIP. Warum solltest du dich mit weniger zufrieden geben? 🌟',
        fr_CH: 'Tu es du genre exigeant ? Parfait, on te traite comme un VIP. Pourquoi devrais-tu te contenter de moins ? 🌟',
        en_US: 'Are you the demanding type? Perfect, we treat you like a VIP. Why should you settle for less? 🌟'
      };
    }
    else if (src.includes('Oh, dimenticato di ordinare? "Ordini oggi per domani"')) {
      t[src] = {
        de_CH: 'Oh, vergessen zu bestellen? "Bestelle heute für morgen" ist unser Motto. Und dann, wer hat gesagt, du musst einen ganzen Lastwagen Spinat kaufen? Bestelle so viel du willst, wann du willst. Kein Mindestbestellwert hier. 🛒',
        fr_CH: 'Oh, oublié de commander ? "Commande aujourd\'hui pour demain", c\'est notre devise. Et puis, qui a dit que tu devais acheter un camion entier d\'épinards ? Commande ce que tu veux, quand tu veux. Pas de minimum de commande ici. 🛒',
        en_US: 'Oh, forgot to order? "Order today for tomorrow" is our motto. And then, who said you have to buy a whole truck of spinach? Order as much as you want, when you want. No minimum order here. 🛒'
      };
    }
    else if (src.includes('Adesso, parliamo di qualità. Questi spinaci non sono il solito contorno')) {
      t[src] = {
        de_CH: 'Jetzt lass uns über Qualität sprechen. Dieser Spinat ist nicht die übliche traurige, zerkochte Beilage. Er ist knusprig, frisch und oh, so vielseitig! Du kannst ihn in eine Creme verwandeln, die zum Finger ablecken ist, in einem Salat verwenden, der wie aus einem Sternerestaurant aussieht, oder eine Quiche machen, die deine Oma neidisch machen würde! 🥗🥧',
        fr_CH: 'Maintenant, parlons qualité. Ces épinards ne sont pas le contour triste et défait habituel. Ils sont croquants, frais, et oh, tellement polyvalents ! Tu peux les transformer en une crème à se lécher les babines, les utiliser dans une salade qui semble sortie d\'un restaurant étoilé, ou en faire une quiche qui ferait envie à ta grand-mère ! 🥗🥧',
        en_US: 'Now, let\'s talk quality. This spinach isn\'t the usual sad, mushy side dish. It\'s crispy, fresh, and oh, so versatile! You can turn it into a cream that\'s finger-licking good, use it in a salad that looks straight out of a starred restaurant, or make a quiche that would make your grandma jealous! 🥗🥧'
      };
    }
    else if (src.includes('E se hai un dubbio, una domanda, o semplicemente voglia di chiacchierare')) {
      t[src] = {
        de_CH: 'Und wenn du einen Zweifel, eine Frage oder einfach Lust auf einen Plausch hast, ist unser dedizierter Support für dich da. Ruf uns an, schreib uns, schick uns ein Rauchzeichen wenn du willst, wir sind immer bereit zu helfen! 📞',
        fr_CH: 'Et si tu as un doute, une question, ou simplement envie de papoter, notre assistance dédiée est là pour toi. Appelle-nous, écris-nous, envoie-nous un signal de fumée si tu veux, on est toujours prêts à t\'aider ! 📞',
        en_US: 'And if you have a doubt, a question, or just want to chat, our dedicated support is here for you. Call us, write us, send us a smoke signal if you want, we\'re always ready to help! 📞'
      };
    }
    else if (src.includes('In conclusione, questi spinaci non sono solo cibo')) {
      t[src] = {
        de_CH: 'Abschließend, dieser Spinat ist nicht nur Essen. Es ist ein Erlebnis. Es ist die Zutat, die in deiner Küche gefehlt hat. Es ist der Funke, der die Leidenschaft für die Gastronomie entfacht. Also, was sagst du, bist du dabei? Probiere den Blattspinat Würfel Belgien TK und mach dich bereit, deine Kunden zu begeistern. Und denk dran, mit LAPA wird Qualität immer serviert!',
        fr_CH: 'En conclusion, ces épinards ne sont pas que de la nourriture. C\'est une expérience. C\'est l\'ingrédient qui manquait dans ta cuisine. C\'est l\'étincelle qui allume la passion pour la gastronomie. Alors, qu\'en dis-tu, t\'es partant ? Essaie les Épinards en Feuilles Cube Belgique Surg et prépare-toi à épater tes clients. Et rappelle-toi, avec LAPA, la qualité est toujours servie !',
        en_US: 'In conclusion, this spinach isn\'t just food. It\'s an experience. It\'s the ingredient that was missing in your kitchen. It\'s the spark that ignites the passion for gastronomy. So, what do you say, are you in? Try the Belgian Leaf Spinach Cube Frozen and get ready to amaze your customers. And remember, with LAPA, quality is always served!'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 53: SPINACI ===\n');

  console.log('1. Aggiorno titolo e sottotitolo...');
  for (const lang of ['it_IT', 'de_CH', 'fr_CH', 'en_US']) {
    await callOdoo('blog.post', 'write',
      [[POST_ID], { name: TITLE_TRANSLATIONS[lang], subtitle: SUBTITLE_TRANSLATIONS[lang] }],
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

  console.log('\n✅ ARTICOLO 53 COMPLETATO!');
}

main();
