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

const POST_ID = 63;

const TITLE_TRANSLATIONS = {
  it_IT: "Perché i Carciofi con Gambo Grigliati della LAPA Sono il Segreto del Successo del Tuo Ristorante 😎🍽️",
  de_CH: "Warum die gegrillten Artischocken mit Stiel von LAPA das Erfolgsgeheimnis deines Restaurants sind 😎🍽️",
  fr_CH: "Pourquoi les Artichauts avec Tige Grillés de LAPA Sont le Secret du Succès de ton Restaurant 😎🍽️",
  en_US: "Why LAPA's Grilled Artichokes with Stem Are the Secret to Your Restaurant's Success 😎🍽️"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Sei stanco di servire ai tuoi clienti i soliti piatti noiosi?')) {
      t[src] = {
        de_CH: 'Bist du es leid, deinen Kunden immer die gleichen langweiligen Gerichte zu servieren? Willst du deinem Menü einen Hauch von Klasse und Originalität verleihen? Dann ist es an der Zeit, die <strong>Gegrillten Artischocken mit Stiel von LAPA</strong> zu entdecken – das Produkt, das deine Küche revolutionieren wird! Die gegrillten Artischocken mit Stiel sind ein einzigartiger Genuss. Dank des Grillens wird der Geschmack der Artischocke hervorgehoben, behält ihre ganze Zartheit und fügt eine rauchige Note hinzu, die dich verrückt machen wird. Der Stiel, oft ignoriert, ist stattdessen eine Geschmacks- und Konsistenzüberraschung, die das Erlebnis vervollständigt.',
        fr_CH: 'Tu en as marre de servir à tes clients les plats ennuyeux habituels ? Tu veux donner une touche de classe et d\'originalité à ton menu ? Alors il est temps de découvrir les <strong>Artichauts avec Tige Grillés de LAPA</strong> – le produit qui révolutionnera ta cuisine ! Les artichauts avec tige grillés sont un délice unique. Grâce à la grillade, la saveur de l\'artichaut est exaltée, gardant toute sa délicatesse et ajoutant une note fumée qui te rendra fou. La tige, souvent ignorée, est au contraire une surprise de goût et de consistance qui complète l\'expérience.',
        en_US: 'Are you tired of serving your customers the same old boring dishes? Do you want to give your menu a touch of class and originality? Then it\'s time to discover <strong>LAPA\'s Grilled Artichokes with Stem</strong> – the product that will revolutionize your kitchen! Grilled artichokes with stem are a unique delight. Thanks to grilling, the artichoke flavor is enhanced, maintaining all its delicacy and adding a smoky note that will drive you crazy. The stem, often ignored, is instead a surprise of taste and texture that completes the experience.'
      };
    }
    else if (src.includes('Ma cosa rende davvero speciali i Carciofi con Gambo Grigliati della LAPA?')) {
      t[src] = {
        de_CH: 'Aber was macht die Gegrillten Artischocken mit Stiel von LAPA wirklich besonders? Zunächst, kompromisslose Qualität: unsere Artischocken werden sorgfältig von den besten italienischen Produzenten ausgewählt und perfekt gegrillt, um einen authentischen und unverwechselbaren Geschmack zu garantieren. Außerdem musst du dir mit unserer Lieferung 6 Tage die Woche keine Sorgen machen, wann du bestellen sollst. Mit LAPA erhältst du deine frischen und servierfertigen Artischocken praktisch jeden Tag der Woche!',
        fr_CH: 'Mais qu\'est-ce qui rend vraiment spéciaux les Artichauts avec Tige Grillés de LAPA ? D\'abord, la qualité sans compromis : nos artichauts sont sélectionnés avec soin chez les meilleurs producteurs italiens et grillés à la perfection pour garantir une saveur authentique et inimitable. De plus, avec notre livraison 6 jours sur 7, tu n\'as pas à te soucier de quand commander. Avec LAPA, tu reçois tes artichauts frais et prêts à servir pratiquement chaque jour de la semaine !',
        en_US: 'But what really makes LAPA\'s Grilled Artichokes with Stem special? First of all, uncompromising quality: our artichokes are carefully selected from the best Italian producers and grilled to perfection to guarantee an authentic and unmistakable flavor. Plus, with our delivery 6 days a week, you don\'t have to worry about when to order. With LAPA, you receive your fresh and ready-to-serve artichokes practically every day of the week!'
      };
    }
    else if (src.includes('E sai qual è il bello? Offriamo un listino personalizzato')) {
      t[src] = {
        de_CH: 'Und weißt du, was das Beste ist? Wir bieten eine personalisierte Preisliste. Wir passen die Preise an deine Bestellhäufigkeit und -menge an und garantieren dir immer das beste Angebot für dein Restaurant. Und wenn dich die Idee von Mindestbestellungen beunruhigt, entspann dich! Bei uns gibt es keine Mindestbestellungen. Willst du nur eine kleine Menge für ein besonderes Gericht? Kein Problem. Bestelle so viel du willst, wann du willst, ohne Einschränkungen.',
        fr_CH: 'Et tu sais ce qui est génial ? On offre un tarif personnalisé. On personnalise les prix en fonction de ta fréquence et du volume de commandes, te garantissant toujours la meilleure affaire pour ton restaurant. Et si l\'idée de devoir faire des commandes minimum te préoccupe, détends-toi ! Avec nous, il n\'y a pas de minimum de commande. Tu veux juste une petite quantité pour un plat spécial ? Pas de problème. Commande ce que tu veux, quand tu veux, sans restrictions.',
        en_US: 'And you know what\'s great? We offer a personalized price list. We customize prices based on your frequency and order volume, always guaranteeing you the best deal for your restaurant. And if you\'re worried about minimum orders, relax! With us, there are no minimum orders. Want just a small quantity for a special dish? No problem. Order as much as you want, whenever you want, without restrictions.'
      };
    }
    else if (src.includes('Includere i Carciofi con Gambo Grigliati nel tuo menu non è solo una scelta intelligente')) {
      t[src] = {
        de_CH: 'Die Gegrillten Artischocken mit Stiel in dein Menü aufzunehmen ist nicht nur eine kluge Wahl, es ist ein Gewinnzug. Diese Artischocken sind vielseitig und perfekt als Vorspeise, Beilage oder Hauptzutat in Salaten und ersten Gängen. Biete deinen Kunden etwas, das sie nirgendwo anders finden werden. Gegrillte Artischocken mit Stiel sind eine Neuheit, die über dich reden lässt. Das Grillen verleiht den Artischocken einen reichen und komplexen Geschmack und hebt jedes Gericht auf ein neues Niveau der Raffinesse.',
        fr_CH: 'Inclure les Artichauts avec Tige Grillés dans ton menu n\'est pas seulement un choix intelligent, c\'est un coup gagnant. Ces artichauts sont polyvalents et parfaits comme antipasto, accompagnement ou ingrédient principal dans les salades et les premiers plats. Offre à tes clients quelque chose qu\'ils ne trouveront nulle part ailleurs. Les artichauts avec tige grillés sont une nouveauté qui fera parler de toi. La grillade donne aux artichauts un goût riche et complexe, élevant n\'importe quel plat à un nouveau niveau de raffinement.',
        en_US: 'Including Grilled Artichokes with Stem in your menu is not just a smart choice, it\'s a winning move. These artichokes are versatile and perfect as an appetizer, side dish, or main ingredient in salads and first courses. Offer your customers something they won\'t find anywhere else. Grilled artichokes with stem are a novelty that will get people talking about you. Grilling gives the artichokes a rich and complex taste, elevating any dish to a new level of sophistication.'
      };
    }
    else if (src.includes('Ora, ti lancio una sfida: sei pronto a sorprendere i tuoi clienti?')) {
      t[src] = {
        de_CH: 'Jetzt fordere ich dich heraus: bist du bereit, deine Kunden zu überraschen? Probiere unsere gegrillten Artischocken mit Stiel und entdecke, wie ein Produkt den Unterschied in deiner Küche machen kann. Es ist Zeit, dein Menü auf das nächste Level zu heben!',
        fr_CH: 'Maintenant, je te lance un défi : tu es prêt à surprendre tes clients ? Essaie nos artichauts avec tige grillés et découvre comment un produit peut faire la différence dans ta cuisine. Il est temps de passer ton menu au niveau supérieur !',
        en_US: 'Now, I challenge you: are you ready to surprise your customers? Try our grilled artichokes with stem and discover how one product can make the difference in your kitchen. It\'s time to take your menu to the next level!'
      };
    }
    else if (src.includes('Siamo curiosi di sapere come i carciofi con gambo grigliati hanno trasformato il tuo ristorante')) {
      t[src] = {
        de_CH: 'Wir sind neugierig zu erfahren, wie die gegrillten Artischocken mit Stiel dein Restaurant transformiert haben. Schreib uns in den Kommentaren und teile deine Rezepte und kreativen Ideen! 🌿💬',
        fr_CH: 'On est curieux de savoir comment les artichauts avec tige grillés ont transformé ton restaurant. Écris-nous dans les commentaires et partage tes recettes et idées créatives ! 🌿💬',
        en_US: 'We\'re curious to know how grilled artichokes with stem have transformed your restaurant. Write to us in the comments and share your recipes and creative ideas! 🌿💬'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 63: CARCIOFI CON GAMBO GRIGLIATI ===\n');

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

  console.log('\n✅ ARTICOLO 63 COMPLETATO!');
}

main();
