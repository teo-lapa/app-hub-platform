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

// Funzione per tradurre un articolo
async function translateArticle(postId, italianContent, translationsDict) {
  console.log(`\n=== ARTICOLO ${postId} ===`);

  // 1. Scrivo contenuto italiano
  console.log('  1. Scrivo italiano...');
  await callOdoo('blog.post', 'write', [[postId], { content: italianContent }]);

  // 2. Leggo segmenti
  const segmentData = await callOdoo('blog.post', 'get_field_translations', [[postId], 'content']);
  if (!segmentData) {
    console.log('  ERRORE: non riesco a leggere segmenti');
    return;
  }
  const segments = segmentData[0];
  const sourceTexts = [...new Set(segments.map(s => s.source))];
  console.log(`  2. Trovati ${sourceTexts.length} segmenti`);

  // 3. Traduco
  for (const lang of ['de_CH', 'fr_CH', 'en_US']) {
    const langTranslations = {};
    let found = 0;

    for (const src of sourceTexts) {
      if (translationsDict[src] && translationsDict[src][lang]) {
        langTranslations[src] = translationsDict[src][lang];
        found++;
      }
    }

    if (found > 0) {
      await callOdoo('blog.post', 'update_field_translations',
        [[postId], 'content', { [lang]: langTranslations }]
      );
      console.log(`  ${lang}: ${found}/${sourceTexts.length} OK`);
    }
  }
}

// TRADUZIONI PER TUTTI GLI ARTICOLI
// Ogni chiave è il testo italiano, ogni valore è un oggetto {de_CH, fr_CH, en_US}

const TRANSLATIONS = {
  // --- ARTICOLO 76 ---
  "Il Sogno di Aprire un Ristorante Italiano": {
    de_CH: "Der Traum, ein italienisches Restaurant zu eröffnen",
    fr_CH: "Le rêve d'ouvrir un restaurant italien",
    en_US: "The Dream of Opening an Italian Restaurant"
  },
  "La Svizzera è un mercato ideale per la ristorazione italiana. Con una forte comunità italiana e una passione diffusa per la cucina mediterranea, aprire un ristorante italiano può essere un'ottima opportunità di business.": {
    de_CH: "Die Schweiz ist ein idealer Markt für italienische Gastronomie. Mit einer starken italienischen Gemeinschaft und einer weit verbreiteten Leidenschaft für die mediterrane Küche kann die Eröffnung eines italienischen Restaurants eine hervorragende Geschäftsmöglichkeit sein.",
    fr_CH: "La Suisse est un marché idéal pour la restauration italienne. Avec une forte communauté italienne et une passion répandue pour la cuisine méditerranéenne, ouvrir un restaurant italien peut être une excellente opportunité commerciale.",
    en_US: "Switzerland is an ideal market for Italian dining. With a strong Italian community and a widespread passion for Mediterranean cuisine, opening an Italian restaurant can be an excellent business opportunity."
  },
  "I Passi Fondamentali": {
    de_CH: "Die grundlegenden Schritte",
    fr_CH: "Les étapes fondamentales",
    en_US: "The Fundamental Steps"
  },
  "1. Business Plan e Finanziamenti": {
    de_CH: "1. Businessplan und Finanzierung",
    fr_CH: "1. Business Plan et Financement",
    en_US: "1. Business Plan and Financing"
  },
  "Prima di tutto, devi avere un piano solido:": {
    de_CH: "Zunächst brauchen Sie einen soliden Plan:",
    fr_CH: "Tout d'abord, vous devez avoir un plan solide :",
    en_US: "First of all, you need a solid plan:"
  },
  "Definisci il tuo concept (trattoria, pizzeria, fine dining)": {
    de_CH: "Definieren Sie Ihr Konzept (Trattoria, Pizzeria, Fine Dining)",
    fr_CH: "Définissez votre concept (trattoria, pizzeria, fine dining)",
    en_US: "Define your concept (trattoria, pizzeria, fine dining)"
  },
  "Stima i costi di avvio (location, attrezzature, licenze)": {
    de_CH: "Schätzen Sie die Startkosten (Standort, Ausrüstung, Lizenzen)",
    fr_CH: "Estimez les coûts de démarrage (emplacement, équipements, licences)",
    en_US: "Estimate startup costs (location, equipment, licenses)"
  },
  "Calcola i costi operativi mensili": {
    de_CH: "Berechnen Sie die monatlichen Betriebskosten",
    fr_CH: "Calculez les coûts opérationnels mensuels",
    en_US: "Calculate monthly operating costs"
  },
  "Prevedi il break-even point": {
    de_CH: "Planen Sie den Break-Even-Punkt",
    fr_CH: "Prévoyez le seuil de rentabilité",
    en_US: "Plan for the break-even point"
  },
  "2. Location e Permessi": {
    de_CH: "2. Standort und Genehmigungen",
    fr_CH: "2. Emplacement et Permis",
    en_US: "2. Location and Permits"
  },
  "La scelta della location è cruciale. Considera:": {
    de_CH: "Die Wahl des Standorts ist entscheidend. Berücksichtigen Sie:",
    fr_CH: "Le choix de l'emplacement est crucial. Considérez :",
    en_US: "The choice of location is crucial. Consider:"
  },
  "Traffico pedonale e visibilità": {
    de_CH: "Fussgängerverkehr und Sichtbarkeit",
    fr_CH: "Trafic piétonnier et visibilité",
    en_US: "Foot traffic and visibility"
  },
  "Parcheggio e accessibilità": {
    de_CH: "Parkplätze und Erreichbarkeit",
    fr_CH: "Stationnement et accessibilité",
    en_US: "Parking and accessibility"
  },
  "Concorrenza nella zona": {
    de_CH: "Konkurrenz in der Gegend",
    fr_CH: "Concurrence dans la zone",
    en_US: "Competition in the area"
  },
  "Costi di affitto": {
    de_CH: "Mietkosten",
    fr_CH: "Coûts de location",
    en_US: "Rental costs"
  },
  "Ricorda di ottenere tutti i permessi necessari: licenza per la somministrazione, autorizzazioni sanitarie, permessi comunali.": {
    de_CH: "Denken Sie daran, alle erforderlichen Genehmigungen einzuholen: Ausschankgenehmigung, Gesundheitsgenehmigungen, kommunale Genehmigungen.",
    fr_CH: "N'oubliez pas d'obtenir tous les permis nécessaires : licence de débit de boissons, autorisations sanitaires, permis communaux.",
    en_US: "Remember to obtain all necessary permits: liquor license, health authorizations, municipal permits."
  },
  "3. Attrezzature e Arredamento": {
    de_CH: "3. Ausrüstung und Einrichtung",
    fr_CH: "3. Équipements et Aménagement",
    en_US: "3. Equipment and Furnishing"
  },
  "Investi in attrezzature di qualità:": {
    de_CH: "Investieren Sie in Qualitätsausrüstung:",
    fr_CH: "Investissez dans des équipements de qualité :",
    en_US: "Invest in quality equipment:"
  },
  "Cucina professionale completa": {
    de_CH: "Komplette professionelle Küche",
    fr_CH: "Cuisine professionnelle complète",
    en_US: "Complete professional kitchen"
  },
  "Forno per pizza (se applicabile)": {
    de_CH: "Pizzaofen (falls zutreffend)",
    fr_CH: "Four à pizza (si applicable)",
    en_US: "Pizza oven (if applicable)"
  },
  "Sistemi di refrigerazione adeguati": {
    de_CH: "Angemessene Kühlsysteme",
    fr_CH: "Systèmes de réfrigération adéquats",
    en_US: "Adequate refrigeration systems"
  },
  "Arredamento che rifletta l'atmosfera italiana": {
    de_CH: "Einrichtung, die die italienische Atmosphäre widerspiegelt",
    fr_CH: "Décoration qui reflète l'atmosphère italienne",
    en_US: "Furnishing that reflects the Italian atmosphere"
  },
  "4. Menu e Fornitori": {
    de_CH: "4. Menü und Lieferanten",
    fr_CH: "4. Menu et Fournisseurs",
    en_US: "4. Menu and Suppliers"
  },
  "Il menu è il cuore del tuo ristorante. Per distinguerti:": {
    de_CH: "Das Menü ist das Herz Ihres Restaurants. Um sich abzuheben:",
    fr_CH: "Le menu est le cœur de votre restaurant. Pour vous démarquer :",
    en_US: "The menu is the heart of your restaurant. To stand out:"
  },
  "Usa ingredienti italiani autentici": {
    de_CH: "Verwenden Sie authentische italienische Zutaten",
    fr_CH: "Utilisez des ingrédients italiens authentiques",
    en_US: "Use authentic Italian ingredients"
  },
  "Scegli fornitori affidabili per prodotti freschi": {
    de_CH: "Wählen Sie zuverlässige Lieferanten für frische Produkte",
    fr_CH: "Choisissez des fournisseurs fiables pour les produits frais",
    en_US: "Choose reliable suppliers for fresh products"
  },
  "Offri piatti tradizionali eseguiti alla perfezione": {
    de_CH: "Bieten Sie traditionelle Gerichte perfekt zubereitet an",
    fr_CH: "Proposez des plats traditionnels exécutés à la perfection",
    en_US: "Offer traditional dishes executed to perfection"
  },
  "Considera specialità regionali italiane": {
    de_CH: "Berücksichtigen Sie italienische regionale Spezialitäten",
    fr_CH: "Considérez les spécialités régionales italiennes",
    en_US: "Consider Italian regional specialties"
  },
  "5. Staff e Formazione": {
    de_CH: "5. Personal und Schulung",
    fr_CH: "5. Personnel et Formation",
    en_US: "5. Staff and Training"
  },
  "Il personale fa la differenza:": {
    de_CH: "Das Personal macht den Unterschied:",
    fr_CH: "Le personnel fait la différence :",
    en_US: "The staff makes the difference:"
  },
  "Assumi chef con esperienza in cucina italiana": {
    de_CH: "Stellen Sie Köche mit Erfahrung in der italienischen Küche ein",
    fr_CH: "Engagez des chefs expérimentés en cuisine italienne",
    en_US: "Hire chefs with experience in Italian cuisine"
  },
  "Forma il personale di sala sui piatti e sui vini": {
    de_CH: "Schulen Sie das Servicepersonal über Gerichte und Weine",
    fr_CH: "Formez le personnel de salle sur les plats et les vins",
    en_US: "Train front-of-house staff on dishes and wines"
  },
  "Crea un ambiente di lavoro positivo": {
    de_CH: "Schaffen Sie ein positives Arbeitsumfeld",
    fr_CH: "Créez un environnement de travail positif",
    en_US: "Create a positive work environment"
  },
  "L'Importanza dei Fornitori Giusti": {
    de_CH: "Die Bedeutung der richtigen Lieferanten",
    fr_CH: "L'importance des bons fournisseurs",
    en_US: "The Importance of the Right Suppliers"
  },
  "Un ristorante italiano autentico ha bisogno di ingredienti autentici. Scegli un grossista che possa fornirti:": {
    de_CH: "Ein authentisches italienisches Restaurant braucht authentische Zutaten. Wählen Sie einen Grossisten, der Ihnen liefern kann:",
    fr_CH: "Un restaurant italien authentique a besoin d'ingrédients authentiques. Choisissez un grossiste qui peut vous fournir :",
    en_US: "An authentic Italian restaurant needs authentic ingredients. Choose a wholesaler who can provide you with:"
  },
  "Pasta fresca e secca di qualità": {
    de_CH: "Qualitäts-Frisch- und Trockennudeln",
    fr_CH: "Pâtes fraîches et sèches de qualité",
    en_US: "Quality fresh and dry pasta"
  },
  "Formaggi DOP italiani": {
    de_CH: "Italienische DOP-Käse",
    fr_CH: "Fromages DOP italiens",
    en_US: "Italian DOP cheeses"
  },
  "Salumi tradizionali": {
    de_CH: "Traditionelle Wurstwaren",
    fr_CH: "Charcuteries traditionnelles",
    en_US: "Traditional cured meats"
  },
  "Olio extravergine d'oliva": {
    de_CH: "Natives Olivenöl extra",
    fr_CH: "Huile d'olive extra vierge",
    en_US: "Extra virgin olive oil"
  },
  "Prodotti freschi consegnati regolarmente": {
    de_CH: "Regelmässig gelieferte Frischprodukte",
    fr_CH: "Produits frais livrés régulièrement",
    en_US: "Fresh products delivered regularly"
  },
  "LAPA: Il Partner per il Tuo Ristorante": {
    de_CH: "LAPA: Der Partner für Ihr Restaurant",
    fr_CH: "LAPA : Le partenaire pour votre restaurant",
    en_US: "LAPA: The Partner for Your Restaurant"
  },
  "LAPA supporta ristoranti italiani in tutta la Svizzera con oltre 3.000 prodotti autentici. Consegniamo in tutto il paese senza minimi d'ordine, permettendoti di gestire il tuo inventario con flessibilità.": {
    de_CH: "LAPA unterstützt italienische Restaurants in der ganzen Schweiz mit über 3.000 authentischen Produkten. Wir liefern landesweit ohne Mindestbestellwert und ermöglichen Ihnen eine flexible Lagerverwaltung.",
    fr_CH: "LAPA soutient les restaurants italiens dans toute la Suisse avec plus de 3 000 produits authentiques. Nous livrons dans tout le pays sans minimum de commande, vous permettant de gérer votre inventaire avec flexibilité.",
    en_US: "LAPA supports Italian restaurants throughout Switzerland with over 3,000 authentic products. We deliver nationwide with no minimum order, allowing you to manage your inventory with flexibility."
  },
  "Stai pianificando il tuo ristorante? Contattaci per scoprire come possiamo supportare la tua attività.": {
    de_CH: "Planen Sie Ihr Restaurant? Kontaktieren Sie uns, um zu erfahren, wie wir Ihr Geschäft unterstützen können.",
    fr_CH: "Vous planifiez votre restaurant ? Contactez-nous pour découvrir comment nous pouvons soutenir votre activité.",
    en_US: "Planning your restaurant? Contact us to find out how we can support your business."
  }
};

// CONTENUTI ITALIANI
const ARTICLES = {
  76: `<h2>Il Sogno di Aprire un Ristorante Italiano</h2>
<p>La Svizzera è un mercato ideale per la ristorazione italiana. Con una forte comunità italiana e una passione diffusa per la cucina mediterranea, aprire un ristorante italiano può essere un'ottima opportunità di business.</p>

<h2>I Passi Fondamentali</h2>

<h3>1. Business Plan e Finanziamenti</h3>
<p>Prima di tutto, devi avere un piano solido:</p>
<ul>
<li>Definisci il tuo concept (trattoria, pizzeria, fine dining)</li>
<li>Stima i costi di avvio (location, attrezzature, licenze)</li>
<li>Calcola i costi operativi mensili</li>
<li>Prevedi il break-even point</li>
</ul>

<h3>2. Location e Permessi</h3>
<p>La scelta della location è cruciale. Considera:</p>
<ul>
<li>Traffico pedonale e visibilità</li>
<li>Parcheggio e accessibilità</li>
<li>Concorrenza nella zona</li>
<li>Costi di affitto</li>
</ul>
<p>Ricorda di ottenere tutti i permessi necessari: licenza per la somministrazione, autorizzazioni sanitarie, permessi comunali.</p>

<h3>3. Attrezzature e Arredamento</h3>
<p>Investi in attrezzature di qualità:</p>
<ul>
<li>Cucina professionale completa</li>
<li>Forno per pizza (se applicabile)</li>
<li>Sistemi di refrigerazione adeguati</li>
<li>Arredamento che rifletta l'atmosfera italiana</li>
</ul>

<h3>4. Menu e Fornitori</h3>
<p>Il menu è il cuore del tuo ristorante. Per distinguerti:</p>
<ul>
<li>Usa ingredienti italiani autentici</li>
<li>Scegli fornitori affidabili per prodotti freschi</li>
<li>Offri piatti tradizionali eseguiti alla perfezione</li>
<li>Considera specialità regionali italiane</li>
</ul>

<h3>5. Staff e Formazione</h3>
<p>Il personale fa la differenza:</p>
<ul>
<li>Assumi chef con esperienza in cucina italiana</li>
<li>Forma il personale di sala sui piatti e sui vini</li>
<li>Crea un ambiente di lavoro positivo</li>
</ul>

<h2>L'Importanza dei Fornitori Giusti</h2>
<p>Un ristorante italiano autentico ha bisogno di ingredienti autentici. Scegli un grossista che possa fornirti:</p>
<ul>
<li>Pasta fresca e secca di qualità</li>
<li>Formaggi DOP italiani</li>
<li>Salumi tradizionali</li>
<li>Olio extravergine d'oliva</li>
<li>Prodotti freschi consegnati regolarmente</li>
</ul>

<h2>LAPA: Il Partner per il Tuo Ristorante</h2>
<p>LAPA supporta ristoranti italiani in tutta la Svizzera con oltre 3.000 prodotti autentici. Consegniamo in tutto il paese senza minimi d'ordine, permettendoti di gestire il tuo inventario con flessibilità.</p>

<p>Stai pianificando il tuo ristorante? Contattaci per scoprire come possiamo supportare la tua attività.</p>`
};

async function main() {
  await auth();

  console.log('\n========================================');
  console.log('TRADUZIONE CONTENUTI ARTICOLI 76-89');
  console.log('========================================\n');

  // Traduci articolo 76
  if (ARTICLES[76]) {
    await translateArticle(76, ARTICLES[76], TRANSLATIONS);
  }

  // Verifica finale
  console.log('\n--- VERIFICA ARTICOLO 76 ---\n');
  for (const lang of ['it_IT', 'de_CH', 'fr_CH', 'en_US']) {
    const data = await callOdoo('blog.post', 'read', [[76], ['content']], { context: { lang } });
    const contentText = (data?.[0]?.content || '').replace(/<[^>]*>/g, '').substring(0, 80);
    console.log(`[${lang}] ${contentText}...`);
  }
}

main();
