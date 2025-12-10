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

const POST_ID = 79;

// Contenuto ITALIANO
const ITALIAN_CONTENT = `<section class="s_text_block pt40 pb40 o_colored_level" data-snippet="s_text_block">
<div class="container">
<h2>Perche la Scelta del Fornitore e Fondamentale</h2>
<p>Aprire una pizzeria di successo in Svizzera richiede molto piu di una buona ricetta. La qualita degli ingredienti fa la differenza tra una pizza mediocre e una eccezionale. Per questo, scegliere il fornitore giusto e una delle decisioni piu importanti che prenderai.</p>

<h3>I 5 Criteri Essenziali per Scegliere un Fornitore</h3>

<h4>1. Qualita dei Prodotti</h4>
<p>Non tutti i fornitori sono uguali. Cerca un grossista che:</p>
<ul>
<li>Importi direttamente dall'Italia</li>
<li>Offra prodotti DOP e IGP certificati</li>
<li>Garantisca la catena del freddo per i freschi</li>
<li>Abbia una selezione ampia di mozzarelle (fior di latte, bufala, burrata)</li>
</ul>

<h4>2. Affidabilita delle Consegne</h4>
<p>Una pizzeria non puo permettersi di restare senza ingredienti. Il tuo fornitore deve garantire:</p>
<ul>
<li>Consegne puntuali e regolari</li>
<li>Flessibilita negli orari</li>
<li>Possibilita di ordini urgenti</li>
<li>Copertura in tutta la Svizzera</li>
</ul>

<h4>3. Rapporto Qualita-Prezzo</h4>
<p>Il prezzo piu basso non e sempre la scelta migliore. Valuta il valore complessivo: qualita, servizio, affidabilita e supporto.</p>

<h4>4. Gamma di Prodotti</h4>
<p>Un buon fornitore dovrebbe offrirti tutto cio di cui hai bisogno:</p>
<ul>
<li>Farine professionali per pizza</li>
<li>Pomodori San Marzano DOP</li>
<li>Mozzarelle fresche italiane</li>
<li>Salumi e formaggi di qualita</li>
<li>Olio extravergine d'oliva</li>
</ul>

<h4>5. Servizio Clienti</h4>
<p>Un partner affidabile offre supporto quando ne hai bisogno: consulenza sui prodotti, gestione degli ordini semplice e assistenza rapida.</p>

<h3>Perche Scegliere LAPA come Fornitore</h3>
<p>LAPA e il grossista di riferimento per pizzerie e ristoranti italiani in Svizzera. Offriamo:</p>
<ul>
<li>Oltre 3.000 prodotti italiani autentici</li>
<li>Consegna in tutta la Svizzera</li>
<li>Nessun minimo d'ordine</li>
<li>Prodotti freschi consegnati in 24-48 ore</li>
<li>Assistenza dedicata per ogni cliente</li>
</ul>

<h3>Conclusione</h3>
<p>Scegliere il fornitore giusto e un investimento nel successo della tua pizzeria. Non accontentarti: i tuoi clienti meritano ingredienti di qualita, e tu meriti un partner affidabile.</p>

<p>Vuoi scoprire i nostri prodotti? Visita il nostro catalogo o contattaci per una consulenza gratuita.</p>
</div>
</section>`;

// Traduzioni per ogni segmento
const TRANSLATIONS = {
  "Perche la Scelta del Fornitore e Fondamentale": {
    de_CH: "Warum die Wahl des Lieferanten entscheidend ist",
    fr_CH: "Pourquoi le choix du fournisseur est fondamental",
    en_US: "Why Choosing the Right Supplier is Fundamental"
  },
  "Aprire una pizzeria di successo in Svizzera richiede molto piu di una buona ricetta. La qualita degli ingredienti fa la differenza tra una pizza mediocre e una eccezionale. Per questo, scegliere il fornitore giusto e una delle decisioni piu importanti che prenderai.": {
    de_CH: "Eine erfolgreiche Pizzeria in der Schweiz zu eroeffnen erfordert viel mehr als ein gutes Rezept. Die Qualitaet der Zutaten macht den Unterschied zwischen einer mittelmassigen und einer aussergewoehnlichen Pizza. Deshalb ist die Wahl des richtigen Lieferanten eine der wichtigsten Entscheidungen, die Sie treffen werden.",
    fr_CH: "Ouvrir une pizzeria a succes en Suisse demande bien plus qu'une bonne recette. La qualite des ingredients fait la difference entre une pizza mediocre et une pizza exceptionnelle. C'est pourquoi choisir le bon fournisseur est l'une des decisions les plus importantes que vous prendrez.",
    en_US: "Opening a successful pizzeria in Switzerland requires much more than a good recipe. The quality of ingredients makes the difference between a mediocre pizza and an exceptional one. That's why choosing the right supplier is one of the most important decisions you'll make."
  },
  "I 5 Criteri Essenziali per Scegliere un Fornitore": {
    de_CH: "Die 5 wesentlichen Kriterien fuer die Wahl eines Lieferanten",
    fr_CH: "Les 5 criteres essentiels pour choisir un fournisseur",
    en_US: "The 5 Essential Criteria for Choosing a Supplier"
  },
  "1. Qualita dei Prodotti": {
    de_CH: "1. Produktqualitaet",
    fr_CH: "1. Qualite des produits",
    en_US: "1. Product Quality"
  },
  "Non tutti i fornitori sono uguali. Cerca un grossista che:": {
    de_CH: "Nicht alle Lieferanten sind gleich. Suchen Sie einen Grosshaendler, der:",
    fr_CH: "Tous les fournisseurs ne se valent pas. Recherchez un grossiste qui:",
    en_US: "Not all suppliers are equal. Look for a wholesaler that:"
  },
  "Importi direttamente dall'Italia": {
    de_CH: "Direkt aus Italien importiert",
    fr_CH: "Importe directement d'Italie",
    en_US: "Imports directly from Italy"
  },
  "Offra prodotti DOP e IGP certificati": {
    de_CH: "Zertifizierte DOP- und IGP-Produkte anbietet",
    fr_CH: "Propose des produits DOP et IGP certifies",
    en_US: "Offers certified DOP and IGP products"
  },
  "Garantisca la catena del freddo per i freschi": {
    de_CH: "Die Kuehlkette fuer Frischprodukte garantiert",
    fr_CH: "Garantit la chaine du froid pour les produits frais",
    en_US: "Guarantees the cold chain for fresh products"
  },
  "Abbia una selezione ampia di mozzarelle (fior di latte, bufala, burrata)": {
    de_CH: "Eine grosse Auswahl an Mozzarella hat (Fior di Latte, Bueffel, Burrata)",
    fr_CH: "Dispose d'une large selection de mozzarellas (fior di latte, bufala, burrata)",
    en_US: "Has a wide selection of mozzarellas (fior di latte, buffalo, burrata)"
  },
  "2. Affidabilita delle Consegne": {
    de_CH: "2. Zuverlaessigkeit der Lieferungen",
    fr_CH: "2. Fiabilite des livraisons",
    en_US: "2. Delivery Reliability"
  },
  "Una pizzeria non puo permettersi di restare senza ingredienti. Il tuo fornitore deve garantire:": {
    de_CH: "Eine Pizzeria kann es sich nicht leisten, ohne Zutaten zu sein. Ihr Lieferant muss garantieren:",
    fr_CH: "Une pizzeria ne peut pas se permettre de manquer d'ingredients. Votre fournisseur doit garantir:",
    en_US: "A pizzeria cannot afford to run out of ingredients. Your supplier must guarantee:"
  },
  "Consegne puntuali e regolari": {
    de_CH: "Puenktliche und regelmaessige Lieferungen",
    fr_CH: "Des livraisons ponctuelles et regulieres",
    en_US: "Punctual and regular deliveries"
  },
  "Flessibilita negli orari": {
    de_CH: "Flexible Lieferzeiten",
    fr_CH: "Flexibilite des horaires",
    en_US: "Flexibility in schedules"
  },
  "Possibilita di ordini urgenti": {
    de_CH: "Moeglichkeit fuer dringende Bestellungen",
    fr_CH: "Possibilite de commandes urgentes",
    en_US: "Possibility of urgent orders"
  },
  "Copertura in tutta la Svizzera": {
    de_CH: "Abdeckung in der ganzen Schweiz",
    fr_CH: "Couverture dans toute la Suisse",
    en_US: "Coverage throughout Switzerland"
  },
  "3. Rapporto Qualita-Prezzo": {
    de_CH: "3. Preis-Leistungs-Verhaeltnis",
    fr_CH: "3. Rapport qualite-prix",
    en_US: "3. Quality-Price Ratio"
  },
  "Il prezzo piu basso non e sempre la scelta migliore. Valuta il valore complessivo: qualita, servizio, affidabilita e supporto.": {
    de_CH: "Der niedrigste Preis ist nicht immer die beste Wahl. Bewerten Sie den Gesamtwert: Qualitaet, Service, Zuverlaessigkeit und Support.",
    fr_CH: "Le prix le plus bas n'est pas toujours le meilleur choix. Evaluez la valeur globale: qualite, service, fiabilite et support.",
    en_US: "The lowest price is not always the best choice. Evaluate the overall value: quality, service, reliability and support."
  },
  "4. Gamma di Prodotti": {
    de_CH: "4. Produktpalette",
    fr_CH: "4. Gamme de produits",
    en_US: "4. Product Range"
  },
  "Un buon fornitore dovrebbe offrirti tutto cio di cui hai bisogno:": {
    de_CH: "Ein guter Lieferant sollte Ihnen alles bieten, was Sie brauchen:",
    fr_CH: "Un bon fournisseur devrait vous offrir tout ce dont vous avez besoin:",
    en_US: "A good supplier should offer you everything you need:"
  },
  "Farine professionali per pizza": {
    de_CH: "Professionelles Pizzamehl",
    fr_CH: "Farines professionnelles pour pizza",
    en_US: "Professional pizza flour"
  },
  "Pomodori San Marzano DOP": {
    de_CH: "San Marzano DOP Tomaten",
    fr_CH: "Tomates San Marzano DOP",
    en_US: "San Marzano DOP tomatoes"
  },
  "Mozzarelle fresche italiane": {
    de_CH: "Frischer italienischer Mozzarella",
    fr_CH: "Mozzarellas fraiches italiennes",
    en_US: "Fresh Italian mozzarella"
  },
  "Salumi e formaggi di qualita": {
    de_CH: "Hochwertige Wurstwaren und Kaese",
    fr_CH: "Charcuteries et fromages de qualite",
    en_US: "Quality cured meats and cheeses"
  },
  "Olio extravergine d'oliva": {
    de_CH: "Natives Olivenoel extra",
    fr_CH: "Huile d'olive extra vierge",
    en_US: "Extra virgin olive oil"
  },
  "5. Servizio Clienti": {
    de_CH: "5. Kundenservice",
    fr_CH: "5. Service client",
    en_US: "5. Customer Service"
  },
  "Un partner affidabile offre supporto quando ne hai bisogno: consulenza sui prodotti, gestione degli ordini semplice e assistenza rapida.": {
    de_CH: "Ein zuverlaessiger Partner bietet Unterstuetzung, wenn Sie sie brauchen: Produktberatung, einfache Bestellverwaltung und schnelle Hilfe.",
    fr_CH: "Un partenaire fiable offre un soutien quand vous en avez besoin: conseils sur les produits, gestion simple des commandes et assistance rapide.",
    en_US: "A reliable partner offers support when you need it: product advice, simple order management and quick assistance."
  },
  "Perche Scegliere LAPA come Fornitore": {
    de_CH: "Warum LAPA als Lieferant waehlen",
    fr_CH: "Pourquoi choisir LAPA comme fournisseur",
    en_US: "Why Choose LAPA as Your Supplier"
  },
  "LAPA e il grossista di riferimento per pizzerie e ristoranti italiani in Svizzera. Offriamo:": {
    de_CH: "LAPA ist der fuehrende Grosshaendler fuer Pizzerien und italienische Restaurants in der Schweiz. Wir bieten:",
    fr_CH: "LAPA est le grossiste de reference pour les pizzerias et restaurants italiens en Suisse. Nous offrons:",
    en_US: "LAPA is the leading wholesaler for pizzerias and Italian restaurants in Switzerland. We offer:"
  },
  "Oltre 3.000 prodotti italiani autentici": {
    de_CH: "Ueber 3.000 authentische italienische Produkte",
    fr_CH: "Plus de 3.000 produits italiens authentiques",
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
    de_CH: "Frische Produkte innerhalb von 24-48 Stunden geliefert",
    fr_CH: "Produits frais livres en 24-48 heures",
    en_US: "Fresh products delivered in 24-48 hours"
  },
  "Assistenza dedicata per ogni cliente": {
    de_CH: "Individuelle Betreuung fuer jeden Kunden",
    fr_CH: "Assistance dediee pour chaque client",
    en_US: "Dedicated assistance for every customer"
  },
  "Conclusione": {
    de_CH: "Fazit",
    fr_CH: "Conclusion",
    en_US: "Conclusion"
  },
  "Scegliere il fornitore giusto e un investimento nel successo della tua pizzeria. Non accontentarti: i tuoi clienti meritano ingredienti di qualita, e tu meriti un partner affidabile.": {
    de_CH: "Die Wahl des richtigen Lieferanten ist eine Investition in den Erfolg Ihrer Pizzeria. Geben Sie sich nicht mit weniger zufrieden: Ihre Kunden verdienen hochwertige Zutaten, und Sie verdienen einen zuverlaessigen Partner.",
    fr_CH: "Choisir le bon fournisseur est un investissement dans le succes de votre pizzeria. Ne vous contentez pas de moins: vos clients meritent des ingredients de qualite, et vous meritez un partenaire fiable.",
    en_US: "Choosing the right supplier is an investment in the success of your pizzeria. Don't settle for less: your customers deserve quality ingredients, and you deserve a reliable partner."
  },
  "Vuoi scoprire i nostri prodotti? Visita il nostro catalogo o contattaci per una consulenza gratuita.": {
    de_CH: "Moechten Sie unsere Produkte entdecken? Besuchen Sie unseren Katalog oder kontaktieren Sie uns fuer eine kostenlose Beratung.",
    fr_CH: "Vous voulez decouvrir nos produits? Visitez notre catalogue ou contactez-nous pour une consultation gratuite.",
    en_US: "Want to discover our products? Visit our catalog or contact us for a free consultation."
  }
};

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 79: COME SCEGLIERE IL GROSSISTA GIUSTO ===\n');

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

  console.log('\n✅ ARTICOLO 79 COMPLETATO!');
}

main();
