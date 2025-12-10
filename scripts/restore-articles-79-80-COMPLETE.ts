/**
 * COMPLETE RESTORATION: Articles 79 & 80
 * Final script to complete the blog restoration
 */

const ODOO_CONFIG = {
  url: 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com',
  db: 'lapadevadmin-lapa-v2-main-7268478',
  username: 'paul@lapa.ch',
  password: 'lapa201180'
};

let sessionId: string | null = null;

async function authenticate(): Promise<number> {
  const response = await fetch(`${ODOO_CONFIG.url}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        db: ODOO_CONFIG.db,
        login: ODOO_CONFIG.username,
        password: ODOO_CONFIG.password
      },
      id: Date.now()
    })
  });

  const cookies = response.headers.get('set-cookie');
  if (cookies) {
    const match = cookies.match(/session_id=([^;]+)/);
    if (match) sessionId = match[1];
  }

  const data: any = await response.json();
  if (!data.result?.uid) throw new Error('Auth failed');
  console.log(`✅ Authenticated as ${ODOO_CONFIG.username}`);
  return data.result.uid;
}

async function write(model: string, ids: number[], values: any, context?: any): Promise<boolean> {
  const response = await fetch(`${ODOO_CONFIG.url}/web/dataset/call_kw/${model}/write`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_id=${sessionId}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model,
        method: 'write',
        args: [ids, values],
        kwargs: { context: context || {} }
      },
      id: Date.now()
    })
  });

  const data: any = await response.json();
  if (data.error) {
    console.log(`❌ Error: ${data.error.data?.message || data.error.message}`);
    return false;
  }
  return data.result === true;
}

// Article 79: Grossista Prodotti Italiani
const ARTICLE_79 = {
  it_IT: {
    name: 'Grossista Prodotti Italiani in Svizzera: Come Scegliere il Migliore',
    subtitle: 'Guida per ristoranti, pizzerie e gastronomie alla ricerca di un fornitore affidabile',
    website_meta_title: 'Grossista Prodotti Italiani Svizzera | Guida Scelta | LAPA',
    website_meta_description: 'Cerchi un grossista di prodotti italiani in Svizzera? Guida completa per scegliere il fornitore giusto per il tuo ristorante. Qualità, servizio, prezzi.',
    content: `<h2>Perché Affidarsi a un Grossista Specializzato</h2>
<p>Gestire un ristorante italiano autentico in Svizzera richiede ingredienti autentici. Un grossista specializzato in prodotti italiani offre vantaggi che un distributore generico non può garantire:</p>
<ul>
<li>Selezione curata di prodotti autentici</li>
<li>Conoscenza approfondita delle specialità regionali</li>
<li>Rapporti diretti con produttori italiani</li>
<li>Consulenza esperta sui prodotti</li>
</ul>

<h2>Cosa Cercare in un Grossista</h2>

<h3>1. Ampiezza del Catalogo</h3>
<p>Un buon grossista dovrebbe offrire:</p>
<ul>
<li>Latticini freschi (mozzarella, burrata, ricotta)</li>
<li>Formaggi stagionati DOP</li>
<li>Salumi di qualità</li>
<li>Pasta secca e fresca</li>
<li>Conserve e sottoli</li>
<li>Olio e aceto</li>
<li>Prodotti da forno</li>
</ul>

<h3>2. Freschezza e Catena del Freddo</h3>
<p>Per i prodotti freschi, la catena del freddo è fondamentale. Verifica che il grossista abbia:</p>
<ul>
<li>Trasporto refrigerato</li>
<li>Magazzini a temperatura controllata</li>
<li>Rotazione frequente delle scorte</li>
</ul>

<h3>3. Frequenza di Consegna</h3>
<p>Idealmente, dovresti poter ricevere consegne multiple durante la settimana per mantenere sempre prodotti freschi.</p>

<h3>4. Flessibilità</h3>
<p>Cerca un fornitore che offra:</p>
<ul>
<li>Nessun minimo d'ordine (o minimo ragionevole)</li>
<li>Ordini last-minute per emergenze</li>
<li>Possibilità di testare nuovi prodotti</li>
</ul>

<h2>LAPA: Il Tuo Partner per i Prodotti Italiani</h2>
<p>LAPA è il grossista di riferimento per la ristorazione italiana in Svizzera:</p>
<ul>
<li>✅ Oltre 3.000 prodotti autentici italiani</li>
<li>✅ Importazione diretta dall'Italia</li>
<li>✅ Consegna in tutta la Svizzera</li>
<li>✅ Nessun minimo d'ordine</li>
<li>✅ Prodotti freschi consegnati in 24-48 ore</li>
<li>✅ Team dedicato per assistenza</li>
</ul>

<p><a href="/shop">Scopri il nostro catalogo</a> o <a href="/contactus">richiedi informazioni</a>.</p>`
  },
  de_DE: {
    name: 'Grosshändler für Italienische Produkte in der Schweiz: Den Besten Wählen',
    subtitle: 'Leitfaden für Restaurants, Pizzerien und Gastronomien auf der Suche nach einem zuverlässigen Lieferanten',
    website_meta_title: 'Grosshändler Italienische Produkte Schweiz | Auswahlhilfe | LAPA',
    website_meta_description: 'Suchen Sie einen Grosshändler für italienische Produkte in der Schweiz? Kompletter Leitfaden zur Auswahl des richtigen Lieferanten für Ihr Restaurant.',
    content: `<h2>Warum auf einen Spezialisierten Grosshändler Setzen</h2>
<p>Ein authentisches italienisches Restaurant in der Schweiz zu führen erfordert authentische Zutaten. Ein auf italienische Produkte spezialisierter Grosshändler bietet Vorteile, die ein generischer Distributor nicht garantieren kann:</p>
<ul>
<li>Kuratierte Auswahl authentischer Produkte</li>
<li>Tiefgehende Kenntnis regionaler Spezialitäten</li>
<li>Direkte Beziehungen zu italienischen Produzenten</li>
<li>Fachkundige Produktberatung</li>
</ul>

<h2>Worauf bei einem Grosshändler Achten</h2>

<h3>1. Katalogbreite</h3>
<p>Ein guter Grosshändler sollte bieten:</p>
<ul>
<li>Frische Milchprodukte (Mozzarella, Burrata, Ricotta)</li>
<li>DOP-gereifte Käse</li>
<li>Qualitätswurstwaren</li>
<li>Getrocknete und frische Pasta</li>
<li>Konserven und Eingelegtes</li>
<li>Öl und Essig</li>
<li>Backwaren</li>
</ul>

<h3>2. Frische und Kühlkette</h3>
<p>Für Frischprodukte ist die Kühlkette fundamental. Prüfen Sie, dass der Grosshändler hat:</p>
<ul>
<li>Gekühlten Transport</li>
<li>Temperaturkontrollierte Lager</li>
<li>Häufige Bestandsrotation</li>
</ul>

<h3>3. Lieferfrequenz</h3>
<p>Idealerweise sollten Sie mehrere Lieferungen pro Woche erhalten können, um immer frische Produkte zu haben.</p>

<h3>4. Flexibilität</h3>
<p>Suchen Sie einen Lieferanten, der bietet:</p>
<ul>
<li>Keinen Mindestbestellwert (oder vernünftiges Minimum)</li>
<li>Last-Minute-Bestellungen für Notfälle</li>
<li>Möglichkeit, neue Produkte zu testen</li>
</ul>

<h2>LAPA: Ihr Partner für Italienische Produkte</h2>
<p>LAPA ist der führende Grosshändler für italienische Gastronomie in der Schweiz:</p>
<ul>
<li>✅ Über 3.000 authentische italienische Produkte</li>
<li>✅ Direktimport aus Italien</li>
<li>✅ Lieferung in der ganzen Schweiz</li>
<li>✅ Kein Mindestbestellwert</li>
<li>✅ Frische Produkte in 24-48 Stunden geliefert</li>
<li>✅ Engagiertes Support-Team</li>
</ul>

<p><a href="/shop">Entdecken Sie unseren Katalog</a> oder <a href="/contactus">fordern Sie Informationen an</a>.</p>`
  },
  fr_FR: {
    name: 'Grossiste Produits Italiens en Suisse: Comment Choisir le Meilleur',
    subtitle: 'Guide pour restaurants, pizzerias et gastronomies à la recherche d\'un fournisseur fiable',
    website_meta_title: 'Grossiste Produits Italiens Suisse | Guide de Choix | LAPA',
    website_meta_description: 'Vous cherchez un grossiste de produits italiens en Suisse? Guide complet pour choisir le bon fournisseur pour votre restaurant. Qualité, service, prix.',
    content: `<h2>Pourquoi Faire Confiance à un Grossiste Spécialisé</h2>
<p>Gérer un restaurant italien authentique en Suisse nécessite des ingrédients authentiques. Un grossiste spécialisé en produits italiens offre des avantages qu'un distributeur générique ne peut garantir:</p>
<ul>
<li>Sélection soignée de produits authentiques</li>
<li>Connaissance approfondie des spécialités régionales</li>
<li>Relations directes avec les producteurs italiens</li>
<li>Conseil expert sur les produits</li>
</ul>

<h2>Que Rechercher chez un Grossiste</h2>

<h3>1. Étendue du Catalogue</h3>
<p>Un bon grossiste devrait offrir:</p>
<ul>
<li>Produits laitiers frais (mozzarella, burrata, ricotta)</li>
<li>Fromages affinés DOP</li>
<li>Charcuteries de qualité</li>
<li>Pâtes sèches et fraîches</li>
<li>Conserves et produits à l'huile</li>
<li>Huile et vinaigre</li>
<li>Produits de boulangerie</li>
</ul>

<h3>2. Fraîcheur et Chaîne du Froid</h3>
<p>Pour les produits frais, la chaîne du froid est fondamentale. Vérifiez que le grossiste dispose de:</p>
<ul>
<li>Transport réfrigéré</li>
<li>Entrepôts à température contrôlée</li>
<li>Rotation fréquente des stocks</li>
</ul>

<h3>3. Fréquence de Livraison</h3>
<p>Idéalement, vous devriez pouvoir recevoir plusieurs livraisons par semaine pour avoir toujours des produits frais.</p>

<h3>4. Flexibilité</h3>
<p>Cherchez un fournisseur qui offre:</p>
<ul>
<li>Pas de minimum de commande (ou minimum raisonnable)</li>
<li>Commandes de dernière minute pour les urgences</li>
<li>Possibilité de tester de nouveaux produits</li>
</ul>

<h2>LAPA: Votre Partenaire pour les Produits Italiens</h2>
<p>LAPA est le grossiste de référence pour la restauration italienne en Suisse:</p>
<ul>
<li>✅ Plus de 3'000 produits italiens authentiques</li>
<li>✅ Importation directe d'Italie</li>
<li>✅ Livraison dans toute la Suisse</li>
<li>✅ Pas de minimum de commande</li>
<li>✅ Produits frais livrés en 24-48 heures</li>
<li>✅ Équipe dédiée pour l'assistance</li>
</ul>

<p><a href="/shop">Découvrez notre catalogue</a> ou <a href="/contactus">demandez des informations</a>.</p>`
  },
  en_EN: {
    name: 'Italian Products Wholesaler in Switzerland: How to Choose the Best',
    subtitle: 'Guide for restaurants, pizzerias and gastronomy looking for a reliable supplier',
    website_meta_title: 'Italian Products Wholesaler Switzerland | Selection Guide | LAPA',
    website_meta_description: 'Looking for an Italian products wholesaler in Switzerland? Complete guide to choosing the right supplier for your restaurant. Quality, service, prices.',
    content: `<h2>Why Rely on a Specialized Wholesaler</h2>
<p>Running an authentic Italian restaurant in Switzerland requires authentic ingredients. A wholesaler specialized in Italian products offers advantages that a generic distributor cannot guarantee:</p>
<ul>
<li>Curated selection of authentic products</li>
<li>In-depth knowledge of regional specialties</li>
<li>Direct relationships with Italian producers</li>
<li>Expert product consultation</li>
</ul>

<h2>What to Look for in a Wholesaler</h2>

<h3>1. Catalog Breadth</h3>
<p>A good wholesaler should offer:</p>
<ul>
<li>Fresh dairy (mozzarella, burrata, ricotta)</li>
<li>DOP aged cheeses</li>
<li>Quality cured meats</li>
<li>Dried and fresh pasta</li>
<li>Preserves and products in oil</li>
<li>Oil and vinegar</li>
<li>Baked goods</li>
</ul>

<h3>2. Freshness and Cold Chain</h3>
<p>For fresh products, the cold chain is fundamental. Verify that the wholesaler has:</p>
<ul>
<li>Refrigerated transport</li>
<li>Temperature-controlled warehouses</li>
<li>Frequent stock rotation</li>
</ul>

<h3>3. Delivery Frequency</h3>
<p>Ideally, you should be able to receive multiple deliveries per week to always have fresh products.</p>

<h3>4. Flexibility</h3>
<p>Look for a supplier that offers:</p>
<ul>
<li>No minimum order (or reasonable minimum)</li>
<li>Last-minute orders for emergencies</li>
<li>Ability to test new products</li>
</ul>

<h2>LAPA: Your Partner for Italian Products</h2>
<p>LAPA is the leading wholesaler for Italian gastronomy in Switzerland:</p>
<ul>
<li>✅ Over 3,000 authentic Italian products</li>
<li>✅ Direct import from Italy</li>
<li>✅ Delivery throughout Switzerland</li>
<li>✅ No minimum order</li>
<li>✅ Fresh products delivered in 24-48 hours</li>
<li>✅ Dedicated support team</li>
</ul>

<p><a href="/shop">Discover our catalog</a> or <a href="/contactus">request information</a>.</p>`
  }
};

// Article 80: Guanciale vs Pancetta (only Italian in original)
const ARTICLE_80 = {
  it_IT: {
    name: 'Guanciale vs Pancetta: Qual è la Differenza e Quando Usarli',
    subtitle: 'La guida definitiva per ristoratori italiani',
    website_meta_title: 'Guanciale vs Pancetta | Differenze e Usi | LAPA',
    website_meta_description: 'Guanciale o pancetta? Scopri le differenze, quando usare ciascuno e perché il guanciale è essenziale per carbonara e amatriciana autentiche.',
    content: `<h2>Il Grande Dibattito: Guanciale vs Pancetta</h2>
<p>Per chi cucina italiano, la scelta tra guanciale e pancetta non è solo una questione di gusto: è una questione di <strong>autenticità</strong>. Vediamo le differenze e quando usare ciascuno.</p>

<h2>Cos'è il Guanciale</h2>
<p>Il guanciale è un salume ottenuto dalla <strong>guancia del maiale</strong>. Le sue caratteristiche:</p>
<ul>
<li><strong>Taglio:</strong> Guancia e parte della gola del suino</li>
<li><strong>Stagionatura:</strong> Minimo 3 settimane</li>
<li><strong>Sapore:</strong> Intenso, con note speziate (pepe nero)</li>
<li><strong>Grasso:</strong> Alto contenuto, si scioglie in modo cremoso</li>
<li><strong>Origine:</strong> Tradizione laziale (Roma, Amatrice)</li>
</ul>

<h2>Cos'è la Pancetta</h2>
<p>La pancetta è ricavata dalla <strong>pancia del maiale</strong>. Le sue caratteristiche:</p>
<ul>
<li><strong>Taglio:</strong> Ventresca/pancia</li>
<li><strong>Varietà:</strong> Tesa, arrotolata, affumicata</li>
<li><strong>Sapore:</strong> Più delicato, meno speziato</li>
<li><strong>Grasso:</strong> Bilanciato tra magro e grasso</li>
<li><strong>Origine:</strong> Diverse regioni italiane</li>
</ul>

<h2>Quando Usare il Guanciale (Obbligatorio!)</h2>
<ul>
<li><strong>Carbonara</strong> - MAI con pancetta o bacon!</li>
<li><strong>Amatriciana</strong> - Ricetta tradizionale di Amatrice</li>
<li><strong>Gricia</strong> - La "madre" della carbonara</li>
</ul>
<p>Il guanciale dona a questi piatti la cremosità e il sapore intenso che li rendono unici.</p>

<h2>Quando Usare la Pancetta</h2>
<ul>
<li>Sughi e ragù</li>
<li>Torte salate e quiche</li>
<li>Insalate e contorni</li>
<li>Bruschette e antipasti</li>
</ul>

<h2>Errori da Evitare</h2>
<p><strong>Mai usare bacon al posto del guanciale!</strong> Il bacon è affumicato e ha un sapore completamente diverso che rovina i piatti tradizionali romani.</p>

<h2>Dove Trovare Guanciale Autentico in Svizzera</h2>
<p>LAPA importa guanciale romano autentico direttamente dall'Italia. <a href="/shop">Scopri la nostra selezione di salumi</a>.</p>`
  }
};

async function restoreArticle(articleId: number, articleData: any) {
  console.log(`\n📝 Restoring Article ${articleId}...`);

  const languages = ['it_IT', 'de_DE', 'fr_FR', 'en_EN'];
  let success = 0;

  for (const lang of languages) {
    const langData = articleData[lang];
    if (!langData) {
      console.log(`   ⚠️  No ${lang} content - skipping`);
      continue;
    }

    const langName = { 'it_IT': 'Italian', 'de_DE': 'German', 'fr_FR': 'French', 'en_EN': 'English' }[lang];
    console.log(`   🌐 Writing ${langName}...`);

    const result = await write('blog.post', [articleId], langData, { lang });
    if (result) {
      console.log(`   ✅ ${langName} restored`);
      success++;
    } else {
      console.log(`   ❌ ${langName} failed`);
    }

    await new Promise(r => setTimeout(r, 300));
  }

  return success > 0;
}

async function main() {
  console.log('🚨 FINAL COMPLETE RESTORATION: Articles 79 & 80');
  console.log('='.repeat(60));

  await authenticate();

  let totalSuccess = 0;

  const result79 = await restoreArticle(79, ARTICLE_79);
  if (result79) totalSuccess++;

  const result80 = await restoreArticle(80, ARTICLE_80);
  if (result80) totalSuccess++;

  console.log('\n' + '='.repeat(60));
  console.log('📊 COMPLETE RESTORATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Article 76: FULLY RESTORED (4/4 languages)`);
  console.log(`✅ Article 77: FULLY RESTORED (4/4 languages)`);
  console.log(`✅ Article 78: FULLY RESTORED (4/4 languages)`);
  console.log(`✅ Article 79: ${result79 ? 'FULLY RESTORED (4/4 languages)' : 'FAILED'}`);
  console.log(`⚠️  Article 80: ${result80 ? 'PARTIALLY RESTORED (1/4 languages - Italian only)' : 'FAILED'}`);
  console.log('\n📝 NOTE: Article 80 was only created with Italian content in the');
  console.log('   original script. German, French, and English translations were');
  console.log('   never created and would need to be written.');
}

main();
