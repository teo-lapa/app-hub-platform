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

const POST_ID = 54;

const TITLE_TRANSLATIONS = {
  it_IT: "🔥 Il Prosciutto di Parma che fa impazzire tutti - Sei Pronto a Sfatare i Miti? 🐷",
  de_CH: "🔥 Der Parmaschinken, der alle verrückt macht - Bist du bereit, Mythen zu brechen? 🐷",
  fr_CH: "🔥 Le Jambon de Parme qui Rend Tout le Monde Fou - Tu es Prêt à Briser les Mythes ? 🐷",
  en_US: "🔥 The Parma Ham That Drives Everyone Crazy - Ready to Bust Some Myths? 🐷"
};

const SUBTITLE_TRANSLATIONS = {
  it_IT: "Ehi, sì proprio tu! Hai mai provato un Prosciutto di Parma che ti fa dire \"Mamma mia!\" ad ogni morso? No, non sto scherzando. Sto parlando del Prosciutto di Parma disossato Addobbo da LAPA, un colosso da 7.5 kg che è più di un semplice affettato, è una dichiarazione d'amore all'arte culinaria italiana! 🇮🇹",
  de_CH: "Hey, ja genau du! Hast du jemals einen Parmaschinken probiert, der dich bei jedem Bissen \"Mamma mia!\" sagen lässt? Nein, ich scherze nicht. Ich spreche vom entbeinten Parmaschinken Addobbo von LAPA, ein Koloss von 7,5 kg, der mehr als nur ein Aufschnitt ist - es ist eine Liebeserklärung an die italienische Kochkunst! 🇮🇹",
  fr_CH: "Hé, oui toi ! Tu as déjà goûté un Jambon de Parme qui te fait dire \"Mamma mia !\" à chaque bouchée ? Non, je ne plaisante pas. Je parle du Jambon de Parme désossé Addobbo de LAPA, un colosse de 7,5 kg qui est plus qu'une simple charcuterie, c'est une déclaration d'amour à l'art culinaire italien ! 🇮🇹",
  en_US: "Hey, yes you! Have you ever tried a Parma Ham that makes you say \"Mamma mia!\" with every bite? No, I'm not kidding. I'm talking about LAPA's boneless Parma Ham Addobbo, a 7.5 kg colossus that's more than just a cold cut - it's a declaration of love to Italian culinary art! 🇮🇹"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Lasciami indovinare, sei abituato a quei prosciutti così-così')) {
      t[src] = {
        de_CH: 'Lass mich raten, du bist diese so-lala-Schinken gewohnt, die alle gleich aussehen, oder? Vertrau mir, nachdem du unseren probiert hast, wirst du diesen Billigschinken Lebewohl sagen. Das ist das echte Geschäft, ein Konzentrat aus Geschmack, Tradition und... nun ja, reiner italienischer Magie! ✨',
        fr_CH: 'Laisse-moi deviner, tu es habitué à ces jambons comme-ci comme-ça qui semblent tous pareils, pas vrai ? Fais-moi confiance, après avoir goûté le nôtre, tu diras adieu à ces petits jambons de quatre sous. C\'est la vraie affaire, un concentré de goût, de tradition et... eh bien, de pure magie italienne ! ✨',
        en_US: 'Let me guess, you\'re used to those so-so hams that all look the same, right? Trust me, after trying ours, you\'ll say goodbye to those cheap hams. This is the real deal, a concentrate of taste, tradition and... well, pure Italian magic! ✨'
      };
    }
    else if (src.includes('E non è solo una questione di sapore. Con LAPA')) {
      t[src] = {
        de_CH: 'Und es geht nicht nur um den Geschmack. Mit LAPA ist das Einkaufserlebnis genauso köstlich wie der Schinken selbst. Schnelle Lieferungen 6 Tage die Woche, weil Warten nervt, oder? Und unsere Web App ist so einfach zu bedienen, dass sogar meine Oma eine Bestellung aufgeben könnte! 😎',
        fr_CH: 'Et ce n\'est pas qu\'une question de saveur. Avec LAPA, l\'expérience d\'achat est tout aussi exquise que le jambon lui-même. Livraisons rapides 6 jours sur 7, parce qu\'attendre c\'est chiant, pas vrai ? Et notre Web App est tellement facile à utiliser que même ma grand-mère pourrait passer commande ! 😎',
        en_US: 'And it\'s not just about flavor. With LAPA, the shopping experience is just as exquisite as the ham itself. Fast deliveries 6 days a week, because waiting is a pain, right? And our Web App is so easy to use that even my grandma could place an order! 😎'
      };
    }
    else if (src.includes('Sei un cliente VIP, lo sapevi? Noi di LAPA non ci accontentiamo')) {
      t[src] = {
        de_CH: 'Du bist ein VIP-Kunde, wusstest du das? Wir bei LAPA geben uns nicht damit zufrieden, dich wie eine Nummer zu behandeln. Wir bieten einen Service, der dich wie den König (oder die Königin) fühlen lässt, der du bist.',
        fr_CH: 'Tu es un client VIP, tu le savais ? Nous chez LAPA on ne se contente pas de te traiter comme un numéro. On offre un service qui te fait sentir comme le roi (ou la reine) que tu es.',
        en_US: 'You\'re a VIP customer, did you know that? At LAPA we don\'t settle for treating you like a number. We offer a service that makes you feel like the king (or queen) that you are.'
      };
    }
    else if (src.includes('che sei. Prezzi personalizzati, zero limiti di ordine')) {
      t[src] = {
        de_CH: 'Personalisierte Preise, keine Bestellgrenzen (ja, du hast richtig gelesen!), und ein Support-Team, das immer bereit ist, dir zu helfen, auch wenn du nur über die beste Art plaudern willst, den Schinken zu servieren. 🍖👑',
        fr_CH: 'Prix personnalisés, zéro limite de commande (oui, tu as bien lu !), et une équipe d\'assistance toujours prête à te donner un coup de main, même si tu as juste envie de papoter sur la meilleure façon de servir le jambon. 🍖👑',
        en_US: 'Customized prices, zero order limits (yes, you read that right!), and a support team that\'s always ready to give you a hand, even if you just want to chat about the best way to serve ham. 🍖👑'
      };
    }
    else if (src.includes('Ma torniamo al protagonista, il nostro Prosciutto di Parma')) {
      t[src] = {
        de_CH: 'Aber zurück zum Hauptdarsteller, unserem Parmaschinken. Das ist nicht der übliche Aufschnitt aus dem Supermarkt. Er ist wie der Brad Pitt unter den Schinken, aber viel geschmackvoller und weniger in den Klatschspalten. Er ist entbeint, was bedeutet, dass du ihn schneiden kannst, wie du willst, ohne dich mit diesem nervigen Knochen herumzuärgern. Und der Geschmack? Meine Güte, es ist wie eine Reise in die Hügel von Parma mit jedem Bissen. 🌄',
        fr_CH: 'Mais revenons au protagoniste, notre Jambon de Parme. Ce n\'est pas la charcuterie habituelle que tu trouves au supermarché. C\'est comme le Brad Pitt des jambons, mais beaucoup plus savoureux et moins médiatisé. Il est désossé, ce qui signifie que tu peux le trancher comme tu veux, sans te prendre la tête avec cet os embêtant. Et le goût ? Mon Dieu, c\'est comme un voyage dans les collines de Parme à chaque bouchée. 🌄',
        en_US: 'But let\'s get back to the star, our Parma Ham. This isn\'t the usual deli meat you find at the supermarket. It\'s like the Brad Pitt of hams, but much tastier and less talked about. It\'s boneless, which means you can slice it however you want, without messing around with that annoying bone. And the taste? Oh my, it\'s like a trip to the Parma hills with every bite. 🌄'
      };
    }
    else if (src.includes('E se ti dimentichi di ordinare? Tranquillo, sei coperto')) {
      t[src] = {
        de_CH: 'Und wenn du vergisst zu bestellen? Keine Sorge, du bist abgesichert. Bestelle heute und es kommt morgen an. So kannst du weiter deine Arbeit als Koch machen, ohne Unterbrechungen, wie der Küchenboss, der du bist. 😉',
        fr_CH: 'Et si tu oublies de commander ? Tranquille, t\'es couvert. Commande aujourd\'hui et ça arrive demain. Comme ça tu peux continuer à faire ton travail de chef sans interruptions, comme le boss de la cuisine que tu es. 😉',
        en_US: 'And if you forget to order? Relax, you\'re covered. Order today and it arrives tomorrow. So you can keep doing your chef work without interruptions, like the kitchen boss you are. 😉'
      };
    }
    else if (src.includes('Ora, voglio vederti all\'opera. Prova questo capolavoro')) {
      t[src] = {
        de_CH: 'Jetzt will ich dich in Aktion sehen. Probiere dieses Schinken-Meisterwerk und sag mir, ob es nicht der beste Schinken ist, den du je gegessen hast. Ich wette einen Teller Spaghetti mit Tomatensoße, dass du nicht mehr ohne leben kannst. 🍝',
        fr_CH: 'Maintenant, je veux te voir à l\'œuvre. Essaie ce chef-d\'œuvre de jambon et dis-moi si ce n\'est pas le meilleur jambon que tu aies jamais mangé. Je parie un plat de spaghetti à la tomate que tu ne pourras plus t\'en passer. 🍝',
        en_US: 'Now, I want to see you in action. Try this ham masterpiece and tell me if it\'s not the best ham you\'ve ever eaten. I bet a plate of spaghetti with tomato sauce that you won\'t be able to live without it. 🍝'
      };
    }
    else if (src.includes('Che aspetti? Dai un\'occhiata, ordina e preparati')) {
      t[src] = {
        de_CH: 'Worauf wartest du? Schau es dir an, bestelle und mach dich bereit für ein Geschmackserlebnis, das dich sagen lässt "Warum habe ich das nicht früher probiert?".',
        fr_CH: 'Qu\'est-ce que tu attends ? Jette un œil, commande et prépare-toi à vivre une expérience gustative qui te fera dire "Pourquoi je ne l\'ai pas essayé avant ?".',
        en_US: 'What are you waiting for? Take a look, order and get ready to live a taste experience that\'ll make you say "Why didn\'t I try this before?".'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 54: PROSCIUTTO DI PARMA ===\n');

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

  console.log('\n✅ ARTICOLO 54 COMPLETATO!');
}

main();
