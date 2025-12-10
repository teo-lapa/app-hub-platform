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

// Contenuto italiano originale
const italianContent = `<h2>Perché la Scelta del Fornitore è Fondamentale</h2>
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

<p><strong>Vuoi scoprire i nostri prodotti?</strong> <a href="/shop">Visita il nostro catalogo</a> o <a href="/contactus">contattaci</a> per una consulenza gratuita.</p>`;

// Dizionario traduzioni per ogni segmento
const translations = {
  de_CH: {
    "Perché la Scelta del Fornitore è Fondamentale": "Warum die Wahl des Lieferanten entscheidend ist",
    "Aprire una pizzeria di successo in Svizzera richiede molto più di una buona ricetta.": "Eine erfolgreiche Pizzeria in der Schweiz zu eröffnen erfordert viel mehr als ein gutes Rezept.",
    "La qualità degli ingredienti": "Die Qualität der Zutaten",
    "fa la differenza tra una pizza mediocre e una eccezionale. Per questo, scegliere il fornitore giusto è una delle decisioni più importanti che prenderai.": "macht den Unterschied zwischen einer mittelmässigen und einer aussergewöhnlichen Pizza. Deshalb ist die Wahl des richtigen Lieferanten eine der wichtigsten Entscheidungen, die Sie treffen werden.",
    "I 5 Criteri Essenziali per Scegliere un Fornitore": "Die 5 wesentlichen Kriterien für die Lieferantenauswahl",
    "1. Qualità dei Prodotti": "1. Produktqualität",
    "Non tutti i fornitori sono uguali. Cerca un grossista che:": "Nicht alle Lieferanten sind gleich. Suchen Sie einen Grossisten, der:",
    "Importi direttamente dall'Italia": "Direkt aus Italien importiert",
    "Offra prodotti DOP e IGP certificati": "Zertifizierte DOP- und IGP-Produkte anbietet",
    "Garantisca la catena del freddo per i freschi": "Die Kühlkette für Frischprodukte garantiert",
    "Abbia una selezione ampia di mozzarelle (fior di latte, bufala, burrata)": "Eine breite Auswahl an Mozzarella hat (Fior di Latte, Bufala, Burrata)",
    "2. Affidabilità delle Consegne": "2. Lieferzuverlässigkeit",
    "Una pizzeria non può permettersi di restare senza ingredienti. Il tuo fornitore deve garantire:": "Eine Pizzeria kann es sich nicht leisten, ohne Zutaten dazustehen. Ihr Lieferant muss garantieren:",
    "Consegne puntuali e regolari": "Pünktliche und regelmässige Lieferungen",
    "Flessibilità negli orari": "Flexible Lieferzeiten",
    "Possibilità di ordini urgenti": "Möglichkeit für dringende Bestellungen",
    "Copertura in tutta la Svizzera": "Abdeckung in der ganzen Schweiz",
    "3. Rapporto Qualità-Prezzo": "3. Preis-Leistungs-Verhältnis",
    "Il prezzo più basso non è sempre la scelta migliore. Valuta il": "Der niedrigste Preis ist nicht immer die beste Wahl. Bewerten Sie den",
    "valore complessivo": "Gesamtwert",
    ": qualità, servizio, affidabilità e supporto.": ": Qualität, Service, Zuverlässigkeit und Support.",
    "4. Gamma di Prodotti": "4. Produktsortiment",
    "Un buon fornitore dovrebbe offrirti tutto ciò di cui hai bisogno:": "Ein guter Lieferant sollte Ihnen alles bieten, was Sie brauchen:",
    "Farine professionali per pizza": "Professionelle Pizzamehle",
    "Pomodori San Marzano DOP": "San Marzano DOP Tomaten",
    "Mozzarelle fresche italiane": "Frische italienische Mozzarella",
    "Salumi e formaggi di qualità": "Qualitäts-Wurstwaren und Käse",
    "Olio extravergine d'oliva": "Natives Olivenöl extra",
    "5. Servizio Clienti": "5. Kundenservice",
    "Un partner affidabile offre supporto quando ne hai bisogno: consulenza sui prodotti, gestione degli ordini semplice e assistenza rapida.": "Ein zuverlässiger Partner bietet Unterstützung, wenn Sie sie brauchen: Produktberatung, einfache Bestellabwicklung und schnelle Hilfe.",
    "Perché Scegliere LAPA come Fornitore": "Warum LAPA als Lieferant wählen",
    "LAPA è il grossista di riferimento per pizzerie e ristoranti italiani in Svizzera. Offriamo:": "LAPA ist der Referenz-Grossist für Pizzerien und italienische Restaurants in der Schweiz. Wir bieten:",
    "Oltre 3.000 prodotti italiani autentici": "Über 3.000 authentische italienische Produkte",
    "Consegna in tutta la Svizzera": "Lieferung in die ganze Schweiz",
    "Nessun minimo d'ordine": "Kein Mindestbestellwert",
    "Prodotti freschi consegnati in 24-48 ore": "Frische Produkte in 24-48 Stunden geliefert",
    "Assistenza dedicata per ogni cliente": "Persönliche Betreuung für jeden Kunden",
    "Conclusione": "Fazit",
    "Scegliere il fornitore giusto è un investimento nel successo della tua pizzeria. Non accontentarti: i tuoi clienti meritano ingredienti di qualità, e tu meriti un partner affidabile.": "Den richtigen Lieferanten zu wählen ist eine Investition in den Erfolg Ihrer Pizzeria. Geben Sie sich nicht mit weniger zufrieden: Ihre Kunden verdienen Qualitätszutaten, und Sie verdienen einen zuverlässigen Partner.",
    "Vuoi scoprire i nostri prodotti?": "Möchten Sie unsere Produkte entdecken?",
    "Visita il nostro catalogo": "Besuchen Sie unseren Katalog",
    "contattaci": "kontaktieren Sie uns",
    "per una consulenza gratuita.": "für eine kostenlose Beratung."
  },
  fr_CH: {
    "Perché la Scelta del Fornitore è Fondamentale": "Pourquoi le choix du fournisseur est fondamental",
    "Aprire una pizzeria di successo in Svizzera richiede molto più di una buona ricetta.": "Ouvrir une pizzeria à succès en Suisse nécessite bien plus qu'une bonne recette.",
    "La qualità degli ingredienti": "La qualité des ingrédients",
    "fa la differenza tra una pizza mediocre e una eccezionale. Per questo, scegliere il fornitore giusto è una delle decisioni più importanti che prenderai.": "fait la différence entre une pizza médiocre et une pizza exceptionnelle. C'est pourquoi choisir le bon fournisseur est l'une des décisions les plus importantes que vous prendrez.",
    "I 5 Criteri Essenziali per Scegliere un Fornitore": "Les 5 critères essentiels pour choisir un fournisseur",
    "1. Qualità dei Prodotti": "1. Qualité des produits",
    "Non tutti i fornitori sono uguali. Cerca un grossista che:": "Tous les fournisseurs ne se valent pas. Recherchez un grossiste qui :",
    "Importi direttamente dall'Italia": "Importe directement d'Italie",
    "Offra prodotti DOP e IGP certificati": "Propose des produits DOP et IGP certifiés",
    "Garantisca la catena del freddo per i freschi": "Garantit la chaîne du froid pour les produits frais",
    "Abbia una selezione ampia di mozzarelle (fior di latte, bufala, burrata)": "Dispose d'une large sélection de mozzarellas (fior di latte, bufala, burrata)",
    "2. Affidabilità delle Consegne": "2. Fiabilité des livraisons",
    "Una pizzeria non può permettersi di restare senza ingredienti. Il tuo fornitore deve garantire:": "Une pizzeria ne peut pas se permettre de manquer d'ingrédients. Votre fournisseur doit garantir :",
    "Consegne puntuali e regolari": "Des livraisons ponctuelles et régulières",
    "Flessibilità negli orari": "Une flexibilité dans les horaires",
    "Possibilità di ordini urgenti": "La possibilité de commandes urgentes",
    "Copertura in tutta la Svizzera": "Une couverture dans toute la Suisse",
    "3. Rapporto Qualità-Prezzo": "3. Rapport qualité-prix",
    "Il prezzo più basso non è sempre la scelta migliore. Valuta il": "Le prix le plus bas n'est pas toujours le meilleur choix. Évaluez la",
    "valore complessivo": "valeur globale",
    ": qualità, servizio, affidabilità e supporto.": ": qualité, service, fiabilité et support.",
    "4. Gamma di Prodotti": "4. Gamme de produits",
    "Un buon fornitore dovrebbe offrirti tutto ciò di cui hai bisogno:": "Un bon fournisseur devrait vous offrir tout ce dont vous avez besoin :",
    "Farine professionali per pizza": "Farines professionnelles pour pizza",
    "Pomodori San Marzano DOP": "Tomates San Marzano DOP",
    "Mozzarelle fresche italiane": "Mozzarellas fraîches italiennes",
    "Salumi e formaggi di qualità": "Charcuteries et fromages de qualité",
    "Olio extravergine d'oliva": "Huile d'olive extra vierge",
    "5. Servizio Clienti": "5. Service client",
    "Un partner affidabile offre supporto quando ne hai bisogno: consulenza sui prodotti, gestione degli ordini semplice e assistenza rapida.": "Un partenaire fiable offre un support quand vous en avez besoin : conseil sur les produits, gestion des commandes simplifiée et assistance rapide.",
    "Perché Scegliere LAPA come Fornitore": "Pourquoi choisir LAPA comme fournisseur",
    "LAPA è il grossista di riferimento per pizzerie e ristoranti italiani in Svizzera. Offriamo:": "LAPA est le grossiste de référence pour les pizzerias et restaurants italiens en Suisse. Nous offrons :",
    "Oltre 3.000 prodotti italiani autentici": "Plus de 3 000 produits italiens authentiques",
    "Consegna in tutta la Svizzera": "Livraison dans toute la Suisse",
    "Nessun minimo d'ordine": "Pas de minimum de commande",
    "Prodotti freschi consegnati in 24-48 ore": "Produits frais livrés en 24-48 heures",
    "Assistenza dedicata per ogni cliente": "Assistance dédiée pour chaque client",
    "Conclusione": "Conclusion",
    "Scegliere il fornitore giusto è un investimento nel successo della tua pizzeria. Non accontentarti: i tuoi clienti meritano ingredienti di qualità, e tu meriti un partner affidabile.": "Choisir le bon fournisseur est un investissement dans le succès de votre pizzeria. Ne vous contentez pas de moins : vos clients méritent des ingrédients de qualité, et vous méritez un partenaire fiable.",
    "Vuoi scoprire i nostri prodotti?": "Vous voulez découvrir nos produits ?",
    "Visita il nostro catalogo": "Visitez notre catalogue",
    "contattaci": "contactez-nous",
    "per una consulenza gratuita.": "pour une consultation gratuite."
  },
  en_US: {
    "Perché la Scelta del Fornitore è Fondamentale": "Why Choosing the Right Supplier is Fundamental",
    "Aprire una pizzeria di successo in Svizzera richiede molto più di una buona ricetta.": "Opening a successful pizzeria in Switzerland requires much more than a good recipe.",
    "La qualità degli ingredienti": "The quality of ingredients",
    "fa la differenza tra una pizza mediocre e una eccezionale. Per questo, scegliere il fornitore giusto è una delle decisioni più importanti che prenderai.": "makes the difference between a mediocre pizza and an exceptional one. That's why choosing the right supplier is one of the most important decisions you'll make.",
    "I 5 Criteri Essenziali per Scegliere un Fornitore": "The 5 Essential Criteria for Choosing a Supplier",
    "1. Qualità dei Prodotti": "1. Product Quality",
    "Non tutti i fornitori sono uguali. Cerca un grossista che:": "Not all suppliers are equal. Look for a wholesaler that:",
    "Importi direttamente dall'Italia": "Imports directly from Italy",
    "Offra prodotti DOP e IGP certificati": "Offers certified DOP and IGP products",
    "Garantisca la catena del freddo per i freschi": "Guarantees the cold chain for fresh products",
    "Abbia una selezione ampia di mozzarelle (fior di latte, bufala, burrata)": "Has a wide selection of mozzarellas (fior di latte, buffalo, burrata)",
    "2. Affidabilità delle Consegne": "2. Delivery Reliability",
    "Una pizzeria non può permettersi di restare senza ingredienti. Il tuo fornitore deve garantire:": "A pizzeria cannot afford to run out of ingredients. Your supplier must guarantee:",
    "Consegne puntuali e regolari": "Punctual and regular deliveries",
    "Flessibilità negli orari": "Flexibility in scheduling",
    "Possibilità di ordini urgenti": "Possibility of urgent orders",
    "Copertura in tutta la Svizzera": "Coverage throughout Switzerland",
    "3. Rapporto Qualità-Prezzo": "3. Value for Money",
    "Il prezzo più basso non è sempre la scelta migliore. Valuta il": "The lowest price isn't always the best choice. Evaluate the",
    "valore complessivo": "overall value",
    ": qualità, servizio, affidabilità e supporto.": ": quality, service, reliability, and support.",
    "4. Gamma di Prodotti": "4. Product Range",
    "Un buon fornitore dovrebbe offrirti tutto ciò di cui hai bisogno:": "A good supplier should offer you everything you need:",
    "Farine professionali per pizza": "Professional pizza flours",
    "Pomodori San Marzano DOP": "San Marzano DOP tomatoes",
    "Mozzarelle fresche italiane": "Fresh Italian mozzarella",
    "Salumi e formaggi di qualità": "Quality cured meats and cheeses",
    "Olio extravergine d'oliva": "Extra virgin olive oil",
    "5. Servizio Clienti": "5. Customer Service",
    "Un partner affidabile offre supporto quando ne hai bisogno: consulenza sui prodotti, gestione degli ordini semplice e assistenza rapida.": "A reliable partner offers support when you need it: product consultation, simple order management, and quick assistance.",
    "Perché Scegliere LAPA come Fornitore": "Why Choose LAPA as Your Supplier",
    "LAPA è il grossista di riferimento per pizzerie e ristoranti italiani in Svizzera. Offriamo:": "LAPA is the reference wholesaler for pizzerias and Italian restaurants in Switzerland. We offer:",
    "Oltre 3.000 prodotti italiani autentici": "Over 3,000 authentic Italian products",
    "Consegna in tutta la Svizzera": "Delivery throughout Switzerland",
    "Nessun minimo d'ordine": "No minimum order",
    "Prodotti freschi consegnati in 24-48 ore": "Fresh products delivered in 24-48 hours",
    "Assistenza dedicata per ogni cliente": "Dedicated assistance for every customer",
    "Conclusione": "Conclusion",
    "Scegliere il fornitore giusto è un investimento nel successo della tua pizzeria. Non accontentarti: i tuoi clienti meritano ingredienti di qualità, e tu meriti un partner affidabile.": "Choosing the right supplier is an investment in your pizzeria's success. Don't settle for less: your customers deserve quality ingredients, and you deserve a reliable partner.",
    "Vuoi scoprire i nostri prodotti?": "Want to discover our products?",
    "Visita il nostro catalogo": "Visit our catalog",
    "contattaci": "contact us",
    "per una consulenza gratuita.": "for a free consultation."
  }
};

async function main() {
  await auth();

  console.log('\n=== TRADUZIONE CONTENUTO ARTICOLO 75 ===\n');

  // 1. Riscrivo il contenuto italiano
  console.log('1. Scrivo contenuto ITALIANO...');
  await callOdoo('blog.post', 'write', [[postId], { content: italianContent }]);

  // 2. Leggo i segmenti
  console.log('2. Leggo segmenti...');
  const segmentData = await callOdoo('blog.post', 'get_field_translations', [[postId], 'content']);
  const segments = segmentData[0];
  const sourceTexts = [...new Set(segments.map(s => s.source))];
  console.log(`   Trovati ${sourceTexts.length} segmenti unici`);

  // 3. Applico traduzioni per ogni lingua
  for (const lang of ['de_CH', 'fr_CH', 'en_US']) {
    console.log(`\n3. Traduco in ${lang}...`);

    // Preparo il dizionario con solo i segmenti che esistono
    const langTranslations = {};
    let translated = 0;
    let missing = 0;

    for (const src of sourceTexts) {
      if (translations[lang][src]) {
        langTranslations[src] = translations[lang][src];
        translated++;
      } else {
        missing++;
        // console.log(`   MANCANTE: "${src.substring(0, 40)}..."`);
      }
    }

    console.log(`   Segmenti tradotti: ${translated}/${sourceTexts.length}`);

    if (Object.keys(langTranslations).length > 0) {
      const result = await callOdoo('blog.post', 'update_field_translations',
        [[postId], 'content', { [lang]: langTranslations }]
      );
      console.log(`   Risultato: ${result === true ? 'OK' : 'ERRORE'}`);
    }
  }

  // 4. Verifica
  console.log('\n--- VERIFICA FINALE ---\n');
  for (const lang of ['it_IT', 'de_CH', 'fr_CH', 'en_US']) {
    const data = await callOdoo('blog.post', 'read', [[postId], ['content']], { context: { lang } });
    const contentText = (data?.[0]?.content || '').replace(/<[^>]*>/g, '').substring(0, 80);
    console.log(`[${lang}] ${contentText}...`);
  }
}

main();
