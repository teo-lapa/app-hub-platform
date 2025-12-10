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

const POST_ID = 31;

const TITLE_TRANSLATIONS = {
  it_IT: "🔥 Finocchiona IGP con LAPA - Oltre il Salume, Verso l'Arte del Gusto! 🔥",
  de_CH: "🔥 Finocchiona IGP mit LAPA - Über die Wurst hinaus, zur Kunst des Geschmacks! 🔥",
  fr_CH: "🔥 Finocchiona IGP avec LAPA - Au-delà de la Charcuterie, Vers l'Art du Goût ! 🔥",
  en_US: "🔥 Finocchiona IGP with LAPA - Beyond Cured Meat, Towards the Art of Taste! 🔥"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Ciao! Ti voglio parlare di qualcosa di speciale')) {
      t[src] = {
        de_CH: 'Hallo! Ich möchte dir von etwas Besonderem erzählen. Eine Wurst, die nicht nur den Gaumen erfreut, sondern auch eine Geschichte von Tradition und Leidenschaft erzählt: die Finocchiona IGP. Dieses toskanische Produkt, eine perfekte Symphonie aus Schweinefleisch, wildem Fenchel, Salz, Pfeffer und Rotwein, verkörpert die Essenz der italienischen Gastronomie. 🍷🐖',
        fr_CH: 'Salut ! Je veux te parler de quelque chose de spécial. Une charcuterie qui non seulement délecte le palais, mais qui raconte une histoire de tradition et de passion : la Finocchiona IGP. Ce produit toscan, une symphonie parfaite de viande de porc, fenouil sauvage, sel, poivre et vin rouge, incarne l\'essence de la gastronomie italienne. 🍷🐖',
        en_US: 'Hello! I want to tell you about something special. A cured meat that not only delights the palate, but tells a story of tradition and passion: Finocchiona IGP. This Tuscan product, a perfect symphony of pork, wild fennel, salt, pepper and red wine, embodies the essence of Italian gastronomy. 🍷🐖'
      };
    }
    else if (src.includes('Immagina di utilizzare la Finocchiona IGP nei tuoi piatti')) {
      t[src] = {
        de_CH: 'Stelle dir vor, die Finocchiona IGP in deinen Gerichten zu verwenden. Denke daran, wie sie mit Käse auf einem rustikalen Schneidebrett verschmilzt, oder wie sie einer cremigen Pasta einen besonderen Touch verleiht, oder wie sie zur Seele eines Gourmet-Sandwiches wird. 🥪🍝🧀',
        fr_CH: 'Imagine utiliser la Finocchiona IGP dans tes plats. Pense à comment elle se fond avec les fromages sur une planche rustique, ou comment elle ajoute une touche spéciale à des pâtes crémeuses, ou encore comment elle se transforme en l\'âme d\'un sandwich gourmet. 🥪🍝🧀',
        en_US: 'Imagine using Finocchiona IGP in your dishes. Think about how it blends with cheeses on a rustic cutting board, or how it adds a special touch to creamy pasta, or how it transforms into the soul of a gourmet sandwich. 🥪🍝🧀'
      };
    }
    else if (src.includes('Qui è dove entra in scena LAPA')) {
      t[src] = {
        de_CH: 'Hier kommt LAPA ins Spiel. Wir sind nicht nur ein Lieferant. Wir sind dein strategischer Partner, der Verbündete deiner Küche. Mit Lieferungen sechs Tage von sieben kann die Finocchiona IGP immer griffbereit sein. Vergessen zu bestellen? Keine Sorge: mit LAPA bestellst du heute, und morgen ist es da! Und das alles ohne Mindestbestellwert. 🚚⏱️',
        fr_CH: 'C\'est là qu\'entre en scène LAPA. Nous ne sommes pas seulement un fournisseur. Nous sommes ton partenaire stratégique, l\'allié de ta cuisine. Avec des livraisons six jours sur sept, la Finocchiona IGP peut toujours être à portée de main. Tu as oublié de commander ? Aucune inquiétude : avec LAPA tu commandes aujourd\'hui, et demain ça arrive ! Et tout cela sans minimum de commande. 🚚⏱️',
        en_US: 'This is where LAPA comes in. We\'re not just a supplier. We\'re your strategic partner, your kitchen\'s ally. With deliveries six days out of seven, Finocchiona IGP can always be at hand. Forgot to order? No worries: with LAPA you order today, and tomorrow it arrives! And all this with no minimum order. 🚚⏱️'
      };
    }
    else if (src.includes('Grazie al nostro listino personalizzato e alla nostra intuitiva Web App')) {
      t[src] = {
        de_CH: 'Dank unserer personalisierten Preisliste und unserer intuitiven Web App für Bestellungen wird dein Einkaufserlebnis flüssig und personalisiert. Gib dich nicht mit weniger zufrieden. LAPA findet, importiert und liefert ALLES, was du brauchst, einschließlich dieser Finocchiona IGP, die du dir immer gewünscht hast. 📲🛍️',
        fr_CH: 'Grâce à notre catalogue personnalisé et à notre intuitive Web App pour les commandes, ton expérience d\'achat devient fluide et personnalisée. Ne te contente pas de moins. LAPA trouve, importe et livre TOUT ce dont tu as besoin, y compris cette Finocchiona IGP que tu as toujours désirée. 📲🛍️',
        en_US: 'Thanks to our customized price list and our intuitive Web App for orders, your shopping experience becomes smooth and personalized. Don\'t settle for less. LAPA finds, imports and delivers EVERYTHING you need, including that Finocchiona IGP you\'ve always wanted. 📲🛍️'
      };
    }
    else if (src.includes('Non scordiamo il nostro servizio V.I.P')) {
      t[src] = {
        de_CH: 'Vergessen wir nicht unseren V.I.P.-Service. Warum solltest du dich mit normalem Service zufrieden geben, wenn du einen Sternenservice mit LAPA haben kannst? Und bei Problemen, wisse dass unser dedizierter Support immer bereit ist, dir zu helfen. 🌟🛎️',
        fr_CH: 'N\'oublions pas notre service V.I.P. Pourquoi devrais-tu te contenter du normal, quand tu peux avoir un service stellaire avec LAPA ? Et en cas de problèmes, sache que notre assistance dédiée est toujours prête à t\'aider. 🌟🛎️',
        en_US: 'Let\'s not forget our V.I.P. service. Why should you settle for normal, when you can have stellar service with LAPA? And in case of problems, know that our dedicated support is always ready to help you. 🌟🛎️'
      };
    }
    else if (src.includes('Sei pronto a dare una marcia in più alla tua cucina')) {
      t[src] = {
        de_CH: 'Bist du bereit, deiner Küche mit der Finocchiona IGP und LAPA einen Gang höher zu schalten? Bist du bereit zu entdecken, was wir alles für dich und dein Lokal tun können? 🤩🔝',
        fr_CH: 'Es-tu prêt à donner un coup de boost à ta cuisine avec la Finocchiona IGP et LAPA ? Es-tu prêt à découvrir tout ce que nous pouvons faire pour toi et ton établissement ? 🤩🔝',
        en_US: 'Are you ready to take your kitchen up a gear with Finocchiona IGP and LAPA? Are you ready to discover everything we can do for you and your venue? 🤩🔝'
      };
    }
    else if (src.includes('Non vediamo l\'ora di leggere i tuoi commenti')) {
      t[src] = {
        de_CH: 'Wir können es kaum erwarten, deine Kommentare zu lesen. Und wenn du in der richtigen Stimmung bist, teile mit uns: Was ist dein Lieblingsgericht mit Finocchiona IGP? 🗣️👨‍🍳',
        fr_CH: 'Nous avons hâte de lire tes commentaires. Et, si tu es d\'humeur, partage avec nous : quel est ton plat préféré avec la Finocchiona IGP ? 🗣️👨‍🍳',
        en_US: 'We can\'t wait to read your comments. And, if you\'re in the mood, share with us: what\'s your favorite dish with Finocchiona IGP? 🗣️👨‍🍳'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 31: FINOCCHIONA IGP ===\n');

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

  console.log('\n✅ ARTICOLO 31 COMPLETATO!');
}

main();
