/**
 * SCRIPT DI RIPRISTINO CONTENUTI BLOG
 * Ripristina i contenuti originali degli articoli blog ID 75-89
 */

const ODOO_CONFIG = {
  url: 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com',
  db: 'lapadevadmin-lapa-v2-main-7268478',
  username: 'paul@lapa.ch',
  password: 'lapa201180'
};

let sessionId: string = '';

// Contenuti originali degli articoli
const ORIGINAL_ARTICLES = [
  {
    id: 75,
    it: {
      name: 'Come Scegliere il Fornitore Giusto per la Tua Pizzeria in Svizzera',
      subtitle: 'Guida completa per ristoratori: criteri, qualità e servizio',
      content: `<h2>Perché la Scelta del Fornitore è Fondamentale</h2>
<p>Aprire una pizzeria di successo in Svizzera richiede molto più di una buona ricetta. <strong>La qualità degli ingredienti</strong> fa la differenza tra una pizza mediocre e una eccezionale. Per questo, scegliere il fornitore giusto è una delle decisioni più importanti che prenderai.</p>

<h2>I 5 Criteri Essenziali per Scegliere un Fornitore</h2>

<h3>1. Qualità dei Prodotti</h3>
<p>Non tutti i fornitori sono uguali. Cerca un grossista che:</p>
<ul>
<li>Importi direttamente dall'Italia</li>
<li>Offra prodotti DOP e IGP certificati</li>
<li>Garantisca la catena del freddo per i freschi</li>
<li>Abbia una selezione ampia di mozzarelle (fior di latte, bufala, burrata)</li>
</ul>

<h3>2. Affidabilità delle Consegne</h3>
<p>Una pizzeria non può permettersi di restare senza ingredienti. Il tuo fornitore deve garantire:</p>
<ul>
<li>Consegne puntuali e regolari</li>
<li>Flessibilità negli orari</li>
<li>Possibilità di ordini urgenti</li>
<li>Copertura in tutta la Svizzera</li>
</ul>

<h3>3. Rapporto Qualità-Prezzo</h3>
<p>Il prezzo più basso non è sempre la scelta migliore. Valuta il <strong>valore complessivo</strong>: qualità, servizio, affidabilità e supporto.</p>

<h3>4. Gamma di Prodotti</h3>
<p>Un buon fornitore per pizzerie dovrebbe offrire:</p>
<ul>
<li>Farine di alta qualità (tipo 00, integrale, multicereali)</li>
<li>Pomodori pelati San Marzano DOP</li>
<li>Mozzarella fresca e formaggi italiani</li>
<li>Salumi: prosciutto, speck, 'nduja, salame</li>
<li>Olio extravergine d'oliva</li>
<li>Verdure grigliate e sottoli</li>
</ul>

<h3>5. Servizio Clienti</h3>
<p>Cerca un partner, non solo un fornitore. Il servizio ideale include:</p>
<ul>
<li>Consulenza sui prodotti</li>
<li>Supporto per il menu</li>
<li>Gestione reclami efficiente</li>
<li>Nessun minimo d'ordine (o minimo ragionevole)</li>
</ul>

<h2>Perché Scegliere LAPA come Fornitore</h2>
<p>LAPA è il grossista di riferimento per pizzerie e ristoranti italiani in Svizzera. Offriamo:</p>
<ul>
<li>✅ Oltre 3.000 prodotti italiani autentici</li>
<li>✅ Consegna in tutta la Svizzera</li>
<li>✅ Nessun minimo d'ordine</li>
<li>✅ Prodotti freschi consegnati in 24-48 ore</li>
<li>✅ Assistenza dedicata per ogni cliente</li>
</ul>

<h2>Conclusione</h2>
<p>Scegliere il fornitore giusto è un investimento nel successo della tua pizzeria. Non accontentarti: i tuoi clienti meritano ingredienti di qualità, e tu meriti un partner affidabile.</p>

<p><strong>Vuoi scoprire i nostri prodotti?</strong> <a href="/shop">Visita il nostro catalogo</a> o <a href="/contactus">contattaci</a> per una consulenza gratuita.</p>`,
      website_meta_title: 'Fornitore Pizzeria Svizzera | Guida alla Scelta | LAPA',
      website_meta_description: 'Scopri come scegliere il miglior fornitore per la tua pizzeria in Svizzera. Criteri di qualità, consegna, prezzi e servizio. Guida completa LAPA.'
    },
    de: {
      name: 'So Wählen Sie den Richtigen Lieferanten für Ihre Pizzeria in der Schweiz',
      subtitle: 'Kompletter Leitfaden für Gastronomen: Kriterien, Qualität und Service',
      content: `<h2>Warum die Wahl des Lieferanten Entscheidend ist</h2>
<p>Eine erfolgreiche Pizzeria in der Schweiz zu eröffnen erfordert mehr als ein gutes Rezept. <strong>Die Qualität der Zutaten</strong> macht den Unterschied zwischen einer mittelmässigen und einer aussergewöhnlichen Pizza. Deshalb ist die Wahl des richtigen Lieferanten eine der wichtigsten Entscheidungen.</p>

<h2>Die 5 Wesentlichen Kriterien für die Lieferantenwahl</h2>

<h3>1. Produktqualität</h3>
<p>Nicht alle Lieferanten sind gleich. Suchen Sie einen Grosshändler, der:</p>
<ul>
<li>Direkt aus Italien importiert</li>
<li>DOP- und IGP-zertifizierte Produkte anbietet</li>
<li>Die Kühlkette für Frischprodukte garantiert</li>
<li>Eine breite Auswahl an Mozzarella bietet (Fior di Latte, Büffel, Burrata)</li>
</ul>

<h3>2. Lieferzuverlässigkeit</h3>
<p>Eine Pizzeria kann es sich nicht leisten, ohne Zutaten dazustehen. Ihr Lieferant muss garantieren:</p>
<ul>
<li>Pünktliche und regelmässige Lieferungen</li>
<li>Flexible Lieferzeiten</li>
<li>Möglichkeit für Eilbestellungen</li>
<li>Abdeckung in der ganzen Schweiz</li>
</ul>

<h3>3. Preis-Leistungs-Verhältnis</h3>
<p>Der niedrigste Preis ist nicht immer die beste Wahl. Bewerten Sie den <strong>Gesamtwert</strong>: Qualität, Service, Zuverlässigkeit und Support.</p>

<h3>4. Produktsortiment</h3>
<p>Ein guter Pizzeria-Lieferant sollte anbieten:</p>
<ul>
<li>Hochwertige Mehle (Tipo 00, Vollkorn, Mehrkorn)</li>
<li>San Marzano DOP geschälte Tomaten</li>
<li>Frische Mozzarella und italienische Käse</li>
<li>Wurstwaren: Prosciutto, Speck, 'Nduja, Salami</li>
<li>Natives Olivenöl extra</li>
<li>Gegrilltes Gemüse und Eingelegtes</li>
</ul>

<h3>5. Kundenservice</h3>
<p>Suchen Sie einen Partner, nicht nur einen Lieferanten. Der ideale Service umfasst:</p>
<ul>
<li>Produktberatung</li>
<li>Menü-Unterstützung</li>
<li>Effizientes Beschwerdemanagement</li>
<li>Kein Mindestbestellwert (oder vernünftiges Minimum)</li>
</ul>

<h2>Warum LAPA als Lieferant Wählen</h2>
<p>LAPA ist der führende Grosshändler für Pizzerien und italienische Restaurants in der Schweiz. Wir bieten:</p>
<ul>
<li>✅ Über 3.000 authentische italienische Produkte</li>
<li>✅ Lieferung in der ganzen Schweiz</li>
<li>✅ Kein Mindestbestellwert</li>
<li>✅ Frische Produkte in 24-48 Stunden geliefert</li>
<li>✅ Persönliche Betreuung für jeden Kunden</li>
</ul>

<h2>Fazit</h2>
<p>Den richtigen Lieferanten zu wählen ist eine Investition in den Erfolg Ihrer Pizzeria. Geben Sie sich nicht zufrieden: Ihre Kunden verdienen Qualitätszutaten, und Sie verdienen einen zuverlässigen Partner.</p>

<p><strong>Möchten Sie unsere Produkte entdecken?</strong> <a href="/shop">Besuchen Sie unseren Katalog</a> oder <a href="/contactus">kontaktieren Sie uns</a> für eine kostenlose Beratung.</p>`,
      website_meta_title: 'Pizzeria Lieferant Schweiz | Auswahlhilfe | LAPA',
      website_meta_description: 'Erfahren Sie, wie Sie den besten Lieferanten für Ihre Pizzeria in der Schweiz auswählen. Qualitätskriterien, Lieferung, Preise und Service. LAPA Leitfaden.'
    },
    fr: {
      name: 'Comment Choisir le Bon Fournisseur pour Votre Pizzeria en Suisse',
      subtitle: 'Guide complet pour restaurateurs: critères, qualité et service',
      content: `<h2>Pourquoi le Choix du Fournisseur est Fondamental</h2>
<p>Ouvrir une pizzeria à succès en Suisse nécessite bien plus qu'une bonne recette. <strong>La qualité des ingrédients</strong> fait la différence entre une pizza médiocre et une pizza exceptionnelle. C'est pourquoi choisir le bon fournisseur est l'une des décisions les plus importantes que vous prendrez.</p>

<h2>Les 5 Critères Essentiels pour Choisir un Fournisseur</h2>

<h3>1. Qualité des Produits</h3>
<p>Tous les fournisseurs ne se valent pas. Recherchez un grossiste qui:</p>
<ul>
<li>Importe directement d'Italie</li>
<li>Propose des produits certifiés DOP et IGP</li>
<li>Garantit la chaîne du froid pour les produits frais</li>
<li>Offre une large sélection de mozzarellas (fior di latte, bufflonne, burrata)</li>
</ul>

<h3>2. Fiabilité des Livraisons</h3>
<p>Une pizzeria ne peut pas se permettre de manquer d'ingrédients. Votre fournisseur doit garantir:</p>
<ul>
<li>Des livraisons ponctuelles et régulières</li>
<li>De la flexibilité dans les horaires</li>
<li>La possibilité de commandes urgentes</li>
<li>Une couverture dans toute la Suisse</li>
</ul>

<h3>3. Rapport Qualité-Prix</h3>
<p>Le prix le plus bas n'est pas toujours le meilleur choix. Évaluez la <strong>valeur globale</strong>: qualité, service, fiabilité et support.</p>

<h3>4. Gamme de Produits</h3>
<p>Un bon fournisseur pour pizzerias devrait offrir:</p>
<ul>
<li>Des farines de haute qualité (type 00, complète, multicéréales)</li>
<li>Des tomates pelées San Marzano DOP</li>
<li>De la mozzarella fraîche et des fromages italiens</li>
<li>De la charcuterie: prosciutto, speck, 'nduja, salami</li>
<li>De l'huile d'olive extra vierge</li>
<li>Des légumes grillés et conserves</li>
</ul>

<h3>5. Service Client</h3>
<p>Cherchez un partenaire, pas seulement un fournisseur. Le service idéal comprend:</p>
<ul>
<li>Conseil sur les produits</li>
<li>Support pour le menu</li>
<li>Gestion efficace des réclamations</li>
<li>Pas de minimum de commande (ou minimum raisonnable)</li>
</ul>

<h2>Pourquoi Choisir LAPA comme Fournisseur</h2>
<p>LAPA est le grossiste de référence pour les pizzerias et restaurants italiens en Suisse. Nous offrons:</p>
<ul>
<li>✅ Plus de 3'000 produits italiens authentiques</li>
<li>✅ Livraison dans toute la Suisse</li>
<li>✅ Pas de minimum de commande</li>
<li>✅ Produits frais livrés en 24-48 heures</li>
<li>✅ Assistance dédiée pour chaque client</li>
</ul>

<h2>Conclusion</h2>
<p>Choisir le bon fournisseur est un investissement dans le succès de votre pizzeria. Ne vous contentez pas de moins: vos clients méritent des ingrédients de qualité, et vous méritez un partenaire fiable.</p>

<p><strong>Vous voulez découvrir nos produits?</strong> <a href="/shop">Visitez notre catalogue</a> ou <a href="/contactus">contactez-nous</a> pour une consultation gratuite.</p>`,
      website_meta_title: 'Fournisseur Pizzeria Suisse | Guide de Choix | LAPA',
      website_meta_description: 'Découvrez comment choisir le meilleur fournisseur pour votre pizzeria en Suisse. Critères de qualité, livraison, prix et service. Guide complet LAPA.'
    },
    en: {
      name: 'How to Choose the Right Supplier for Your Pizzeria in Switzerland',
      subtitle: 'Complete guide for restaurateurs: criteria, quality and service',
      content: `<h2>Why Choosing the Right Supplier is Fundamental</h2>
<p>Opening a successful pizzeria in Switzerland requires much more than a good recipe. <strong>The quality of ingredients</strong> makes the difference between a mediocre pizza and an exceptional one. That's why choosing the right supplier is one of the most important decisions you'll make.</p>

<h2>The 5 Essential Criteria for Choosing a Supplier</h2>

<h3>1. Product Quality</h3>
<p>Not all suppliers are equal. Look for a wholesaler that:</p>
<ul>
<li>Imports directly from Italy</li>
<li>Offers DOP and IGP certified products</li>
<li>Guarantees the cold chain for fresh products</li>
<li>Has a wide selection of mozzarellas (fior di latte, buffalo, burrata)</li>
</ul>

<h3>2. Delivery Reliability</h3>
<p>A pizzeria cannot afford to run out of ingredients. Your supplier must guarantee:</p>
<ul>
<li>Punctual and regular deliveries</li>
<li>Flexible delivery times</li>
<li>Possibility of urgent orders</li>
<li>Coverage throughout Switzerland</li>
</ul>

<h3>3. Value for Money</h3>
<p>The lowest price is not always the best choice. Evaluate the <strong>overall value</strong>: quality, service, reliability and support.</p>

<h3>4. Product Range</h3>
<p>A good pizzeria supplier should offer:</p>
<ul>
<li>High-quality flours (tipo 00, wholemeal, multigrain)</li>
<li>San Marzano DOP peeled tomatoes</li>
<li>Fresh mozzarella and Italian cheeses</li>
<li>Cured meats: prosciutto, speck, 'nduja, salami</li>
<li>Extra virgin olive oil</li>
<li>Grilled vegetables and preserves</li>
</ul>

<h3>5. Customer Service</h3>
<p>Look for a partner, not just a supplier. Ideal service includes:</p>
<ul>
<li>Product consultation</li>
<li>Menu support</li>
<li>Efficient complaint handling</li>
<li>No minimum order (or reasonable minimum)</li>
</ul>

<h2>Why Choose LAPA as Your Supplier</h2>
<p>LAPA is the leading wholesaler for pizzerias and Italian restaurants in Switzerland. We offer:</p>
<ul>
<li>✅ Over 3,000 authentic Italian products</li>
<li>✅ Delivery throughout Switzerland</li>
<li>✅ No minimum order</li>
<li>✅ Fresh products delivered in 24-48 hours</li>
<li>✅ Dedicated support for every customer</li>
</ul>

<h2>Conclusion</h2>
<p>Choosing the right supplier is an investment in your pizzeria's success. Don't settle for less: your customers deserve quality ingredients, and you deserve a reliable partner.</p>

<p><strong>Want to discover our products?</strong> <a href="/shop">Visit our catalog</a> or <a href="/contactus">contact us</a> for a free consultation.</p>`,
      website_meta_title: 'Pizzeria Supplier Switzerland | Selection Guide | LAPA',
      website_meta_description: 'Discover how to choose the best supplier for your pizzeria in Switzerland. Quality criteria, delivery, prices and service. Complete LAPA guide.'
    }
  }
];

async function authenticate(): Promise<void> {
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

  if (!sessionId) throw new Error('Auth failed');
  console.log('✓ Autenticato');
}

async function writeWithLang(id: number, values: any, lang: string): Promise<boolean> {
  const response = await fetch(`${ODOO_CONFIG.url}/web/dataset/call_kw/blog.post/write`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_id=${sessionId}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model: 'blog.post',
        method: 'write',
        args: [[id], values],
        kwargs: { context: { lang } }
      },
      id: Date.now()
    })
  });

  const data: any = await response.json();
  return data.result === true;
}

async function main() {
  console.log('========================================');
  console.log('RIPRISTINO CONTENUTI BLOG');
  console.log('========================================\n');

  await authenticate();

  // Per ora ripristino solo l'articolo 75 come test
  const article = ORIGINAL_ARTICLES[0];
  console.log(`\nRipristino articolo ID ${article.id}...`);

  // Ripristina italiano
  console.log('  → Italiano...');
  await writeWithLang(article.id, {
    name: article.it.name,
    subtitle: article.it.subtitle,
    content: article.it.content,
    website_meta_title: article.it.website_meta_title,
    website_meta_description: article.it.website_meta_description
  }, 'it_IT');

  // Ripristina tedesco
  console.log('  → Tedesco...');
  await writeWithLang(article.id, {
    name: article.de.name,
    subtitle: article.de.subtitle,
    content: article.de.content,
    website_meta_title: article.de.website_meta_title,
    website_meta_description: article.de.website_meta_description
  }, 'de_CH');

  // Ripristina francese
  console.log('  → Francese...');
  await writeWithLang(article.id, {
    name: article.fr.name,
    subtitle: article.fr.subtitle,
    content: article.fr.content,
    website_meta_title: article.fr.website_meta_title,
    website_meta_description: article.fr.website_meta_description
  }, 'fr_CH');

  // Ripristina inglese
  console.log('  → Inglese...');
  await writeWithLang(article.id, {
    name: article.en.name,
    subtitle: article.en.subtitle,
    content: article.en.content,
    website_meta_title: article.en.website_meta_title,
    website_meta_description: article.en.website_meta_description
  }, 'en_US');

  console.log(`  ✓ Articolo ${article.id} ripristinato!`);

  console.log('\n========================================');
  console.log('Test completato per articolo 75.');
  console.log('Verificare sul sito prima di procedere.');
  console.log('========================================');
}

main();
