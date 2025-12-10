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

const POST_ID = 20;

const TITLE_TRANSLATIONS = {
  it_IT: "🚀 \"Scopri i Carciofi a Spicchi Trifolati di LAPA: Il segreto per far impazzire i clienti del tuo locale!\" 🌟",
  de_CH: "🚀 \"Entdecken Sie die geschmorten Artischockenherzen von LAPA: Das Geheimnis, um die Kunden Ihres Lokals zu begeistern!\" 🌟",
  fr_CH: "🚀 \"Découvrez les Artichauts en Quartiers Trifolati de LAPA : Le secret pour rendre fous les clients de votre établissement !\" 🌟",
  en_US: "🚀 \"Discover LAPA's Sautéed Artichoke Hearts: The secret to driving your venue's customers crazy!\" 🌟"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Ehi, amico! Ascolta un attimo')) {
      t[src] = {
        de_CH: '🍴 Hey, Freund! Hör mal zu! 📣',
        fr_CH: '🍴 Hey, ami ! Écoute un instant ! 📣',
        en_US: '🍴 Hey, friend! Listen up! 📣'
      };
    }
    else if (src.includes('Sei stufo di mangiare sempre la stessa roba')) {
      t[src] = {
        de_CH: 'Hast du es satt, in deinem Restaurant oder deiner Pizzeria immer das gleiche langweilige Zeug zu essen? Gut, denn LAPA - Finest Italian Food ist hier, um alles zu ändern, und wir präsentieren dir unseren neuesten Erfolg: die geschmorten Artischockenherzen!',
        fr_CH: 'Tu en as marre de manger toujours la même chose ennuyeuse dans ton restaurant ou ta pizzeria ? Bien, parce que LAPA - Finest Italian Food est là pour tout changer, et nous te présentons notre dernier succès : les Artichauts en Quartiers Trifolati !',
        en_US: 'Are you tired of always eating the same boring stuff at your restaurant or pizzeria? Well, because LAPA - Finest Italian Food is here to change everything, and we present to you our latest success: the Sautéed Artichoke Hearts!'
      };
    }
    else if (src.includes("È risaputo che il carciofo sia un'icona")) {
      t[src] = {
        de_CH: 'Es ist bekannt, dass die Artischocke eine Ikone der italienischen Küche ist 🇮🇹, aber nicht jeder weiß, wie man ihren Geschmack hervorheben kann. Deshalb haben wir, die Genies von LAPA, beschlossen, die Artischocke auf ein anderes Niveau zu bringen!',
        fr_CH: 'C\'est bien connu que l\'artichaut est une icône de la cuisine italienne 🇮🇹, mais tout le monde ne sait pas comment exalter son goût. C\'est pourquoi nous, génies de LAPA, avons décidé d\'amener l\'artichaut à un niveau supérieur !',
        en_US: 'It\'s well known that artichoke is an icon of Italian cuisine 🇮🇹, but not everyone knows how to enhance its taste. That\'s why we, the geniuses at LAPA, decided to take the artichoke to another level!'
      };
    }
    else if (src.includes('I nostri carciofi a spicchi trifolati sono selezionati')) {
      t[src] = {
        de_CH: '🌱 Unsere geschmorten Artischockenherzen werden sorgfältig von den besten italienischen Produzenten ausgewählt, um nur die höchste Qualität zu bieten. Die Artischocken werden dann mit Knoblauch geschmort und ergeben ein köstliches und aromatisches Gericht.',
        fr_CH: '🌱 Nos artichauts en quartiers trifolati sont sélectionnés avec soin parmi les meilleurs producteurs italiens, en nous assurant d\'offrir uniquement la plus haute qualité. Les artichauts sont ensuite sautés avec de l\'ail, créant un plat délicieux et aromatique.',
        en_US: '🌱 Our sautéed artichoke hearts are carefully selected from the best Italian producers, ensuring we offer only the highest quality. The artichokes are then sautéed with garlic, creating a delicious and aromatic dish.'
      };
    }
    else if (src.includes("Sai cos'è il bello di avere noi come fornitore")) {
      t[src] = {
        de_CH: 'Weißt du, was das Schöne daran ist, uns als Lieferanten zu haben? Wir liefern dir das Produkt, das du brauchst, wann du es brauchst! 😎 Vergessen, die Artischocken zu bestellen? Bestelle heute und morgen kommen sie an! 🚚💨',
        fr_CH: 'Tu sais ce qui est génial de nous avoir comme fournisseur ? Nous te livrons le produit dont tu as besoin, quand tu en as besoin ! 😎 Oublié de commander les artichauts ? Commande aujourd\'hui et demain ils arrivent ! 🚚💨',
        en_US: 'You know what\'s great about having us as a supplier? We deliver the product you need, when you need it! 😎 Forgot to order the artichokes? Order today and tomorrow they arrive! 🚚💨'
      };
    }
    else if (src.includes('Con la nostra comodissima WEB APP')) {
      t[src] = {
        de_CH: '📲 Mit unserer sehr praktischen WEB APP kannst du im Handumdrehen bestellen, ohne kostbare Zeit zu verlieren. Außerdem kannst du Bestellungen und Waren verfolgen, Dokumente einsehen und vieles mehr!',
        fr_CH: '📲 Avec notre très pratique WEB APP, tu pourras commander en un clin d\'œil, sans perdre de temps précieux. De plus, tu pourras suivre les commandes et la marchandise, consulter des documents et bien plus !',
        en_US: '📲 With our very convenient WEB APP, you can order in the blink of an eye, without wasting precious time. Plus, you can track orders and goods, view documents and much more!'
      };
    }
    else if (src.includes("E sai qual è il top del top")) {
      t[src] = {
        de_CH: 'Und weißt du, was das Beste vom Besten ist? Die V.I.P.-Services! Warum sich damit zufrieden geben, ein gewöhnlicher Kunde zu sein, wenn du ein besonderer Kunde mit vielen Extra-Services sein kannst? 🎉',
        fr_CH: 'Et tu sais quel est le top du top ? Les services V.I.P. ! Pourquoi se contenter d\'être un client ordinaire quand tu peux être un client spécial avec plein de services extras ? 🎉',
        en_US: 'And you know what\'s the best of the best? The V.I.P. services! Why settle for being an ordinary customer when you can be a special customer with lots of extra services? 🎉'
      };
    }
    else if (src.includes('Che aspetti? Prova subito i nostri Carciofi')) {
      t[src] = {
        de_CH: 'Worauf wartest du? Probiere sofort unsere geschmorten Artischockenherzen! Wetten, dass sie deine Kunden verrückt machen und sie nicht mehr darauf verzichten können? 🤤',
        fr_CH: 'Qu\'attends-tu ? Essaie tout de suite nos Artichauts en Quartiers Trifolati ! On parie qu\'ils rendront tes clients fous et qu\'ils ne pourront plus s\'en passer ? 🤤',
        en_US: 'What are you waiting for? Try our Sautéed Artichoke Hearts right now! We bet they\'ll drive your customers crazy and they won\'t be able to do without them? 🤤'
      };
    }
    else if (src.includes('E ricorda, con LAPA - Finest Italian Food')) {
      t[src] = {
        de_CH: '🔥 Und denke daran, mit LAPA - Finest Italian Food bist du immer in guten Händen. Wir haben eine dedizierte Unterstützung bereit, dir zu helfen, wenn du uns brauchst. Egal welches Problem du hast, wir sind hier, um es zu lösen!',
        fr_CH: '🔥 Et rappelle-toi, avec LAPA - Finest Italian Food, tu es toujours en bonnes mains. Nous avons une assistance dédiée prête à t\'aider si tu as besoin de nous. Peu importe le problème, nous sommes là pour le résoudre !',
        en_US: '🔥 And remember, with LAPA - Finest Italian Food, you\'re always in good hands. We have dedicated assistance ready to help you if you need us. No matter what problem you have, we\'re here to solve it!'
      };
    }
    else if (src.includes('Cosa dici, sei pronto a portare il tuo ristorante')) {
      t[src] = {
        de_CH: 'Was sagst du, bist du bereit, dein Restaurant, deine Pizzeria oder deine Bar auf das nächste Level zu bringen? Dann lass LAPA dir helfen! 🤝',
        fr_CH: 'Qu\'en dis-tu, es-tu prêt à amener ton restaurant, ta pizzeria ou ton pub au niveau supérieur ? Alors laisse LAPA te donner un coup de main ! 🤝',
        en_US: 'What do you say, are you ready to take your restaurant, pizzeria or pub to the next level? Then let LAPA give you a hand! 🤝'
      };
    }
    else if (src.includes('Contattaci subito e unisciti alla famiglia LAPA')) {
      t[src] = {
        de_CH: 'Kontaktiere uns sofort und werde Teil der LAPA-Familie! 📞💌',
        fr_CH: 'Contacte-nous tout de suite et rejoins la famille LAPA ! 📞💌',
        en_US: 'Contact us right away and join the LAPA family! 📞💌'
      };
    }
    else if (src.includes('PS: Non dimenticare che consegniamo 6 su 7')) {
      t[src] = {
        de_CH: '<span style="color: rgb(52, 53, 65)">PS: Vergiss nicht, dass wir 6 von 7 Tagen liefern, von Montag bis Samstag! Also, keine Ausreden, unsere köstlichen geschmorten Artischockenherzen nicht zu probieren! 🚛🎯😉</span>',
        fr_CH: '<span style="color: rgb(52, 53, 65)">PS: N\'oublie pas que nous livrons 6 jours sur 7, du lundi au samedi ! Donc, pas d\'excuses pour ne pas essayer nos délicieux Artichauts en Quartiers Trifolati ! 🚛🎯😉</span>',
        en_US: '<span style="color: rgb(52, 53, 65)">PS: Don\'t forget that we deliver 6 out of 7 days, from Monday to Saturday! So, no excuses not to try our delicious Sautéed Artichoke Hearts! 🚛🎯😉</span>'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 20: CARCIOFI TRIFOLATI ===\n');

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

  console.log('\n✅ ARTICOLO 20 COMPLETATO!');
}

main();
