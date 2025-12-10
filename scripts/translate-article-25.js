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

const POST_ID = 25;

const TITLE_TRANSLATIONS = {
  it_IT: "🔥🔥🔥 \"Il Cornetto che ti Riporta agli Anni '80: Sapore Autentico, Consegna Moderna!\" 🔥🔥🔥",
  de_CH: "🔥🔥🔥 \"Das Croissant, das dich in die 80er Jahre zurückversetzt: Authentischer Geschmack, moderne Lieferung!\" 🔥🔥🔥",
  fr_CH: "🔥🔥🔥 \"Le Croissant qui te Ramène aux Années 80 : Saveur Authentique, Livraison Moderne !\" 🔥🔥🔥",
  en_US: "🔥🔥🔥 \"The Croissant that Takes You Back to the '80s: Authentic Taste, Modern Delivery!\" 🔥🔥🔥"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Ciao! abbiamo una chicca per te')) {
      t[src] = {
        de_CH: 'Hallo! Wir haben etwas Besonderes für dich. 🍩 Wir präsentieren dir das Cornetto 1980 Curvo, eine Zeitreise, die dich zur Süße eines perfekten Frühstücks zurückbringt, genau wie es die italienische Tradition will. 🇮🇹',
        fr_CH: 'Salut ! Nous avons une petite pépite pour toi. 🍩 Nous te présentons le Cornetto 1980 Curvo, un voyage dans le temps qui te ramène à la douceur d\'un petit-déjeuner parfait, exactement comme le veut la tradition italienne. 🇮🇹',
        en_US: 'Hello! We have a treat for you. 🍩 We present to you the Cornetto 1980 Curvo, a journey through time that takes you back to the sweetness of a perfect breakfast, just as Italian tradition dictates. 🇮🇹'
      };
    }
    else if (src.includes('Questo non è un semplice cornetto, è un tuffo nel passato')) {
      t[src] = {
        de_CH: 'Dies ist nicht einfach ein Croissant, es ist ein Sprung in die Vergangenheit, eine Rückkehr in die 80er Jahre. Erinnerst du dich, als das Frühstück ein heiliger Moment war, den man in Ruhe genoss, vielleicht beim Zeitunglesen und Kaffeetrinken? Nun, dieses Croissant ist all das. 🥐☕',
        fr_CH: 'Ce n\'est pas un simple croissant, c\'est un plongeon dans le passé, un retour aux années 80. Tu te souviens quand le petit-déjeuner était un moment sacré, à savourer tranquillement, peut-être en lisant le journal et en sirotant un café ? Eh bien, ce croissant c\'est tout ça. 🥐☕',
        en_US: 'This is not just a croissant, it\'s a dive into the past, a return to the \'80s. Remember when breakfast was a sacred moment, to be enjoyed calmly, perhaps reading the newspaper and sipping a coffee? Well, this croissant is all of that. 🥐☕'
      };
    }
    else if (src.includes('Il Cornetto 1980 Curvo è realizzato con materie prime')) {
      t[src] = {
        de_CH: 'Das Cornetto 1980 Curvo wird mit hochwertigen Rohstoffen hergestellt, mit Teigen, die die Gärzeiten respektieren, für einen unverwechselbaren Geschmack und einen zarten Duft. Der weiche Teig mit unverwechselbaren aromatischen Noten und einer gut definierten Porenstruktur wird dich beim ersten Bissen verlieben lassen. 😍',
        fr_CH: 'Le Cornetto 1980 Curvo est réalisé avec des matières premières de haute qualité, avec des pâtes qui respectent les temps de levage, pour un goût inimitable et un parfum délicat. La pâte moelleuse aux notes aromatiques inimitables et une alvéolation bien définie te fera tomber amoureux dès la première bouchée. 😍',
        en_US: 'The Cornetto 1980 Curvo is made with high-quality raw materials, with doughs that respect rising times, for an unmistakable taste and delicate fragrance. The soft dough with unmistakable aromatic notes and well-defined air pockets will make you fall in love at the first bite. 😍'
      };
    }
    else if (src.includes('E sai cosa è il bello? Puoi ordinarlo oggi e averlo domani')) {
      t[src] = {
        de_CH: 'Und weißt du, was das Schöne ist? Du kannst es heute bestellen und morgen haben! Ja, du hast richtig verstanden. Mit LAPA, wenn du vergisst, etwas zu bestellen, musst du dir keine Sorgen machen. Bestelle heute und morgen ist es da. Ist das nicht fantastisch? 🚀',
        fr_CH: 'Et tu sais ce qui est génial ? Tu peux le commander aujourd\'hui et l\'avoir demain ! Oui, tu as bien compris. Avec LAPA, si tu oublies de commander quelque chose, tu n\'as pas à t\'inquiéter. Commande aujourd\'hui et demain ça arrive. C\'est pas fantastique ? 🚀',
        en_US: 'And you know what\'s great? You can order it today and have it tomorrow! Yes, you understood correctly. With LAPA, if you forget to order something, you don\'t have to worry. Order today and tomorrow it arrives. Isn\'t that fantastic? 🚀'
      };
    }
    else if (src.includes('E non finisce qui. Sai, noi di LAPA non ci accontentiamo')) {
      t[src] = {
        de_CH: 'Und das ist noch nicht alles. Weißt du, wir bei LAPA geben uns nicht damit zufrieden, dir nur ein Qualitätsprodukt zu geben. Wir wollen, dass du dich besonders fühlst. Deshalb bieten wir all unseren Kunden einen V.I.P.-Service. Warum solltest du dich damit zufrieden geben, wie ein gewöhnlicher Kunde behandelt zu werden, wenn du ein VIP werden kannst? 🎩',
        fr_CH: 'Et ce n\'est pas fini. Tu sais, nous chez LAPA ne nous contentons pas de te donner seulement un produit de qualité. Nous voulons que tu te sentes spécial. C\'est pourquoi nous offrons un service V.I.P. à tous nos clients. Pourquoi devrais-tu te contenter d\'être traité comme un client ordinaire quand tu peux devenir un VIP ? 🎩',
        en_US: 'And it doesn\'t end there. You know, at LAPA we\'re not satisfied with just giving you a quality product. We want you to feel special. That\'s why we offer a V.I.P. service to all our customers. Why should you settle for being treated like an ordinary customer when you can become a VIP? 🎩'
      };
    }
    else if (src.includes('E non preoccuparti del minimo d\'ordine')) {
      t[src] = {
        de_CH: 'Und mach dir keine Sorgen über den Mindestbestellwert. Bei uns kannst du bestellen, was du willst, so viel du willst. Wir zwingen dich nicht, beim Discounter einzukaufen. Bestelle dein Cornetto 1980 Curvo, oder jedes andere Produkt, das du möchtest, und wir liefern es dir. 📦',
        fr_CH: 'Et ne t\'inquiète pas du minimum de commande. Avec nous, tu peux commander ce que tu veux, autant que tu veux. Nous ne te forçons pas à faire tes courses au discount. Commande ton Cornetto 1980 Curvo, ou n\'importe quel autre produit que tu désires, et nous te le livrons. 📦',
        en_US: 'And don\'t worry about the minimum order. With us, you can order what you want, as much as you want. We don\'t force you to shop at the discount store. Order your Cornetto 1980 Curvo, or any other product you desire, and we\'ll deliver it to you. 📦'
      };
    }
    else if (src.includes('Allora, cosa aspetti? Fai un salto indietro nel tempo')) {
      t[src] = {
        de_CH: 'Also, worauf wartest du? Mach einen Sprung in die Vergangenheit mit unserem Cornetto 1980 Curvo und genieße die Süße eines perfekten Frühstücks. Bestelle heute, und morgen kannst du dein Croissant genießen, genau wie vor 40 Jahren. 🕰️',
        fr_CH: 'Alors, qu\'attends-tu ? Fais un saut dans le passé avec notre Cornetto 1980 Curvo et profite de la douceur d\'un petit-déjeuner parfait. Commande aujourd\'hui, et demain tu pourras savourer ton croissant, exactement comme il y a 40 ans. 🕰️',
        en_US: 'So, what are you waiting for? Take a leap back in time with our Cornetto 1980 Curvo and enjoy the sweetness of a perfect breakfast. Order today, and tomorrow you can enjoy your croissant, just like 40 years ago. 🕰️'
      };
    }
    else if (src.includes('LAPA, il tuo partner per la ristorazione')) {
      t[src] = {
        de_CH: 'LAPA, dein Partner für die Gastronomie. Denn bei uns ist jeder Tag wie eine Zeitreise. 🚀🕰️🍩',
        fr_CH: 'LAPA, ton partenaire pour la restauration. Parce qu\'avec nous, chaque jour est comme un voyage dans le temps. 🚀🕰️🍩',
        en_US: 'LAPA, your partner for catering. Because with us, every day is like a journey through time. 🚀🕰️🍩'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 25: CORNETTO 1980 CURVO ===\n');

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

  console.log('\n✅ ARTICOLO 25 COMPLETATO!');
}

main();
