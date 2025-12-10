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

const POST_ID = 60;

const TITLE_TRANSLATIONS = {
  it_IT: "🍐 Scopri la PUREA SURG ZUCCHERATA 10% PERA di LAPA 🚀",
  de_CH: "🍐 Entdecke das TK-BIRNENPÜREE 10% GEZUCKERT von LAPA 🚀",
  fr_CH: "🍐 Découvre la PURÉE SURG SUCRÉE 10% POIRE de LAPA 🚀",
  en_US: "🍐 Discover LAPA's FROZEN SWEETENED 10% PEAR PUREE 🚀"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Eh sì, amico mio, è proprio così: stiamo per parlarti di purea di pera')) {
      t[src] = {
        de_CH: 'Ja ja, mein Freund, genau so ist es: wir werden dir von Birnenpüree erzählen, aber nimm sofort diese Schnute weg. Das ist nicht das übliche langweilige Zeug, das du erwartest. Das TK-BIRNENPÜREE 10% GEZUCKERT von LAPA - Finest Italian Food ist der Game Changer, auf den dein Restaurant gewartet hat, eines dieser Schmuckstücke, bei denen du sagst: "Warum zum Teufel bin ich nicht früher darauf gekommen?"',
        fr_CH: 'Eh oui, mon ami, c\'est bien ça : on va te parler de purée de poire, mais enlève tout de suite cette moue. Ce n\'est pas le truc ennuyeux habituel que tu attends. La PURÉE SURG SUCRÉE 10% POIRE de LAPA - Finest Italian Food est le changement de jeu que ton restaurant attendait, une de ces pépites qui te font dire : "Mais pourquoi diable je n\'y ai pas pensé avant ?"',
        en_US: 'Oh yes, my friend, that\'s right: we\'re about to talk to you about pear puree, but wipe that frown off immediately. This isn\'t the usual boring stuff you expect. The FROZEN SWEETENED 10% PEAR PUREE from LAPA - Finest Italian Food is the game changer your restaurant was waiting for, one of those gems that make you say: "Why the heck didn\'t I think of this before?"'
      };
    }
    else if (src.includes('Prima di tutto, lascia che ti spieghi cosa rende questa purea così dannatamente speciale')) {
      t[src] = {
        de_CH: 'Zuallererst, lass mich dir erklären, was dieses Püree so verdammt besonders macht. Das ist nicht das übliche Fruchtmus, das du in den Supermarktregalen findest, nein nein. Das ist Qualitätsbirne, Freund, mit genau der richtigen Prise Zucker, um die Aromen explodieren zu lassen, ohne das Ganze in eine Kalorienbombe zu verwandeln. Es ist dick, es ist lecker, und wir bringen es dir frisch frisch direkt, fast so, als hätten wir es nur für dich zu Hause gemacht.',
        fr_CH: 'D\'abord, laisse-moi t\'expliquer ce qui rend cette purée si fichtrement spéciale. Ce n\'est pas la purée de fruits habituelle que tu trouves dans les rayons du supermarché, non non. C\'est de la poire de qualité, mon ami, avec juste ce qu\'il faut de sucre pour faire exploser les saveurs, sans transformer le tout en bombe calorique. Elle est dense, elle est goûteuse, et on te l\'apporte directement fraîche fraîche, presque comme si on l\'avait faite maison juste pour toi.',
        en_US: 'First of all, let me explain what makes this puree so darn special. This isn\'t the usual fruit puree you find on supermarket shelves, no no. This is quality pear, friend, with just the right touch of sugar to make the flavors explode, without turning the whole thing into a calorie bomb. It\'s thick, it\'s tasty, and we bring it to you fresh fresh, almost as if we made it at home just for you.'
      };
    }
    else if (src.includes('E sai la cosa migliore? Con LAPA non devi fare salti mortali per avere questo prodotto')) {
      t[src] = {
        de_CH: 'Und weißt du das Beste? Mit LAPA musst du keine Saltos machen, um dieses Produkt zu bekommen, wenn du es brauchst. Hast du vergessen es zu bestellen? Keine Sorge, wir schicken es dir "im Handumdrehen". Bestelle heute, und pam! Morgen ist es schon bei dir. Und es gibt keinen Quatsch mit Mindestbestellungen; nimm, was du brauchst, Punkt. Du bist der Chef, und wir sind hier, um dir das Leben leicht zu machen.',
        fr_CH: 'Et tu sais le meilleur ? Avec LAPA tu n\'as pas à faire des acrobaties pour avoir ce produit quand tu en as besoin. Tu as oublié de la commander ? Tranquille, on te l\'expédie "en un clin d\'œil". Tu commandes aujourd\'hui, et pam ! Demain elle est déjà chez toi. Et pas de bêtises de commandes minimum ; prends ce qu\'il te faut, point. C\'est toi le chef, et on est là pour te rendre la vie facile.',
        en_US: 'And you know the best part? With LAPA you don\'t have to do backflips to get this product when you need it. Forgot to order it? Relax, we\'ll ship it to you "in the blink of an eye". Order today, and bam! Tomorrow it\'s already at your place. And no minimum order nonsense; take what you need, period. You\'re the boss, and we\'re here to make your life easy.'
      };
    }
    else if (src.includes('Ora, se sei uno di quelli che si stufa facilmente e ama sperimentare')) {
      t[src] = {
        de_CH: 'Jetzt, wenn du einer von denen bist, die sich leicht langweilen und gerne experimentieren, haben wir dich auch dort abgedeckt. Mit unserem VIP-Service fühlst du dich wie ein König: personalisierte Preise basierend darauf, was du am häufigsten nimmst und in welcher Menge, Top-Support wenn du ihn brauchst, und eine App, mit der du alles von deinem Wohnzimmersofa aus verwalten kannst, oder aus der Küche, oder auch vom Bad aus... wer sind wir zu urteilen?',
        fr_CH: 'Maintenant, si tu es du genre à te lasser facilement et qui aime expérimenter, on t\'a couvert là aussi. Avec notre service VIP tu te sens comme un roi : prix personnalisés en fonction de ce que tu prends le plus souvent et des quantités, assistance top quand tu en as besoin, et une app qui te fait tout gérer depuis le canapé de ton salon, ou de la cuisine, ou même des toilettes... qui sommes-nous pour juger ?',
        en_US: 'Now, if you\'re one of those who gets bored easily and loves to experiment, we\'ve got you covered there too. With our VIP service you feel like a king: personalized prices based on what you take most often and quantities, top assistance when you need it, and an app that lets you manage everything from your living room couch, or the kitchen, or even the bathroom... who are we to judge?'
      };
    }
    else if (src.includes('Quindi, dacci dentro: prova la PUREA SURG ZUCCHERATA 10% PERA in quel tuo piatto stellato')) {
      t[src] = {
        de_CH: 'Also, leg los: probiere das TK-BIRNENPÜREE 10% GEZUCKERT in deinem Sternegericht oder dem verrückten Cocktail, den du schon immer ausprobieren wolltest. Los, zeig allen, dass Birnenpüree nicht nur Zeug für alte Leute beim Nachmittagssnack ist, sondern eine revolutionäre Zutat, die allem, was du in deinem Lokal servierst, den Extra-Kick geben kann.',
        fr_CH: 'Donc, fonce : essaie la PURÉE SURG SUCRÉE 10% POIRE dans ton plat étoilé ou ce cocktail de folie que tu as toujours voulu essayer. Allez, montre à tout le monde que la purée de poire n\'est pas que pour les vieux qui prennent leur goûter, mais un ingrédient révolutionnaire qui peut donner un boost à tout ce que tu sers dans ton établissement.',
        en_US: 'So, go for it: try the FROZEN SWEETENED 10% PEAR PUREE in that starred dish of yours or that crazy cocktail you\'ve always wanted to try. Come on, show everyone that pear puree isn\'t just stuff for old folks having a snack, but a revolutionary ingredient that can give an extra boost to everything you serve in your place.'
      };
    }
    else if (src.includes('Non ci credi? Provaci. E poi torna qui a raccontarci tutto')) {
      t[src] = {
        de_CH: 'Glaubst du nicht? Probier es. Und dann komm hierher zurück und erzähl uns alles. Wir sind neugierig zu erfahren, wie dieser kleine Schatz dir geholfen hat, deine Kunden sprachlos zu machen. Los, rede frei und schieß los in den Kommentaren! 🍐🔥',
        fr_CH: 'Tu n\'y crois pas ? Essaie. Et puis reviens ici nous raconter tout. On est curieux de savoir comment ce petit trésor t\'a aidé à laisser tes clients bouche bée. Vas-y, délie ta langue et balance tout dans les commentaires ! 🍐🔥',
        en_US: 'Don\'t believe it? Try it. And then come back here to tell us everything. We\'re curious to know how this little treasure helped you leave your customers speechless. Go on, spill the beans and fire away in the comments! 🍐🔥'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 60: PUREA PERA ===\n');

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

  console.log('\n✅ ARTICOLO 60 COMPLETATO!');
}

main();
