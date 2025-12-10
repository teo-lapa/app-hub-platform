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

const postId = 75;

// Contenuto italiano
const italianContent = `<h2>Perché la Scelta del Fornitore è Fondamentale</h2>
<p>Aprire una pizzeria di successo in Svizzera richiede molto più di una buona ricetta. La qualità degli ingredienti fa la differenza tra una pizza mediocre e una eccezionale. Per questo, scegliere il fornitore giusto è una delle decisioni più importanti che prenderai.</p>

<h2>I 5 Criteri Essenziali per Scegliere un Fornitore</h2>

<h3>1. Qualità dei Prodotti</h3>
<p>Non tutti i fornitori sono uguali. Cerca un grossista che:</p>
<ul>
<li>Importi direttamente dall'Italia</li>
<li>Offra prodotti DOP e IGP certificati</li>
<li>Garantisca la catena del freddo per i freschi</li>
<li>Abbia una selezione ampia di mozzarelle</li>
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
<p>Il prezzo più basso non è sempre la scelta migliore. Valuta il valore complessivo: qualità, servizio, affidabilità e supporto.</p>

<h3>4. Gamma di Prodotti</h3>
<p>Un buon fornitore dovrebbe offrirti tutto ciò di cui hai bisogno:</p>
<ul>
<li>Farine professionali per pizza</li>
<li>Pomodori San Marzano DOP</li>
<li>Mozzarelle fresche italiane</li>
<li>Salumi e formaggi di qualità</li>
<li>Olio extravergine d'oliva</li>
</ul>

<h3>5. Servizio Clienti</h3>
<p>Un partner affidabile offre supporto quando ne hai bisogno: consulenza sui prodotti, gestione degli ordini semplice e assistenza rapida.</p>

<h2>Perché Scegliere LAPA come Fornitore</h2>
<p>LAPA è il grossista di riferimento per pizzerie e ristoranti italiani in Svizzera. Offriamo:</p>
<ul>
<li>Oltre 3.000 prodotti italiani autentici</li>
<li>Consegna in tutta la Svizzera</li>
<li>Nessun minimo d'ordine</li>
<li>Prodotti freschi consegnati in 24-48 ore</li>
<li>Assistenza dedicata per ogni cliente</li>
</ul>

<h2>Conclusione</h2>
<p>Scegliere il fornitore giusto è un investimento nel successo della tua pizzeria. Non accontentarti: i tuoi clienti meritano ingredienti di qualità, e tu meriti un partner affidabile.</p>

<p>Vuoi scoprire i nostri prodotti? Visita il nostro catalogo o contattaci per una consulenza gratuita.</p>`;

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 75 - TRADUZIONE COMPLETA ===\n');

  // 1. Scrivo contenuto italiano
  console.log('1. Scrivo contenuto ITALIANO...');
  await callOdoo('blog.post', 'write', [[postId], { content: italianContent }]);

  // 2. Leggo i segmenti
  console.log('2. Leggo segmenti...');
  const segmentData = await callOdoo('blog.post', 'get_field_translations', [[postId], 'content']);
  const segments = segmentData[0];
  const sourceTexts = [...new Set(segments.map(s => s.source))];
  console.log(`   Trovati ${sourceTexts.length} segmenti unici:`);
  for (const src of sourceTexts) {
    console.log(`   - "${src.substring(0, 50)}${src.length > 50 ? '...' : ''}"`);
  }

  // 3. Preparo traduzioni dinamiche
  console.log('\n3. Preparo traduzioni...');

  // Funzione per tradurre un testo
  function translateText(text, lang) {
    const dict = {
      "Perché la Scelta del Fornitore è Fondamentale": {
        de_CH: "Warum die Wahl des Lieferanten entscheidend ist",
        fr_CH: "Pourquoi le choix du fournisseur est fondamental",
        en_US: "Why Choosing the Right Supplier is Fundamental"
      },
      "Aprire una pizzeria di successo in Svizzera richiede molto più di una buona ricetta. La qualità degli ingredienti fa la differenza tra una pizza mediocre e una eccezionale. Per questo, scegliere il fornitore giusto è una delle decisioni più importanti che prenderai.": {
        de_CH: "Eine erfolgreiche Pizzeria in der Schweiz zu eröffnen erfordert viel mehr als ein gutes Rezept. Die Qualität der Zutaten macht den Unterschied zwischen einer mittelmässigen und einer aussergewöhnlichen Pizza. Deshalb ist die Wahl des richtigen Lieferanten eine der wichtigsten Entscheidungen, die Sie treffen werden.",
        fr_CH: "Ouvrir une pizzeria à succès en Suisse nécessite bien plus qu'une bonne recette. La qualité des ingrédients fait la différence entre une pizza médiocre et une pizza exceptionnelle. C'est pourquoi choisir le bon fournisseur est l'une des décisions les plus importantes que vous prendrez.",
        en_US: "Opening a successful pizzeria in Switzerland requires much more than a good recipe. The quality of ingredients makes the difference between a mediocre pizza and an exceptional one. That's why choosing the right supplier is one of the most important decisions you'll make."
      },
      "I 5 Criteri Essenziali per Scegliere un Fornitore": {
        de_CH: "Die 5 wesentlichen Kriterien für die Lieferantenauswahl",
        fr_CH: "Les 5 critères essentiels pour choisir un fournisseur",
        en_US: "The 5 Essential Criteria for Choosing a Supplier"
      },
      "1. Qualità dei Prodotti": {
        de_CH: "1. Produktqualität",
        fr_CH: "1. Qualité des produits",
        en_US: "1. Product Quality"
      },
      "Non tutti i fornitori sono uguali. Cerca un grossista che:": {
        de_CH: "Nicht alle Lieferanten sind gleich. Suchen Sie einen Grossisten, der:",
        fr_CH: "Tous les fournisseurs ne se valent pas. Recherchez un grossiste qui :",
        en_US: "Not all suppliers are equal. Look for a wholesaler that:"
      },
      "Importi direttamente dall'Italia": {
        de_CH: "Direkt aus Italien importiert",
        fr_CH: "Importe directement d'Italie",
        en_US: "Imports directly from Italy"
      },
      "Offra prodotti DOP e IGP certificati": {
        de_CH: "Zertifizierte DOP- und IGP-Produkte anbietet",
        fr_CH: "Propose des produits DOP et IGP certifiés",
        en_US: "Offers certified DOP and IGP products"
      },
      "Garantisca la catena del freddo per i freschi": {
        de_CH: "Die Kühlkette für Frischprodukte garantiert",
        fr_CH: "Garantit la chaîne du froid pour les produits frais",
        en_US: "Guarantees the cold chain for fresh products"
      },
      "Abbia una selezione ampia di mozzarelle": {
        de_CH: "Eine breite Auswahl an Mozzarella hat",
        fr_CH: "Dispose d'une large sélection de mozzarellas",
        en_US: "Has a wide selection of mozzarellas"
      },
      "2. Affidabilità delle Consegne": {
        de_CH: "2. Lieferzuverlässigkeit",
        fr_CH: "2. Fiabilité des livraisons",
        en_US: "2. Delivery Reliability"
      },
      "Una pizzeria non può permettersi di restare senza ingredienti. Il tuo fornitore deve garantire:": {
        de_CH: "Eine Pizzeria kann es sich nicht leisten, ohne Zutaten dazustehen. Ihr Lieferant muss garantieren:",
        fr_CH: "Une pizzeria ne peut pas se permettre de manquer d'ingrédients. Votre fournisseur doit garantir :",
        en_US: "A pizzeria cannot afford to run out of ingredients. Your supplier must guarantee:"
      },
      "Consegne puntuali e regolari": {
        de_CH: "Pünktliche und regelmässige Lieferungen",
        fr_CH: "Des livraisons ponctuelles et régulières",
        en_US: "Punctual and regular deliveries"
      },
      "Flessibilità negli orari": {
        de_CH: "Flexible Lieferzeiten",
        fr_CH: "Une flexibilité dans les horaires",
        en_US: "Flexibility in scheduling"
      },
      "Possibilità di ordini urgenti": {
        de_CH: "Möglichkeit für dringende Bestellungen",
        fr_CH: "La possibilité de commandes urgentes",
        en_US: "Possibility of urgent orders"
      },
      "Copertura in tutta la Svizzera": {
        de_CH: "Abdeckung in der ganzen Schweiz",
        fr_CH: "Une couverture dans toute la Suisse",
        en_US: "Coverage throughout Switzerland"
      },
      "3. Rapporto Qualità-Prezzo": {
        de_CH: "3. Preis-Leistungs-Verhältnis",
        fr_CH: "3. Rapport qualité-prix",
        en_US: "3. Value for Money"
      },
      "Il prezzo più basso non è sempre la scelta migliore. Valuta il valore complessivo: qualità, servizio, affidabilità e supporto.": {
        de_CH: "Der niedrigste Preis ist nicht immer die beste Wahl. Bewerten Sie den Gesamtwert: Qualität, Service, Zuverlässigkeit und Support.",
        fr_CH: "Le prix le plus bas n'est pas toujours le meilleur choix. Évaluez la valeur globale : qualité, service, fiabilité et support.",
        en_US: "The lowest price isn't always the best choice. Evaluate the overall value: quality, service, reliability, and support."
      },
      "4. Gamma di Prodotti": {
        de_CH: "4. Produktsortiment",
        fr_CH: "4. Gamme de produits",
        en_US: "4. Product Range"
      },
      "Un buon fornitore dovrebbe offrirti tutto ciò di cui hai bisogno:": {
        de_CH: "Ein guter Lieferant sollte Ihnen alles bieten, was Sie brauchen:",
        fr_CH: "Un bon fournisseur devrait vous offrir tout ce dont vous avez besoin :",
        en_US: "A good supplier should offer you everything you need:"
      },
      "Farine professionali per pizza": {
        de_CH: "Professionelle Pizzamehle",
        fr_CH: "Farines professionnelles pour pizza",
        en_US: "Professional pizza flours"
      },
      "Pomodori San Marzano DOP": {
        de_CH: "San Marzano DOP Tomaten",
        fr_CH: "Tomates San Marzano DOP",
        en_US: "San Marzano DOP tomatoes"
      },
      "Mozzarelle fresche italiane": {
        de_CH: "Frische italienische Mozzarella",
        fr_CH: "Mozzarellas fraîches italiennes",
        en_US: "Fresh Italian mozzarella"
      },
      "Salumi e formaggi di qualità": {
        de_CH: "Qualitäts-Wurstwaren und Käse",
        fr_CH: "Charcuteries et fromages de qualité",
        en_US: "Quality cured meats and cheeses"
      },
      "Olio extravergine d'oliva": {
        de_CH: "Natives Olivenöl extra",
        fr_CH: "Huile d'olive extra vierge",
        en_US: "Extra virgin olive oil"
      },
      "5. Servizio Clienti": {
        de_CH: "5. Kundenservice",
        fr_CH: "5. Service client",
        en_US: "5. Customer Service"
      },
      "Un partner affidabile offre supporto quando ne hai bisogno: consulenza sui prodotti, gestione degli ordini semplice e assistenza rapida.": {
        de_CH: "Ein zuverlässiger Partner bietet Unterstützung, wenn Sie sie brauchen: Produktberatung, einfache Bestellabwicklung und schnelle Hilfe.",
        fr_CH: "Un partenaire fiable offre un support quand vous en avez besoin : conseil sur les produits, gestion des commandes simplifiée et assistance rapide.",
        en_US: "A reliable partner offers support when you need it: product consultation, simple order management, and quick assistance."
      },
      "Perché Scegliere LAPA come Fornitore": {
        de_CH: "Warum LAPA als Lieferant wählen",
        fr_CH: "Pourquoi choisir LAPA comme fournisseur",
        en_US: "Why Choose LAPA as Your Supplier"
      },
      "LAPA è il grossista di riferimento per pizzerie e ristoranti italiani in Svizzera. Offriamo:": {
        de_CH: "LAPA ist der Referenz-Grossist für Pizzerien und italienische Restaurants in der Schweiz. Wir bieten:",
        fr_CH: "LAPA est le grossiste de référence pour les pizzerias et restaurants italiens en Suisse. Nous offrons :",
        en_US: "LAPA is the reference wholesaler for pizzerias and Italian restaurants in Switzerland. We offer:"
      },
      "Oltre 3.000 prodotti italiani autentici": {
        de_CH: "Über 3.000 authentische italienische Produkte",
        fr_CH: "Plus de 3 000 produits italiens authentiques",
        en_US: "Over 3,000 authentic Italian products"
      },
      "Consegna in tutta la Svizzera": {
        de_CH: "Lieferung in die ganze Schweiz",
        fr_CH: "Livraison dans toute la Suisse",
        en_US: "Delivery throughout Switzerland"
      },
      "Nessun minimo d'ordine": {
        de_CH: "Kein Mindestbestellwert",
        fr_CH: "Pas de minimum de commande",
        en_US: "No minimum order"
      },
      "Prodotti freschi consegnati in 24-48 ore": {
        de_CH: "Frische Produkte in 24-48 Stunden geliefert",
        fr_CH: "Produits frais livrés en 24-48 heures",
        en_US: "Fresh products delivered in 24-48 hours"
      },
      "Assistenza dedicata per ogni cliente": {
        de_CH: "Persönliche Betreuung für jeden Kunden",
        fr_CH: "Assistance dédiée pour chaque client",
        en_US: "Dedicated assistance for every customer"
      },
      "Conclusione": {
        de_CH: "Fazit",
        fr_CH: "Conclusion",
        en_US: "Conclusion"
      },
      "Scegliere il fornitore giusto è un investimento nel successo della tua pizzeria. Non accontentarti: i tuoi clienti meritano ingredienti di qualità, e tu meriti un partner affidabile.": {
        de_CH: "Den richtigen Lieferanten zu wählen ist eine Investition in den Erfolg Ihrer Pizzeria. Geben Sie sich nicht mit weniger zufrieden: Ihre Kunden verdienen Qualitätszutaten, und Sie verdienen einen zuverlässigen Partner.",
        fr_CH: "Choisir le bon fournisseur est un investissement dans le succès de votre pizzeria. Ne vous contentez pas de moins : vos clients méritent des ingrédients de qualité, et vous méritez un partenaire fiable.",
        en_US: "Choosing the right supplier is an investment in your pizzeria's success. Don't settle for less: your customers deserve quality ingredients, and you deserve a reliable partner."
      },
      "Vuoi scoprire i nostri prodotti? Visita il nostro catalogo o contattaci per una consulenza gratuita.": {
        de_CH: "Möchten Sie unsere Produkte entdecken? Besuchen Sie unseren Katalog oder kontaktieren Sie uns für eine kostenlose Beratung.",
        fr_CH: "Vous voulez découvrir nos produits ? Visitez notre catalogue ou contactez-nous pour une consultation gratuite.",
        en_US: "Want to discover our products? Visit our catalog or contact us for a free consultation."
      }
    };

    return dict[text]?.[lang] || null;
  }

  // 4. Traduco per ogni lingua
  for (const lang of ['de_CH', 'fr_CH', 'en_US']) {
    console.log(`\n4. Traduco in ${lang}...`);

    const langTranslations = {};
    let found = 0;
    let missing = 0;

    for (const src of sourceTexts) {
      const translation = translateText(src, lang);
      if (translation) {
        langTranslations[src] = translation;
        found++;
      } else {
        missing++;
        console.log(`   MANCA: "${src.substring(0, 40)}..."`);
      }
    }

    console.log(`   Tradotti: ${found}/${sourceTexts.length}`);

    if (Object.keys(langTranslations).length > 0) {
      const result = await callOdoo('blog.post', 'update_field_translations',
        [[postId], 'content', { [lang]: langTranslations }]
      );
      console.log(`   Risultato: ${result === true ? 'OK' : 'ERRORE'}`);
    }
  }

  // 5. Verifica
  console.log('\n--- VERIFICA FINALE ---\n');
  for (const lang of ['it_IT', 'de_CH', 'fr_CH', 'en_US']) {
    const data = await callOdoo('blog.post', 'read', [[postId], ['content']], { context: { lang } });
    const contentText = (data?.[0]?.content || '').replace(/<[^>]*>/g, '').substring(0, 100);
    console.log(`[${lang}] ${contentText}...`);
  }
}

main();
