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

const POST_ID = 50;

const TITLE_TRANSLATIONS = {
  it_IT: "Tuorlo d'Uovo Rosso Più AIA: La Rivoluzione in Cucina che Non Sapevi di Avere Bisogno!",
  de_CH: "Rotes Eigelb Plus AIA: Die Küchenrevolution, die du nicht wusstest, dass du sie brauchst!",
  fr_CH: "Jaune d'Œuf Rouge Plus AIA : La Révolution en Cuisine dont tu Ne Savais pas avoir Besoin !",
  en_US: "Red Egg Yolk Plus AIA: The Kitchen Revolution You Didn't Know You Needed!"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Oggi ti svelo un segreto che cambierà per sempre il tuo modo di cucinare')) {
      t[src] = {
        de_CH: 'Heute verrate ich dir ein Geheimnis, das deine Art zu kochen für immer verändern wird. Es heißt ROTES EIGELB PLUS AIA, und glaub mir, es ist der Wahnsinn! 😜',
        fr_CH: 'Aujourd\'hui je te révèle un secret qui changera pour toujours ta façon de cuisiner. Ça s\'appelle JAUNE D\'ŒUF ROUGE PLUS AIA, et fais-moi confiance, c\'est un truc de ouf ! 😜',
        en_US: 'Today I\'m revealing a secret that will change your way of cooking forever. It\'s called RED EGG YOLK PLUS AIA, and trust me, it\'s crazy stuff! 😜'
      };
    }
    else if (src.includes('Prima di tutto, lascia che ti parli di questo tuorlo d\'oro')) {
      t[src] = {
        de_CH: 'Lass mich dir zunächst von diesem goldenen Eigelb erzählen. Das sind nicht die üblichen blassen und geschmacklosen Eigelbe, die du im Supermarkt findest. Nein, das sind Eigelbe in lebhaftem Rot, ein Geschmack, der dir im Mund explodiert, fast so, als hätten die Hühner eine Hochschule für Küche besucht! 🐔🎓',
        fr_CH: 'D\'abord, laisse-moi te parler de ce jaune d\'or. Ce ne sont pas les jaunes d\'œuf pâles et insipides habituels que tu trouves au supermarché. Non, ce sont des jaunes d\'un rouge vif, un goût qui t\'explose en bouche, presque comme si les poules avaient fréquenté une école de haute cuisine ! 🐔🎓',
        en_US: 'First of all, let me tell you about this golden yolk. These aren\'t the usual pale and tasteless yolks you find at the supermarket. No, these are yolks of a vivid red, a taste that explodes in your mouth, almost as if the hens had attended a high-end culinary school! 🐔🎓'
      };
    }
    else if (src.includes('Ora, so cosa stai pensando: "Ma come faccio a mettere le mani su questa meraviglia?"')) {
      t[src] = {
        de_CH: 'Jetzt weiß ich, was du denkst: "Aber wie bekomme ich dieses Wunder in die Hände?" Keine Sorge, LAPA kümmert sich darum! Lieferung? Schneller als ein Jogger im Park. Hast du vergessen zu bestellen? Kein Problem, bestelle heute und morgen liegt dieser Schatz vor deiner Haustür. 🚚💨',
        fr_CH: 'Maintenant, je sais ce que tu penses : "Mais comment je mets la main sur cette merveille ?" Tranquille, LAPA s\'en charge ! Livraison ? Plus rapide qu\'un coureur au parc. Tu as oublié de commander ? Pas de problème, commande aujourd\'hui et demain tu retrouves ce trésor à ta porte. 🚚💨',
        en_US: 'Now, I know what you\'re thinking: "But how do I get my hands on this wonder?" Relax, LAPA takes care of it! Delivery? Faster than a runner in the park. Forgot to order? No problem, order today and tomorrow this treasure will be at your door. 🚚💨'
      };
    }
    else if (src.includes('E per la parte migliore: con LAPA, sei tu il boss')) {
      t[src] = {
        de_CH: 'Und jetzt der beste Teil: mit LAPA bist du der Boss. Brauchst du ein paar von diesen außergewöhnlichen Eigelben? Bestelle sie wie und wann du willst über unsere WEB APP, die so intuitiv ist, dass sogar dein Opa sie benutzen könnte. Und ja, wir haben auch an V.I.P.-Services gedacht, denn komm schon, wer will sich nicht ein bisschen wie ein Star fühlen? 🌟',
        fr_CH: 'Et pour le meilleur : avec LAPA, c\'est toi le boss. Tu as besoin de quelques-uns de ces jaunes extraordinaires ? Commande-les comme et quand tu veux depuis notre WEB APP, qui est tellement intuitive que même ton grand-père pourrait l\'utiliser. Et oui, on a aussi pensé aux services V.I.P. parce que, allez, qui ne veut pas se sentir un peu star ? 🌟',
        en_US: 'And for the best part: with LAPA, you\'re the boss. Need some of these extraordinary yolks? Order them how and when you want from our WEB APP, which is so intuitive that even your grandpa could use it. And yes, we\'ve also thought about V.I.P. services because, come on, who doesn\'t want to feel like a star? 🌟'
      };
    }
    else if (src.includes('E se sei nel panico perché non sai come usare al meglio questi tuorli super')) {
      t[src] = {
        de_CH: 'Und wenn du in Panik bist, weil du nicht weißt, wie du diese Super-Eigelbe am besten verwendest, ruf unser Team an. Ja, genau, wir haben ein dediziertes Support-Team, bereit dir aus der Patsche zu helfen... oder aus den Eiern! 🆘🥚',
        fr_CH: 'Et si tu paniques parce que tu ne sais pas comment utiliser au mieux ces super jaunes, appelle notre équipe. Oui, exactement, on a une équipe d\'assistance dédiée, prête à t\'aider à sortir des ennuis... ou des œufs ! 🆘🥚',
        en_US: 'And if you\'re panicking because you don\'t know how to best use these super yolks, call our team. Yes, that\'s right, we have a dedicated support team, ready to help you out of trouble... or out of eggs! 🆘🥚'
      };
    }
    else if (src.includes('Allora, cosa aspetti? Sfida la routine e porta la tua cucina')) {
      t[src] = {
        de_CH: 'Also, worauf wartest du? Fordere die Routine heraus und bringe deine Küche auf ein nie dagewesenes Niveau. Und wenn du dein Meisterwerk mit dem ROTEN EIGELB PLUS AIA zubereitest, vergiss nicht, deine Erfahrung zu teilen. Wir sind neugierig wie Katzen! 🐱👀',
        fr_CH: 'Alors, qu\'est-ce que tu attends ? Défie la routine et porte ta cuisine à un niveau jamais vu. Et quand tu feras ton chef-d\'œuvre avec le JAUNE D\'ŒUF ROUGE PLUS AIA, n\'oublie pas de partager ton expérience. On est curieux comme des chats ! 🐱👀',
        en_US: 'So, what are you waiting for? Challenge the routine and take your kitchen to a never-before-seen level. And when you make your masterpiece with RED EGG YOLK PLUS AIA, remember to share your experience. We\'re curious as cats! 🐱👀'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 50: TUORLO D\'UOVO ROSSO ===\n');

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

  console.log('\n✅ ARTICOLO 50 COMPLETATO!');
}

main();
