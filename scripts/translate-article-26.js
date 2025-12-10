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

const POST_ID = 26;

const TITLE_TRANSLATIONS = {
  it_IT: "Cime di Rapa Surgelate? Ma stai scherzando? 😲🥦",
  de_CH: "Tiefgekühlte Steckrübenspitzen? Machst du Witze? 😲🥦",
  fr_CH: "Cimes de Navet Surgelées ? Tu plaisantes ? 😲🥦",
  en_US: "Frozen Turnip Tops? Are you kidding? 😲🥦"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Ciao! Sì, proprio a te che stai leggendo')) {
      t[src] = {
        de_CH: 'Hallo! Ja, genau du, der das hier liest. Ich habe eine Nachricht, die dich vom Stuhl springen lassen könnte! 😱 Bereit, etwas Revolutionäres zu hören? Schnall dich an und bereite dich auf eine Geschmacksreise vor. Heute sprechen wir über die tiefgekühlten Steckrübenspitzen Spirito Contadino. "Tiefgekühlt?" wirst du sagen, "Was redest du da? Die können nie wie frische sein!" 👀',
        fr_CH: 'Salut ! Oui, c\'est bien à toi qui lis ça. J\'ai une nouvelle qui pourrait te faire sauter de ta chaise ! 😱 Prêt à entendre quelque chose de révolutionnaire ? Attache ta ceinture et prépare-toi à un voyage dans le goût. Aujourd\'hui nous parlons des Cimes de Navet Surgelées Spirito Contadino. "Surgelées ?" diras-tu, "Mais qu\'est-ce que tu racontes ? Elles ne peuvent jamais être comme les fraîches !" 👀',
        en_US: 'Hello! Yes, you who are reading this. I have news that might make you jump off your chair! 😱 Ready to hear something revolutionary? Buckle up and get ready for a taste journey. Today we\'re talking about Frozen Turnip Tops Spirito Contadino. "Frozen?" you\'ll say, "What are you talking about? They can never be like fresh ones!" 👀'
      };
    }
    else if (src.includes('Ecco la sfida! 🚀 Sì, stiamo parlando delle vere')) {
      t[src] = {
        de_CH: 'Hier ist die Herausforderung! 🚀 Ja, wir sprechen von den echten, authentischen, geliebten Steckrübenspitzen, dem Stolz der apulischen Küche. Die, die dich von Orecchiette-Pasta träumen lassen und dich sagen lassen "wie lecker!". Und wir wissen, frische Steckrübenspitzen zu finden ist wie die Nadel im Heuhaufen zu suchen. Und wenn du sie findest, sind sie nie so wie die, die Oma gemacht hat, oder?',
        fr_CH: 'Voici le défi ! 🚀 Oui, nous parlons des vraies, authentiques, adorées Cimes de Navet, gloire de la cuisine des Pouilles. Celles qui te font rêver de pâtes orecchiette et te font dire "que c\'est bon !". Et nous le savons, trouver des cimes de navet fraîches c\'est comme chercher une aiguille dans une botte de foin. Et quand tu les trouves, elles ne sont jamais comme celles que préparait grand-mère, pas vrai ?',
        en_US: 'Here\'s the challenge! 🚀 Yes, we\'re talking about the real, authentic, beloved Turnip Tops, the glory of Apulian cuisine. The ones that make you dream of orecchiette pasta and make you say "how delicious!". And we know, finding fresh turnip tops is like looking for a needle in a haystack. And when you find them, they\'re never like the ones grandma used to make, right?'
      };
    }
    else if (src.includes('Ma ecco la nostra proposta che suona come una bestemmia')) {
      t[src] = {
        de_CH: 'Aber hier ist unser Vorschlag, der wie eine Gotteslästerung klingt: Tiefgekühlte Steckrübenspitzen Spirito Contadino. Ja, du hast richtig verstanden, tiefgekühlt! 🥶 Geerntet auf dem Höhepunkt ihrer Reife, wenn der Geschmack am besten ist, und sofort tiefgefroren, um den ganzen Geschmack und die Güte zu bewahren. Klingt das wie Ketzerei? Warte, bis du sie probierst!',
        fr_CH: 'Mais voici notre proposition qui sonne comme un blasphème : Cimes de Navet Surgelées Spirito Contadino. Oui, tu as bien compris, surgelées ! 🥶 Récoltées au sommet de leur maturité, quand le goût est au top, et immédiatement surgelées pour conserver toute la saveur et la bonté. Ça te semble une hérésie ? Attends de goûter !',
        en_US: 'But here\'s our proposal that sounds like blasphemy: Frozen Turnip Tops Spirito Contadino. Yes, you understood correctly, frozen! 🥶 Harvested at the peak of their ripeness, when the taste is at its best, and immediately frozen to preserve all the flavor and goodness. Does it sound like heresy? Wait until you try them!'
      };
    }
    else if (src.includes('E noi della LAPA - Finest Italian Food, non ci limitiamo')) {
      t[src] = {
        de_CH: 'Und wir von LAPA - Finest Italian Food beschränken uns nicht darauf, dir ein Produkt zu verkaufen und tschüss zu sagen. Nein, nein! Du kannst nicht nur heute bestellen und deine tiefgekühlten Steckrübenspitzen morgen haben (ja, du hast richtig gelesen, morgen! ⏰), sondern es gibt keinen Mindestbestellwert. Du willst nur eine Packung? Warum nicht? Wir haben den Mindestbestellwert abgeschafft!',
        fr_CH: 'Et nous de LAPA - Finest Italian Food, nous ne nous limitons pas à te vendre un produit et te dire au revoir. Non, non ! Non seulement tu pourras commander aujourd\'hui et avoir tes cimes de navet surgelées demain (oui, tu as bien lu, demain ! ⏰), mais il n\'y a pas de minimum de commande. Tu veux seulement un paquet ? Et pourquoi pas ? Nous avons dit adieu au minimum de commande !',
        en_US: 'And we at LAPA - Finest Italian Food, we don\'t just sell you a product and say goodbye. No, no! Not only can you order today and have your frozen turnip tops tomorrow (yes, you read that right, tomorrow! ⏰), but there\'s no minimum order. You want just one package? Why not? We\'ve said goodbye to minimum orders!'
      };
    }
    else if (src.includes('E se hai problemi, dubbi, se ti senti perso')) {
      t[src] = {
        de_CH: 'Und wenn du Probleme hast, Zweifel, wenn du dich in der Welt der tiefgekühlten Steckrübenspitzen verloren fühlst, ist unser dediziertes Support-Team immer da, bereit dir zu helfen. Wir sind für dich da, und nicht nur, weil sie uns dafür bezahlen! 😉',
        fr_CH: 'Et si tu as des problèmes, des doutes, si tu te sens perdu dans le monde des cimes de navet surgelées, notre équipe d\'assistance dédiée est toujours là, prête à te donner un coup de main. Nous sommes là pour toi, et pas seulement parce qu\'ils nous paient pour ça ! 😉',
        en_US: 'And if you have problems, doubts, if you feel lost in the world of frozen turnip tops, our dedicated support team is always there, ready to give you a hand. We\'re here for you, and not just because they pay us to do it! 😉'
      };
    }
    else if (src.includes('Allora, sei pronto a sconvolgere il tuo mondo gastronomico')) {
      t[src] = {
        de_CH: 'Also, bist du bereit, deine gastronomische Welt mit unseren tiefgekühlten Steckrübenspitzen Spirito Contadino auf den Kopf zu stellen? Bist du bereit zu sagen "wow, diese tiefgekühlten Steckrübenspitzen sind köstlich"? Herausforderung angenommen? Wir warten auf deine Antwort in den Kommentaren! 📢',
        fr_CH: 'Alors, es-tu prêt à bouleverser ton monde gastronomique avec nos Cimes de Navet Surgelées Spirito Contadino ? Es-tu prêt à dire "wow, ces cimes de navet surgelées sont délicieuses" ? Défi accepté ? Nous attendons ta réponse dans les commentaires ! 📢',
        en_US: 'So, are you ready to shake up your gastronomic world with our Frozen Turnip Tops Spirito Contadino? Are you ready to say "wow, these frozen turnip tops are delicious"? Challenge accepted? We\'re waiting for your response in the comments! 📢'
      };
    }
    else if (src.includes('E ricorda, siamo la LAPA - Finest Italian Food')) {
      t[src] = {
        de_CH: 'Und denk daran, wir sind LAPA - Finest Italian Food, deine Abkürzung zu hochwertigen gastronomischen Produkten, direkt an deine Tür geliefert. Warum sich mit dem Discounter zufrieden geben, wenn du das Beste haben kannst? 🎉👑🍴',
        fr_CH: 'Et rappelle-toi, nous sommes LAPA - Finest Italian Food, ton raccourci vers les produits gastronomiques de qualité, livrés directement à ta porte. Pourquoi se contenter du discount quand tu peux avoir le top ? 🎉👑🍴',
        en_US: 'And remember, we\'re LAPA - Finest Italian Food, your shortcut to quality gastronomic products, delivered directly to your door. Why settle for the discount store when you can have the best? 🎉👑🍴'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 26: CIME DI RAPA SURGELATE ===\n');

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

  console.log('\n✅ ARTICOLO 26 COMPLETATO!');
}

main();
