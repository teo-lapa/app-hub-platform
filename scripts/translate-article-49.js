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

const POST_ID = 49;

const TITLE_TRANSLATIONS = {
  it_IT: "Le Tartellette Mignon di LAPA: L'Antipasto Che Cambia le Regole del Gioco! 🎲",
  de_CH: "LAP Mini-Tartelettes: Die Vorspeise, die die Spielregeln ändert! 🎲",
  fr_CH: "Les Tartelettes Mignon de LAPA : L'Entrée qui Change les Règles du Jeu ! 🎲",
  en_US: "LAPA's Mignon Tartlets: The Appetizer That Changes the Game! 🎲"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Oggi ho una chicca per te: le nostre Tartellette Mignon')) {
      t[src] = {
        de_CH: 'Heute habe ich ein Highlight für dich: unsere Mini-Tartelettes. Sie sind die Vorspeise, von der du nicht wusstest, dass du sie wolltest, aber glaub mir, einmal probiert, werden sie ein Muss auf deinem Menü. 🌟',
        fr_CH: 'Aujourd\'hui j\'ai une pépite pour toi : nos Tartelettes Mignon. C\'est l\'entrée que tu ne savais pas que tu désirais mais, crois-moi, une fois goûtées, elles deviendront un incontournable de ton menu. 🌟',
        en_US: 'Today I have a gem for you: our Mignon Tartlets. They\'re the appetizer you didn\'t know you wanted but, trust me, once you try them, they\'ll become a must on your menu. 🌟'
      };
    }
    else if (src.includes('Immagina di poter offrire ai tuoi ospiti o clienti qualcosa di unico')) {
      t[src] = {
        de_CH: 'Stell dir vor, du könntest deinen Gästen oder Kunden etwas Einzigartiges bieten, etwas das sie sprachlos macht und sie immer wieder kommen lässt. Diese Tartelettes sind nicht nur ein Fest des Geschmacks und der Leichtigkeit, sondern auch ein Symbol dafür, wie wir bei LAPA uns um dich und dein Geschäft kümmern. 💼',
        fr_CH: 'Imagine pouvoir offrir à tes invités ou clients quelque chose d\'unique, quelque chose qui les laisse sans voix et les fasse revenir encore et encore. Ces tartelettes ne sont pas seulement un festival de goût et de légèreté, mais aussi le symbole de comment nous chez LAPA nous prenons soin de toi et de ton business. 💼',
        en_US: 'Imagine being able to offer your guests or customers something unique, something that leaves them speechless and makes them come back again and again. These tartlets aren\'t just a celebration of taste and lightness, but also a symbol of how we at LAPA take care of you and your business. 💼'
      };
    }
    else if (src.includes('Con noi, non devi preoccuparti di pianificare gli ordini con settimane di anticipo')) {
      t[src] = {
        de_CH: 'Bei uns musst du dir keine Sorgen machen, Bestellungen Wochen im Voraus zu planen. Du weißt ja, manchmal passieren unvorhergesehene Dinge, und wir sind dafür da! Mit unseren schnellen und zuverlässigen Lieferungen bist du fast jeden Tag der Woche abgesichert. Bestelle heute und voilà, morgen hast du diese Wunder servierbereit. ⏰',
        fr_CH: 'Avec nous, tu n\'as pas à te soucier de planifier les commandes des semaines à l\'avance. Tu sais comment c\'est, parfois les imprévus arrivent, et nous sommes là pour ça ! Avec nos livraisons rapides et fiables, tu es couvert presque chaque jour de la semaine. Commande aujourd\'hui et voilà, demain tu as ces merveilles prêtes à être servies. ⏰',
        en_US: 'With us, you don\'t have to worry about planning orders weeks in advance. You know how it is, sometimes unexpected things happen, and we\'re here for that! With our fast and reliable deliveries, you\'re covered almost every day of the week. Order today and voilà, tomorrow you\'ll have these wonders ready to be served. ⏰'
      };
    }
    else if (src.includes('E se pensi che ordinare sia una seccatura, ti dimostrerò il contrario')) {
      t[src] = {
        de_CH: 'Und wenn du denkst, Bestellen sei lästig, werde ich dir das Gegenteil beweisen. Unsere WEB APP ist so intuitiv und einfach zu bedienen, dass du deine Bestellung aufgibst, während du deinen Morgenkaffee schlürfst, ohne auch nur einen Schluck zu verpassen! ☕',
        fr_CH: 'Et si tu penses que commander c\'est une corvée, je te prouverai le contraire. Notre WEB APP est tellement intuitive et facile à utiliser que tu passeras ta commande en sirotant ton café du matin, sans perdre une seule gorgée ! ☕',
        en_US: 'And if you think ordering is a hassle, I\'ll prove you wrong. Our WEB APP is so intuitive and easy to use that you\'ll place your order while sipping your morning coffee, without missing a single sip! ☕'
      };
    }
    else if (src.includes('E sai una cosa? Qui da LAPA amiamo coccolare i nostri clienti')) {
      t[src] = {
        de_CH: 'Und weißt du was? Hier bei LAPA lieben wir es, unsere Kunden zu verwöhnen. Wir bieten dir nicht einfach eine Preisliste, sondern ein personalisiertes Erlebnis. Je nachdem wie viel und wie oft du unsere Tartelettes bestellst, bieten wir dir Preise, die dich denken lassen: "Warum habe ich nicht früher angefangen?" 💸',
        fr_CH: 'Et tu sais quoi ? Ici chez LAPA on adore chouchouter nos clients. On ne t\'offre pas une simple liste de prix, mais une expérience personnalisée. En fonction de combien et combien de fois tu commandes nos tartelettes, on te propose des prix qui te feront penser : "Pourquoi je n\'ai pas commencé plus tôt ?" 💸',
        en_US: 'And you know what? Here at LAPA we love to pamper our customers. We don\'t offer you just a price list, but a personalized experience. Based on how much and how often you order our tartlets, we offer you prices that\'ll make you think: "Why didn\'t I start earlier?" 💸'
      };
    }
    else if (src.includes('Ma non finisce qui. Sai quando ti senti un po\' perso')) {
      t[src] = {
        de_CH: 'Aber es hört hier nicht auf. Du weißt, wenn du dich etwas verloren fühlst und eine Hand brauchst? Unser Team ist immer bereit, dich zu unterstützen. Ob es ein Rat ist, wie du die Tartelettes am besten präsentierst, oder eine Frage zur Bestellung, wir sind für dich da. 📞',
        fr_CH: 'Mais ça ne s\'arrête pas là. Tu sais quand tu te sens un peu perdu et que tu as besoin d\'un coup de main ? Notre équipe est toujours prête à te soutenir. Que ce soit un conseil sur comment présenter au mieux les tartelettes ou une question sur la commande, on est là pour toi. 📞',
        en_US: 'But it doesn\'t end here. You know when you feel a bit lost and need a hand? Our team is always ready to support you. Whether it\'s advice on how to best present the tartlets or a question about the order, we\'re here for you. 📞'
      };
    }
    else if (src.includes('Ora parliamo un attimo di queste Tartellette Mignon')) {
      t[src] = {
        de_CH: 'Lass uns kurz über diese Mini-Tartelettes sprechen. Sie sind das perfekte Beispiel dafür, wie Qualität und Geschmack Hand in Hand gehen können. Leicht, knusprig und mit einer Füllung, die dir das Wasser im Mund zusammenlaufen lässt, sind sie perfekt für jeden Anlass, von einem eleganten Empfang bis zu einem geselligen Treffen unter Freunden. 🥳',
        fr_CH: 'Maintenant parlons un instant de ces Tartelettes Mignon. Elles sont l\'exemple parfait de comment qualité et goût peuvent aller de pair. Légères, croustillantes et avec une garniture qui te fera saliver, elles sont parfaites pour chaque occasion, d\'une réception élégante à une rencontre conviviale entre amis. 🥳',
        en_US: 'Now let\'s talk for a moment about these Mignon Tartlets. They\'re the perfect example of how quality and taste can go hand in hand. Light, crispy and with a filling that\'ll make your mouth water, they\'re perfect for every occasion, from an elegant reception to a friendly gathering among friends. 🥳'
      };
    }
    else if (src.includes('Allora, che ne pensi? Sei pronto a lasciarti sorprendere')) {
      t[src] = {
        de_CH: 'Also, was denkst du? Bist du bereit, dich überraschen zu lassen und deine Kunden mit diesen kleinen aber mächtigen Köstlichkeiten zu überraschen?',
        fr_CH: 'Alors, qu\'en penses-tu ? Tu es prêt à te laisser surprendre et à surprendre tes clients avec ces petites mais puissantes délices ?',
        en_US: 'So, what do you think? Are you ready to be surprised and to surprise your customers with these small but powerful delights?'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 49: TARTELLETTE MIGNON ===\n');

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

  console.log('\n✅ ARTICOLO 49 COMPLETATO!');
}

main();
