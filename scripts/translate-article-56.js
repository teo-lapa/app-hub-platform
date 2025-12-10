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

const POST_ID = 56;

const TITLE_TRANSLATIONS = {
  it_IT: "🔥 Sfida Accesa ai Pizzaioli: La Pala per Pizza che Cambierà il Tuo Modo di Lavorare 🍕",
  de_CH: "🔥 Heiße Herausforderung an Pizzabäcker: Die Pizzaschaufel, die deine Arbeitsweise verändern wird 🍕",
  fr_CH: "🔥 Défi Brûlant aux Pizzaïolos : La Pelle à Pizza qui Changera ta Façon de Travailler 🍕",
  en_US: "🔥 Hot Challenge to Pizza Makers: The Pizza Peel That Will Change the Way You Work 🍕"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Oggi ti porto una chicca che ti farà dire')) {
      t[src] = {
        de_CH: 'Heute bringe ich dir ein Schmuckstück, das dich sagen lassen wird "wo war das mein ganzes Leben?!" Ich spreche von der rechteckigen perforierten Pizzaschaufel Napoli 33 cm x 1,83 cm GI. Ja, ich weiß, der Name ist ein ordentlicher Brocken, aber warte, bis du hörst, was dieses Wunderding kann.',
        fr_CH: 'Aujourd\'hui je t\'apporte une pépite qui te fera dire "mais où était-elle toute ma vie ?!" Je parle de la Pelle à Pizza Rectangulaire Perforée Napoli de 33 cm x 1,83 cm GI. Oui, je sais, le nom est costaud, mais attends d\'entendre ce que fait cette merveille.',
        en_US: 'Today I bring you a gem that will make you say "where has this been all my life?!" I\'m talking about the Rectangular Perforated Pizza Peel Naples 33 cm x 1.83 cm GI. Yes, I know, the name is a mouthful, but wait until you hear what this wonder does.'
      };
    }
    else if (src.includes('Iniziamo con il materiale: alluminio S.H.A.')) {
      t[src] = {
        de_CH: 'Fangen wir mit dem Material an: S.H.A.-Aluminium (Special Hard Anodizing). Hast du dich jemals gefragt, wie es wäre, mit einer Schaufel zu arbeiten, die dich nicht im Stich lässt, auch wenn der Ofen wie die Hölle wirkt? Diese Schaufel hält dreimal mehr Hitze aus als normales Aluminium. Leicht wie eine Feder, hart wie ein Felsen und gleitet auf Mehl besser als ein Eisläufer auf dem Eis.',
        fr_CH: 'Commençons par le matériau : aluminium S.H.A. (Special Hard Anodizing). Tu t\'es jamais demandé comment ce serait de travailler avec une pelle qui ne t\'abandonne pas même quand le four semble l\'enfer ? Cette pelle résiste à la chaleur trois fois plus que l\'aluminium normal. Légère comme une plume, dure comme un roc, et elle glisse sur la farine mieux qu\'un patineur sur la glace.',
        en_US: 'Let\'s start with the material: S.H.A. aluminum (Special Hard Anodizing). Have you ever wondered what it would be like to work with a peel that won\'t abandon you even when the oven feels like hell? This peel withstands heat three times more than regular aluminum. Light as a feather, hard as a rock, and slides on flour better than a skater on ice.'
      };
    }
    else if (src.includes('Ora, parliamo del design. Questa pala non è il solito rettangolo noioso')) {
      t[src] = {
        de_CH: 'Jetzt lass uns über das Design sprechen. Diese Schaufel ist nicht das übliche langweilige Rechteck. Sie wurde für die künstlerischen Bewegungen der neapolitanischen Pizzabäcker entworfen. Diese Löcher sind nicht nur Dekoration, Freund! Sie lassen überschüssiges Mehl abfallen, damit deine Pizza nicht zum Keks wird.',
        fr_CH: 'Maintenant, parlons du design. Cette pelle n\'est pas le rectangle ennuyeux habituel. Elle a été pensée pour les gestes artistiques des pizzaïolos napolitains. Ces trous ne sont pas juste décoratifs, mon ami ! Ils servent à laisser glisser la farine en excès, pour que ta pizza ne se transforme pas en biscuit.',
        en_US: 'Now, let\'s talk about the design. This peel isn\'t your usual boring rectangle. It was designed for the artistic movements of Neapolitan pizza makers. Those holes aren\'t just decoration, friend! They let excess flour slide off, so your pizza doesn\'t turn into a cookie.'
      };
    }
    else if (src.includes('Il manico, poi, è un capolavoro')) {
      t[src] = {
        de_CH: 'Der Griff ist übrigens ein Meisterwerk: Golf von Neapel-Farbe, mit einem Griff, der dich zum König der Pizzeria macht. Und die drei farbigen Nieten wie die italienische Flagge? Sie sind das Siegel eines Made in Italy, das alles sprengt.',
        fr_CH: 'Le manche, puis, est un chef-d\'œuvre : couleur Golfe de Naples, avec une prise qui te fait sentir le roi de la pizzeria. Et les trois rivets colorés comme le drapeau italien ? C\'est le sceau d\'un Made in Italy qui déchire.',
        en_US: 'The handle, by the way, is a masterpiece: Gulf of Naples color, with a grip that makes you feel like the king of the pizzeria. And the three colored rivets like the Italian flag? They\'re the seal of a Made in Italy that rocks.'
      };
    }
    else if (src.includes('E ora la parte migliore: LAPA - Finest Italian Food ti porta questa bellezza')) {
      t[src] = {
        de_CH: 'Und jetzt der beste Teil: LAPA - Finest Italian Food bringt dir diese Schönheit direkt nach Hause oder in dein Restaurant ohne Mindestbestellgeschichten. Du bist in der Krise, weil du vergessen hast zu bestellen? Keine Sorge, bestelle heute und morgen wartet sie schon auf dich. Und mit unserer App ist Bestellen so einfach, dass du es auch nach ein paar Bier machen könntest.',
        fr_CH: 'Et maintenant la meilleure partie : LAPA - Finest Italian Food t\'apporte cette beauté directement chez toi ou dans ton restaurant sans histoires de minimum de commande. Tu es en crise parce que tu as oublié de commander ? Tranquille, commande aujourd\'hui et demain elle t\'attend déjà. Et avec notre app, passer commande c\'est tellement facile que tu pourrais le faire même après quelques bières.',
        en_US: 'And now the best part: LAPA - Finest Italian Food brings this beauty directly to your home or restaurant with no minimum order stories. Are you in crisis because you forgot to order? Relax, order today and tomorrow it\'s already waiting for you. And with our app, ordering is so easy you could do it even after a couple of beers.'
      };
    }
    else if (src.includes('Allora, sei pronto a lasciarti stupire?')) {
      t[src] = {
        de_CH: 'Also, bist du bereit, dich verblüffen zu lassen? Probiere diese Schaufel und du wirst nicht mehr zurück wollen. Und wenn sie dir nicht gefällt, komm und sag es mir. Ich bin sicher, das wird nicht passieren, aber ich liebe eine gute Herausforderung. Los, kommentiere hier unten und sag mir, was du denkst. Die Revolution in deiner Küche beginnt mit einer einfachen Schaufel. Bist du dabei? 🍕💥👊',
        fr_CH: 'Alors, tu es prêt à te laisser épater ? Essaie cette pelle et tu verras que tu ne voudras plus revenir en arrière. Et si elle ne te plaît pas, viens me le dire. Je suis sûr que ça n\'arrivera pas, mais j\'adore un bon défi. Allez, commente ci-dessous et dis-moi ce que tu en penses. La révolution dans ta cuisine commence avec une simple pelle. T\'es partant ? 🍕💥👊',
        en_US: 'So, are you ready to be amazed? Try this peel and you\'ll see you won\'t want to go back. And if you don\'t like it, come tell me. I\'m sure that won\'t happen, but I love a good challenge. Come on, comment below and tell me what you think. The revolution in your kitchen starts with a simple peel. Are you in? 🍕💥👊'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 56: PALA PER PIZZA ===\n');

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

  console.log('\n✅ ARTICOLO 56 COMPLETATO!');
}

main();
