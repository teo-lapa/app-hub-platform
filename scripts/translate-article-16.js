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

const POST_ID = 16;

const TITLE_TRANSLATIONS = {
  it_IT: "Amarene Sciroppate da Urlo: Il Gusto che Stavi Cercando! 😋🍒🎉",
  de_CH: "Sensationelle Amarena-Kirschen im Sirup: Der Geschmack, den Sie gesucht haben! 😋🍒🎉",
  fr_CH: "Griottes au Sirop Exceptionnelles : Le Goût que Vous Recherchiez ! 😋🍒🎉",
  en_US: "Amazing Sour Cherries in Syrup: The Taste You Were Looking For! 😋🍒🎉"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Ciao amici della gastronomia')) {
      t[src] = {
        de_CH: 'Hallo Freunde der Gastronomie! 😋 LAPA ist zurück mit einer köstlichen Neuheit, die Sie sich die Finger lecken lässt! 🤤 Wir präsentieren Ihnen die AMARENA-KIRSCHEN IM SIRUP',
        fr_CH: 'Salut les amis de la gastronomie ! 😋 LAPA est de retour avec une nouveauté délicieuse qui vous fera vous lécher les babines ! 🤤 Nous vous présentons les GRIOTTES AU SIROP',
        en_US: 'Hello friends of gastronomy! 😋 LAPA is back with a delicious novelty that will make you lick your lips! 🤤 We present to you SOUR CHERRIES IN SYRUP'
      };
    }
    else if (src.includes('Siete stanchi delle solite amarene')) {
      t[src] = {
        de_CH: 'Sind Sie die üblichen minderwertigen Kirschen leid, die eher wie Kaugummi als Obst schmecken? Hier ist die Lösung für Sie! Diese Sirup-Köstlichkeiten werden Sie beim ersten Bissen verlieben. Perfekt für Desserts, Cocktails und vieles mehr.',
        fr_CH: 'Vous en avez assez des griottes habituelles de mauvaise qualité qui ressemblent plus à des chewing-gums qu\'à des fruits ? Voici la solution pour vous ! Ces délices au sirop vous feront tomber amoureux dès la première bouchée. Parfaites pour les desserts, cocktails et bien plus.',
        en_US: 'Are you tired of the usual low-quality sour cherries that seem more like chewing gum than fruit? Here\'s the solution for you! These syrupy delights will make you fall in love at first bite. Perfect for desserts, cocktails and much more.'
      };
    }
    else if (src.includes('Perché scegliere le nostre amarene')) {
      t[src] = {
        de_CH: 'Warum unsere Kirschen wählen? Ganz einfach, Freund! Weil LAPA sich verpflichtet, Ihnen nur das Beste zu liefern, und diese Kirschen sind der Beweis! 😎',
        fr_CH: 'Pourquoi choisir nos griottes ? Simple, ami ! Parce que LAPA s\'engage à vous fournir uniquement le meilleur, et ces griottes en sont la preuve ! 😎',
        en_US: 'Why choose our sour cherries? Simple, friend! Because LAPA is committed to providing you only the best, and these cherries are the proof! 😎'
      };
    }
    else if (src.includes('Ma basta chiacchiere')) {
      t[src] = {
        de_CH: 'Aber genug geredet, kommen wir zu den Stärken unseres Unternehmens, die dieses Angebot noch attraktiver machen! 🌟',
        fr_CH: 'Mais assez de bavardages, passons aux points forts de notre entreprise, qui rendent cette offre encore plus alléchante ! 🌟',
        en_US: 'But enough talk, let\'s move on to the strengths of our company, which make this offer even more enticing! 🌟'
      };
    }
    else if (src.includes('Consegne 6 su 7')) {
      t[src] = {
        de_CH: '🚚 Lieferungen 6 von 7: Ob Sie ein Restaurant, eine Pizzeria oder eine Bar haben, wir wissen, dass Sie die Kirschen schnell brauchen! Bestellen Sie heute, und morgen haben Sie sie direkt in Ihrer Küche! Und übrigens, kein Mindestbestellwert!',
        fr_CH: '🚚 Livraisons 6 sur 7 : Que vous ayez un restaurant, une pizzeria ou un pub, nous savons que vous avez besoin des griottes rapidement ! Commandez aujourd\'hui, et demain vous les aurez directement dans votre cuisine ! Et, d\'ailleurs, pas de minimum de commande !',
        en_US: '🚚 Deliveries 6 out of 7: Whether you have a restaurant, pizzeria or pub, we know you need the cherries fast! Order today, and tomorrow you\'ll have them right in your kitchen! And, by the way, no minimum order!'
      };
    }
    else if (src.includes('APP per ordini')) {
      t[src] = {
        de_CH: '📱 APP für Bestellungen: Bestellen bei LAPA ist so einfach wie ein Glas Wasser zu trinken... oder besser gesagt, einen Spritz mit Kirschen! 🍸 Laden Sie unsere praktische WEB APP herunter, geben Sie Ihre Bestellung auf und behalten Sie alles unter Kontrolle!',
        fr_CH: '📱 APP pour commandes : Commander avec LAPA est aussi facile que boire un verre d\'eau... ou mieux, un spritz aux griottes ! 🍸 Téléchargez notre très pratique WEB APP, passez votre commande et gardez tout sous contrôle !',
        en_US: '📱 APP for orders: Ordering with LAPA is as easy as drinking a glass of water... or better, a spritz with cherries! 🍸 Download our convenient WEB APP, place your order and keep everything under control!'
      };
    }
    else if (src.includes('I prodotti che tu vuoi')) {
      t[src] = {
        de_CH: '🛍️ Die Produkte, die Sie wollen: Wir begnügen uns nicht mit den üblichen Marken! Wir suchen, importieren und liefern ALLES, was Sie brauchen, genau wie diese spektakulären Kirschen! 💪',
        fr_CH: '🛍️ Les produits que vous voulez : Nous ne nous contentons pas des marques habituelles ! Nous cherchons, importons et livrons TOUT ce dont vous avez besoin, exactement comme ces griottes spectaculaires ! 💪',
        en_US: '🛍️ The products you want: We don\'t settle for the usual brands! We search, import and deliver EVERYTHING you need, just like these spectacular cherries! 💪'
      };
    }
    else if (src.includes('Assistenza dedicata')) {
      t[src] = {
        de_CH: '👨‍💼 Dedizierte Unterstützung: Haben Sie ein Problem oder eine Frage zu den Kirschen oder zu etwas anderem? Schreiben Sie uns oder rufen Sie uns an, ein Berater ist immer bereit, Ihnen zu helfen! Wir sind wie die erweiterte Familie, von der Sie nicht wussten, dass Sie sie wollten!',
        fr_CH: '👨‍💼 Assistance dédiée : Vous avez un problème ou une question sur les griottes ou autre chose ? Écrivez-nous ou appelez-nous, un conseiller est toujours prêt à vous aider ! Nous sommes comme la famille élargie que vous ne saviez pas que vous vouliez !',
        en_US: '👨‍💼 Dedicated assistance: Have a problem or question about the cherries or something else? Write to us or call us, a consultant is always ready to help you! We\'re like the extended family you didn\'t know you wanted!'
      };
    }
    else if (src.includes('Non aspettare un minuto di più')) {
      t[src] = {
        de_CH: 'Warten Sie keine Minute länger, Freund! Tun Sie sich einen Gefallen und bestellen Sie sofort diese AMARENA-KIRSCHEN IM SIRUP! Ihre Küche und Ihre Kunden werden es Ihnen danken! 🎉',
        fr_CH: 'N\'attendez pas une minute de plus, ami ! Faites-vous une faveur et commandez tout de suite ces GRIOTTES AU SIROP ! Votre cuisine et vos clients vous remercieront ! 🎉',
        en_US: 'Don\'t wait another minute, friend! Do yourself a favor and order these SOUR CHERRIES IN SYRUP right away! Your kitchen and your customers will thank you! 🎉'
      };
    }
    else if (src.includes('Alla prossima, buona cucina')) {
      t[src] = {
        de_CH: 'Bis zum nächsten Mal, gutes Kochen und viel Spaß mit LAPA, Ihrer Quelle für gastronomische Produkte und gute Laune! 😜👋',
        fr_CH: 'À la prochaine, bonne cuisine et amusez-vous bien avec LAPA, votre source de produits gastronomiques et de bonne humeur ! 😜👋',
        en_US: 'Until next time, happy cooking and have fun with LAPA, your source of gastronomic products and good mood! 😜👋'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 16: AMARENE SCIROPPATE ===\n');

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

  console.log('\n✅ ARTICOLO 16 COMPLETATO!');
}

main();
