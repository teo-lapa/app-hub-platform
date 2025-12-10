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

const POST_ID = 36;

const TITLE_TRANSLATIONS = {
  it_IT: "MASCARPONE: Il 🤴 Re dei Formaggi o Solo un Capriccio da Hipster? 🤔",
  de_CH: "MASCARPONE: Der 🤴 König der Käse oder nur eine Hipster-Laune? 🤔",
  fr_CH: "MASCARPONE : Le 🤴 Roi des Fromages ou Juste un Caprice de Hipster ? 🤔",
  en_US: "MASCARPONE: The 🤴 King of Cheeses or Just a Hipster Whim? 🤔"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Ti sei mai fermato a riflettere su quanto sia fondamentale il mascarpone')) {
      t[src] = {
        de_CH: 'Hast du jemals innegehalten und darüber nachgedacht, wie grundlegend der Mascarpone in unserer schönen italienischen Küche ist? Nein, ich spreche nicht von diesem wässrigen Durcheinander, das du in den Discounter-Regalen findest. Ich spreche vom echten, cremigen, luxuriösen Mascarpone.',
        fr_CH: 'T\'es-tu jamais arrêté pour réfléchir à quel point le mascarpone est fondamental dans notre belle cuisine italienne ? Non, je ne parle pas de ce gâchis aqueux que tu trouves sur les étagères du discount. Je parle du vrai, du crémeux, du luxueux mascarpone.',
        en_US: 'Have you ever stopped to reflect on how fundamental mascarpone is in our beautiful Italian cuisine? No, I\'m not talking about that watery mess you find on discount store shelves. I\'m talking about the real, creamy, luxurious mascarpone.'
      };
    }
    else if (src.includes('Mi chiedi perché? Be\', lascia che ti illumini')) {
      t[src] = {
        de_CH: 'Du fragst mich warum? Nun, lass mich dich kurz aufklären. 🌟',
        fr_CH: 'Tu me demandes pourquoi ? Eh bien, laisse-moi t\'éclairer un instant. 🌟',
        en_US: 'You ask me why? Well, let me enlighten you for a moment. 🌟'
      };
    }
    else if (src.includes('Questo gioiellino non è il solito formaggio')) {
      t[src] = {
        de_CH: 'Dieses Juwel ist nicht der übliche Käse, den du in den Einkaufswagen legst und im Kühlschrank vergisst. Mascarpone ist ein Fest für die Geschmacksknospen, eine sensorische Reise. Wenn du ihn probierst, merkst du, dass alle anderen Mascarpone, die du vorher probiert hast, nur ein schlechter Witz waren. Und wer will schon Witze, wenn es ums Essen geht?',
        fr_CH: 'Ce petit bijou n\'est pas le fromage habituel que tu mets dans le chariot et oublies au frigo. Le mascarpone est une fête pour les papilles, un voyage sensoriel. Quand tu le savoures, tu te rends compte que tous les autres mascarpone que tu as essayés avant n\'étaient qu\'une mauvaise blague. Et qui veut des blagues quand il s\'agit de nourriture ?',
        en_US: 'This little gem isn\'t the usual cheese you put in your cart and forget in the fridge. Mascarpone is a feast for the taste buds, a sensory journey. When you taste it, you realize that all the other mascarpones you\'ve tried before were just a bad joke. And who wants jokes when it comes to food?'
      };
    }
    else if (src.includes('E sai cosa rende ancora più dolce l\'esperienza')) {
      t[src] = {
        de_CH: 'Und weißt du, was das Erlebnis noch süßer macht? Bestelle heute und BOOM! 💥 Morgen hast du diese göttliche Creme vor der Tür. Was?! Ja, du hast richtig verstanden. Bestelle heute für morgen. Warum warten, wenn du jetzt Hunger hast?',
        fr_CH: 'Et tu sais ce qui rend l\'expérience encore plus douce ? Commande aujourd\'hui et BOOM ! 💥 Demain tu te retrouves avec cette crème divine devant ta porte. Quoi ?! Oui, tu as bien compris. Commande aujourd\'hui pour demain. Pourquoi attendre quand tu as faim maintenant ?',
        en_US: 'And you know what makes the experience even sweeter? Order today and BOOM! 💥 Tomorrow you\'ll find this divine cream at your door. What?! Yes, you understood correctly. Order today for tomorrow. Why wait when you\'re hungry now?'
      };
    }
    else if (src.includes('E se sei uno di quelli che odia leggere piccole scritte')) {
      t[src] = {
        de_CH: 'Und wenn du einer von denen bist, die es hassen, Kleingedrucktes und Details auf einer Website zu lesen, habe ich gute Neuigkeiten für dich. Mit der LAPA WEB APP kannst du diese Schönheit mit wenigen Klicks bestellen. 📱 Und seien wir ehrlich, wer will sich schon das Leben mit endlosen Formularen kompliziert machen, wenn alles, was du dir wünschst, ein würdiger Mascarpone ist?',
        fr_CH: 'Et si tu es l\'un de ceux qui détestent lire les petits caractères et les détails sur un site web, j\'ai de bonnes nouvelles pour toi. Avec la WEB APP de LAPA, tu peux commander cette beauté en quelques clics. 📱 Et disons-le, qui veut se compliquer la vie avec des formulaires interminables quand tout ce que tu désires c\'est un mascarpone digne de ce nom ?',
        en_US: 'And if you\'re one of those who hates reading fine print and details on a website, I have good news for you. With the LAPA WEB APP you can order this beauty with a few clicks. 📱 And let\'s face it, who wants to complicate their life with endless forms when all you want is a mascarpone worthy of the name?'
      };
    }
    else if (src.includes('Oh, e un altro vantaggio? Nessun minimo d\'ordine')) {
      t[src] = {
        de_CH: 'Oh, und noch ein Vorteil? Kein Mindestbestellwert. Ja, du musst den Warenkorb nicht mit einem Haufen Zeug füllen, nur um einen Mindestbestellwert zu erreichen. Bestelle so viel du willst, wann du willst. Ist das nicht fantastisch?',
        fr_CH: 'Oh, et un autre avantage ? Pas de minimum de commande. Oui, tu n\'as pas besoin de remplir le panier avec un tas de trucs juste pour satisfaire une commande minimum. Commande autant que tu veux, quand tu veux. C\'est pas génial ?',
        en_US: 'Oh, and another advantage? No minimum order. Yes, you don\'t have to fill your cart with a bunch of stuff just to meet a minimum order. Order as much as you want, whenever you want. Isn\'t that fantastic?'
      };
    }
    else if (src.includes('Allora, tu cosa ne pensi? Il mascarpone è davvero il re')) {
      t[src] = {
        de_CH: 'Also, was denkst du? Ist Mascarpone wirklich der König der Käse oder nur ein weiterer Hipster-Trend? Hinterlasse einen Kommentar hier unten, und sei ehrlich! (Auch wenn, ehrlich gesagt, wenn du ihn nicht liebst, sollten wir ernsthaft über deinen Gaumen sprechen. 😉)',
        fr_CH: 'Alors, qu\'en penses-tu ? Le mascarpone est-il vraiment le roi des fromages ou juste une autre mode de hipster ? Laisse un commentaire ci-dessous, et sois sincère ! (Même si, honnêtement, si tu ne l\'aimes pas, on devrait sérieusement parler de ton palais. 😉)',
        en_US: 'So, what do you think? Is mascarpone really the king of cheeses or just another hipster trend? Leave a comment below, and be honest! (Although, honestly, if you don\'t love it, we should seriously talk about your palate. 😉)'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 36: MASCARPONE ===\n');

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

  console.log('\n✅ ARTICOLO 36 COMPLETATO!');
}

main();
