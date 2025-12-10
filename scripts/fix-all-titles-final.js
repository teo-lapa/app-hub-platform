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

// Scrittura BASE (italiano) - SENZA context
async function writeBase(id, values) {
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
        kwargs: {}
      },
      id: Date.now()
    })
  });
  return (await r.json());
}

// Scrittura TRADUZIONE - CON context lang
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
        kwargs: { fields: ['name', 'subtitle'], context: { lang } }
      },
      id: Date.now()
    })
  });
  return (await r.json()).result?.[0];
}

// TUTTI GLI ARTICOLI 75-89
const articles = [
  {
    id: 75,
    it: { name: "Come Scegliere il Fornitore Giusto per la Tua Pizzeria in Svizzera", subtitle: "Guida completa alla scelta del grossista ideale per ingredienti italiani di qualità" },
    de: { name: "Wie Sie den richtigen Lieferanten für Ihre Pizzeria in der Schweiz wählen", subtitle: "Vollständiger Leitfaden zur Auswahl des idealen Grossisten für italienische Qualitätszutaten" },
    fr: { name: "Comment choisir le bon fournisseur pour votre pizzeria en Suisse", subtitle: "Guide complet pour choisir le grossiste idéal pour des ingrédients italiens de qualité" },
    en: { name: "How to Choose the Right Supplier for Your Pizzeria in Switzerland", subtitle: "Complete guide to selecting the ideal wholesaler for quality Italian ingredients" }
  },
  {
    id: 76,
    it: { name: "Guida Completa: Aprire un Ristorante Italiano in Svizzera", subtitle: "Tutto quello che devi sapere per avviare la tua attività di ristorazione italiana" },
    de: { name: "Vollständiger Leitfaden: Ein italienisches Restaurant in der Schweiz eröffnen", subtitle: "Alles, was Sie wissen müssen, um Ihr italienisches Gastronomiegeschäft zu starten" },
    fr: { name: "Guide complet : Ouvrir un restaurant italien en Suisse", subtitle: "Tout ce que vous devez savoir pour lancer votre activité de restauration italienne" },
    en: { name: "Complete Guide: Opening an Italian Restaurant in Switzerland", subtitle: "Everything you need to know to start your Italian restaurant business" }
  },
  {
    id: 77,
    it: { name: "Mozzarella di Bufala vs Fior di Latte: Le Differenze", subtitle: "Guida completa per scegliere la mozzarella giusta per ogni piatto" },
    de: { name: "Büffelmozzarella vs Fior di Latte: Die Unterschiede", subtitle: "Vollständiger Leitfaden zur Auswahl des richtigen Mozzarellas für jedes Gericht" },
    fr: { name: "Mozzarella di Bufala vs Fior di Latte : Les différences", subtitle: "Guide complet pour choisir la bonne mozzarella pour chaque plat" },
    en: { name: "Buffalo Mozzarella vs Fior di Latte: The Differences", subtitle: "Complete guide to choosing the right mozzarella for every dish" }
  },
  {
    id: 78,
    it: { name: "I 10 Prodotti Essenziali per Pizzerie", subtitle: "La lista completa degli ingredienti che ogni pizzeria deve avere" },
    de: { name: "Die 10 wichtigsten Produkte für Pizzerien", subtitle: "Die vollständige Liste der Zutaten, die jede Pizzeria haben muss" },
    fr: { name: "Les 10 produits essentiels pour les pizzerias", subtitle: "La liste complète des ingrédients que chaque pizzeria doit avoir" },
    en: { name: "The 10 Essential Products for Pizzerias", subtitle: "The complete list of ingredients every pizzeria must have" }
  },
  {
    id: 79,
    it: { name: "Come Scegliere un Grossista di Prodotti Italiani", subtitle: "I criteri fondamentali per selezionare il fornitore ideale per il tuo ristorante" },
    de: { name: "Wie man einen Grossisten für italienische Produkte auswählt", subtitle: "Die grundlegenden Kriterien zur Auswahl des idealen Lieferanten für Ihr Restaurant" },
    fr: { name: "Comment choisir un grossiste de produits italiens", subtitle: "Les critères fondamentaux pour sélectionner le fournisseur idéal pour votre restaurant" },
    en: { name: "How to Choose an Italian Products Wholesaler", subtitle: "The fundamental criteria for selecting the ideal supplier for your restaurant" }
  },
  {
    id: 80,
    it: { name: "Guanciale vs Pancetta: Qual è la Differenza", subtitle: "Guida completa per capire quando usare guanciale o pancetta nei tuoi piatti" },
    de: { name: "Guanciale vs Pancetta: Was ist der Unterschied", subtitle: "Vollständiger Leitfaden, um zu verstehen, wann man Guanciale oder Pancetta in Gerichten verwendet" },
    fr: { name: "Guanciale vs Pancetta : Quelle est la différence", subtitle: "Guide complet pour comprendre quand utiliser le guanciale ou la pancetta dans vos plats" },
    en: { name: "Guanciale vs Pancetta: What's the Difference", subtitle: "Complete guide to understanding when to use guanciale or pancetta in your dishes" }
  },
  {
    id: 81,
    it: { name: "Come Conservare Correttamente i Prodotti Freschi Italiani", subtitle: "Guida pratica per mantenere la qualità di mozzarella, salumi e altri prodotti freschi" },
    de: { name: "Wie man frische italienische Produkte richtig lagert", subtitle: "Praktischer Leitfaden zur Erhaltung der Qualität von Mozzarella, Wurstwaren und anderen Frischprodukten" },
    fr: { name: "Comment conserver correctement les produits frais italiens", subtitle: "Guide pratique pour maintenir la qualité de la mozzarella, des charcuteries et autres produits frais" },
    en: { name: "How to Properly Store Fresh Italian Products", subtitle: "Practical guide to maintaining the quality of mozzarella, cured meats and other fresh products" }
  },
  {
    id: 82,
    it: { name: "Olio Extravergine d'Oliva: Guida alla Scelta per Ristoranti", subtitle: "Come selezionare l'olio giusto per ogni piatto del tuo menu" },
    de: { name: "Natives Olivenöl Extra: Auswahlhilfe für Restaurants", subtitle: "Wie man das richtige Öl für jedes Gericht auf Ihrer Speisekarte auswählt" },
    fr: { name: "Huile d'olive extra vierge : Guide de sélection pour restaurants", subtitle: "Comment sélectionner la bonne huile pour chaque plat de votre menu" },
    en: { name: "Extra Virgin Olive Oil: Selection Guide for Restaurants", subtitle: "How to select the right oil for every dish on your menu" }
  },
  {
    id: 83,
    it: { name: "Pasta Fresca vs Pasta Secca: Guida per Ristoratori", subtitle: "Quando usare pasta fresca e quando pasta secca nel tuo ristorante" },
    de: { name: "Frische Pasta vs Trockene Pasta: Leitfaden für Gastronomen", subtitle: "Wann Sie frische Pasta und wann Sie trockene Pasta in Ihrem Restaurant verwenden sollten" },
    fr: { name: "Pâtes fraîches vs Pâtes sèches : Guide pour restaurateurs", subtitle: "Quand utiliser des pâtes fraîches et quand utiliser des pâtes sèches dans votre restaurant" },
    en: { name: "Fresh Pasta vs Dry Pasta: Guide for Restaurateurs", subtitle: "When to use fresh pasta and when to use dry pasta in your restaurant" }
  },
  {
    id: 84,
    it: { name: "I Formaggi DOP Italiani che Ogni Ristorante Deve Avere", subtitle: "La guida definitiva ai formaggi italiani certificati per la ristorazione" },
    de: { name: "Die italienischen DOP-Käse, die jedes Restaurant haben muss", subtitle: "Der ultimative Leitfaden zu zertifizierten italienischen Käsesorten für die Gastronomie" },
    fr: { name: "Les fromages DOP italiens que chaque restaurant doit avoir", subtitle: "Le guide ultime des fromages italiens certifiés pour la restauration" },
    en: { name: "Italian DOP Cheeses Every Restaurant Must Have", subtitle: "The ultimate guide to certified Italian cheeses for restaurants" }
  },
  {
    id: 85,
    it: { name: "Pomodori per Pizza: San Marzano e Alternative di Qualità", subtitle: "Come scegliere i pomodori giusti per la tua pizza napoletana" },
    de: { name: "Tomaten für Pizza: San Marzano und Qualitätsalternativen", subtitle: "Wie man die richtigen Tomaten für Ihre neapolitanische Pizza auswählt" },
    fr: { name: "Tomates pour pizza : San Marzano et alternatives de qualité", subtitle: "Comment choisir les bonnes tomates pour votre pizza napolitaine" },
    en: { name: "Tomatoes for Pizza: San Marzano and Quality Alternatives", subtitle: "How to choose the right tomatoes for your Neapolitan pizza" }
  },
  {
    id: 86,
    it: { name: "Attrezzature Essenziali per una Pizzeria: La Lista Completa", subtitle: "Tutto quello che serve per avviare e gestire una pizzeria di successo" },
    de: { name: "Wesentliche Ausstattung für eine Pizzeria: Die vollständige Liste", subtitle: "Alles, was Sie brauchen, um eine erfolgreiche Pizzeria zu starten und zu führen" },
    fr: { name: "Équipements essentiels pour une pizzeria : La liste complète", subtitle: "Tout ce dont vous avez besoin pour démarrer et gérer une pizzeria à succès" },
    en: { name: "Essential Equipment for a Pizzeria: The Complete List", subtitle: "Everything you need to start and run a successful pizzeria" }
  },
  {
    id: 87,
    it: { name: "I Salumi Italiani per Ristoranti: Guida Completa", subtitle: "Dalla selezione alla conservazione: tutto sui salumi italiani per la ristorazione" },
    de: { name: "Italienische Wurstwaren für Restaurants: Vollständiger Leitfaden", subtitle: "Von der Auswahl bis zur Lagerung: alles über italienische Wurstwaren für die Gastronomie" },
    fr: { name: "Les charcuteries italiennes pour restaurants : Guide complet", subtitle: "De la sélection à la conservation : tout sur les charcuteries italiennes pour la restauration" },
    en: { name: "Italian Cured Meats for Restaurants: Complete Guide", subtitle: "From selection to storage: everything about Italian cured meats for restaurants" }
  },
  {
    id: 88,
    it: { name: "Come Creare un Menu Italiano Autentico per il Tuo Ristorante", subtitle: "Consigli pratici per costruire un menu che rappresenti la vera cucina italiana" },
    de: { name: "Wie man ein authentisches italienisches Menü für Ihr Restaurant erstellt", subtitle: "Praktische Tipps zur Erstellung eines Menüs, das die echte italienische Küche repräsentiert" },
    fr: { name: "Comment créer un menu italien authentique pour votre restaurant", subtitle: "Conseils pratiques pour construire un menu qui représente la vraie cuisine italienne" },
    en: { name: "How to Create an Authentic Italian Menu for Your Restaurant", subtitle: "Practical tips for building a menu that represents true Italian cuisine" }
  },
  {
    id: 89,
    it: { name: "Consegna Prodotti Freschi: Cosa Cercare in un Fornitore", subtitle: "I criteri fondamentali per garantire la qualità dei prodotti freschi nel tuo ristorante" },
    de: { name: "Lieferung von Frischprodukten: Worauf Sie bei einem Lieferanten achten sollten", subtitle: "Die grundlegenden Kriterien zur Gewährleistung der Qualität von Frischprodukten in Ihrem Restaurant" },
    fr: { name: "Livraison de produits frais : Ce qu'il faut rechercher chez un fournisseur", subtitle: "Les critères fondamentaux pour garantir la qualité des produits frais dans votre restaurant" },
    en: { name: "Fresh Product Delivery: What to Look for in a Supplier", subtitle: "The fundamental criteria to ensure the quality of fresh products in your restaurant" }
  }
];

async function main() {
  await auth();

  console.log('\n=== SISTEMAZIONE TITOLI ARTICOLI 75-89 ===\n');

  // FASE 1: Scrivo tutti i titoli ITALIANI come BASE
  console.log('--- FASE 1: TITOLI ITALIANI (BASE) ---\n');
  for (const article of articles) {
    console.log(`Articolo ${article.id}: ${article.it.name.substring(0, 40)}...`);
    const result = await writeBase(article.id, article.it);
    console.log(`  IT: ${result.result === true ? 'OK' : 'ERRORE'}`);
  }

  // FASE 2: Scrivo le traduzioni
  console.log('\n--- FASE 2: TRADUZIONI ---\n');

  // Tedesco
  console.log('TEDESCO (de_CH):');
  for (const article of articles) {
    const result = await writeWithLang(article.id, article.de, 'de_CH');
    console.log(`  ${article.id}: ${result.result === true ? 'OK' : 'ERRORE'}`);
  }

  // Francese
  console.log('\nFRANCESE (fr_CH):');
  for (const article of articles) {
    const result = await writeWithLang(article.id, article.fr, 'fr_CH');
    console.log(`  ${article.id}: ${result.result === true ? 'OK' : 'ERRORE'}`);
  }

  // Inglese
  console.log('\nINGLESE (en_US):');
  for (const article of articles) {
    const result = await writeWithLang(article.id, article.en, 'en_US');
    console.log(`  ${article.id}: ${result.result === true ? 'OK' : 'ERRORE'}`);
  }

  // Verifica finale
  console.log('\n--- VERIFICA FINALE ---\n');
  for (const article of articles) {
    console.log(`\nArticolo ${article.id}:`);
    for (const lang of ['it_IT', 'de_CH', 'fr_CH', 'en_US']) {
      const data = await readWithLang(article.id, lang);
      console.log(`  [${lang}] ${data?.name?.substring(0, 50)}...`);
    }
  }
}

main();
