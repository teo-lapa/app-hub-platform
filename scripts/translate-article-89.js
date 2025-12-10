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

const POST_ID = 89;

// Contenuto ITALIANO
const ITALIAN_CONTENT = `<section class="s_text_block pt40 pb40 o_colored_level" data-snippet="s_text_block">
<div class="container">
<h2>La Freschezza Arriva a Casa Tua</h2>
<p>Per un ristorante italiano, la qualita degli ingredienti e fondamentale. Ma come garantire che i prodotti freschi arrivino nelle migliori condizioni? LAPA ha la risposta con il suo servizio di consegna in tutta la Svizzera.</p>

<h3>La Nostra Copertura</h3>
<p>LAPA consegna in tutta la Svizzera:</p>
<ul>
<li>Zurigo e area metropolitana</li>
<li>Berna e Svizzera centrale</li>
<li>Basilea e Svizzera nordoccidentale</li>
<li>Ginevra e Romandia</li>
<li>Lugano e Ticino</li>
<li>Tutte le altre regioni svizzere</li>
</ul>

<h3>I Nostri Tempi di Consegna</h3>
<ul>
<li>Prodotti freschi: consegna in 24-48 ore</li>
<li>Prodotti secchi: consegna in 48-72 ore</li>
<li>Ordini urgenti: possibilita di consegna express</li>
<li>Consegne programmate: scegli il giorno che preferisci</li>
</ul>

<h3>La Catena del Freddo Garantita</h3>
<p>Per i prodotti freschi, la catena del freddo e essenziale:</p>
<ul>
<li>Magazzini refrigerati a temperatura controllata</li>
<li>Camion refrigerati per il trasporto</li>
<li>Monitoraggio costante della temperatura</li>
<li>Imballaggi termici per prodotti delicati</li>
</ul>

<h3>Nessun Minimo d'Ordine</h3>
<p>A differenza di altri grossisti, LAPA non richiede minimi d'ordine. Puoi ordinare:</p>
<ul>
<li>Anche solo un prodotto</li>
<li>Quantita piccole per testare nuovi ingredienti</li>
<li>Riordini frequenti senza vincoli</li>
<li>Esattamente quello che ti serve</li>
</ul>

<h3>Come Ordinare</h3>
<ul>
<li>Online: attraverso il nostro sito web 24 ore su 24</li>
<li>Telefono: il nostro team e a disposizione</li>
<li>Email: per ordini programmati</li>
<li>App: gestisci i tuoi ordini ovunque tu sia</li>
</ul>

<h3>I Nostri Prodotti Freschi</h3>
<p>Consegniamo freschi ogni giorno:</p>
<ul>
<li>Mozzarella e burrata freschissime</li>
<li>Salumi appena affettati</li>
<li>Formaggi stagionati e freschi</li>
<li>Pasta fresca artigianale</li>
<li>Verdure e ingredienti di stagione</li>
</ul>

<h3>Perche Scegliere LAPA</h3>
<ul>
<li>Oltre 3.000 prodotti italiani autentici</li>
<li>Importazione diretta dall'Italia</li>
<li>Prezzi competitivi per professionisti</li>
<li>Assistenza dedicata e consulenza</li>
<li>Fatturazione semplice e trasparente</li>
</ul>

<h3>Conclusione</h3>
<p>Con LAPA, i migliori ingredienti italiani arrivano direttamente nel tuo ristorante. Freschezza garantita, consegna puntuale, nessun compromesso sulla qualita.</p>
</div>
</section>`;

// Traduzioni per ogni segmento
const TRANSLATIONS = {
  "La Freschezza Arriva a Casa Tua": {
    de_CH: "Frische kommt zu Ihnen nach Hause",
    fr_CH: "La fraicheur arrive chez vous",
    en_US: "Freshness Comes to Your Door"
  },
  "Per un ristorante italiano, la qualita degli ingredienti e fondamentale. Ma come garantire che i prodotti freschi arrivino nelle migliori condizioni? LAPA ha la risposta con il suo servizio di consegna in tutta la Svizzera.": {
    de_CH: "Fuer ein italienisches Restaurant ist die Qualitaet der Zutaten grundlegend. Aber wie kann man garantieren, dass frische Produkte in bestem Zustand ankommen? LAPA hat die Antwort mit seinem Lieferservice in der ganzen Schweiz.",
    fr_CH: "Pour un restaurant italien, la qualite des ingredients est fondamentale. Mais comment garantir que les produits frais arrivent dans les meilleures conditions? LAPA a la reponse avec son service de livraison dans toute la Suisse.",
    en_US: "For an Italian restaurant, the quality of ingredients is fundamental. But how do you guarantee that fresh products arrive in the best conditions? LAPA has the answer with its delivery service throughout Switzerland."
  },
  "La Nostra Copertura": {
    de_CH: "Unsere Abdeckung",
    fr_CH: "Notre couverture",
    en_US: "Our Coverage"
  },
  "LAPA consegna in tutta la Svizzera:": {
    de_CH: "LAPA liefert in die ganze Schweiz:",
    fr_CH: "LAPA livre dans toute la Suisse:",
    en_US: "LAPA delivers throughout Switzerland:"
  },
  "Zurigo e area metropolitana": {
    de_CH: "Zuerich und Grossraum",
    fr_CH: "Zurich et region metropolitaine",
    en_US: "Zurich and metropolitan area"
  },
  "Berna e Svizzera centrale": {
    de_CH: "Bern und Zentralschweiz",
    fr_CH: "Berne et Suisse centrale",
    en_US: "Bern and central Switzerland"
  },
  "Basilea e Svizzera nordoccidentale": {
    de_CH: "Basel und Nordwestschweiz",
    fr_CH: "Bale et Suisse du Nord-Ouest",
    en_US: "Basel and northwestern Switzerland"
  },
  "Ginevra e Romandia": {
    de_CH: "Genf und Romandie",
    fr_CH: "Geneve et Romandie",
    en_US: "Geneva and Romandy"
  },
  "Lugano e Ticino": {
    de_CH: "Lugano und Tessin",
    fr_CH: "Lugano et Tessin",
    en_US: "Lugano and Ticino"
  },
  "Tutte le altre regioni svizzere": {
    de_CH: "Alle anderen Schweizer Regionen",
    fr_CH: "Toutes les autres regions suisses",
    en_US: "All other Swiss regions"
  },
  "I Nostri Tempi di Consegna": {
    de_CH: "Unsere Lieferzeiten",
    fr_CH: "Nos delais de livraison",
    en_US: "Our Delivery Times"
  },
  "Prodotti freschi: consegna in 24-48 ore": {
    de_CH: "Frischprodukte: Lieferung in 24-48 Stunden",
    fr_CH: "Produits frais: livraison en 24-48 heures",
    en_US: "Fresh products: delivery in 24-48 hours"
  },
  "Prodotti secchi: consegna in 48-72 ore": {
    de_CH: "Trockene Produkte: Lieferung in 48-72 Stunden",
    fr_CH: "Produits secs: livraison en 48-72 heures",
    en_US: "Dry products: delivery in 48-72 hours"
  },
  "Ordini urgenti: possibilita di consegna express": {
    de_CH: "Dringende Bestellungen: Moeglichkeit der Expresslieferung",
    fr_CH: "Commandes urgentes: possibilite de livraison express",
    en_US: "Urgent orders: express delivery possible"
  },
  "Consegne programmate: scegli il giorno che preferisci": {
    de_CH: "Geplante Lieferungen: waehlen Sie den Tag, den Sie bevorzugen",
    fr_CH: "Livraisons programmees: choisissez le jour que vous preferez",
    en_US: "Scheduled deliveries: choose the day you prefer"
  },
  "La Catena del Freddo Garantita": {
    de_CH: "Die garantierte Kuehlkette",
    fr_CH: "La chaine du froid garantie",
    en_US: "The Guaranteed Cold Chain"
  },
  "Per i prodotti freschi, la catena del freddo e essenziale:": {
    de_CH: "Fuer Frischprodukte ist die Kuehlkette unerlasslich:",
    fr_CH: "Pour les produits frais, la chaine du froid est essentielle:",
    en_US: "For fresh products, the cold chain is essential:"
  },
  "Magazzini refrigerati a temperatura controllata": {
    de_CH: "Temperaturkontrollierte Kuehllager",
    fr_CH: "Entrepots refrigeres a temperature controlee",
    en_US: "Temperature-controlled refrigerated warehouses"
  },
  "Camion refrigerati per il trasporto": {
    de_CH: "Kuehlwagen fuer den Transport",
    fr_CH: "Camions refrigeres pour le transport",
    en_US: "Refrigerated trucks for transport"
  },
  "Monitoraggio costante della temperatura": {
    de_CH: "Staendige Temperaturueberwachung",
    fr_CH: "Surveillance constante de la temperature",
    en_US: "Constant temperature monitoring"
  },
  "Imballaggi termici per prodotti delicati": {
    de_CH: "Thermische Verpackungen fuer empfindliche Produkte",
    fr_CH: "Emballages thermiques pour produits delicats",
    en_US: "Thermal packaging for delicate products"
  },
  "Nessun Minimo d'Ordine": {
    de_CH: "Kein Mindestbestellwert",
    fr_CH: "Pas de minimum de commande",
    en_US: "No Minimum Order"
  },
  "A differenza di altri grossisti, LAPA non richiede minimi d'ordine. Puoi ordinare:": {
    de_CH: "Anders als andere Grosshaendler verlangt LAPA keinen Mindestbestellwert. Sie koennen bestellen:",
    fr_CH: "Contrairement a d'autres grossistes, LAPA n'exige pas de minimum de commande. Vous pouvez commander:",
    en_US: "Unlike other wholesalers, LAPA doesn't require minimum orders. You can order:"
  },
  "Anche solo un prodotto": {
    de_CH: "Auch nur ein Produkt",
    fr_CH: "Meme un seul produit",
    en_US: "Even just one product"
  },
  "Quantita piccole per testare nuovi ingredienti": {
    de_CH: "Kleine Mengen zum Testen neuer Zutaten",
    fr_CH: "Petites quantites pour tester de nouveaux ingredients",
    en_US: "Small quantities to test new ingredients"
  },
  "Riordini frequenti senza vincoli": {
    de_CH: "Haeufige Nachbestellungen ohne Einschraenkungen",
    fr_CH: "Reapprovisionnements frequents sans contraintes",
    en_US: "Frequent reorders without constraints"
  },
  "Esattamente quello che ti serve": {
    de_CH: "Genau das, was Sie brauchen",
    fr_CH: "Exactement ce dont vous avez besoin",
    en_US: "Exactly what you need"
  },
  "Come Ordinare": {
    de_CH: "Wie bestellen",
    fr_CH: "Comment commander",
    en_US: "How to Order"
  },
  "Online: attraverso il nostro sito web 24 ore su 24": {
    de_CH: "Online: ueber unsere Website rund um die Uhr",
    fr_CH: "En ligne: via notre site web 24 heures sur 24",
    en_US: "Online: through our website 24 hours a day"
  },
  "Telefono: il nostro team e a disposizione": {
    de_CH: "Telefon: unser Team steht zur Verfuegung",
    fr_CH: "Telephone: notre equipe est a disposition",
    en_US: "Phone: our team is available"
  },
  "Email: per ordini programmati": {
    de_CH: "E-Mail: fuer geplante Bestellungen",
    fr_CH: "Email: pour les commandes programmees",
    en_US: "Email: for scheduled orders"
  },
  "App: gestisci i tuoi ordini ovunque tu sia": {
    de_CH: "App: verwalten Sie Ihre Bestellungen ueberall",
    fr_CH: "Application: gerez vos commandes ou que vous soyez",
    en_US: "App: manage your orders wherever you are"
  },
  "I Nostri Prodotti Freschi": {
    de_CH: "Unsere Frischprodukte",
    fr_CH: "Nos produits frais",
    en_US: "Our Fresh Products"
  },
  "Consegniamo freschi ogni giorno:": {
    de_CH: "Wir liefern taeglich frisch:",
    fr_CH: "Nous livrons frais chaque jour:",
    en_US: "We deliver fresh every day:"
  },
  "Mozzarella e burrata freschissime": {
    de_CH: "Frischeste Mozzarella und Burrata",
    fr_CH: "Mozzarella et burrata tres fraiches",
    en_US: "Very fresh mozzarella and burrata"
  },
  "Salumi appena affettati": {
    de_CH: "Frisch geschnittene Wurstwaren",
    fr_CH: "Charcuteries fraichement tranchees",
    en_US: "Freshly sliced cured meats"
  },
  "Formaggi stagionati e freschi": {
    de_CH: "Gereifte und frische Kaese",
    fr_CH: "Fromages affines et frais",
    en_US: "Aged and fresh cheeses"
  },
  "Pasta fresca artigianale": {
    de_CH: "Handwerkliche frische Pasta",
    fr_CH: "Pates fraiches artisanales",
    en_US: "Artisanal fresh pasta"
  },
  "Verdure e ingredienti di stagione": {
    de_CH: "Saisonales Gemuese und Zutaten",
    fr_CH: "Legumes et ingredients de saison",
    en_US: "Seasonal vegetables and ingredients"
  },
  "Perche Scegliere LAPA": {
    de_CH: "Warum LAPA waehlen",
    fr_CH: "Pourquoi choisir LAPA",
    en_US: "Why Choose LAPA"
  },
  "Oltre 3.000 prodotti italiani autentici": {
    de_CH: "Ueber 3.000 authentische italienische Produkte",
    fr_CH: "Plus de 3.000 produits italiens authentiques",
    en_US: "Over 3,000 authentic Italian products"
  },
  "Importazione diretta dall'Italia": {
    de_CH: "Direktimport aus Italien",
    fr_CH: "Importation directe d'Italie",
    en_US: "Direct import from Italy"
  },
  "Prezzi competitivi per professionisti": {
    de_CH: "Wettbewerbsfaehige Preise fuer Profis",
    fr_CH: "Prix competitifs pour les professionnels",
    en_US: "Competitive prices for professionals"
  },
  "Assistenza dedicata e consulenza": {
    de_CH: "Engagierte Unterstuetzung und Beratung",
    fr_CH: "Assistance dediee et conseil",
    en_US: "Dedicated assistance and consulting"
  },
  "Fatturazione semplice e trasparente": {
    de_CH: "Einfache und transparente Rechnungsstellung",
    fr_CH: "Facturation simple et transparente",
    en_US: "Simple and transparent billing"
  },
  "Conclusione": {
    de_CH: "Fazit",
    fr_CH: "Conclusion",
    en_US: "Conclusion"
  },
  "Con LAPA, i migliori ingredienti italiani arrivano direttamente nel tuo ristorante. Freschezza garantita, consegna puntuale, nessun compromesso sulla qualita.": {
    de_CH: "Mit LAPA kommen die besten italienischen Zutaten direkt in Ihr Restaurant. Garantierte Frische, puenktliche Lieferung, keine Kompromisse bei der Qualitaet.",
    fr_CH: "Avec LAPA, les meilleurs ingredients italiens arrivent directement dans votre restaurant. Fraicheur garantie, livraison ponctuelle, aucun compromis sur la qualite.",
    en_US: "With LAPA, the best Italian ingredients arrive directly at your restaurant. Guaranteed freshness, punctual delivery, no compromise on quality."
  }
};

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 89: CONSEGNA PRODOTTI FRESCHI ===\n');

  // 1. Scrivo contenuto italiano
  console.log('1. Scrivo contenuto ITALIANO...');
  await callOdoo('blog.post', 'write',
    [[POST_ID], { content: ITALIAN_CONTENT }],
    { context: { lang: 'it_IT' } }
  );

  // 2. Leggo i segmenti
  console.log('2. Leggo segmenti...');
  const segmentData = await callOdoo('blog.post', 'get_field_translations', [[POST_ID], 'content']);
  const segments = segmentData[0];
  const sourceTexts = [...new Set(segments.map(s => s.source))];
  console.log(`   Trovati ${sourceTexts.length} segmenti`);

  // 3. Applico traduzioni per ogni lingua
  for (const lang of ['de_CH', 'fr_CH', 'en_US']) {
    const langTranslations = {};
    let count = 0;
    for (const src of sourceTexts) {
      if (TRANSLATIONS[src] && TRANSLATIONS[src][lang]) {
        langTranslations[src] = TRANSLATIONS[src][lang];
        count++;
      }
    }
    await callOdoo('blog.post', 'update_field_translations',
      [[POST_ID], 'content', { [lang]: langTranslations }]
    );
    console.log(`   ${lang}: ${count}/${sourceTexts.length} segmenti tradotti`);
  }

  // 4. Verifica
  console.log('\n--- VERIFICA ---\n');
  for (const lang of ['it_IT', 'de_CH', 'fr_CH', 'en_US']) {
    const data = await callOdoo('blog.post', 'read',
      [[POST_ID], ['content']],
      { context: { lang } }
    );
    const text = (data?.[0]?.content || '').replace(/<[^>]*>/g, '').substring(0, 60);
    console.log(`[${lang}] ${text}...`);
  }

  console.log('\n✅ ARTICOLO 89 COMPLETATO!');
}

main();
