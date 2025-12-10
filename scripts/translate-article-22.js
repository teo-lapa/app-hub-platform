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

const POST_ID = 22;

const TITLE_TRANSLATIONS = {
  it_IT: "Scopri le Cassatine Siciliane Monoporzioni iMarigliano: un'esplosione di gusto nel tuo locale! 😍🍰",
  de_CH: "Entdecken Sie die sizilianischen Cassatine-Einzelportionen von iMarigliano: eine Geschmacksexplosion in Ihrem Lokal! 😍🍰",
  fr_CH: "Découvrez les Cassatine Siciliennes en Portions Individuelles iMarigliano : une explosion de saveur dans votre établissement ! 😍🍰",
  en_US: "Discover iMarigliano's Single-Portion Sicilian Cassatine: a taste explosion in your venue! 😍🍰"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('La Cassatina Siciliana: il gusto del sole')) {
      t[src] = {
        de_CH: '🍋🍊 Die sizilianische Cassatina: der Geschmack der Sonne in Ihrem Lokal! 🌞🤤',
        fr_CH: '🍋🍊 La Cassatina Sicilienne : le goût du soleil dans votre établissement ! 🌞🤤',
        en_US: '🍋🍊 The Sicilian Cassatina: the taste of sunshine in your venue! 🌞🤤'
      };
    }
    else if (src.includes('Ciao amico! Senti un po')) {
      t[src] = {
        de_CH: 'Hallo Freund! Hör mal her: Wenn du wüsstest, was für eine köstliche Sache wir gerade aus unserer Zauberkiste geholt haben! 🎩✨ Es handelt sich um die sizilianischen Cassatine-Einzelportionen, 12 Stück pro Karton, direkt von Imarigliano! 🍰🇮🇹',
        fr_CH: 'Salut ami ! Écoute un peu ça : si tu savais quelle chose délicieuse nous venons de sortir de notre boîte magique ! 🎩✨ Il s\'agit des Cassatine Siciliennes en Portions Individuelles, 12 pièces par carton, directement d\'Imarigliano ! 🍰🇮🇹',
        en_US: 'Hey friend! Listen to this: if you only knew what delicious stuff we just pulled out of our magic box! 🎩✨ We\'re talking about Single-Portion Sicilian Cassatine, 12 pieces per box, directly from Imarigliano! 🍰🇮🇹'
      };
    }
    else if (src.includes('La cassata siciliana è un\'icona della pasticceria')) {
      t[src] = {
        de_CH: 'Die sizilianische Cassata ist eine Ikone der italienischen Konditorei, und wir von LAPA - Finest Italian Food konnten diese Delikatesse natürlich nicht ignorieren. Weißt du warum? Weil wir dir nur das Beste bieten wollen! 😎',
        fr_CH: 'La cassata sicilienne est une icône de la pâtisserie italienne, et nous chez LAPA - Finest Italian Food ne pouvions certainement pas ignorer cette délicatesse. Tu sais pourquoi ? Parce que nous voulons t\'offrir seulement le meilleur ! 😎',
        en_US: 'The Sicilian cassata is an icon of Italian pastry, and we at LAPA - Finest Italian Food certainly couldn\'t ignore this delicacy. You know why? Because we want to offer you only the best! 😎'
      };
    }
    else if (src.includes('Ogni cassatina è un\'esplosione di sapori')) {
      t[src] = {
        de_CH: '🤩 Jede Cassatina ist eine Geschmacksexplosion: feuchter Biskuit, Schafsmilch-Ricotta, Schokolade und kandierte Früchte... kurzum, ein Meisterwerk der Konditorkunst! Willst du dich mit den üblichen Süßigkeiten zufrieden geben oder deine Kunden mit etwas wirklich Besonderem überraschen? 🌟',
        fr_CH: '🤩 Chaque cassatina est une explosion de saveurs : génoise moelleuse, ricotta de brebis, chocolat et fruits confits... bref, un chef-d\'œuvre de pâtisserie ! Tu veux te contenter des desserts habituels ou surprendre tes clients avec quelque chose de vraiment spécial ? 🌟',
        en_US: '🤩 Each cassatina is an explosion of flavors: moist sponge cake, sheep\'s milk ricotta, chocolate and candied fruits... in short, a pastry masterpiece! Do you want to settle for the usual desserts or amaze your customers with something truly special? 🌟'
      };
    }
    else if (src.includes('Usufruisci dei nostri fantastici servizi')) {
      t[src] = {
        de_CH: '✌️ Nutze unsere fantastischen Dienste, wie die Lieferungen 6 von 7 Tagen, von Montag bis Samstag! Vergessen, die Cassatine zu bestellen? Keine Sorge, bestelle heute und morgen bringen wir sie direkt in dein Lokal! 🚚💨',
        fr_CH: '✌️ Profite de nos services fantastiques, comme les livraisons 6 jours sur 7, du lundi au samedi ! Tu as oublié de commander les cassatine ? Ne t\'inquiète pas, commande aujourd\'hui et demain nous te les apportons directement dans ton établissement ! 🚚💨',
        en_US: '✌️ Take advantage of our fantastic services, like deliveries 6 out of 7 days, from Monday to Saturday! Forgot to order the cassatine? Don\'t worry, order today and tomorrow we\'ll bring them directly to your venue! 🚚💨'
      };
    }
    else if (src.includes('E non dimenticare la nostra comodissima WEB APP')) {
      t[src] = {
        de_CH: '📲 Und vergiss nicht unsere super praktische WEB APP, um Bestellungen im Handumdrehen aufzugeben, ohne kostbare Zeit zu verlieren! Du kannst auch Bestellungen und Waren verfolgen und Dokumente einsehen. Praktisch machen wir dir das Leben leichter, und das tun wir gerne! 😄',
        fr_CH: '📲 Et n\'oublie pas notre très pratique WEB APP, pour passer des commandes en un clin d\'œil, sans perdre de temps précieux ! Tu pourras aussi suivre les commandes, la marchandise et consulter les documents. Pratiquement, nous te simplifions la vie, et nous le faisons avec plaisir ! 😄',
        en_US: '📲 And don\'t forget our super convenient WEB APP, to place orders in the blink of an eye, without wasting precious time! You can also track orders and goods and view documents. Basically, we\'re making your life easier, and we do it gladly! 😄'
      };
    }
    else if (src.includes('Ricorda, con LAPA - Finest Italian Food, sei sempre in buone mani')) {
      t[src] = {
        de_CH: '🔥 Denk daran, mit LAPA - Finest Italian Food bist du immer in guten Händen. Wir haben die dedizierte Unterstützung bereit, dir zu helfen, wenn du uns brauchst. Egal welches Problem du hast, wir sind hier, um es zu lösen! 💯',
        fr_CH: '🔥 N\'oublie pas, avec LAPA - Finest Italian Food, tu es toujours en bonnes mains. Nous avons l\'assistance dédiée prête à t\'aider si tu as besoin de nous. Peu importe le problème que tu as, nous sommes là pour le résoudre ! 💯',
        en_US: '🔥 Remember, with LAPA - Finest Italian Food, you\'re always in good hands. We have dedicated assistance ready to help you if you need us. No matter what problem you have, we\'re here to solve it! 💯'
      };
    }
    else if (src.includes('Allora, cosa aspetti? Prova subito le nostre Cassatine')) {
      t[src] = {
        de_CH: 'Also, worauf wartest du? Probiere sofort unsere sizilianischen Cassatine-Einzelportionen und bringe ein Stück Sizilien in dein Restaurant, deine Pizzeria oder deinen Pub! Wir wetten, dass sie deine Kunden verrückt machen und sie nicht mehr darauf verzichten können? 🤤',
        fr_CH: 'Alors, qu\'attends-tu ? Essaie tout de suite nos Cassatine Siciliennes en Portions Individuelles et apporte un peu de Sicile dans ton restaurant, ta pizzeria ou ton pub ! On parie qu\'elles rendront tes clients fous et qu\'ils ne pourront plus s\'en passer ? 🤤',
        en_US: 'So, what are you waiting for? Try our Single-Portion Sicilian Cassatine right now and bring a piece of Sicily to your restaurant, pizzeria or pub! We bet they\'ll drive your customers crazy and they won\'t be able to do without them? 🤤'
      };
    }
    else if (src.includes('Contattaci subito e unisciti alla famiglia LAPA')) {
      t[src] = {
        de_CH: 'Kontaktiere uns sofort und werde Teil der LAPA-Familie! 📞💌',
        fr_CH: 'Contacte-nous tout de suite et rejoins la famille LAPA ! 📞💌',
        en_US: 'Contact us right away and join the LAPA family! 📞💌'
      };
    }
    else if (src.includes('PS: Ricorda che consegniamo 6 su 7')) {
      t[src] = {
        de_CH: 'PS: Denk daran, dass wir 6 von 7 Tagen liefern, von Montag bis Samstag! Also keine Ausreden, diese köstlichen sizilianischen Cassatine-Einzelportionen nicht zu probieren! 🚛🎯😉',
        fr_CH: 'PS : N\'oublie pas que nous livrons 6 jours sur 7, du lundi au samedi ! Donc, pas d\'excuses pour ne pas essayer ces délicieuses Cassatine Siciliennes en Portions Individuelles ! 🚛🎯😉',
        en_US: 'PS: Remember we deliver 6 out of 7 days, from Monday to Saturday! So, no excuses not to try these delicious Single-Portion Sicilian Cassatine! 🚛🎯😉'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 22: CASSATINE SICILIANE ===\n');

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

  console.log('\n✅ ARTICOLO 22 COMPLETATO!');
}

main();
