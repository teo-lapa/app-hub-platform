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

const POST_ID = 23;

const TITLE_TRANSLATIONS = {
  it_IT: "🍫🇮🇹 Cialde Scure Mignon: Il segreto per Cannoli Siciliani da urlo! 🎉",
  de_CH: "🍫🇮🇹 Dunkle Mignon-Waffeln: Das Geheimnis für unvergessliche sizilianische Cannoli! 🎉",
  fr_CH: "🍫🇮🇹 Gaufrettes Mignon Foncées : Le secret des Cannoli Siciliens à tomber ! 🎉",
  en_US: "🍫🇮🇹 Dark Mignon Wafers: The secret for amazing Sicilian Cannoli! 🎉"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Ciao amico della ristorazione')) {
      t[src] = {
        de_CH: 'Hallo Gastronomie-Freund! 👋 Heute sprechen wir über ein Produkt, das deine Kunden verrückt machen wird: die dunklen Mignon-Waffeln für sizilianische Cannoli. Ja, du hast richtig verstanden, wir sprechen von dieser knusprigen, schokoladigen Köstlichkeit, die die leckerste Füllung umhüllt, die du dir vorstellen kannst. 🤤',
        fr_CH: 'Salut ami de la restauration ! 👋 Aujourd\'hui nous parlons d\'un produit qui rendra tes clients fous : les Gaufrettes Mignon Foncées pour Cannoli Siciliens. Oui, tu as bien compris, nous parlons de ce délice croustillant et chocolaté qui enveloppe la garniture la plus gourmande que tu puisses imaginer. 🤤',
        en_US: 'Hello restaurant friend! 👋 Today we\'re talking about a product that will drive your customers crazy: the Dark Mignon Wafers for Sicilian Cannoli. Yes, you understood correctly, we\'re talking about that crispy, chocolatey delight that wraps the most delicious filling you can imagine. 🤤'
      };
    }
    else if (src.includes('Le Cialde Scure Mignon sono il biglietto da visita')) {
      t[src] = {
        de_CH: 'Die dunklen Mignon-Waffeln sind die Visitenkarte für einen echten sizilianischen Cannolo. Diese kleinen Wunder werden nach sizilianischer Tradition hergestellt, mit erstklassigen Zutaten und einem Produktionsprozess, der die Konditorkunst der Insel respektiert. 🏝️',
        fr_CH: 'Les Gaufrettes Mignon Foncées sont la carte de visite d\'un vrai cannoli sicilien. Ces petites merveilles sont réalisées selon la tradition sicilienne, avec des ingrédients de première qualité et un processus de production qui respecte l\'art pâtissier de l\'île. 🏝️',
        en_US: 'The Dark Mignon Wafers are the calling card for a proper Sicilian cannolo. These little wonders are made following Sicilian tradition, with top-quality ingredients and a production process that respects the island\'s pastry art. 🏝️'
      };
    }
    else if (src.includes('Le Cialde Scure Mignon per Cannoli Siciliani non sono solo un involucro')) {
      t[src] = {
        de_CH: 'Die dunklen Mignon-Waffeln für sizilianische Cannoli sind nicht nur eine Hülle, sondern ein grundlegendes Element, das dazu beiträgt, dieses Dessert zu einem einzigartigen Geschmackserlebnis zu machen. Die Zugabe von Kakao im Waffelteig verleiht ihnen nicht nur eine dunkle und ansprechende Farbe, sondern bereichert auch das Geschmacksprofil des Cannolo.',
        fr_CH: 'Les Gaufrettes Mignon Foncées pour Cannoli Siciliens ne sont pas seulement une enveloppe, mais un élément fondamental qui contribue à faire de ce dessert une expérience gustative unique. L\'ajout de cacao dans la pâte des gaufrettes ne leur donne pas seulement une couleur foncée et attrayante, mais enrichit également le profil de saveur du cannolo.',
        en_US: 'The Dark Mignon Wafers for Sicilian Cannoli are not just a wrapper, but a fundamental element that contributes to making this dessert a unique taste experience. The addition of cocoa in the wafer dough not only gives them a dark and attractive color, but also enriches the flavor profile of the cannolo.'
      };
    }
    else if (src.includes('Il cacao, con la sua nota leggermente amara')) {
      t[src] = {
        de_CH: 'Der Kakao, mit seiner leicht bitteren Note, schafft ein perfektes Gleichgewicht mit der Süße der Ricotta oder jeder anderen Füllung, die du verwendest. Dieser Geschmackskontrast macht jeden Bissen Cannolo zu einem vollständigen Geschmackserlebnis, bei dem Süß und Bitter zu einer perfekten Verbindung verschmelzen.',
        fr_CH: 'Le cacao, avec sa note légèrement amère, crée un équilibre parfait avec la douceur de la ricotta ou de toute autre garniture que tu choisis d\'utiliser. Ce contraste de saveurs fait de chaque bouchée de cannolo une expérience gustative complète, où le sucré et l\'amer fusionnent en une union parfaite.',
        en_US: 'The cocoa, with its slightly bitter note, creates a perfect balance with the sweetness of the ricotta or any other filling you choose to use. This contrast of flavors makes every bite of cannolo a complete taste experience, where sweet and bitter blend in a perfect union.'
      };
    }
    else if (src.includes('Inoltre, il cacao nell\'impasto delle cialde contribuisce')) {
      t[src] = {
        de_CH: 'Außerdem trägt der Kakao im Waffelteig dazu bei, die Textur des Cannolo noch interessanter zu machen. Die Kakaowaffeln haben nämlich eine besondere Knusprigkeit, die perfekt zur Cremigkeit der Füllung passt und einen Konsistenzkontrast schafft, der den Cannolo noch angenehmer zum Essen macht.',
        fr_CH: 'De plus, le cacao dans la pâte des gaufrettes contribue à rendre la texture du cannolo encore plus intéressante. Les gaufrettes au cacao ont en effet un croustillant particulier qui s\'harmonise parfaitement avec l\'onctuosité de la garniture, créant un contraste de textures qui rend le cannolo encore plus agréable à manger.',
        en_US: 'Furthermore, the cocoa in the wafer dough contributes to making the cannolo texture even more interesting. The cocoa wafers have a particular crispness that pairs perfectly with the creaminess of the filling, creating a contrast of textures that makes the cannolo even more enjoyable to eat.'
      };
    }
    else if (src.includes('In conclusione, le Cialde Scure Mignon per Cannoli Siciliani non sono solo un dettaglio')) {
      t[src] = {
        de_CH: 'Zusammenfassend sind die dunklen Mignon-Waffeln für sizilianische Cannoli nicht nur ein Detail, sondern ein Element, das wirklich den Unterschied bei der Zubereitung dieses Desserts ausmachen kann. Mit ihrem einzigartigen Geschmack und ihrer knusprigen Textur können sie deinen Cannolo von einem einfachen Dessert zu einem echten Geschmackserlebnis erheben.',
        fr_CH: 'En conclusion, les Gaufrettes Mignon Foncées pour Cannoli Siciliens ne sont pas seulement un détail, mais un élément qui peut vraiment faire la différence dans la préparation de ce dessert. Avec leur saveur unique et leur texture croustillante, elles sont capables d\'élever ton cannolo de simple dessert à véritable expérience gustative.',
        en_US: 'In conclusion, the Dark Mignon Wafers for Sicilian Cannoli are not just a detail, but an element that can truly make the difference in preparing this dessert. With their unique flavor and crispy texture, they are able to elevate your cannolo from a simple dessert to a true taste experience.'
      };
    }
    else if (src.includes('Ma sai qual è la cosa più bella')) {
      t[src] = {
        de_CH: 'Aber weißt du, was das Schönste ist? Dass diese Waffeln direkt zu dir kommen, ohne dass du einen Finger rühren musst. Und weißt du warum? Weil wir von LAPA für dich da sind. 🚚',
        fr_CH: 'Mais tu sais quelle est la plus belle chose ? Que ces gaufrettes arrivent directement chez toi, sans que tu aies à lever le petit doigt. Et tu sais pourquoi ? Parce que nous chez LAPA sommes là pour toi. 🚚',
        en_US: 'But do you know what the best part is? That these wafers come directly to you, without you having to lift a finger. And you know why? Because we at LAPA are here for you. 🚚'
      };
    }
    else if (src.includes('Hai dimenticato di ordinare le cialde per i tuoi cannoli')) {
      t[src] = {
        de_CH: 'Hast du vergessen, die Waffeln für deine Cannoli zu bestellen? Kein Problem! Mit unserem Service "Heute bestellen, morgen geliefert" garantieren wir, dass deine Waffeln rechtzeitig für deine nächste Cannoli-Charge ankommen. Und keine Sorge, wenn du keinen ganzen LKW voller Waffeln brauchst: bei uns gibt es keinen Mindestbestellwert. Bestelle was du willst, so viel du willst. 📦',
        fr_CH: 'Tu as oublié de commander les gaufrettes pour tes cannoli ? Pas de problème ! Avec notre service "Commande aujourd\'hui, livré demain", nous te garantissons que tes gaufrettes arriveront à temps pour ta prochaine fournée de cannoli. Et ne t\'inquiète pas si tu n\'as pas besoin d\'un camion entier de gaufrettes : chez nous, pas de minimum de commande. Commande ce que tu veux, autant que tu veux. 📦',
        en_US: 'Forgot to order the wafers for your cannoli? No problem! With our "Order today, delivered tomorrow" service, we guarantee your wafers will arrive in time for your next batch of cannoli. And don\'t worry if you don\'t need a whole truck of wafers: with us there\'s no minimum order. Order what you want, as much as you want. 📦'
      };
    }
    else if (src.includes('E se hai bisogno di un consiglio su come utilizzare al meglio')) {
      t[src] = {
        de_CH: 'Und wenn du einen Rat brauchst, wie du unsere dunklen Mignon-Waffeln am besten verwendest, oder wenn du ein Problem mit deiner Bestellung hast, zögere nicht, uns zu kontaktieren. Unsere dedizierte Unterstützung ist immer bereit, dir zu helfen. Weil du für uns ein VIP bist. 🌟',
        fr_CH: 'Et si tu as besoin d\'un conseil sur la meilleure façon d\'utiliser nos Gaufrettes Mignon Foncées, ou si tu as un problème avec ta commande, n\'hésite pas à nous contacter. Notre assistance dédiée est toujours prête à t\'aider. Parce que pour nous, tu es un VIP. 🌟',
        en_US: 'And if you need advice on how to best use our Dark Mignon Wafers, or if you have any problem with your order, don\'t hesitate to contact us. Our dedicated assistance is always ready to help you. Because for us, you\'re a VIP. 🌟'
      };
    }
    else if (src.includes('Quindi, cosa aspetti? Ordina subito le tue Cialde Scure Mignon')) {
      t[src] = {
        de_CH: 'Also, worauf wartest du? Bestelle jetzt deine dunklen Mignon-Waffeln für sizilianische Cannoli und mach deine Kunden glücklich. Und denk daran: mit LAPA stehst du immer an erster Stelle. 🥇',
        fr_CH: 'Alors, qu\'attends-tu ? Commande tout de suite tes Gaufrettes Mignon Foncées pour Cannoli Siciliens et rends tes clients heureux. Et rappelle-toi : avec LAPA, tu es toujours au premier rang. 🥇',
        en_US: 'So, what are you waiting for? Order your Dark Mignon Wafers for Sicilian Cannoli now and make your customers happy. And remember: with LAPA, you\'re always in first place. 🥇'
      };
    }
    else if (src.includes('P.S. Sei già un nostro cliente VIP')) {
      t[src] = {
        de_CH: 'P.S. Bist du schon ein VIP-Kunde bei uns? Dann lade unsere super praktische WEB APP herunter, um bequem und schnell zu bestellen, mit Bestellhistorie und Warenübersicht, Dokumenten und vielem mehr Nützlichem. Du bist noch kein VIP? Worauf wartest du, kontaktiere uns und entdecke alle Vorteile, die wir für dich reserviert haben! 📲',
        fr_CH: 'P.S. Tu es déjà un de nos clients VIP ? Alors télécharge notre très pratique WEB APP pour commander confortablement et rapidement, avec l\'historique des commandes et de la marchandise, les documents et bien d\'autres choses utiles. Tu n\'es pas encore VIP ? Qu\'attends-tu, contacte-nous et découvre tous les avantages que nous avons réservés pour toi ! 📲',
        en_US: 'P.S. Are you already a VIP customer with us? Then download our super convenient WEB APP to order comfortably and quickly, with order and goods history, documents and much more. Not a VIP yet? What are you waiting for, contact us and discover all the benefits we\'ve reserved for you! 📲'
      };
    }
    else if (src.includes('E ora, buona cucina e buon divertimento con le tue Cialde Scure Mignon')) {
      t[src] = {
        de_CH: 'Und jetzt, viel Spaß beim Kochen und Genießen mit deinen dunklen Mignon-Waffeln für sizilianische Cannoli! 🎉🍫🇮🇹',
        fr_CH: 'Et maintenant, bonne cuisine et bon amusement avec tes Gaufrettes Mignon Foncées pour Cannoli Siciliens ! 🎉🍫🇮🇹',
        en_US: 'And now, happy cooking and have fun with your Dark Mignon Wafers for Sicilian Cannoli! 🎉🍫🇮🇹'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 23: CIALDE SCURE MIGNON ===\n');

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

  console.log('\n✅ ARTICOLO 23 COMPLETATO!');
}

main();
