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

const POST_ID = 32;

const TITLE_TRANSLATIONS = {
  it_IT: "🧀Fiordilatte Taglio Napoli: Non Un Formaggio Qualunque, Ma Il Re Della Tua Pizza🍕",
  de_CH: "🧀Fiordilatte Taglio Napoli: Kein gewöhnlicher Käse, sondern der König deiner Pizza🍕",
  fr_CH: "🧀Fiordilatte Taglio Napoli : Pas Un Fromage Ordinaire, Mais Le Roi de Ta Pizza🍕",
  en_US: "🧀Fiordilatte Taglio Napoli: Not Just Any Cheese, But The King Of Your Pizza🍕"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Hai mai sentito parlare del Fiordilatte Taglio Napoli')) {
      t[src] = {
        de_CH: 'Hast du jemals vom Fiordilatte Taglio Napoli gehört? Wenn deine Antwort "nein" ist, mein Freund, hast du etwas wirklich Besonderes verpasst😉. Aber keine Sorge, ich werde dich auf eine kulinarische Reise 🌍 mitnehmen, die für immer verändern wird, wie du deine Pizza siehst und vor allem schmeckst.',
        fr_CH: 'As-tu déjà entendu parler du Fiordilatte Taglio Napoli ? Si ta réponse est "non", mon ami, tu as raté quelque chose de vraiment spécial😉. Mais ne t\'inquiète pas, je t\'emmènerai dans un voyage culinaire 🌍 qui changera à jamais ta façon de voir, et surtout de goûter, ta pizza.',
        en_US: 'Have you ever heard of Fiordilatte Taglio Napoli? If your answer is "no", my friend, you\'ve missed something truly special😉. But don\'t worry, I\'ll take you on a culinary journey 🌍 that will forever change the way you look at, and especially taste, your pizza.'
      };
    }
    else if (src.includes('Il Fiordilatte Taglio Napoli non è un formaggio qualunque')) {
      t[src] = {
        de_CH: 'Fiordilatte Taglio Napoli ist kein gewöhnlicher Käse. Es ist ein hochwertiges Produkt🌟, bekannt für seine breite und dicke Form, das perfekt auf deiner Pizza schmilzt und einen cremigen und köstlichen Geschmack 😋 erzeugt, der dir schon beim Gedanken daran das Wasser im Mund zusammenlaufen lässt. Mit diesem Käse wird deine Pizza von einem einfachen Gericht zu einem kulinarischen Kunstwerk🎨.',
        fr_CH: 'Le Fiordilatte Taglio Napoli n\'est pas un fromage ordinaire. C\'est un produit de haute qualité🌟, connu pour sa forme large et épaisse, qui fond parfaitement sur ta pizza, créant une saveur crémeuse et délicieuse 😋 qui te mettra l\'eau à la bouche rien qu\'en y pensant. Avec ce fromage, ta pizza sera transformée d\'un simple plat en une œuvre d\'art culinaire🎨.',
        en_US: 'Fiordilatte Taglio Napoli is not just any cheese. It\'s a high-quality product🌟, known for its wide and thick shape, that melts perfectly on your pizza, creating a creamy and delicious flavor 😋 that will make your mouth water just thinking about it. With this cheese, your pizza will be transformed from a simple dish to a culinary work of art🎨.'
      };
    }
    else if (src.includes('Ma ecco la cosa: non tutti sono in grado di fornirti')) {
      t[src] = {
        de_CH: 'Aber hier ist die Sache: nicht jeder kann dir den echten Fiordilatte Taglio Napoli liefern. Tatsächlich werden dich viele Lieferanten dazu bringen, dich mit weniger zufrieden zu geben 😔. Und du, als Profi im Gastronomiebereich, solltest dich nicht zufrieden geben. Nicht wenn du deinen Kunden das authentischste und köstlichste kulinarische Erlebnis bieten willst👌.',
        fr_CH: 'Mais voilà le problème : tout le monde n\'est pas capable de te fournir le vrai Fiordilatte Taglio Napoli. En fait, beaucoup de fournisseurs te feront te contenter de moins 😔. Et toi, en tant que professionnel de la restauration, tu ne devrais pas te contenter. Pas si tu veux offrir à tes clients l\'expérience culinaire la plus authentique et délicieuse👌.',
        en_US: 'But here\'s the thing: not everyone can supply you with the real Fiordilatte Taglio Napoli. In fact, many suppliers will make you settle for less 😔. And you, as a professional in the restaurant industry, shouldn\'t settle. Not if you want to offer your customers the most authentic and delicious culinary experience👌.'
      };
    }
    else if (src.includes('Qui a LAPA, la tua soddisfazione è la nostra priorità')) {
      t[src] = {
        de_CH: 'Hier bei LAPA ist deine Zufriedenheit unsere Priorität. Deshalb liefern wir dir nicht nur den authentischen Fiordilatte Taglio Napoli, sondern bringen ihn dir auch persönlich, sechs Tage von sieben 🚚. Ja, du hast richtig verstanden. Von Montag bis Samstag sind wir da, mit deinem Lieblingskäse, bereit auf deine Pizza gelegt zu werden. Und es ist nicht nötig, eine Mindestmenge zu bestellen. Du kannst bestellen was du willst, so viel du willst🙌.',
        fr_CH: 'Ici chez LAPA, ta satisfaction est notre priorité. C\'est pourquoi, non seulement nous te fournirons l\'authentique Fiordilatte Taglio Napoli, mais nous te l\'apporterons directement, six jours sur sept 🚚. Oui, tu as bien compris. Du lundi au samedi, nous serons là, avec ton fromage préféré, prêt à être mis sur ta pizza. Et pas besoin de commander une quantité minimum. Tu peux commander ce que tu veux, autant que tu veux🙌.',
        en_US: 'Here at LAPA, your satisfaction is our priority. That\'s why we\'ll not only supply you with authentic Fiordilatte Taglio Napoli, but we\'ll bring it to you directly, six days out of seven 🚚. Yes, you understood correctly. From Monday to Saturday, we\'ll be there, with your favorite cheese, ready to be put on your pizza. And there\'s no need to order a minimum quantity. You can order what you want, as much as you want🙌.'
      };
    }
    else if (src.includes('Ma non è tutto. Grazie alla nostra pratica WEB APP')) {
      t[src] = {
        de_CH: 'Aber das ist nicht alles. Dank unserer praktischen WEB APP 📱 kannst du deinen Fiordilatte Taglio Napoli schnell und bequem bestellen, und du hast immer die Historie deiner Bestellungen zur Verfügung. Und wenn du vergessen hast zu bestellen? Kein Problem. Mit LAPA kannst du heute bestellen und morgen erhalten💥.',
        fr_CH: 'Mais ce n\'est pas tout. Grâce à notre pratique WEB APP 📱, tu peux commander ton Fiordilatte Taglio Napoli de manière rapide et commode, et tu auras toujours l\'historique de tes commandes à disposition. Et si tu as oublié de commander ? Pas de problème. Avec LAPA, tu peux commander aujourd\'hui et recevoir demain💥.',
        en_US: 'But that\'s not all. Thanks to our convenient WEB APP 📱, you can order your Fiordilatte Taglio Napoli quickly and easily, and you\'ll always have your order history available. And if you forgot to order? No problem. With LAPA, you can order today and receive tomorrow💥.'
      };
    }
    else if (src.includes('E per qualsiasi problema, o se hai bisogno di consigli')) {
      t[src] = {
        de_CH: 'Und bei Problemen, oder wenn du Tipps brauchst, wie du deinen Fiordilatte Taglio Napoli am besten verwenden kannst, steht dir unser dedizierter Support zur Verfügung. Wir sind immer bereit, dir zu helfen, die perfekte Pizza zu kreieren💪.',
        fr_CH: 'Et pour tout problème, ou si tu as besoin de conseils sur la meilleure façon d\'utiliser ton Fiordilatte Taglio Napoli, tu as à ta disposition notre assistance dédiée. Nous sommes toujours prêts à t\'aider à créer la pizza parfaite💪.',
        en_US: 'And for any problem, or if you need advice on how to best use your Fiordilatte Taglio Napoli, you have our dedicated support available. We\'re always ready to help you create the perfect pizza💪.'
      };
    }
    else if (src.includes('Allora, sei pronto a passare al livello successivo')) {
      t[src] = {
        de_CH: 'Also, bist du bereit, mit deinem Fiordilatte Taglio Napoli auf das nächste Level zu gehen? Werde heute LAPA-Kunde und entdecke den Unterschied. Schließlich, warum solltest du dich damit zufrieden geben, wie ein gewöhnlicher Kunde behandelt zu werden, wenn du ein VIP werden kannst👑?',
        fr_CH: 'Alors, es-tu prêt à passer au niveau supérieur avec ton Fiordilatte Taglio Napoli ? Deviens client LAPA aujourd\'hui et découvre la différence. Après tout, pourquoi devrais-tu te contenter d\'être traité comme un client ordinaire quand tu peux devenir un VIP👑 ?',
        en_US: 'So, are you ready to take it to the next level with your Fiordilatte Taglio Napoli? Become a LAPA customer today and discover the difference. After all, why should you settle for being treated like an ordinary customer when you can become a VIP👑?'
      };
    }
    else if (src.includes('E tu, come usi il Fiordilatte Taglio Napoli nella tua cucina')) {
      t[src] = {
        de_CH: 'Und du, wie verwendest du Fiordilatte Taglio Napoli in deiner Küche? Teile mit uns deine kreativsten Rezepte in den Kommentaren 📝. Wir sind neugierig, deine Kreationen zu entdecken!',
        fr_CH: 'Et toi, comment utilises-tu le Fiordilatte Taglio Napoli dans ta cuisine ? Partage avec nous tes recettes les plus créatives dans les commentaires 📝. Nous sommes curieux de découvrir tes créations !',
        en_US: 'And you, how do you use Fiordilatte Taglio Napoli in your kitchen? Share your most creative recipes with us in the comments 📝. We\'re curious to discover your creations!'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 32: FIORDILATTE TAGLIO NAPOLI ===\n');

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

  console.log('\n✅ ARTICOLO 32 COMPLETATO!');
}

main();
