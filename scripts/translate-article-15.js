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

const POST_ID = 15;

const TITLE_TRANSLATIONS = {
  it_IT: "🐣 Pasqua a Tavola: Sorprendi i Tuoi Clienti con Dolci Tradizionali Italiani e Svizzeri Grazie a LAPA! 🍰",
  de_CH: "🐣 Ostern auf dem Tisch: Überraschen Sie Ihre Kunden mit traditionellen italienischen und Schweizer Süßigkeiten dank LAPA! 🍰",
  fr_CH: "🐣 Pâques à Table : Surprenez vos clients avec des desserts traditionnels italiens et suisses grâce à LAPA ! 🍰",
  en_US: "🐣 Easter at the Table: Surprise Your Customers with Traditional Italian and Swiss Desserts Thanks to LAPA! 🍰"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Ciao a tutti voi cuochi')) {
      t[src] = {
        de_CH: '<span style="background-color: transparent; font-size: 16px;">Hallo an alle Köche, Gastronomen und Feinschmecker! Ostern steht vor der Tür und wir wissen, dass Sie Ihren Kunden etwas Besonderes bieten möchten.</span>',
        fr_CH: '<span style="background-color: transparent; font-size: 16px;">Bonjour à tous les cuisiniers, restaurateurs et passionnés de gastronomie ! Pâques approche et nous savons que vous voulez offrir à vos clients quelque chose de spécial.</span>',
        en_US: '<span style="background-color: transparent; font-size: 16px;">Hello to all you chefs, restaurateurs and food enthusiasts! Easter is just around the corner and we know you want to offer your customers something special.</span>'
      };
    }
    else if (src.includes('Immaginate di servire in tavola la colomba')) {
      t[src] = {
        de_CH: '<span style="background-color: transparent; font-size: 16px;">Stellen Sie sich vor, die Colomba, die neapolitanische Pastiera, die sizilianische Cassata und viele andere italienische Oster-Köstlichkeiten auf den Tisch zu bringen. 🍰🐰</span>',
        fr_CH: '<span style="background-color: transparent; font-size: 16px;">Imaginez servir à table la colomba, la pastiera napolitaine, la cassata sicilienne et bien d\'autres délices de Pâques italiens. 🍰🐰</span>',
        en_US: '<span style="background-color: transparent; font-size: 16px;">Imagine serving the colomba, Neapolitan pastiera, Sicilian cassata and many other Italian Easter delicacies at the table. 🍰🐰</span>'
      };
    }
    else if (src.includes('Pastiera Napoletana')) {
      t[src] = {
        de_CH: '<span style="background-color: transparent; font-size: 16px;">🐰 Neapolitanische Pastiera: Die Pastiera ist ein traditionelles neapolitanisches Dessert, das zu Ostern zubereitet wird. Ihre Geschichte hat Wurzeln in der Antike.</span>',
        fr_CH: '<span style="background-color: transparent; font-size: 16px;">🐰 Pastiera Napolitaine : la Pastiera est un dessert traditionnel napolitain préparé pendant Pâques. Son histoire remonte à l\'Antiquité.</span>',
        en_US: '<span style="background-color: transparent; font-size: 16px;">🐰 Neapolitan Pastiera: Pastiera is a traditional Neapolitan dessert prepared during Easter. Its history has roots in ancient times.</span>'
      };
    }
    else if (src.includes('Torta Pasqualina')) {
      t[src] = {
        de_CH: '<span style="background-color: transparent; font-size: 16px;">🌼 Torta Pasqualina: Ursprünglich aus Ligurien stammend, ist die Torta Pasqualina eine traditionelle italienische herzhafte Torte, die zu Ostern zubereitet wird.</span>',
        fr_CH: '<span style="background-color: transparent; font-size: 16px;">🌼 Torta Pasqualina : originaire de Ligurie, la Torta Pasqualina est une tarte salée traditionnelle italienne préparée pendant Pâques.</span>',
        en_US: '<span style="background-color: transparent; font-size: 16px;">🌼 Torta Pasqualina: originally from Liguria, Torta Pasqualina is a traditional Italian savory pie prepared during Easter.</span>'
      };
    }
    else if (src.includes('Girella di cioccolato svizzera')) {
      t[src] = {
        de_CH: '<span style="background-color: transparent; font-size: 16px;">🍫 Schweizer Schokoladen-Girella: Diese Schweizer Süßigkeit ist ein Schokoladen-Genuss, der traditionell zu Ostern zubereitet wird.</span>',
        fr_CH: '<span style="background-color: transparent; font-size: 16px;">🍫 Girella au chocolat suisse : cette pâtisserie suisse est un délice au chocolat préparé traditionnellement pendant Pâques.</span>',
        en_US: '<span style="background-color: transparent; font-size: 16px;">🍫 Swiss chocolate Girella: this Swiss dessert is a chocolate delight traditionally prepared during Easter.</span>'
      };
    }
    else if (src.includes('Uovo di Pasqua al cioccolato')) {
      t[src] = {
        de_CH: '<span style="background-color: transparent; font-size: 16px;">🥚 Schokoladen-Osterei: Das Schokoladen-Osterei ist sowohl in Italien als auch in der Schweiz Tradition. Schokoladen-Eier symbolisieren neues Leben.</span>',
        fr_CH: '<span style="background-color: transparent; font-size: 16px;">🥚 Œuf de Pâques en chocolat : l\'œuf de Pâques en chocolat est une tradition à la fois italienne et suisse. Les œufs en chocolat symbolisent une nouvelle vie.</span>',
        en_US: '<span style="background-color: transparent; font-size: 16px;">🥚 Chocolate Easter Egg: the chocolate Easter egg is both an Italian and Swiss tradition. Chocolate eggs symbolize new life.</span>'
      };
    }
    else if (src.includes('Osterchüechli')) {
      t[src] = {
        de_CH: '<span style="font-size:11pt;background-color:transparent"><br></span><span style="background-color: transparent; font-size: 16px;">🌸 Osterchüechli: Das Osterchüechli ist eine traditionelle Schweizer Süßigkeit.</span>',
        fr_CH: '<span style="font-size:11pt;background-color:transparent"><br></span><span style="background-color: transparent; font-size: 16px;">🌸 Osterchüechli : l\'Osterchüechli est une pâtisserie suisse d\'origine traditionnelle.</span>',
        en_US: '<span style="font-size:11pt;background-color:transparent"><br></span><span style="background-color: transparent; font-size: 16px;">🌸 Osterchüechli: Osterchüechli is a traditional Swiss dessert.</span>'
      };
    }
    else if (src.includes('Osterfladen')) {
      t[src] = {
        de_CH: '<span style="background-color: transparent; font-size: 16px;">🥧 Osterfladen: Der Osterfladen ist eine typische Süßigkeit aus der deutschsprachigen Schweiz und wird zu Ostern zubereitet. Es ist ein weicher und cremiger Kuchen.</span>',
        fr_CH: '<span style="background-color: transparent; font-size: 16px;">🥧 Osterfladen : l\'Osterfladen est un dessert typique de la Suisse alémanique préparé pendant Pâques. C\'est une tarte moelleuse et crémeuse.</span>',
        en_US: '<span style="background-color: transparent; font-size: 16px;">🥧 Osterfladen: Osterfladen is a typical dessert from German-speaking Switzerland prepared during Easter. It is a soft and creamy cake.</span>'
      };
    }
    else if (src.includes('Con LAPA, non solo vi forniamo')) {
      t[src] = {
        de_CH: '<span style="background-color: transparent; font-size: 16px;">Mit LAPA liefern wir Ihnen nicht nur die notwendigen Zutaten für diese kulinarischen Meisterwerke, sondern bieten Ihnen auch eine Reihe von Vorteilen.</span>',
        fr_CH: '<span style="background-color: transparent; font-size: 16px;">Avec LAPA, non seulement nous vous fournissons les ingrédients nécessaires pour réaliser ces chefs-d\'œuvre culinaires, mais nous vous offrons également une série d\'avantages.</span>',
        en_US: '<span style="background-color: transparent; font-size: 16px;">With LAPA, we not only provide you with the necessary ingredients to create these culinary masterpieces, but we also offer you a series of advantages.</span>'
      };
    }
    else if (src.includes('Consegne 6 su 7')) {
      t[src] = {
        de_CH: '<span style="background-color: transparent; font-size: 16px;">🚚 Lieferungen 6 von 7: Von Montag bis Samstag liefern wir "fast" jeden Tag! Sie müssen nicht planen, wann Sie bestellen, denn Sie können es immer tun.</span>',
        fr_CH: '<span style="background-color: transparent; font-size: 16px;">🚚 Livraisons 6 sur 7 : Du lundi au samedi, nous livrons "presque" tous les jours ! Vous n\'avez pas à programmer quand commander car vous pouvez toujours le faire.</span>',
        en_US: '<span style="background-color: transparent; font-size: 16px;">🚚 Deliveries 6 out of 7: From Monday to Saturday, we deliver "almost" every day! You don\'t have to plan when to order because you can always do it.</span>'
      };
    }
    else if (src.includes('APP per ordini')) {
      t[src] = {
        de_CH: '<span style="background-color: transparent; font-size: 16px;">📲 APP für Bestellungen: Eine sehr praktische WEB APP, um bequem und schnell zu bestellen, mit Bestellhistorie und Waren, Dokumenten und vielem mehr.</span>',
        fr_CH: '<span style="background-color: transparent; font-size: 16px;">📲 APP pour commandes : Une WEB APP très pratique pour commander confortablement et rapidement, avec historique des commandes et des marchandises, documents et bien plus.</span>',
        en_US: '<span style="background-color: transparent; font-size: 16px;">📲 APP for orders: A very convenient WEB APP to order comfortably and quickly, with order and goods history, documents and much more.</span>'
      };
    }
    else if (src.includes('Servizi V.I.P.')) {
      t[src] = {
        de_CH: '<span style="background-color: transparent; font-size: 16px;">🎁 V.I.P. Services: Warum wie ein gewöhnlicher Kunde behandelt werden, wenn Sie VIP werden können? Viele besondere Dienstleistungen für besondere Kunden.</span>',
        fr_CH: '<span style="background-color: transparent; font-size: 16px;">🎁 Services V.I.P. : Pourquoi être traité comme un client ordinaire quand vous pouvez devenir VIP ? De nombreux services particuliers pour des clients spéciaux.</span>',
        en_US: '<span style="background-color: transparent; font-size: 16px;">🎁 V.I.P. Services: Why be treated like an ordinary customer when you can become a VIP? Many special services for special customers.</span>'
      };
    }
    else if (src.includes('E questi sono solo alcuni')) {
      t[src] = {
        de_CH: '<span style="background-color: transparent; font-size: 16px;">Und das sind nur einige unserer Stärken. Entdecken Sie alle Vorteile, die LAPA Ihnen bieten kann, und überraschen Sie Ihre Kunden mit Oster-Süßigkeiten.</span>',
        fr_CH: '<span style="background-color: transparent; font-size: 16px;">Et ce ne sont que quelques-uns de nos points forts. Découvrez tous les avantages que LAPA peut vous offrir et surprenez vos clients avec des desserts de Pâques.</span>',
        en_US: '<span style="background-color: transparent; font-size: 16px;">And these are just some of our strengths. Discover all the advantages that LAPA can offer you and amaze your customers with Easter desserts.</span>'
      };
    }
    else if (src.includes('Immagine: Un piatto con dolci')) {
      t[src] = {
        de_CH: '<span style="background-color: transparent; font-size: 16px;">📸 Bild: Ein Teller mit typischen italienischen und Schweizer Oster-Süßigkeiten, elegant dekoriert und servierbereit. Im Hintergrund das LAPA-Logo.</span>',
        fr_CH: '<span style="background-color: transparent; font-size: 16px;">📸 Image : Une assiette avec des desserts typiques de Pâques italiens et suisses, élégamment décorés et prêts à être servis. En arrière-plan, le logo LAPA.</span>',
        en_US: '<span style="background-color: transparent; font-size: 16px;">📸 Image: A plate with typical Italian and Swiss Easter desserts, elegantly decorated and ready to be served. In the background, the LAPA logo.</span>'
      };
    }
    else if (src.includes('Non perdere tempo')) {
      t[src] = {
        de_CH: '<span style="background-color: transparent; font-size: 16px;">Verlieren Sie keine Zeit! 🕐 Besuchen Sie unsere Website, konsultieren Sie unseren Katalog und bestellen Sie sofort die Zutaten für Ihre Oster-Süßigkeiten. Ihre Kunden werden es Ihnen danken!</span>',
        fr_CH: '<span style="background-color: transparent; font-size: 16px;">Ne perdez pas de temps ! 🕐 Visitez notre site, consultez notre catalogue et commandez immédiatement les ingrédients pour vos desserts de Pâques. Vos clients vous remercieront !</span>',
        en_US: '<span style="background-color: transparent; font-size: 16px;">Don\'t waste time! 🕐 Visit our website, browse our catalog and order the ingredients for your Easter desserts right away. Your customers will thank you!</span>'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 15: PASQUA A TAVOLA ===\n');

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

  console.log('\n✅ ARTICOLO 15 COMPLETATO!');
}

main();
