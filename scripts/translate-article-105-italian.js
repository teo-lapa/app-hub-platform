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

const POST_ID = 105;

// Traduzioni ITALIANO per ogni segmento inglese
const ITALIAN_TRANSLATIONS = {
  "LAPA and Artificial Intelligence: The Future of Restaurants":
    "LAPA e l'Intelligenza Artificiale: Il Futuro della Ristorazione",

  "Artificial intelligence is revolutionizing every sector, including restaurants. LAPA embraces this innovation to offer an ever-better service to restaurants and pizzerias in Switzerland. Discover how AI can help your business.":
    "L'intelligenza artificiale sta rivoluzionando ogni settore, inclusa la ristorazione. LAPA abbraccia questa innovazione per offrire un servizio sempre migliore ai ristoranti e alle pizzerie in Svizzera. Scopri come l'IA può aiutare la tua attività.",

  "Why AI is Important for Restaurants":
    "Perché l'IA è Importante per i Ristoranti",

  "Artificial intelligence is not just a technological trend: it's a powerful tool that can transform the way you manage your restaurant. Here are the main advantages:":
    "L'intelligenza artificiale non è solo una tendenza tecnologica: è uno strumento potente che può trasformare il modo in cui gestisci il tuo ristorante. Ecco i principali vantaggi:",

  "Demand forecasting and order optimization":
    "Previsione della domanda e ottimizzazione degli ordini",

  "Reduction of food waste":
    "Riduzione degli sprechi alimentari",

  "Personalization of customer experience":
    "Personalizzazione dell'esperienza del cliente",

  "Automation of repetitive operations":
    "Automazione delle operazioni ripetitive",

  "Analysis of consumption trends":
    "Analisi delle tendenze di consumo",

  "How LAPA Uses Artificial Intelligence":
    "Come LAPA Utilizza l'Intelligenza Artificiale",

  "LAPA integrates artificial intelligence solutions to constantly improve service:":
    "LAPA integra soluzioni di intelligenza artificiale per migliorare costantemente il servizio:",

  "Delivery optimization with intelligent routing algorithms":
    "Ottimizzazione delle consegne con algoritmi di routing intelligenti",

  "Stock forecasting to always guarantee availability":
    "Previsione delle scorte per garantire sempre la disponibilità",

  "Purchase pattern analysis for personalized suggestions":
    "Analisi dei pattern di acquisto per suggerimenti personalizzati",

  "Enhanced customer service with intelligent chatbots":
    "Servizio clienti potenziato con chatbot intelligenti",

  "Automated product catalog management":
    "Gestione automatizzata del catalogo prodotti",

  "AI for Pizzerias: Practical Applications":
    "IA per Pizzerie: Applicazioni Pratiche",

  "Pizzerias can greatly benefit from artificial intelligence:":
    "Le pizzerie possono beneficiare enormemente dell'intelligenza artificiale:",

  "Prediction of order peaks to prepare dough":
    "Previsione dei picchi di ordini per preparare l'impasto",

  "Optimization of mozzarella and fresh ingredient stocks":
    "Ottimizzazione delle scorte di mozzarella e ingredienti freschi",

  "Analysis of customer preferences for personalized menus":
    "Analisi delle preferenze dei clienti per menu personalizzati",

  "Intelligent reservation management":
    "Gestione intelligente delle prenotazioni",

  "Automatic suggestions for supplier orders":
    "Suggerimenti automatici per gli ordini ai fornitori",

  "AI for Italian Restaurants":
    "IA per Ristoranti Italiani",

  "Italian restaurants can leverage AI for:":
    "I ristoranti italiani possono sfruttare l'IA per:",

  "Create seasonal menus based on trends":
    "Creare menu stagionali basati sulle tendenze",

  "Optimize ingredient costs":
    "Ottimizzare i costi degli ingredienti",

  "Manage online reviews intelligently":
    "Gestire le recensioni online in modo intelligente",

  "Predict sales of specific dishes":
    "Prevedere le vendite di piatti specifici",

  "Automate orders to suppliers like LAPA":
    "Automatizzare gli ordini ai fornitori come LAPA",

  "The Future: LAPA and AI Together":
    "Il Futuro: LAPA e IA Insieme",

  "LAPA continuously invests in technology to be the ideal partner for modern restaurateurs. Our platform integrates:":
    "LAPA investe continuamente in tecnologia per essere il partner ideale per i ristoratori moderni. La nostra piattaforma integra:",

  "Intelligent orders with history-based suggestions":
    "Ordini intelligenti con suggerimenti basati sullo storico",

  "Predictive notifications for automatic reorders":
    "Notifiche predittive per riordini automatici",

  "Analytics dashboard to monitor consumption":
    "Dashboard analitica per monitorare i consumi",

  "Integration with leading restaurant management software":
    "Integrazione con i principali software di gestione ristoranti",

  "AI-enhanced multilingual support":
    "Supporto multilingue potenziato dall'IA",

  "Why Choose a Technologically Advanced Supplier":
    "Perché Scegliere un Fornitore Tecnologicamente Avanzato",

  "In 2024 and beyond, choosing a supplier that embraces innovation means:":
    "Nel 2024 e oltre, scegliere un fornitore che abbraccia l'innovazione significa:",

  "Save time in daily operations":
    "Risparmiare tempo nelle operazioni quotidiane",

  "Reduce errors in orders":
    "Ridurre gli errori negli ordini",

  "Always have the right products at the right time":
    "Avere sempre i prodotti giusti al momento giusto",

  "Benefit from optimized prices":
    "Beneficiare di prezzi ottimizzati",

  "Stay competitive in an evolving market":
    "Rimanere competitivi in un mercato in evoluzione",

  "LAPA: Italian Tradition and Technological Innovation":
    "LAPA: Tradizione Italiana e Innovazione Tecnologica",

  "LAPA combines the best of both worlds: the tradition of authentic Italian products and the most advanced technological innovation. With over 3,000 Italian products and a cutting-edge digital platform, we are the ideal partner for restaurants and pizzerias that want to grow.":
    "LAPA combina il meglio di entrambi i mondi: la tradizione dei prodotti italiani autentici e l'innovazione tecnologica più avanzata. Con oltre 3.000 prodotti italiani e una piattaforma digitale all'avanguardia, siamo il partner ideale per ristoranti e pizzerie che vogliono crescere.",

  "Conclusion":
    "Conclusione",

  "Artificial intelligence is the future of restaurants, and LAPA is ready to guide Swiss restaurateurs in this transformation. Choose a supplier that looks to the future: choose LAPA.":
    "L'intelligenza artificiale è il futuro della ristorazione, e LAPA è pronta a guidare i ristoratori svizzeri in questa trasformazione. Scegli un fornitore che guarda al futuro: scegli LAPA.",

  "Want to discover how AI can improve your restaurant? Contact us for a free consultation or visit our online catalog.":
    "Vuoi scoprire come l'IA può migliorare il tuo ristorante? Contattaci per una consulenza gratuita o visita il nostro catalogo online."
};

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 105: TRADUZIONE ITALIANA ===\n');

  console.log('1. Leggo segmenti...');
  const segmentData = await callOdoo('blog.post', 'get_field_translations', [[POST_ID], 'content']);
  const segments = segmentData[0];
  const sourceTexts = [...new Set(segments.map(s => s.source))];
  console.log(`   Trovati ${sourceTexts.length} segmenti`);

  console.log('2. Applico traduzioni ITALIANE...');
  const langTranslations = {};
  let count = 0;
  for (const src of sourceTexts) {
    if (ITALIAN_TRANSLATIONS[src]) {
      langTranslations[src] = ITALIAN_TRANSLATIONS[src];
      count++;
    }
  }

  console.log(`   Segmenti da tradurre: ${count}`);

  if (Object.keys(langTranslations).length > 0) {
    await callOdoo('blog.post', 'update_field_translations',
      [[POST_ID], 'content', { 'it_IT': langTranslations }]
    );
    console.log('   Traduzioni italiane applicate!');
  }

  console.log('\n--- VERIFICA ---\n');
  for (const lang of ['it_IT', 'en_US']) {
    const data = await callOdoo('blog.post', 'read',
      [[POST_ID], ['name', 'content']],
      { context: { lang } }
    );
    const title = data?.[0]?.name || '';
    const text = (data?.[0]?.content || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().substring(0, 150);
    console.log(`[${lang}] ${title}`);
    console.log(`        ${text}...`);
    console.log('');
  }

  console.log('✅ ARTICOLO 105 - TRADUZIONE ITALIANA COMPLETATA!');
}

main();
