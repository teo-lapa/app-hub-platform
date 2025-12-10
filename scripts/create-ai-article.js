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

// Contenuto articolo AI in italiano
const ITALIAN_CONTENT = `<section class="s_text_block pt40 pb40 o_colored_level" data-snippet="s_text_block">
<div class="container">
<h2>LAPA e l'Intelligenza Artificiale: Il Futuro della Ristorazione</h2>
<p>L'intelligenza artificiale sta rivoluzionando ogni settore, compresa la ristorazione. LAPA abbraccia questa innovazione per offrire un servizio sempre migliore ai ristoranti e pizzerie in Svizzera. Scopri come l'AI puo aiutare il tuo business.</p>

<h3>Perche l'AI e Importante per la Ristorazione</h3>
<p>L'intelligenza artificiale non e solo un trend tecnologico: e uno strumento potente che puo trasformare il modo in cui gestisci il tuo ristorante. Ecco i principali vantaggi:</p>
<ul>
<li>Previsione della domanda e ottimizzazione degli ordini</li>
<li>Riduzione degli sprechi alimentari</li>
<li>Personalizzazione dell'esperienza cliente</li>
<li>Automazione delle operazioni ripetitive</li>
<li>Analisi dei trend di consumo</li>
</ul>

<h3>Come LAPA Utilizza l'Intelligenza Artificiale</h3>
<p>LAPA integra soluzioni di intelligenza artificiale per migliorare costantemente il servizio:</p>
<ul>
<li>Ottimizzazione delle consegne con algoritmi di routing intelligente</li>
<li>Previsione delle scorte per garantire sempre disponibilita</li>
<li>Analisi dei pattern di acquisto per suggerimenti personalizzati</li>
<li>Assistenza clienti potenziata con chatbot intelligenti</li>
<li>Gestione automatizzata del catalogo prodotti</li>
</ul>

<h3>AI per le Pizzerie: Applicazioni Pratiche</h3>
<p>Le pizzerie possono beneficiare enormemente dell'intelligenza artificiale:</p>
<ul>
<li>Previsione dei picchi di ordini per preparare l'impasto</li>
<li>Ottimizzazione delle scorte di mozzarella e ingredienti freschi</li>
<li>Analisi delle preferenze dei clienti per menu personalizzati</li>
<li>Gestione intelligente delle prenotazioni</li>
<li>Suggerimenti automatici per ordini ai fornitori</li>
</ul>

<h3>AI per i Ristoranti Italiani</h3>
<p>I ristoranti italiani possono sfruttare l'AI per:</p>
<ul>
<li>Creare menu stagionali basati sui trend</li>
<li>Ottimizzare i costi degli ingredienti</li>
<li>Gestire le recensioni online in modo intelligente</li>
<li>Prevedere le vendite di piatti specifici</li>
<li>Automatizzare gli ordini ai fornitori come LAPA</li>
</ul>

<h3>Il Futuro: LAPA e l'AI Insieme</h3>
<p>LAPA investe continuamente in tecnologia per essere il partner ideale dei ristoratori moderni. La nostra piattaforma integra:</p>
<ul>
<li>Ordini intelligenti con suggerimenti basati sullo storico</li>
<li>Notifiche predittive per riordini automatici</li>
<li>Dashboard analytics per monitorare i consumi</li>
<li>Integrazione con i principali software di gestione ristorante</li>
<li>Supporto multilingue potenziato dall'AI</li>
</ul>

<h3>Perche Scegliere un Fornitore Tecnologicamente Avanzato</h3>
<p>Nel 2024 e oltre, scegliere un fornitore che abbraccia l'innovazione significa:</p>
<ul>
<li>Risparmiare tempo nelle operazioni quotidiane</li>
<li>Ridurre gli errori negli ordini</li>
<li>Avere sempre i prodotti giusti al momento giusto</li>
<li>Beneficiare di prezzi ottimizzati</li>
<li>Restare competitivi in un mercato in evoluzione</li>
</ul>

<h3>LAPA: Tradizione Italiana e Innovazione Tecnologica</h3>
<p>LAPA unisce il meglio di due mondi: la tradizione dei prodotti italiani autentici e l'innovazione tecnologica piu avanzata. Con oltre 3.000 prodotti italiani e una piattaforma digitale all'avanguardia, siamo il partner ideale per ristoranti e pizzerie che vogliono crescere.</p>

<h3>Conclusione</h3>
<p>L'intelligenza artificiale e il futuro della ristorazione, e LAPA e pronta a guidare i ristoratori svizzeri in questa trasformazione. Scegli un fornitore che guarda al futuro: scegli LAPA.</p>

<p>Vuoi scoprire come l'AI puo migliorare il tuo ristorante? Contattaci per una consulenza gratuita o visita il nostro catalogo online.</p>
</div>
</section>`;

// Traduzioni per ogni segmento
const TRANSLATIONS = {
  "LAPA e l'Intelligenza Artificiale: Il Futuro della Ristorazione": {
    de_CH: "LAPA und Kuenstliche Intelligenz: Die Zukunft der Gastronomie",
    fr_CH: "LAPA et l'Intelligence Artificielle: L'Avenir de la Restauration",
    en_US: "LAPA and Artificial Intelligence: The Future of Restaurants"
  },
  "L'intelligenza artificiale sta rivoluzionando ogni settore, compresa la ristorazione. LAPA abbraccia questa innovazione per offrire un servizio sempre migliore ai ristoranti e pizzerie in Svizzera. Scopri come l'AI puo aiutare il tuo business.": {
    de_CH: "Kuenstliche Intelligenz revolutioniert jeden Sektor, einschliesslich der Gastronomie. LAPA umarmt diese Innovation, um Restaurants und Pizzerien in der Schweiz einen immer besseren Service zu bieten. Entdecken Sie, wie KI Ihrem Unternehmen helfen kann.",
    fr_CH: "L'intelligence artificielle revolutionne chaque secteur, y compris la restauration. LAPA embrasse cette innovation pour offrir un service toujours meilleur aux restaurants et pizzerias en Suisse. Decouvrez comment l'IA peut aider votre entreprise.",
    en_US: "Artificial intelligence is revolutionizing every sector, including restaurants. LAPA embraces this innovation to offer an ever-better service to restaurants and pizzerias in Switzerland. Discover how AI can help your business."
  },
  "Perche l'AI e Importante per la Ristorazione": {
    de_CH: "Warum KI fuer die Gastronomie wichtig ist",
    fr_CH: "Pourquoi l'IA est importante pour la restauration",
    en_US: "Why AI is Important for Restaurants"
  },
  "L'intelligenza artificiale non e solo un trend tecnologico: e uno strumento potente che puo trasformare il modo in cui gestisci il tuo ristorante. Ecco i principali vantaggi:": {
    de_CH: "Kuenstliche Intelligenz ist nicht nur ein technologischer Trend: Es ist ein maeechtiges Werkzeug, das die Art und Weise veraendern kann, wie Sie Ihr Restaurant fuehren. Hier sind die Hauptvorteile:",
    fr_CH: "L'intelligence artificielle n'est pas qu'une tendance technologique: c'est un outil puissant qui peut transformer la facon dont vous gerez votre restaurant. Voici les principaux avantages:",
    en_US: "Artificial intelligence is not just a technological trend: it's a powerful tool that can transform the way you manage your restaurant. Here are the main advantages:"
  },
  "Previsione della domanda e ottimizzazione degli ordini": {
    de_CH: "Nachfrageprognose und Bestelloptimierung",
    fr_CH: "Prevision de la demande et optimisation des commandes",
    en_US: "Demand forecasting and order optimization"
  },
  "Riduzione degli sprechi alimentari": {
    de_CH: "Reduzierung von Lebensmittelverschwendung",
    fr_CH: "Reduction du gaspillage alimentaire",
    en_US: "Reduction of food waste"
  },
  "Personalizzazione dell'esperienza cliente": {
    de_CH: "Personalisierung des Kundenerlebnisses",
    fr_CH: "Personnalisation de l'experience client",
    en_US: "Personalization of customer experience"
  },
  "Automazione delle operazioni ripetitive": {
    de_CH: "Automatisierung sich wiederholender Vorgaenge",
    fr_CH: "Automatisation des operations repetitives",
    en_US: "Automation of repetitive operations"
  },
  "Analisi dei trend di consumo": {
    de_CH: "Analyse von Konsumtrends",
    fr_CH: "Analyse des tendances de consommation",
    en_US: "Analysis of consumption trends"
  },
  "Come LAPA Utilizza l'Intelligenza Artificiale": {
    de_CH: "Wie LAPA Kuenstliche Intelligenz nutzt",
    fr_CH: "Comment LAPA utilise l'Intelligence Artificielle",
    en_US: "How LAPA Uses Artificial Intelligence"
  },
  "LAPA integra soluzioni di intelligenza artificiale per migliorare costantemente il servizio:": {
    de_CH: "LAPA integriert KI-Loesungen, um den Service staendig zu verbessern:",
    fr_CH: "LAPA integre des solutions d'intelligence artificielle pour ameliorer constamment le service:",
    en_US: "LAPA integrates artificial intelligence solutions to constantly improve service:"
  },
  "Ottimizzazione delle consegne con algoritmi di routing intelligente": {
    de_CH: "Lieferoptimierung mit intelligenten Routing-Algorithmen",
    fr_CH: "Optimisation des livraisons avec des algorithmes de routage intelligents",
    en_US: "Delivery optimization with intelligent routing algorithms"
  },
  "Previsione delle scorte per garantire sempre disponibilita": {
    de_CH: "Bestandsprognose fuer garantierte Verfuegbarkeit",
    fr_CH: "Prevision des stocks pour garantir toujours la disponibilite",
    en_US: "Stock forecasting to always guarantee availability"
  },
  "Analisi dei pattern di acquisto per suggerimenti personalizzati": {
    de_CH: "Analyse von Kaufmustern fuer personalisierte Empfehlungen",
    fr_CH: "Analyse des habitudes d'achat pour des suggestions personnalisees",
    en_US: "Purchase pattern analysis for personalized suggestions"
  },
  "Assistenza clienti potenziata con chatbot intelligenti": {
    de_CH: "Verbesserter Kundenservice mit intelligenten Chatbots",
    fr_CH: "Service client ameliore avec des chatbots intelligents",
    en_US: "Enhanced customer service with intelligent chatbots"
  },
  "Gestione automatizzata del catalogo prodotti": {
    de_CH: "Automatisierte Produktkatalogverwaltung",
    fr_CH: "Gestion automatisee du catalogue de produits",
    en_US: "Automated product catalog management"
  },
  "AI per le Pizzerie: Applicazioni Pratiche": {
    de_CH: "KI fuer Pizzerien: Praktische Anwendungen",
    fr_CH: "IA pour les pizzerias: Applications pratiques",
    en_US: "AI for Pizzerias: Practical Applications"
  },
  "Le pizzerie possono beneficiare enormemente dell'intelligenza artificiale:": {
    de_CH: "Pizzerien koennen enorm von kuenstlicher Intelligenz profitieren:",
    fr_CH: "Les pizzerias peuvent enormement beneficier de l'intelligence artificielle:",
    en_US: "Pizzerias can greatly benefit from artificial intelligence:"
  },
  "Previsione dei picchi di ordini per preparare l'impasto": {
    de_CH: "Vorhersage von Bestellspitzen fuer die Teigvorbereitung",
    fr_CH: "Prevision des pics de commandes pour preparer la pate",
    en_US: "Prediction of order peaks to prepare dough"
  },
  "Ottimizzazione delle scorte di mozzarella e ingredienti freschi": {
    de_CH: "Optimierung der Mozzarella- und Frischzutatenbestaende",
    fr_CH: "Optimisation des stocks de mozzarella et ingredients frais",
    en_US: "Optimization of mozzarella and fresh ingredient stocks"
  },
  "Analisi delle preferenze dei clienti per menu personalizzati": {
    de_CH: "Analyse der Kundenpraeferenzen fuer personalisierte Menues",
    fr_CH: "Analyse des preferences des clients pour des menus personnalises",
    en_US: "Analysis of customer preferences for personalized menus"
  },
  "Gestione intelligente delle prenotazioni": {
    de_CH: "Intelligentes Reservierungsmanagement",
    fr_CH: "Gestion intelligente des reservations",
    en_US: "Intelligent reservation management"
  },
  "Suggerimenti automatici per ordini ai fornitori": {
    de_CH: "Automatische Vorschlaege fuer Lieferantenbestellungen",
    fr_CH: "Suggestions automatiques pour les commandes aux fournisseurs",
    en_US: "Automatic suggestions for supplier orders"
  },
  "AI per i Ristoranti Italiani": {
    de_CH: "KI fuer italienische Restaurants",
    fr_CH: "IA pour les restaurants italiens",
    en_US: "AI for Italian Restaurants"
  },
  "I ristoranti italiani possono sfruttare l'AI per:": {
    de_CH: "Italienische Restaurants koennen KI nutzen fuer:",
    fr_CH: "Les restaurants italiens peuvent exploiter l'IA pour:",
    en_US: "Italian restaurants can leverage AI for:"
  },
  "Creare menu stagionali basati sui trend": {
    de_CH: "Saisonale Menues basierend auf Trends erstellen",
    fr_CH: "Creer des menus saisonniers bases sur les tendances",
    en_US: "Create seasonal menus based on trends"
  },
  "Ottimizzare i costi degli ingredienti": {
    de_CH: "Zutatenkosten optimieren",
    fr_CH: "Optimiser les couts des ingredients",
    en_US: "Optimize ingredient costs"
  },
  "Gestire le recensioni online in modo intelligente": {
    de_CH: "Online-Bewertungen intelligent verwalten",
    fr_CH: "Gerer intelligemment les avis en ligne",
    en_US: "Manage online reviews intelligently"
  },
  "Prevedere le vendite di piatti specifici": {
    de_CH: "Verkaeufe spezifischer Gerichte vorhersagen",
    fr_CH: "Prevoir les ventes de plats specifiques",
    en_US: "Predict sales of specific dishes"
  },
  "Automatizzare gli ordini ai fornitori come LAPA": {
    de_CH: "Bestellungen bei Lieferanten wie LAPA automatisieren",
    fr_CH: "Automatiser les commandes aupres de fournisseurs comme LAPA",
    en_US: "Automate orders to suppliers like LAPA"
  },
  "Il Futuro: LAPA e l'AI Insieme": {
    de_CH: "Die Zukunft: LAPA und KI gemeinsam",
    fr_CH: "L'avenir: LAPA et l'IA ensemble",
    en_US: "The Future: LAPA and AI Together"
  },
  "LAPA investe continuamente in tecnologia per essere il partner ideale dei ristoratori moderni. La nostra piattaforma integra:": {
    de_CH: "LAPA investiert kontinuierlich in Technologie, um der ideale Partner fuer moderne Gastronomen zu sein. Unsere Plattform integriert:",
    fr_CH: "LAPA investit continuellement dans la technologie pour etre le partenaire ideal des restaurateurs modernes. Notre plateforme integre:",
    en_US: "LAPA continuously invests in technology to be the ideal partner for modern restaurateurs. Our platform integrates:"
  },
  "Ordini intelligenti con suggerimenti basati sullo storico": {
    de_CH: "Intelligente Bestellungen mit verlaufsbasierten Vorschlaegen",
    fr_CH: "Commandes intelligentes avec suggestions basees sur l'historique",
    en_US: "Intelligent orders with history-based suggestions"
  },
  "Notifiche predittive per riordini automatici": {
    de_CH: "Praediktive Benachrichtigungen fuer automatische Nachbestellungen",
    fr_CH: "Notifications predictives pour les reapprovisionnements automatiques",
    en_US: "Predictive notifications for automatic reorders"
  },
  "Dashboard analytics per monitorare i consumi": {
    de_CH: "Analytics-Dashboard zur Ueberwachung des Verbrauchs",
    fr_CH: "Tableau de bord analytique pour surveiller les consommations",
    en_US: "Analytics dashboard to monitor consumption"
  },
  "Integrazione con i principali software di gestione ristorante": {
    de_CH: "Integration mit fuehrenden Restaurantverwaltungssoftwares",
    fr_CH: "Integration avec les principaux logiciels de gestion de restaurant",
    en_US: "Integration with leading restaurant management software"
  },
  "Supporto multilingue potenziato dall'AI": {
    de_CH: "KI-gestuetzter mehrsprachiger Support",
    fr_CH: "Support multilingue renforce par l'IA",
    en_US: "AI-enhanced multilingual support"
  },
  "Perche Scegliere un Fornitore Tecnologicamente Avanzato": {
    de_CH: "Warum einen technologisch fortschrittlichen Lieferanten waehlen",
    fr_CH: "Pourquoi choisir un fournisseur technologiquement avance",
    en_US: "Why Choose a Technologically Advanced Supplier"
  },
  "Nel 2024 e oltre, scegliere un fornitore che abbraccia l'innovazione significa:": {
    de_CH: "Im Jahr 2024 und darueber hinaus bedeutet die Wahl eines Lieferanten, der Innovation umarmt:",
    fr_CH: "En 2024 et au-dela, choisir un fournisseur qui embrasse l'innovation signifie:",
    en_US: "In 2024 and beyond, choosing a supplier that embraces innovation means:"
  },
  "Risparmiare tempo nelle operazioni quotidiane": {
    de_CH: "Zeit bei taeglichen Operationen sparen",
    fr_CH: "Gagner du temps dans les operations quotidiennes",
    en_US: "Save time in daily operations"
  },
  "Ridurre gli errori negli ordini": {
    de_CH: "Bestellfehler reduzieren",
    fr_CH: "Reduire les erreurs dans les commandes",
    en_US: "Reduce errors in orders"
  },
  "Avere sempre i prodotti giusti al momento giusto": {
    de_CH: "Immer die richtigen Produkte zur richtigen Zeit haben",
    fr_CH: "Avoir toujours les bons produits au bon moment",
    en_US: "Always have the right products at the right time"
  },
  "Beneficiare di prezzi ottimizzati": {
    de_CH: "Von optimierten Preisen profitieren",
    fr_CH: "Beneficier de prix optimises",
    en_US: "Benefit from optimized prices"
  },
  "Restare competitivi in un mercato in evoluzione": {
    de_CH: "In einem sich entwickelnden Markt wettbewerbsfaehig bleiben",
    fr_CH: "Rester competitif dans un marche en evolution",
    en_US: "Stay competitive in an evolving market"
  },
  "LAPA: Tradizione Italiana e Innovazione Tecnologica": {
    de_CH: "LAPA: Italienische Tradition und technologische Innovation",
    fr_CH: "LAPA: Tradition italienne et innovation technologique",
    en_US: "LAPA: Italian Tradition and Technological Innovation"
  },
  "LAPA unisce il meglio di due mondi: la tradizione dei prodotti italiani autentici e l'innovazione tecnologica piu avanzata. Con oltre 3.000 prodotti italiani e una piattaforma digitale all'avanguardia, siamo il partner ideale per ristoranti e pizzerie che vogliono crescere.": {
    de_CH: "LAPA vereint das Beste aus zwei Welten: die Tradition authentischer italienischer Produkte und modernste technologische Innovation. Mit ueber 3.000 italienischen Produkten und einer hochmodernen digitalen Plattform sind wir der ideale Partner fuer Restaurants und Pizzerien, die wachsen wollen.",
    fr_CH: "LAPA unit le meilleur des deux mondes: la tradition des produits italiens authentiques et l'innovation technologique la plus avancee. Avec plus de 3.000 produits italiens et une plateforme numerique de pointe, nous sommes le partenaire ideal pour les restaurants et pizzerias qui veulent croitre.",
    en_US: "LAPA combines the best of both worlds: the tradition of authentic Italian products and the most advanced technological innovation. With over 3,000 Italian products and a cutting-edge digital platform, we are the ideal partner for restaurants and pizzerias that want to grow."
  },
  "Conclusione": {
    de_CH: "Fazit",
    fr_CH: "Conclusion",
    en_US: "Conclusion"
  },
  "L'intelligenza artificiale e il futuro della ristorazione, e LAPA e pronta a guidare i ristoratori svizzeri in questa trasformazione. Scegli un fornitore che guarda al futuro: scegli LAPA.": {
    de_CH: "Kuenstliche Intelligenz ist die Zukunft der Gastronomie, und LAPA ist bereit, Schweizer Gastronomen bei dieser Transformation zu fuehren. Waehlen Sie einen Lieferanten, der in die Zukunft blickt: waehlen Sie LAPA.",
    fr_CH: "L'intelligence artificielle est l'avenir de la restauration, et LAPA est pret a guider les restaurateurs suisses dans cette transformation. Choisissez un fournisseur qui regarde vers l'avenir: choisissez LAPA.",
    en_US: "Artificial intelligence is the future of restaurants, and LAPA is ready to guide Swiss restaurateurs in this transformation. Choose a supplier that looks to the future: choose LAPA."
  },
  "Vuoi scoprire come l'AI puo migliorare il tuo ristorante? Contattaci per una consulenza gratuita o visita il nostro catalogo online.": {
    de_CH: "Moechten Sie erfahren, wie KI Ihr Restaurant verbessern kann? Kontaktieren Sie uns fuer eine kostenlose Beratung oder besuchen Sie unseren Online-Katalog.",
    fr_CH: "Vous voulez decouvrir comment l'IA peut ameliorer votre restaurant? Contactez-nous pour une consultation gratuite ou visitez notre catalogue en ligne.",
    en_US: "Want to discover how AI can improve your restaurant? Contact us for a free consultation or visit our online catalog."
  }
};

async function main() {
  await auth();

  console.log('\n=== CREAZIONE ARTICOLO AI ===\n');

  // 1. Trovo il blog corretto (blog 3 o 4 in base a quello usato)
  const blogs = await callOdoo('blog.blog', 'search_read', [[]]);
  console.log('Blog disponibili:', blogs.map(b => `${b.id}: ${b.name}`).join(', '));

  // 2. Creo l'articolo
  console.log('\n1. Creo articolo...');
  const postId = await callOdoo('blog.post', 'create', [{
    name: "LAPA e l'Intelligenza Artificiale: Il Futuro della Ristorazione",
    subtitle: "Come l'AI sta trasformando il settore food e perche LAPA e il partner giusto",
    blog_id: 3, // Blog principale
    content: ITALIAN_CONTENT,
    is_published: true,
    website_meta_title: "LAPA e Intelligenza Artificiale | AI per Ristoranti | Fornitore Svizzera",
    website_meta_description: "Scopri come LAPA usa l'intelligenza artificiale per migliorare il servizio ai ristoranti. AI per pizzerie e ristoranti italiani in Svizzera.",
    website_meta_keywords: "intelligenza artificiale ristoranti, AI pizzerie, LAPA tecnologia, fornitore innovativo svizzera, AI food service"
  }]);

  console.log('   Articolo creato con ID:', postId);

  // 3. Leggo i segmenti per le traduzioni
  console.log('\n2. Leggo segmenti...');
  const segmentData = await callOdoo('blog.post', 'get_field_translations', [[postId], 'content']);
  const segments = segmentData[0];
  const sourceTexts = [...new Set(segments.map(s => s.source))];
  console.log(`   Trovati ${sourceTexts.length} segmenti`);

  // 4. Applico traduzioni per ogni lingua
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
      [[postId], 'content', { [lang]: langTranslations }]
    );
    console.log(`   ${lang}: ${count}/${sourceTexts.length} segmenti tradotti`);
  }

  // 5. Traduco anche titolo e sottotitolo
  console.log('\n3. Traduco titolo e sottotitolo...');

  // Tedesco
  await callOdoo('blog.post', 'write', [[postId], {
    name: "LAPA und Kuenstliche Intelligenz: Die Zukunft der Gastronomie",
    subtitle: "Wie KI den Food-Sektor transformiert und warum LAPA der richtige Partner ist"
  }], { context: { lang: 'de_CH' } });

  // Francese
  await callOdoo('blog.post', 'write', [[postId], {
    name: "LAPA et l'Intelligence Artificielle: L'Avenir de la Restauration",
    subtitle: "Comment l'IA transforme le secteur alimentaire et pourquoi LAPA est le bon partenaire"
  }], { context: { lang: 'fr_CH' } });

  // Inglese
  await callOdoo('blog.post', 'write', [[postId], {
    name: "LAPA and Artificial Intelligence: The Future of Restaurants",
    subtitle: "How AI is transforming the food sector and why LAPA is the right partner"
  }], { context: { lang: 'en_US' } });

  console.log('   Titoli tradotti in tutte le lingue!');

  // 6. Verifica
  console.log('\n--- VERIFICA ---\n');
  for (const lang of ['it_IT', 'de_CH', 'fr_CH', 'en_US']) {
    const data = await callOdoo('blog.post', 'read',
      [[postId], ['name', 'content']],
      { context: { lang } }
    );
    const contentText = (data?.[0]?.content || '').replace(/<[^>]*>/g, '').substring(0, 50);
    console.log(`[${lang}] ${data?.[0]?.name}`);
    console.log(`         ${contentText}...`);
  }

  console.log('\n✅ ARTICOLO AI CREATO E TRADOTTO!');
  console.log('   ID:', postId);
}

main();
