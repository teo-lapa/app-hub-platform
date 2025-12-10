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

const POST_ID = 24;

const TITLE_TRANSLATIONS = {
  it_IT: "🍽️🇮🇹 Spirito Contadino: Cime di Rapa e Salsiccia in Crosta di Farina di Grano: Un Gusto Autentico che Ti Fa Sentire a Casa! 🍽️🇮🇹",
  de_CH: "🍽️🇮🇹 Spirito Contadino: Steckrübenspitzen und Wurst in Weizenmehlkruste: Ein authentischer Geschmack, der dich zu Hause fühlen lässt! 🍽️🇮🇹",
  fr_CH: "🍽️🇮🇹 Spirito Contadino : Cimes de Navet et Saucisse en Croûte de Farine de Blé : Un Goût Authentique qui te Fait Sentir chez Toi ! 🍽️🇮🇹",
  en_US: "🍽️🇮🇹 Spirito Contadino: Turnip Tops and Sausage in Wheat Flour Crust: An Authentic Taste That Makes You Feel at Home! 🍽️🇮🇹"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Ciao! Oggi vogliamo parlarti di un prodotto')) {
      t[src] = {
        de_CH: 'Hallo! Heute möchten wir dir von einem Produkt erzählen, das dir das Wasser im Mund zusammenlaufen lässt: die Steckrübenspitzen und Wurst in Weizenmehlkruste von Spirito Contadino. 🥦🐖🍞',
        fr_CH: 'Salut ! Aujourd\'hui nous voulons te parler d\'un produit qui te mettra l\'eau à la bouche : les Cimes de Navet et Saucisse en Croûte de Farine de Blé de Spirito Contadino. 🥦🐖🍞',
        en_US: 'Hi! Today we want to tell you about a product that will make your mouth water: the Turnip Tops and Sausage in Wheat Flour Crust by Spirito Contadino. 🥦🐖🍞'
      };
    }
    else if (src.includes('Questo piatto è una ricetta gustosa che unisce il sapore deciso')) {
      t[src] = {
        de_CH: 'Dieses Gericht ist ein schmackhaftes Rezept, das den kräftigen und unverwechselbaren Geschmack der Steckrübenspitzen, einem typischen Gemüse der alten apulischen Bauerntradition, mit dem typischen Geschmack der Wurst vereint. Nach der Auswahl der Zutaten werden die Steckrübenspitzen gewaschen, blanchiert und zerkleinert, um in einer leichten Weizenmehlkruste eingehüllt, vorgegart und mit der IQF-Methode (Individually Quick Frozen) tiefgefroren zu werden, um Farbe, Geschmack und Frische bestmöglich zu bewahren und die Nährstoffeigenschaften unverändert zu erhalten.',
        fr_CH: 'Ce plat est une recette savoureuse qui unit le goût décidé et inimitable des cimes de navet, légume typique de l\'ancienne tradition paysanne des Pouilles, à la saveur typique de la saucisse. Après avoir sélectionné les ingrédients, les cimes de navet sont lavées, blanchies et émincées pour être enveloppées d\'une légère croûte de farine de blé, précuites et surgelées avec la méthode IQF (Individually Quick Frozen) pour conserver au mieux couleur, saveur et fraîcheur et maintenir intactes les caractéristiques nutritives.',
        en_US: 'This dish is a tasty recipe that combines the bold and unmistakable flavor of turnip tops, a typical vegetable from the ancient Apulian peasant tradition, with the typical taste of sausage. After selecting the ingredients, the turnip tops are washed, blanched and chopped to be wrapped in a light wheat flour crust, pre-cooked and frozen using the IQF method (Individually Quick Frozen) to best preserve color, flavor and freshness while maintaining the nutritional characteristics unchanged.'
      };
    }
    else if (src.includes('Ora, ti stai chiedendo: "Ma come faccio a mettere le mani')) {
      t[src] = {
        de_CH: 'Jetzt fragst du dich: "Aber wie komme ich an diese Köstlichkeit?" Hier kommt LAPA - Finest Italian Food ins Spiel. 🚚💨',
        fr_CH: 'Maintenant, tu te demandes : "Mais comment puis-je mettre la main sur ce délice ?" C\'est là qu\'entre en jeu LAPA - Finest Italian Food. 🚚💨',
        en_US: 'Now, you\'re wondering: "But how do I get my hands on this delicacy?" That\'s where LAPA - Finest Italian Food comes in. 🚚💨'
      };
    }
    else if (src.includes('LAPA è il tuo angelo custode della gastronomia')) {
      t[src] = {
        de_CH: 'LAPA ist dein Schutzengel der Gastronomie. Lieferung 6 Tage von 7, von Montag bis Samstag. Du musst dir also keine Sorgen machen, wann du bestellen sollst, denn du kannst es jederzeit tun! Und wenn du vergisst, etwas zu bestellen? Keine Sorge, bestelle heute und morgen ist es da! 📅📦',
        fr_CH: 'LAPA est ton ange gardien de la gastronomie. Livraison 6 jours sur 7, du lundi au samedi. Donc, tu n\'as pas à te soucier de programmer quand commander, car tu peux le faire à tout moment ! Et si tu oublies de commander quelque chose ? Tranquille, commande aujourd\'hui et demain ça arrive ! 📅📦',
        en_US: 'LAPA is your guardian angel of gastronomy. Delivery 6 days out of 7, from Monday to Saturday. So, you don\'t have to worry about scheduling when to order, because you can do it anytime! And if you forget to order something? No worries, order today and tomorrow it arrives! 📅📦'
      };
    }
    else if (src.includes('E sai cosa è ancora meglio? Non c\'è un minimo d\'ordine')) {
      t[src] = {
        de_CH: 'Und weißt du, was noch besser ist? Es gibt keinen Mindestbestellwert. Wenn du also nur einen Karton dieser köstlichen Steckrübenspitzen und Wurst in Weizenmehlkruste möchtest, kein Problem. Bestelle was du willst, so viel du willst. 📲🍽️',
        fr_CH: 'Et tu sais ce qui est encore mieux ? Il n\'y a pas de minimum de commande. Donc, si tu veux seulement un carton de ces délicieuses Cimes de Navet et Saucisse en Croûte de Farine de Blé, pas de problème. Commande ce que tu veux, autant que tu veux. 📲🍽️',
        en_US: 'And you know what\'s even better? There\'s no minimum order. So, if you want just one box of these delicious Turnip Tops and Sausage in Wheat Flour Crust, no problem. Order what you want, as much as you want. 📲🍽️'
      };
    }
    else if (src.includes('Quindi, cosa aspetti? Fai un salto nel mondo di LAPA')) {
      t[src] = {
        de_CH: 'Also, worauf wartest du? Tauche ein in die Welt von LAPA und entdecke den authentischen Geschmack der italienischen Tradition. Du wirst es nicht bereuen! 🎉🇮🇹',
        fr_CH: 'Alors, qu\'attends-tu ? Fais un saut dans le monde de LAPA et découvre le goût authentique de la tradition italienne. Tu ne le regretteras pas ! 🎉🇮🇹',
        en_US: 'So, what are you waiting for? Jump into the world of LAPA and discover the authentic taste of Italian tradition. You won\'t regret it! 🎉🇮🇹'
      };
    }
    else if (src.includes('P.S. Ricorda, con LAPA, sei sempre un VIP')) {
      t[src] = {
        de_CH: 'P.S. Denk daran, mit LAPA bist du immer ein VIP. Viele besondere Services für besondere Kunden wie dich! 😉👑',
        fr_CH: 'P.S. Rappelle-toi, avec LAPA, tu es toujours un VIP. Plein de services particuliers pour des clients spéciaux comme toi ! 😉👑',
        en_US: 'P.S. Remember, with LAPA, you\'re always a VIP. Lots of special services for special customers like you! 😉👑'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 24: CIME DI RAPA E SALSICCIA ===\n');

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

  console.log('\n✅ ARTICOLO 24 COMPLETATO!');
}

main();
