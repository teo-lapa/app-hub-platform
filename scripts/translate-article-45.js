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

const POST_ID = 45;

const TITLE_TRANSLATIONS = {
  it_IT: "Scopri il Segreto dei Pinoli: Un'Esplosione di Gusto che Rivoluzionerà la Tua Cucina! 🔥🌿\"",
  de_CH: "Entdecke das Geheimnis der Pinienkerne: Eine Geschmacksexplosion, die deine Küche revolutionieren wird! 🔥🌿",
  fr_CH: "Découvre le Secret des Pignons de Pin : Une Explosion de Goût qui Révolutionnera ta Cuisine ! 🔥🌿",
  en_US: "Discover the Secret of Pine Nuts: A Flavor Explosion That Will Revolutionize Your Kitchen! 🔥🌿"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Ciao amico gastronomo! 🌟 Sei pronto a lasciarti travolgere')) {
      t[src] = {
        de_CH: 'Hallo Gastronomie-Freund! 🌟 Bist du bereit, dich von einer Geschmacksexplosion mitreißen zu lassen, die deine kulinarische Welt revolutionieren wird? Binde die Schürze um, öffne die Augen weit und mach dich bereit, das Geheimnis zu entdecken, das jeder Koch, Pizzabäcker und Meister der Gastronomie in seinem Arsenal haben sollte: die PINIENKERNE!',
        fr_CH: 'Salut ami gastronome ! 🌟 Tu es prêt à te laisser emporter par une explosion de goût qui révolutionnera ton monde culinaire ? Attache ton tablier, ouvre bien les yeux et prépare-toi à découvrir le secret que chaque chef, pizzaïolo et maître de la gastronomie devrait avoir dans son arsenal : les PIGNONS DE PIN !',
        en_US: 'Hello gastronome friend! 🌟 Are you ready to be swept away by a flavor explosion that will revolutionize your culinary world? Tie on your apron, open your eyes wide and get ready to discover the secret that every chef, pizza maker and gastronomy master should have in their arsenal: PINE NUTS!'
      };
    }
    else if (src.includes('Immagina di avere l\'ingrediente magico che esalta ogni piatto')) {
      t[src] = {
        de_CH: 'Stell dir vor, du hast die magische Zutat, die jedes Gericht aufwertet und das Gewöhnliche ins Außergewöhnliche verwandelt! Unsere Pinienkerne sind das goldene Ticket, das die Türen zu einem Reich öffnet, wo Qualität auf Tradition trifft. Verpackt in praktischen 1 kg Beuteln, bieten sie dir die Freiheit, deine Kreativität grenzenlos zu entfalten! 🚀',
        fr_CH: 'Imagine avoir l\'ingrédient magique qui sublime chaque plat, transformant l\'ordinaire en extraordinaire ! Nos pignons de pin sont le ticket d\'or qui ouvre les portes d\'un royaume où la qualité rencontre la tradition. Conditionnés en sachets pratiques de 1 kg, ils t\'offrent la liberté de libérer ta créativité sans limites ! 🚀',
        en_US: 'Imagine having the magic ingredient that enhances every dish, transforming the ordinary into extraordinary! Our pine nuts are the golden ticket that opens the doors to a realm where quality meets tradition. Packaged in practical 1 kg bags, they offer you the freedom to unleash your creativity without limits! 🚀'
      };
    }
    else if (src.includes('E ora, tenetevi forte, perché con LAPA, ordinare è come far scorrere')) {
      t[src] = {
        de_CH: 'Und jetzt halt dich fest, denn mit LAPA ist Bestellen wie Olivenöl in eine heiße Pfanne zu gießen: flüssig, schnell und super einfach! 🍳 Hast du vergessen, Pinienkerne für deine nächste kulinarische Kreation zu bestellen? Keine Angst! Bestelle heute, und wie durch Magie werden die Pinienkerne morgen in deiner Küche sein. 🚚💨',
        fr_CH: 'Et maintenant, tiens-toi bien, parce qu\'avec LAPA, commander c\'est comme faire couler l\'huile d\'olive extra vierge dans une poêle brûlante : fluide, rapide et super simple ! 🍳 Tu as oublié de commander les pignons pour ta prochaine création culinaire ? Pas de panique ! Commande aujourd\'hui, et comme par magie, les pignons seront dans ta cuisine demain. 🚚💨',
        en_US: 'And now, hold tight, because with LAPA, ordering is like pouring extra virgin olive oil into a hot pan: fluid, fast and super simple! 🍳 Forgot to order pine nuts for your next culinary creation? No fear! Order today, and like magic, the pine nuts will be in your kitchen tomorrow. 🚚💨'
      };
    }
    else if (src.includes('"Ma avrò ordinato abbastanza?", ti chiederai')) {
      t[src] = {
        de_CH: '"Aber habe ich genug bestellt?", fragst du dich. Freund, vergiss das Dilemma des Mindestbestellwerts! Bei LAPA ist das Motto FREIHEIT. Bestelle so viel du willst, wann du willst, ohne Sorgen! 🌈',
        fr_CH: '"Mais est-ce que j\'ai commandé assez ?", tu te demanderas. Ami, oublie le dilemme du minimum de commande ! Avec LAPA, le mot d\'ordre est LIBERTÉ. Commande ce que tu veux, quand tu veux, sans te prendre la tête ! 🌈',
        en_US: '"But did I order enough?", you\'ll wonder. Friend, forget the minimum order dilemma! With LAPA, the keyword is FREEDOM. Order as much as you want, whenever you want, worry-free! 🌈'
      };
    }
    else if (src.includes('E vuoi sapere un altro trucco che abbiamo nella manica?')) {
      t[src] = {
        de_CH: 'Und willst du noch einen Trick wissen, den wir im Ärmel haben? Lieferungen 6 Tage die Woche! Ja, du hast richtig gehört. Jeden Tag, außer sonntags, stehen wir dir voll zur Verfügung, bereit, dir das Beste direkt zu dir nach Hause zu liefern. 🚀',
        fr_CH: 'Et tu veux connaître un autre tour qu\'on a dans notre manche ? Livraisons 6 jours sur 7 ! Oui, tu as bien compris. Chaque jour, sauf le dimanche, nous sommes à ta disposition complète, prêts à te servir le meilleur directement chez toi. 🚀',
        en_US: 'And want to know another trick we have up our sleeve? Deliveries 6 days a week! Yes, you heard right. Every day, except Sunday, we\'re at your complete disposal, ready to serve you the best directly to your home. 🚀'
      };
    }
    else if (src.includes('Ma non finisce qui! Con la nostra super APP')) {
      t[src] = {
        de_CH: 'Aber das ist noch nicht alles! Mit unserer super APP kannst du mit einem Klick bestellen, wo immer du bist, und dich wie ein VIP in der Welt der Gastronomie fühlen! 🌟',
        fr_CH: 'Mais ça ne s\'arrête pas là ! Avec notre super APP, tu peux commander en un clic, où que tu sois, te sentant comme un VIP dans le monde de la restauration ! 🌟',
        en_US: 'But it doesn\'t end here! With our super APP, you can order with a click, wherever you are, making you feel like a VIP in the world of gastronomy! 🌟'
      };
    }
    else if (src.includes('Allora, sei pronto a dare il benvenuto ai nostri straordinari pinoli')) {
      t[src] = {
        de_CH: 'Also, bist du bereit, unsere außergewöhnlichen Pinienkerne in deiner Küche willkommen zu heißen und dich vom unvergleichlichen Service von LAPA begeistern zu lassen? Hinterlasse einen Kommentar und teile deine Erfahrung! 🌿🔥',
        fr_CH: 'Alors, tu es prêt à accueillir nos extraordinaires pignons de pin dans ta cuisine et à te laisser surprendre par le service sans égal de LAPA ? Laisse un commentaire et partage ton expérience ! 🌿🔥',
        en_US: 'So, are you ready to welcome our extraordinary pine nuts into your kitchen and be amazed by LAPA\'s unmatched service? Leave a comment and share your experience! 🌿🔥'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 45: PINOLI ===\n');

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

  console.log('\n✅ ARTICOLO 45 COMPLETATO!');
}

main();
