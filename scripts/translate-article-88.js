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

const POST_ID = 88;

// Contenuto ITALIANO
const ITALIAN_CONTENT = `<section class="s_text_block pt40 pb40 o_colored_level" data-snippet="s_text_block">
<div class="container">
<h2>L'Autenticita nel Piatto</h2>
<p>Un menu italiano autentico non e solo una lista di piatti: e un racconto di tradizioni, territori e passione. Ecco come creare un menu che conquisti i tuoi clienti svizzeri con la vera cucina italiana.</p>

<h3>La Struttura del Menu Italiano</h3>
<p>Un menu italiano tradizionale segue un ordine preciso:</p>
<ul>
<li>Antipasti: bruschette, affettati, carpacci</li>
<li>Primi: pasta, risotti, zuppe</li>
<li>Secondi: carne o pesce con contorni</li>
<li>Dolci: tiramisu, panna cotta, cannoli</li>
</ul>

<h3>Gli Antipasti che Conquistano</h3>
<ul>
<li>Tagliere di salumi e formaggi italiani DOP</li>
<li>Bruschette con pomodoro fresco e basilico</li>
<li>Carpaccio di bresaola con rucola e grana</li>
<li>Burrata con pomodorini e pesto</li>
<li>Antipasto all'italiana misto</li>
</ul>

<h3>I Primi Piatti Iconici</h3>
<ul>
<li>Spaghetti alla carbonara autentica</li>
<li>Penne all'arrabbiata</li>
<li>Tagliatelle al ragu bolognese</li>
<li>Risotto alla milanese</li>
<li>Lasagne al forno tradizionali</li>
</ul>

<h3>Le Pizze che Fanno la Differenza</h3>
<ul>
<li>Margherita: la regina delle pizze</li>
<li>Marinara: pomodoro, aglio, origano</li>
<li>Quattro formaggi: gorgonzola, fontina, mozzarella, parmigiano</li>
<li>Diavola: salame piccante</li>
<li>Capricciosa: prosciutto, funghi, carciofi, olive</li>
</ul>

<h3>L'Importanza degli Ingredienti</h3>
<p>Un menu autentico richiede ingredienti autentici:</p>
<ul>
<li>Usa solo prodotti italiani certificati</li>
<li>Preferisci prodotti DOP e IGP</li>
<li>Scegli ingredienti freschi e di stagione</li>
<li>Non scendere a compromessi sulla qualita</li>
</ul>

<h3>Adattare al Mercato Svizzero</h3>
<p>Alcuni consigli per il mercato svizzero:</p>
<ul>
<li>Offri opzioni vegetariane e vegane</li>
<li>Indica gli allergeni chiaramente</li>
<li>Proponi porzioni di diverse dimensioni</li>
<li>Includi descrizioni dei piatti in piu lingue</li>
</ul>

<h3>Gli Errori da Evitare</h3>
<ul>
<li>Non mettere panna nella carbonara</li>
<li>Non servire cappuccino dopo pranzo</li>
<li>Non combinare pesce e formaggio</li>
<li>Non chiamare pasta alla bolognese quello che in Italia e ragu</li>
</ul>

<h3>La Selezione di Vini</h3>
<p>Un buon menu italiano include vini italiani:</p>
<ul>
<li>Chianti per carni e primi al ragu</li>
<li>Prosecco per aperitivi</li>
<li>Pinot Grigio per pesce e piatti leggeri</li>
<li>Primitivo per pizze saporite</li>
</ul>

<h3>Conclusione</h3>
<p>Un menu italiano autentico e il biglietto da visita del tuo ristorante. Investi in qualita, rispetta le tradizioni e i tuoi clienti torneranno sempre.</p>
</div>
</section>`;

// Traduzioni per ogni segmento
const TRANSLATIONS = {
  "L'Autenticita nel Piatto": {
    de_CH: "Authentizitaet auf dem Teller",
    fr_CH: "L'authenticite dans l'assiette",
    en_US: "Authenticity on the Plate"
  },
  "Un menu italiano autentico non e solo una lista di piatti: e un racconto di tradizioni, territori e passione. Ecco come creare un menu che conquisti i tuoi clienti svizzeri con la vera cucina italiana.": {
    de_CH: "Ein authentisches italienisches Menu ist nicht nur eine Liste von Gerichten: Es ist eine Geschichte von Traditionen, Territorien und Leidenschaft. So erstellen Sie ein Menu, das Ihre Schweizer Kunden mit echter italienischer Kueche erobert.",
    fr_CH: "Un menu italien authentique n'est pas seulement une liste de plats: c'est un recit de traditions, de territoires et de passion. Voici comment creer un menu qui conquerra vos clients suisses avec la vraie cuisine italienne.",
    en_US: "An authentic Italian menu is not just a list of dishes: it's a story of traditions, territories and passion. Here's how to create a menu that conquers your Swiss customers with true Italian cuisine."
  },
  "La Struttura del Menu Italiano": {
    de_CH: "Die Struktur des italienischen Menus",
    fr_CH: "La structure du menu italien",
    en_US: "The Structure of the Italian Menu"
  },
  "Un menu italiano tradizionale segue un ordine preciso:": {
    de_CH: "Ein traditionelles italienisches Menu folgt einer praezisen Reihenfolge:",
    fr_CH: "Un menu italien traditionnel suit un ordre precis:",
    en_US: "A traditional Italian menu follows a precise order:"
  },
  "Antipasti: bruschette, affettati, carpacci": {
    de_CH: "Vorspeisen: Bruschetta, Aufschnitt, Carpacci",
    fr_CH: "Antipasti: bruschette, charcuteries, carpaccios",
    en_US: "Appetizers: bruschetta, cold cuts, carpaccios"
  },
  "Primi: pasta, risotti, zuppe": {
    de_CH: "Erste Gaenge: Pasta, Risottos, Suppen",
    fr_CH: "Premiers plats: pates, risottos, soupes",
    en_US: "First courses: pasta, risottos, soups"
  },
  "Secondi: carne o pesce con contorni": {
    de_CH: "Zweite Gaenge: Fleisch oder Fisch mit Beilagen",
    fr_CH: "Seconds plats: viande ou poisson avec accompagnements",
    en_US: "Second courses: meat or fish with sides"
  },
  "Dolci: tiramisu, panna cotta, cannoli": {
    de_CH: "Desserts: Tiramisu, Panna Cotta, Cannoli",
    fr_CH: "Desserts: tiramisu, panna cotta, cannoli",
    en_US: "Desserts: tiramisu, panna cotta, cannoli"
  },
  "Gli Antipasti che Conquistano": {
    de_CH: "Vorspeisen, die begeistern",
    fr_CH: "Les antipasti qui seduisent",
    en_US: "Appetizers that Conquer"
  },
  "Tagliere di salumi e formaggi italiani DOP": {
    de_CH: "Brett mit italienischen DOP-Wurstwaren und Kaese",
    fr_CH: "Planche de charcuteries et fromages italiens DOP",
    en_US: "Board of Italian DOP cured meats and cheeses"
  },
  "Bruschette con pomodoro fresco e basilico": {
    de_CH: "Bruschetta mit frischen Tomaten und Basilikum",
    fr_CH: "Bruschette avec tomates fraiches et basilic",
    en_US: "Bruschetta with fresh tomato and basil"
  },
  "Carpaccio di bresaola con rucola e grana": {
    de_CH: "Bresaola-Carpaccio mit Rucola und Grana",
    fr_CH: "Carpaccio de bresaola avec roquette et grana",
    en_US: "Bresaola carpaccio with arugula and grana"
  },
  "Burrata con pomodorini e pesto": {
    de_CH: "Burrata mit Kirschtomaten und Pesto",
    fr_CH: "Burrata avec tomates cerises et pesto",
    en_US: "Burrata with cherry tomatoes and pesto"
  },
  "Antipasto all'italiana misto": {
    de_CH: "Gemischte italienische Vorspeise",
    fr_CH: "Antipasto mixte a l'italienne",
    en_US: "Mixed Italian antipasto"
  },
  "I Primi Piatti Iconici": {
    de_CH: "Die ikonischen ersten Gaenge",
    fr_CH: "Les premiers plats emblematiques",
    en_US: "The Iconic First Courses"
  },
  "Spaghetti alla carbonara autentica": {
    de_CH: "Authentische Spaghetti Carbonara",
    fr_CH: "Spaghetti alla carbonara authentique",
    en_US: "Authentic spaghetti carbonara"
  },
  "Penne all'arrabbiata": {
    de_CH: "Penne all'arrabbiata",
    fr_CH: "Penne all'arrabbiata",
    en_US: "Penne all'arrabbiata"
  },
  "Tagliatelle al ragu bolognese": {
    de_CH: "Tagliatelle mit Ragu Bolognese",
    fr_CH: "Tagliatelles au ragu bolognaise",
    en_US: "Tagliatelle with Bolognese ragu"
  },
  "Risotto alla milanese": {
    de_CH: "Risotto alla Milanese",
    fr_CH: "Risotto a la milanaise",
    en_US: "Risotto alla milanese"
  },
  "Lasagne al forno tradizionali": {
    de_CH: "Traditionelle Ofenlasagne",
    fr_CH: "Lasagnes au four traditionnelles",
    en_US: "Traditional baked lasagna"
  },
  "Le Pizze che Fanno la Differenza": {
    de_CH: "Die Pizzen, die den Unterschied machen",
    fr_CH: "Les pizzas qui font la difference",
    en_US: "The Pizzas that Make the Difference"
  },
  "Margherita: la regina delle pizze": {
    de_CH: "Margherita: die Koenigin der Pizzen",
    fr_CH: "Margherita: la reine des pizzas",
    en_US: "Margherita: the queen of pizzas"
  },
  "Marinara: pomodoro, aglio, origano": {
    de_CH: "Marinara: Tomate, Knoblauch, Oregano",
    fr_CH: "Marinara: tomate, ail, origan",
    en_US: "Marinara: tomato, garlic, oregano"
  },
  "Quattro formaggi: gorgonzola, fontina, mozzarella, parmigiano": {
    de_CH: "Quattro Formaggi: Gorgonzola, Fontina, Mozzarella, Parmesan",
    fr_CH: "Quatre fromages: gorgonzola, fontina, mozzarella, parmesan",
    en_US: "Four cheeses: gorgonzola, fontina, mozzarella, parmesan"
  },
  "Diavola: salame piccante": {
    de_CH: "Diavola: scharfe Salami",
    fr_CH: "Diavola: salami piquant",
    en_US: "Diavola: spicy salami"
  },
  "Capricciosa: prosciutto, funghi, carciofi, olive": {
    de_CH: "Capricciosa: Schinken, Pilze, Artischocken, Oliven",
    fr_CH: "Capricciosa: jambon, champignons, artichauts, olives",
    en_US: "Capricciosa: ham, mushrooms, artichokes, olives"
  },
  "L'Importanza degli Ingredienti": {
    de_CH: "Die Bedeutung der Zutaten",
    fr_CH: "L'importance des ingredients",
    en_US: "The Importance of Ingredients"
  },
  "Un menu autentico richiede ingredienti autentici:": {
    de_CH: "Ein authentisches Menu erfordert authentische Zutaten:",
    fr_CH: "Un menu authentique necessite des ingredients authentiques:",
    en_US: "An authentic menu requires authentic ingredients:"
  },
  "Usa solo prodotti italiani certificati": {
    de_CH: "Verwenden Sie nur zertifizierte italienische Produkte",
    fr_CH: "Utilisez uniquement des produits italiens certifies",
    en_US: "Use only certified Italian products"
  },
  "Preferisci prodotti DOP e IGP": {
    de_CH: "Bevorzugen Sie DOP- und IGP-Produkte",
    fr_CH: "Preferez les produits DOP et IGP",
    en_US: "Prefer DOP and IGP products"
  },
  "Scegli ingredienti freschi e di stagione": {
    de_CH: "Waehlen Sie frische und saisonale Zutaten",
    fr_CH: "Choisissez des ingredients frais et de saison",
    en_US: "Choose fresh and seasonal ingredients"
  },
  "Non scendere a compromessi sulla qualita": {
    de_CH: "Machen Sie keine Kompromisse bei der Qualitaet",
    fr_CH: "Ne faites pas de compromis sur la qualite",
    en_US: "Don't compromise on quality"
  },
  "Adattare al Mercato Svizzero": {
    de_CH: "Anpassung an den Schweizer Markt",
    fr_CH: "S'adapter au marche suisse",
    en_US: "Adapting to the Swiss Market"
  },
  "Alcuni consigli per il mercato svizzero:": {
    de_CH: "Einige Tipps fuer den Schweizer Markt:",
    fr_CH: "Quelques conseils pour le marche suisse:",
    en_US: "Some tips for the Swiss market:"
  },
  "Offri opzioni vegetariane e vegane": {
    de_CH: "Bieten Sie vegetarische und vegane Optionen an",
    fr_CH: "Proposez des options vegetariennes et veganes",
    en_US: "Offer vegetarian and vegan options"
  },
  "Indica gli allergeni chiaramente": {
    de_CH: "Geben Sie Allergene deutlich an",
    fr_CH: "Indiquez clairement les allergenes",
    en_US: "Clearly indicate allergens"
  },
  "Proponi porzioni di diverse dimensioni": {
    de_CH: "Bieten Sie Portionen in verschiedenen Groessen an",
    fr_CH: "Proposez des portions de differentes tailles",
    en_US: "Offer portions of different sizes"
  },
  "Includi descrizioni dei piatti in piu lingue": {
    de_CH: "Fuegen Sie Gerichtsbeschreibungen in mehreren Sprachen hinzu",
    fr_CH: "Incluez des descriptions des plats en plusieurs langues",
    en_US: "Include dish descriptions in multiple languages"
  },
  "Gli Errori da Evitare": {
    de_CH: "Zu vermeidende Fehler",
    fr_CH: "Les erreurs a eviter",
    en_US: "Mistakes to Avoid"
  },
  "Non mettere panna nella carbonara": {
    de_CH: "Keine Sahne in die Carbonara geben",
    fr_CH: "Ne pas mettre de creme dans la carbonara",
    en_US: "Don't put cream in carbonara"
  },
  "Non servire cappuccino dopo pranzo": {
    de_CH: "Keinen Cappuccino nach dem Mittagessen servieren",
    fr_CH: "Ne pas servir de cappuccino apres le dejeuner",
    en_US: "Don't serve cappuccino after lunch"
  },
  "Non combinare pesce e formaggio": {
    de_CH: "Fisch und Kaese nicht kombinieren",
    fr_CH: "Ne pas combiner poisson et fromage",
    en_US: "Don't combine fish and cheese"
  },
  "Non chiamare pasta alla bolognese quello che in Italia e ragu": {
    de_CH: "Nennen Sie nicht Pasta alla Bolognese, was in Italien Ragu ist",
    fr_CH: "N'appelez pas pasta alla bolognese ce qui en Italie est du ragu",
    en_US: "Don't call pasta alla bolognese what in Italy is ragu"
  },
  "La Selezione di Vini": {
    de_CH: "Die Weinauswahl",
    fr_CH: "La selection de vins",
    en_US: "The Wine Selection"
  },
  "Un buon menu italiano include vini italiani:": {
    de_CH: "Ein gutes italienisches Menu umfasst italienische Weine:",
    fr_CH: "Un bon menu italien comprend des vins italiens:",
    en_US: "A good Italian menu includes Italian wines:"
  },
  "Chianti per carni e primi al ragu": {
    de_CH: "Chianti fuer Fleisch und erste Gaenge mit Ragu",
    fr_CH: "Chianti pour viandes et premiers plats au ragu",
    en_US: "Chianti for meats and first courses with ragu"
  },
  "Prosecco per aperitivi": {
    de_CH: "Prosecco fuer Aperitifs",
    fr_CH: "Prosecco pour les aperitifs",
    en_US: "Prosecco for aperitifs"
  },
  "Pinot Grigio per pesce e piatti leggeri": {
    de_CH: "Pinot Grigio fuer Fisch und leichte Gerichte",
    fr_CH: "Pinot Grigio pour poisson et plats legers",
    en_US: "Pinot Grigio for fish and light dishes"
  },
  "Primitivo per pizze saporite": {
    de_CH: "Primitivo fuer herzhafte Pizzen",
    fr_CH: "Primitivo pour pizzas savoureuses",
    en_US: "Primitivo for flavorful pizzas"
  },
  "Conclusione": {
    de_CH: "Fazit",
    fr_CH: "Conclusion",
    en_US: "Conclusion"
  },
  "Un menu italiano autentico e il biglietto da visita del tuo ristorante. Investi in qualita, rispetta le tradizioni e i tuoi clienti torneranno sempre.": {
    de_CH: "Ein authentisches italienisches Menu ist die Visitenkarte Ihres Restaurants. Investieren Sie in Qualitaet, respektieren Sie die Traditionen und Ihre Kunden werden immer wiederkommen.",
    fr_CH: "Un menu italien authentique est la carte de visite de votre restaurant. Investissez dans la qualite, respectez les traditions et vos clients reviendront toujours.",
    en_US: "An authentic Italian menu is your restaurant's business card. Invest in quality, respect traditions and your customers will always come back."
  }
};

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 88: MENU ITALIANO AUTENTICO ===\n');

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

  console.log('\n✅ ARTICOLO 88 COMPLETATO!');
}

main();
