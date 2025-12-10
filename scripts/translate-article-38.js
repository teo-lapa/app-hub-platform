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

const POST_ID = 38;

const TITLE_TRANSLATIONS = {
  it_IT: "Pappardelle all'Uovo: Ma tu, davvero pensi di aver mangiato pasta fino ad ora? 😂🍝",
  de_CH: "Eiernudeln Pappardelle: Denkst du wirklich, du hast bis jetzt Pasta gegessen? 😂🍝",
  fr_CH: "Pappardelle aux Œufs : Tu penses vraiment avoir mangé des pâtes jusqu'à maintenant ? 😂🍝",
  en_US: "Egg Pappardelle: Do You Really Think You've Eaten Pasta Until Now? 😂🍝"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Facciamola breve: le pappardelle')) {
      t[src] = {
        de_CH: 'Machen wir es kurz: die Pappardelle. Du denkst vielleicht, du kennst sie, aber ich wette meinen nächsten Gehaltsscheck, dass du die echten noch nicht probiert hast. Nicht die aus dem Supermarkt, die nach Pappe und Verzweiflung schmeckten. Ich spreche von den Eiernudeln Pappardelle 1KG, die dich sagen lassen: "Mein Gott, was IST das?!" 🤯',
        fr_CH: 'Faisons court : les pappardelle. Tu penses peut-être les connaître, mais je parie mon prochain salaire que tu n\'as pas encore savouré les vraies. Pas celles du supermarché qui avaient goût de carton et de désespoir. Je parle des Pappardelle aux Œufs de 1KG, celles qui te font dire : "Mon Dieu, mais c\'est QUOI ça ?!" 🤯',
        en_US: 'Let\'s keep it short: pappardelle. You might think you know them, but I\'ll bet my next paycheck you haven\'t tasted the real ones yet. Not those supermarket ones that tasted like cardboard and desperation. I\'m talking about the Egg Pappardelle 1KG, the kind that makes you say: "Oh my God, what IS this?!" 🤯'
      };
    }
    else if (src.includes('Pensa a una pasta che non ha paura di essere se stessa')) {
      t[src] = {
        de_CH: 'Denk an eine Pasta, die keine Angst hat, sie selbst zu sein. Breit, mutig, gemacht mit Liebe, Leidenschaft und natürlich jeder Menge Ei. Es ist wie dieser Rocksong, der leise beginnt und dann BOOM! in deinen Ohren explodiert. Und diese Pappardelle? Sie explodieren vor Geschmack im Mund.',
        fr_CH: 'Pense à des pâtes qui n\'ont pas peur d\'être elles-mêmes. Larges, audacieuses, faites avec amour, passion et, évidemment, beaucoup d\'œuf. C\'est comme cette chanson rock qui commence doucement et puis BOOM ! t\'explose dans les oreilles. Et ces pappardelle ? Elles explosent de saveur en bouche.',
        en_US: 'Think of a pasta that\'s not afraid to be itself. Wide, bold, made with love, passion and, of course, loads of egg. It\'s like that rock song that starts slow and then BOOM! explodes in your ears. And these pappardelle? They explode with flavor in your mouth.'
      };
    }
    else if (src.includes('Però aspetta, perché ora arriva il bello')) {
      t[src] = {
        de_CH: 'Aber warte, jetzt kommt das Beste. Willst du dieses Wunderwerk in die Hände bekommen? LAPA ist die Antwort. Warum? Ich sag\'s dir!',
        fr_CH: 'Mais attends, parce que maintenant arrive le meilleur. Tu veux mettre la main sur cette merveille ? LAPA est la réponse. Pourquoi ? Je vais te le dire !',
        en_US: 'But wait, because now comes the good part. Want to get your hands on this wonder? LAPA is the answer. Why? Let me tell you!'
      };
    }
    else if (src.includes('Consegne 6 su 7? Già, proprio così')) {
      t[src] = {
        de_CH: 'Lieferungen 6 von 7 Tagen? Ja, genau so. Entscheidest du heute, dass du morgen diese besondere Person beeindrucken willst (oder vielleicht nur deine Katze) mit einem Top-Abendessen? Bestelle, und bum! Morgen sind sie bei dir. 😎',
        fr_CH: 'Livraisons 6 jours sur 7 ? Oui, exactement. Tu décides aujourd\'hui que demain tu veux impressionner cette personne spéciale (ou peut-être juste ton chat) avec un dîner top ? Commande, et boum ! Demain elles sont chez toi. 😎',
        en_US: 'Deliveries 6 out of 7 days? Yep, that\'s right. Decide today that tomorrow you want to impress that special someone (or maybe just your cat) with a top dinner? Order, and boom! Tomorrow they\'re at your place. 😎'
      };
    }
    else if (src.includes('Con la nostra APP per ordini')) {
      t[src] = {
        de_CH: 'Mit unserer Bestell-APP, in der Zeit, die du brauchst, um durch die Stories der aktuellen "Influencer" zu scrollen, hast du schon alles erledigt. Und ja, verdammt, kein Mindestbestellwert!',
        fr_CH: 'Avec notre APP pour les commandes, dans le temps qu\'il te faut pour scroller les stories des "influenceurs" du moment, tu as déjà tout fait. Et oui, merde, pas de minimum de commande !',
        en_US: 'With our ordering APP, in the time it takes you to scroll through the stories of current "influencers", you\'ve already done everything. And yes, damn it, no minimum order!'
      };
    }
    else if (src.includes('Sei nel panico perché non sai come condire questo capolavoro')) {
      t[src] = {
        de_CH: 'Du bist in Panik, weil du nicht weißt, wie du dieses Meisterwerk würzen sollst? Keine Sorge, ruf an. Unser Team, das mehr Pasta gesehen hat, als du in deinem ganzen Leben gegessen hast, ist bereit, dir Ratschläge zu geben.',
        fr_CH: 'Tu paniques parce que tu ne sais pas comment assaisonner ce chef-d\'œuvre ? Tranquille, appelle. Notre équipe, qui a vu plus de pâtes que tu n\'en as mangé de toute ta vie, est prête à te donner des conseils.',
        en_US: 'Panicking because you don\'t know how to dress this masterpiece? Relax, call. Our team, who\'ve seen more pasta than you\'ve eaten in your entire life, is ready to give you advice.'
      };
    }
    else if (src.includes('In conclusione: tu hai provato pasta nella tua vita')) {
      t[src] = {
        de_CH: 'Abschließend: Hast du in deinem Leben Pasta probiert? Wenn du die Eiernudeln Pappardelle 1KG von LAPA noch nicht gekostet hast, Freund, hast du nur geträumt! 😜',
        fr_CH: 'En conclusion : tu as goûté des pâtes dans ta vie ? Si tu n\'as pas savouré les Pappardelle aux Œufs de 1KG de LAPA, mon ami, tu n\'as fait que rêver ! 😜',
        en_US: 'In conclusion: have you tried pasta in your life? If you haven\'t tasted the Egg Pappardelle 1KG from LAPA, friend, you\'ve only been dreaming! 😜'
      };
    }
    else if (src.includes('Allora, che fai? Rimani lì seduto a leccarti gli schermi')) {
      t[src] = {
        de_CH: 'Also, was machst du? Bleibst du dort sitzen und leckst deine Telefonbildschirme ab oder steigst du ins Spiel ein und bewegst dich? 💥',
        fr_CH: 'Alors, tu fais quoi ? Tu restes assis là à lécher tes écrans de téléphone ou tu te lances et tu te bouges ? 💥',
        en_US: 'So, what are you doing? Staying there licking your phone screens or getting in the game and making a move? 💥'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 38: PAPPARDELLE ALL\'UOVO ===\n');

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

  console.log('\n✅ ARTICOLO 38 COMPLETATO!');
}

main();
