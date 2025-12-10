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

// Scrittura CON context lang - come fa l'app Social Marketing AI Studio
async function writeWithLang(id, values, lang) {
  const r = await fetch(ODOO.url + '/web/dataset/call_kw/blog.post/write', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': 'session_id=' + sid },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model: 'blog.post',
        method: 'write',
        args: [[id], values],
        kwargs: { context: { lang: lang } }
      },
      id: Date.now()
    })
  });
  return (await r.json());
}

async function readWithLang(id, lang) {
  const r = await fetch(ODOO.url + '/web/dataset/call_kw/blog.post/read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': 'session_id=' + sid },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model: 'blog.post',
        method: 'read',
        args: [[id]],
        kwargs: { fields: ['name', 'subtitle', 'content'], context: { lang } }
      },
      id: Date.now()
    })
  });
  return (await r.json()).result?.[0];
}

// TRADUZIONI ARTICOLO 75

const translations = {
  de_CH: {
    name: "Wie Sie den richtigen Lieferanten für Ihre Pizzeria in der Schweiz wählen",
    subtitle: "Vollständiger Leitfaden zur Auswahl des idealen Grossisten für italienische Qualitätszutaten",
    content: `<h2>Warum die Wahl des Lieferanten entscheidend ist</h2>
<p>Eine erfolgreiche Pizzeria in der Schweiz zu eröffnen erfordert viel mehr als ein gutes Rezept. <strong>Die Qualität der Zutaten</strong> macht den Unterschied zwischen einer mittelmässigen und einer aussergewöhnlichen Pizza. Deshalb ist die Wahl des richtigen Lieferanten eine der wichtigsten Entscheidungen, die Sie treffen werden.</p>

<h2>Die 5 wesentlichen Kriterien für die Lieferantenauswahl</h2>

<h3>1. Produktqualität</h3>
<p>Nicht alle Lieferanten sind gleich. Suchen Sie einen Grossisten, der:</p>
<ul>
<li>Direkt aus Italien importiert</li>
<li>Zertifizierte DOP- und IGP-Produkte anbietet</li>
<li>Die Kühlkette für Frischprodukte garantiert</li>
<li>Eine breite Auswahl an Mozzarella hat (Fior di Latte, Bufala, Burrata)</li>
</ul>

<h3>2. Lieferzuverlässigkeit</h3>
<p>Eine Pizzeria kann es sich nicht leisten, ohne Zutaten dazustehen. Ihr Lieferant muss garantieren:</p>
<ul>
<li>Pünktliche und regelmässige Lieferungen</li>
<li>Flexible Lieferzeiten</li>
<li>Möglichkeit für dringende Bestellungen</li>
<li>Abdeckung in der ganzen Schweiz</li>
</ul>

<h3>3. Preis-Leistungs-Verhältnis</h3>
<p>Der niedrigste Preis ist nicht immer die beste Wahl. Bewerten Sie den <strong>Gesamtwert</strong>: Qualität, Service, Zuverlässigkeit und Support.</p>

<h3>4. Produktsortiment</h3>
<p>Ein guter Lieferant sollte Ihnen alles bieten, was Sie brauchen:</p>
<ul>
<li>Professionelle Pizzamehle</li>
<li>San Marzano DOP Tomaten</li>
<li>Frische italienische Mozzarella</li>
<li>Qualitäts-Wurstwaren und Käse</li>
<li>Natives Olivenöl extra</li>
</ul>

<h3>5. Kundenservice</h3>
<p>Ein zuverlässiger Partner bietet Unterstützung, wenn Sie sie brauchen: Produktberatung, einfache Bestellabwicklung und schnelle Hilfe.</p>

<h2>Warum LAPA als Lieferant wählen</h2>
<p>LAPA ist der Referenz-Grossist für Pizzerien und italienische Restaurants in der Schweiz. Wir bieten:</p>
<ul>
<li>Über 3.000 authentische italienische Produkte</li>
<li>Lieferung in die ganze Schweiz</li>
<li>Kein Mindestbestellwert</li>
<li>Frische Produkte in 24-48 Stunden geliefert</li>
<li>Persönliche Betreuung für jeden Kunden</li>
</ul>

<h2>Fazit</h2>
<p>Den richtigen Lieferanten zu wählen ist eine Investition in den Erfolg Ihrer Pizzeria. Geben Sie sich nicht mit weniger zufrieden: Ihre Kunden verdienen Qualitätszutaten, und Sie verdienen einen zuverlässigen Partner.</p>

<p><strong>Möchten Sie unsere Produkte entdecken?</strong> <a href="/shop">Besuchen Sie unseren Katalog</a> oder <a href="/contactus">kontaktieren Sie uns</a> für eine kostenlose Beratung.</p>`
  },

  fr_CH: {
    name: "Comment choisir le bon fournisseur pour votre pizzeria en Suisse",
    subtitle: "Guide complet pour choisir le grossiste idéal pour des ingrédients italiens de qualité",
    content: `<h2>Pourquoi le choix du fournisseur est fondamental</h2>
<p>Ouvrir une pizzeria à succès en Suisse nécessite bien plus qu'une bonne recette. <strong>La qualité des ingrédients</strong> fait la différence entre une pizza médiocre et une pizza exceptionnelle. C'est pourquoi choisir le bon fournisseur est l'une des décisions les plus importantes que vous prendrez.</p>

<h2>Les 5 critères essentiels pour choisir un fournisseur</h2>

<h3>1. Qualité des produits</h3>
<p>Tous les fournisseurs ne se valent pas. Recherchez un grossiste qui :</p>
<ul>
<li>Importe directement d'Italie</li>
<li>Propose des produits DOP et IGP certifiés</li>
<li>Garantit la chaîne du froid pour les produits frais</li>
<li>Dispose d'une large sélection de mozzarellas (fior di latte, bufala, burrata)</li>
</ul>

<h3>2. Fiabilité des livraisons</h3>
<p>Une pizzeria ne peut pas se permettre de manquer d'ingrédients. Votre fournisseur doit garantir :</p>
<ul>
<li>Des livraisons ponctuelles et régulières</li>
<li>Une flexibilité dans les horaires</li>
<li>La possibilité de commandes urgentes</li>
<li>Une couverture dans toute la Suisse</li>
</ul>

<h3>3. Rapport qualité-prix</h3>
<p>Le prix le plus bas n'est pas toujours le meilleur choix. Évaluez la <strong>valeur globale</strong> : qualité, service, fiabilité et support.</p>

<h3>4. Gamme de produits</h3>
<p>Un bon fournisseur devrait vous offrir tout ce dont vous avez besoin :</p>
<ul>
<li>Farines professionnelles pour pizza</li>
<li>Tomates San Marzano DOP</li>
<li>Mozzarellas fraîches italiennes</li>
<li>Charcuteries et fromages de qualité</li>
<li>Huile d'olive extra vierge</li>
</ul>

<h3>5. Service client</h3>
<p>Un partenaire fiable offre un support quand vous en avez besoin : conseil sur les produits, gestion des commandes simplifiée et assistance rapide.</p>

<h2>Pourquoi choisir LAPA comme fournisseur</h2>
<p>LAPA est le grossiste de référence pour les pizzerias et restaurants italiens en Suisse. Nous offrons :</p>
<ul>
<li>Plus de 3 000 produits italiens authentiques</li>
<li>Livraison dans toute la Suisse</li>
<li>Pas de minimum de commande</li>
<li>Produits frais livrés en 24-48 heures</li>
<li>Assistance dédiée pour chaque client</li>
</ul>

<h2>Conclusion</h2>
<p>Choisir le bon fournisseur est un investissement dans le succès de votre pizzeria. Ne vous contentez pas de moins : vos clients méritent des ingrédients de qualité, et vous méritez un partenaire fiable.</p>

<p><strong>Vous voulez découvrir nos produits ?</strong> <a href="/shop">Visitez notre catalogue</a> ou <a href="/contactus">contactez-nous</a> pour une consultation gratuite.</p>`
  },

  en_US: {
    name: "How to Choose the Right Supplier for Your Pizzeria in Switzerland",
    subtitle: "Complete guide to selecting the ideal wholesaler for quality Italian ingredients",
    content: `<h2>Why Choosing the Right Supplier is Fundamental</h2>
<p>Opening a successful pizzeria in Switzerland requires much more than a good recipe. <strong>The quality of ingredients</strong> makes the difference between a mediocre pizza and an exceptional one. That's why choosing the right supplier is one of the most important decisions you'll make.</p>

<h2>The 5 Essential Criteria for Choosing a Supplier</h2>

<h3>1. Product Quality</h3>
<p>Not all suppliers are equal. Look for a wholesaler that:</p>
<ul>
<li>Imports directly from Italy</li>
<li>Offers certified DOP and IGP products</li>
<li>Guarantees the cold chain for fresh products</li>
<li>Has a wide selection of mozzarellas (fior di latte, buffalo, burrata)</li>
</ul>

<h3>2. Delivery Reliability</h3>
<p>A pizzeria cannot afford to run out of ingredients. Your supplier must guarantee:</p>
<ul>
<li>Punctual and regular deliveries</li>
<li>Flexibility in scheduling</li>
<li>Possibility of urgent orders</li>
<li>Coverage throughout Switzerland</li>
</ul>

<h3>3. Value for Money</h3>
<p>The lowest price isn't always the best choice. Evaluate the <strong>overall value</strong>: quality, service, reliability, and support.</p>

<h3>4. Product Range</h3>
<p>A good supplier should offer you everything you need:</p>
<ul>
<li>Professional pizza flours</li>
<li>San Marzano DOP tomatoes</li>
<li>Fresh Italian mozzarella</li>
<li>Quality cured meats and cheeses</li>
<li>Extra virgin olive oil</li>
</ul>

<h3>5. Customer Service</h3>
<p>A reliable partner offers support when you need it: product consultation, simple order management, and quick assistance.</p>

<h2>Why Choose LAPA as Your Supplier</h2>
<p>LAPA is the reference wholesaler for pizzerias and Italian restaurants in Switzerland. We offer:</p>
<ul>
<li>Over 3,000 authentic Italian products</li>
<li>Delivery throughout Switzerland</li>
<li>No minimum order</li>
<li>Fresh products delivered in 24-48 hours</li>
<li>Dedicated assistance for every customer</li>
</ul>

<h2>Conclusion</h2>
<p>Choosing the right supplier is an investment in your pizzeria's success. Don't settle for less: your customers deserve quality ingredients, and you deserve a reliable partner.</p>

<p><strong>Want to discover our products?</strong> <a href="/shop">Visit our catalog</a> or <a href="/contactus">contact us</a> for a free consultation.</p>`
  }
};

async function main() {
  await auth();

  console.log('\n=== TRADUZIONI CONTENUTO ARTICOLO 75 ===\n');

  // Tedesco
  console.log('1. Scrittura TEDESCO (de_CH)...');
  const deResult = await writeWithLang(75, translations.de_CH, 'de_CH');
  console.log('   DE:', deResult.result === true ? 'OK' : 'ERRORE');

  // Francese
  console.log('2. Scrittura FRANCESE (fr_CH)...');
  const frResult = await writeWithLang(75, translations.fr_CH, 'fr_CH');
  console.log('   FR:', frResult.result === true ? 'OK' : 'ERRORE');

  // Inglese
  console.log('3. Scrittura INGLESE (en_US)...');
  const enResult = await writeWithLang(75, translations.en_US, 'en_US');
  console.log('   EN:', enResult.result === true ? 'OK' : 'ERRORE');

  // Verifica
  console.log('\n--- VERIFICA ---\n');
  for (const lang of ['it_IT', 'de_CH', 'fr_CH', 'en_US']) {
    const data = await readWithLang(75, lang);
    const contentPreview = (data?.content || '').replace(/<[^>]*>/g, '').substring(0, 60);
    console.log(`[${lang}]`);
    console.log(`  Titolo: ${data?.name}`);
    console.log(`  Contenuto: ${contentPreview}...`);
    console.log('');
  }
}

main();
