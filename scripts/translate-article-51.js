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

const POST_ID = 51;

const TITLE_TRANSLATIONS = {
  it_IT: "Vuoi Sbancare? Scopri le Penne Che Fanno Impazzire Tutti! 😎",
  de_CH: "Willst du absahnen? Entdecke die Penne, die alle verrückt machen! 😎",
  fr_CH: "Tu Veux Tout Casser ? Découvre les Penne qui Font Craquer Tout le Monde ! 😎",
  en_US: "Want to Hit the Jackpot? Discover the Penne That Drive Everyone Crazy! 😎"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Ciao a te, mago dei fornelli!')) {
      t[src] = {
        de_CH: 'Hallo, Küchenzauberer! Heute bringe ich dir ein Highlight, das deine Kunden vom Stuhl springen lässt: die Penne Mezzani Rigate D&G Gragnano IGP. Ja, du hast richtig gelesen, wir sprechen von der Pasta, die direkt aus der Heimat der Pasta kommt, Gragnano. Das ist nicht das Zeug, das du im Supermarkt findest, eh!',
        fr_CH: 'Salut à toi, magicien des fourneaux ! Aujourd\'hui je t\'apporte une pépite qui fera bondir tes clients de leur chaise : les Penne Mezzani Rigate D&G Gragnano IGP. Oui, tu as bien lu, on parle de la pasta qui vient directement de la patrie des pâtes, Gragnano. Ce n\'est pas le truc que tu trouves au supermarché, eh !',
        en_US: 'Hello there, kitchen wizard! Today I bring you a gem that will make your customers jump out of their chairs: the Penne Mezzani Rigate D&G Gragnano IGP. Yes, you read that right, we\'re talking about the pasta that comes straight from the homeland of pasta, Gragnano. This isn\'t the stuff you find at the supermarket!'
      };
    }
    else if (src.includes('Ora, focalizziamoci un attimo su queste penne')) {
      t[src] = {
        de_CH: 'Jetzt lass uns einen Moment auf diese Penne konzentrieren. Das sind nicht die üblichen langweiligen Penne. Das ist ein echtes Ticket ins Geschmacksparadies. Ihre gerippte Textur? Ein Segen, um die Soße zu halten, als gäbe es kein Morgen. Und der Geschmack? Wie soll ich sagen... du fühlst dich, als wärst du in einer Trattoria in Gragnano, mit der Oma, die dir den Teller bis zum Rand füllt.',
        fr_CH: 'Maintenant, concentrons-nous un instant sur ces penne. Ce ne sont pas les penne ennuyeuses habituelles. C\'est un véritable billet pour le paradis du goût. Leur texture striée ? Une manne du ciel pour retenir la sauce comme s\'il n\'y avait pas de lendemain. Et le goût ? Comment dire... tu te sentiras comme dans une trattoria à Gragnano, avec la grand-mère qui te remplit l\'assiette jusqu\'au bord.',
        en_US: 'Now, let\'s focus for a moment on these penne. These aren\'t your usual boring penne. These are a real ticket to taste paradise. Their ridged texture? A godsend for holding sauce like there\'s no tomorrow. And the flavor? How to put it... you\'ll feel like you\'re in a trattoria in Gragnano, with grandma filling your plate to the brim.'
      };
    }
    else if (src.includes('Ma aspetta, il bello deve ancora venire!')) {
      t[src] = {
        de_CH: 'Aber warte, das Beste kommt noch! Mit LAPA bringen wir diese Wunder direkt zu dir nach Hause, oder besser gesagt, in dein Restaurant. Und wie? Nun, mit einem Service, der dich wie einen König fühlen lässt:',
        fr_CH: 'Mais attends, le meilleur reste à venir ! Avec LAPA, on t\'apporte ces merveilles directement chez toi, ou plutôt, dans ton restaurant. Et comment ? Eh bien, avec un service qui te fait sentir comme un roi :',
        en_US: 'But wait, the best is yet to come! With LAPA, we bring these wonders directly to your home, or better yet, to your restaurant. And how? Well, with a service that makes you feel like a king:'
      };
    }
    else if (src.includes('<strong>Consegne Rapide Come un Lampo</strong>')) {
      t[src] = {
        de_CH: '<strong>Blitzschnelle Lieferungen</strong>: bestelle heute und puff! Morgen kochst du schon. Du musst keine Saltos mehr mit der Bestellplanung machen.',
        fr_CH: '<strong>Livraisons Rapides Comme l\'Éclair</strong> : commande aujourd\'hui et pouf ! Demain tu cuisines déjà. Tu n\'as plus à faire des acrobaties avec la planification des commandes.',
        en_US: '<strong>Lightning-Fast Deliveries</strong>: order today and poof! Tomorrow you\'re already cooking. No more jumping through hoops with order planning.'
      };
    }
    else if (src.includes('<strong>Prezzi Su Misura</strong>')) {
      t[src] = {
        de_CH: '<strong>Maßgeschneiderte Preise</strong>: warum mehr bezahlen, wenn du das Beste zu personalisierten Preisen haben kannst? Dafür sind wir da.',
        fr_CH: '<strong>Prix Sur Mesure</strong> : pourquoi payer plus quand tu peux avoir le meilleur à des prix personnalisés ? On est là pour ça.',
        en_US: '<strong>Custom Prices</strong>: why pay more when you can have the best at personalized prices? We\'re here for that.'
      };
    }
    else if (src.includes('<strong>Ordinare? Un Gioco da Ragazzi</strong>')) {
      t[src] = {
        de_CH: '<strong>Bestellen? Ein Kinderspiel</strong>: unsere WEB APP ist so einfach und schnell, dass du es sogar mit geschlossenen Augen machen könntest (aber probier\'s nicht, eh!).',
        fr_CH: '<strong>Commander ? Un Jeu d\'Enfant</strong> : notre WEB APP est tellement facile et rapide que tu pourrais le faire les yeux fermés (mais n\'essaie pas, eh !).',
        en_US: '<strong>Ordering? Child\'s Play</strong>: our WEB APP is so easy and fast you could do it with your eyes closed (but don\'t try it, okay!).'
      };
    }
    else if (src.includes('<strong>Trattamento VIP</strong>')) {
      t[src] = {
        de_CH: '<strong>VIP-Behandlung</strong>: warum sich damit zufrieden geben, ein gewöhnlicher Kunde zu sein? Bei uns bist du ein Star!',
        fr_CH: '<strong>Traitement VIP</strong> : pourquoi se contenter d\'être un client ordinaire ? Chez nous, tu es une star !',
        en_US: '<strong>VIP Treatment</strong>: why settle for being an ordinary customer? With us, you\'re a star!'
      };
    }
    else if (src.includes('<strong>Nessun Ordine Minimo</strong>')) {
      t[src] = {
        de_CH: '<strong>Kein Mindestbestellwert</strong>: bestelle, was du brauchst, wann du es brauchst. Einfach, oder?',
        fr_CH: '<strong>Pas de Minimum de Commande</strong> : commande ce qu\'il te faut, quand il te le faut. Simple, non ?',
        en_US: '<strong>No Minimum Order</strong>: order what you need, when you need it. Simple, right?'
      };
    }
    else if (src.includes('<strong>Assistenza H24</strong>')) {
      t[src] = {
        de_CH: '<strong>24/7 Support</strong>: ein Problem? Eine Frage? Wir sind immer für dich da.',
        fr_CH: '<strong>Assistance H24</strong> : un problème ? Une question ? On est là pour toi, toujours.',
        en_US: '<strong>24/7 Support</strong>: a problem? A question? We\'re here for you, always.'
      };
    }
    else if (src.includes('Ora, parliamoci chiaro: con queste penne')) {
      t[src] = {
        de_CH: 'Jetzt lass uns Klartext reden: mit diesen Penne wirst du nicht nur dein Menü auf ein neues Level bringen, sondern deine Kunden verrückt machen. Und mit so einem Service, vergiss die Kopfschmerzen mit der Versorgung.',
        fr_CH: 'Maintenant, parlons franchement : avec ces penne, tu ne feras pas seulement monter ton menu à un nouveau niveau, mais tu rendras tes clients fous. Et avec un service pareil, oublie les casse-têtes des approvisionnements.',
        en_US: 'Now, let\'s be clear: with these penne, you\'ll not only take your menu to a new level, but you\'ll drive your customers crazy. And with service like this, forget about supply headaches.'
      };
    }
    else if (src.includes('E allora, che aspetti?')) {
      t[src] = {
        de_CH: 'Also, worauf wartest du? Bring Schwung in dein Menü und lass diese Penne ihre Magie wirken. Und wenn deine Kunden nach dem Geheimnis deiner Küche fragen, zwinkere und sag: "Es ist ein Geheimnis aus Gragnano 😉".',
        fr_CH: 'Et alors, qu\'est-ce que tu attends ? Donne une secousse à ton menu et laisse ces penne faire leur magie. Et quand tes clients te demanderont le secret de ta cuisine, fais un clin d\'œil et dis : "C\'est un secret de Gragnano 😉".',
        en_US: 'So what are you waiting for? Give your menu a shake and let these penne work their magic. And when your customers ask the secret of your kitchen, wink and say: "It\'s a secret from Gragnano 😉".'
      };
    }
    else if (src.includes('Siamo curiosi di sentire le tue avventure culinarie')) {
      t[src] = {
        de_CH: 'Wir sind gespannt, von deinen kulinarischen Abenteuern mit diesen großartigen Penne zu hören. Schreib uns, erzähl uns, lass uns an deinen Geschichten teilhaben!',
        fr_CH: 'On est curieux d\'entendre tes aventures culinaires avec ces penne d\'enfer. Écris-nous, raconte-nous, fais-nous partager tes histoires !',
        en_US: 'We\'re curious to hear about your culinary adventures with these awesome penne. Write to us, tell us, share your stories with us!'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 51: PENNE MEZZANI RIGATE ===\n');

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

  console.log('\n✅ ARTICOLO 51 COMPLETATO!');
}

main();
