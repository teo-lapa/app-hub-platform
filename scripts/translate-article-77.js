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

const postId = 77;

const italianContent = `<h2>Due Formaggi, Due Mondi Diversi</h2>
<p>Spesso confuse o considerate intercambiabili, la mozzarella di bufala e il fior di latte sono in realtà due formaggi molto diversi. Conoscere le differenze è fondamentale per ogni ristoratore e pizzaiolo.</p>

<h2>Mozzarella di Bufala</h2>

<h3>Origine e Produzione</h3>
<p>La mozzarella di bufala è prodotta esclusivamente con latte di bufala. La versione DOP proviene dalla Campania e dal basso Lazio, dove le bufale vengono allevate secondo tradizione.</p>

<h3>Caratteristiche</h3>
<ul>
<li>Sapore intenso, leggermente acidulo, con note di latte fresco</li>
<li>Consistenza morbida, succosa, con la caratteristica lacrima quando tagliata</li>
<li>Colore bianco porcellana</li>
<li>Contenuto di grassi più alto rispetto al fior di latte</li>
</ul>

<h3>Utilizzi Ideali</h3>
<ul>
<li>Caprese e insalate fresche</li>
<li>Pizza margherita aggiunta a fine cottura</li>
<li>Antipasti e taglieri</li>
<li>Consumo fresco con pomodorini e basilico</li>
</ul>

<h2>Fior di Latte</h2>

<h3>Origine e Produzione</h3>
<p>Il fior di latte è prodotto con latte vaccino fresco. Può essere prodotto in tutta Italia, ma le versioni più pregiate provengono dalla Campania.</p>

<h3>Caratteristiche</h3>
<ul>
<li>Sapore delicato, dolce, meno intenso della bufala</li>
<li>Consistenza più compatta, meno acquosa</li>
<li>Colore bianco latte</li>
<li>Contenuto di grassi inferiore alla bufala</li>
</ul>

<h3>Utilizzi Ideali</h3>
<ul>
<li>Pizza (si scioglie meglio e rilascia meno acqua)</li>
<li>Lasagne e timballi</li>
<li>Parmigiana di melanzane</li>
<li>Piatti al forno in generale</li>
</ul>

<h2>Quale Scegliere per la Pizza?</h2>
<p>Per la pizza napoletana tradizionale:</p>
<ul>
<li>Fior di latte: ideale per la cottura, si scioglie uniformemente senza rilasciare troppa acqua</li>
<li>Bufala: da aggiungere a crudo dopo la cottura, o a pezzi negli ultimi secondi</li>
</ul>
<p>Molti pizzaioli usano una combinazione: fior di latte per la base e bufala fresca aggiunta dopo.</p>

<h2>Conservazione</h2>
<p>Entrambe le mozzarelle vanno conservate nel loro liquido di governo, in frigorifero. La bufala è più delicata e va consumata entro 2-3 giorni. Il fior di latte ha una shelf life leggermente più lunga.</p>

<h2>LAPA: Mozzarelle Italiane Autentiche</h2>
<p>Forniamo sia mozzarella di bufala DOP che fior di latte di alta qualità, consegnati freschi in tutta la Svizzera. I nostri prodotti arrivano direttamente dai caseifici italiani.</p>

<p>Scopri la nostra selezione di latticini nel catalogo.</p>`;

const TRANSLATIONS = {
  "Due Formaggi, Due Mondi Diversi": {
    de_CH: "Zwei Käsesorten, zwei verschiedene Welten",
    fr_CH: "Deux fromages, deux mondes différents",
    en_US: "Two Cheeses, Two Different Worlds"
  },
  "Spesso confuse o considerate intercambiabili, la mozzarella di bufala e il fior di latte sono in realtà due formaggi molto diversi. Conoscere le differenze è fondamentale per ogni ristoratore e pizzaiolo.": {
    de_CH: "Oft verwechselt oder als austauschbar betrachtet, sind Büffelmozzarella und Fior di Latte in Wirklichkeit zwei sehr unterschiedliche Käsesorten. Die Unterschiede zu kennen ist für jeden Gastronomen und Pizzabäcker grundlegend.",
    fr_CH: "Souvent confondues ou considérées comme interchangeables, la mozzarella di bufala et le fior di latte sont en réalité deux fromages très différents. Connaître les différences est fondamental pour tout restaurateur et pizzaïolo.",
    en_US: "Often confused or considered interchangeable, buffalo mozzarella and fior di latte are actually two very different cheeses. Knowing the differences is fundamental for every restaurateur and pizza maker."
  },
  "Mozzarella di Bufala": {
    de_CH: "Büffelmozzarella",
    fr_CH: "Mozzarella di Bufala",
    en_US: "Buffalo Mozzarella"
  },
  "Origine e Produzione": {
    de_CH: "Herkunft und Produktion",
    fr_CH: "Origine et Production",
    en_US: "Origin and Production"
  },
  "La mozzarella di bufala è prodotta esclusivamente con latte di bufala. La versione DOP proviene dalla Campania e dal basso Lazio, dove le bufale vengono allevate secondo tradizione.": {
    de_CH: "Büffelmozzarella wird ausschliesslich aus Büffelmilch hergestellt. Die DOP-Version stammt aus Kampanien und dem südlichen Latium, wo die Büffel traditionell gezüchtet werden.",
    fr_CH: "La mozzarella di bufala est produite exclusivement avec du lait de bufflonne. La version DOP provient de Campanie et du sud du Latium, où les buffles sont élevés selon la tradition.",
    en_US: "Buffalo mozzarella is produced exclusively with buffalo milk. The DOP version comes from Campania and southern Lazio, where buffalo are raised according to tradition."
  },
  "Caratteristiche": {
    de_CH: "Eigenschaften",
    fr_CH: "Caractéristiques",
    en_US: "Characteristics"
  },
  "Sapore intenso, leggermente acidulo, con note di latte fresco": {
    de_CH: "Intensiver, leicht säuerlicher Geschmack mit Noten von frischer Milch",
    fr_CH: "Saveur intense, légèrement acidulée, avec des notes de lait frais",
    en_US: "Intense, slightly tangy flavor with notes of fresh milk"
  },
  "Consistenza morbida, succosa, con la caratteristica lacrima quando tagliata": {
    de_CH: "Weiche, saftige Konsistenz mit der charakteristischen Träne beim Anschneiden",
    fr_CH: "Consistance molle, juteuse, avec la larme caractéristique quand on la coupe",
    en_US: "Soft, juicy texture with the characteristic tear when cut"
  },
  "Colore bianco porcellana": {
    de_CH: "Porzellanweisse Farbe",
    fr_CH: "Couleur blanc porcelaine",
    en_US: "Porcelain white color"
  },
  "Contenuto di grassi più alto rispetto al fior di latte": {
    de_CH: "Höherer Fettgehalt als Fior di Latte",
    fr_CH: "Teneur en matières grasses plus élevée que le fior di latte",
    en_US: "Higher fat content than fior di latte"
  },
  "Utilizzi Ideali": {
    de_CH: "Ideale Verwendung",
    fr_CH: "Utilisations Idéales",
    en_US: "Ideal Uses"
  },
  "Caprese e insalate fresche": {
    de_CH: "Caprese und frische Salate",
    fr_CH: "Caprese et salades fraîches",
    en_US: "Caprese and fresh salads"
  },
  "Pizza margherita aggiunta a fine cottura": {
    de_CH: "Pizza Margherita, am Ende der Garzeit hinzugefügt",
    fr_CH: "Pizza margherita ajoutée en fin de cuisson",
    en_US: "Margherita pizza added at the end of cooking"
  },
  "Antipasti e taglieri": {
    de_CH: "Vorspeisen und Vorspeisenplatten",
    fr_CH: "Antipasti et planches",
    en_US: "Appetizers and cheese boards"
  },
  "Consumo fresco con pomodorini e basilico": {
    de_CH: "Frischer Verzehr mit Kirschtomaten und Basilikum",
    fr_CH: "Consommation fraîche avec tomates cerises et basilic",
    en_US: "Fresh consumption with cherry tomatoes and basil"
  },
  "Fior di Latte": {
    de_CH: "Fior di Latte",
    fr_CH: "Fior di Latte",
    en_US: "Fior di Latte"
  },
  "Il fior di latte è prodotto con latte vaccino fresco. Può essere prodotto in tutta Italia, ma le versioni più pregiate provengono dalla Campania.": {
    de_CH: "Fior di Latte wird aus frischer Kuhmilch hergestellt. Er kann in ganz Italien produziert werden, aber die wertvollsten Versionen kommen aus Kampanien.",
    fr_CH: "Le fior di latte est produit avec du lait de vache frais. Il peut être produit dans toute l'Italie, mais les versions les plus prisées proviennent de Campanie.",
    en_US: "Fior di latte is produced with fresh cow's milk. It can be produced throughout Italy, but the most prized versions come from Campania."
  },
  "Sapore delicato, dolce, meno intenso della bufala": {
    de_CH: "Zarter, süsser Geschmack, weniger intensiv als Büffelmozzarella",
    fr_CH: "Saveur délicate, douce, moins intense que la bufala",
    en_US: "Delicate, sweet flavor, less intense than buffalo"
  },
  "Consistenza più compatta, meno acquosa": {
    de_CH: "Kompaktere Konsistenz, weniger wässrig",
    fr_CH: "Consistance plus compacte, moins aqueuse",
    en_US: "More compact texture, less watery"
  },
  "Colore bianco latte": {
    de_CH: "Milchweisse Farbe",
    fr_CH: "Couleur blanc lait",
    en_US: "Milk white color"
  },
  "Contenuto di grassi inferiore alla bufala": {
    de_CH: "Geringerer Fettgehalt als Büffelmozzarella",
    fr_CH: "Teneur en matières grasses inférieure à la bufala",
    en_US: "Lower fat content than buffalo"
  },
  "Pizza (si scioglie meglio e rilascia meno acqua)": {
    de_CH: "Pizza (schmilzt besser und gibt weniger Wasser ab)",
    fr_CH: "Pizza (fond mieux et libère moins d'eau)",
    en_US: "Pizza (melts better and releases less water)"
  },
  "Lasagne e timballi": {
    de_CH: "Lasagne und Timballi",
    fr_CH: "Lasagnes et timbales",
    en_US: "Lasagna and timbales"
  },
  "Parmigiana di melanzane": {
    de_CH: "Auberginen-Parmigiana",
    fr_CH: "Parmigiana d'aubergines",
    en_US: "Eggplant Parmigiana"
  },
  "Piatti al forno in generale": {
    de_CH: "Ofengerichte im Allgemeinen",
    fr_CH: "Plats au four en général",
    en_US: "Baked dishes in general"
  },
  "Quale Scegliere per la Pizza?": {
    de_CH: "Welchen für die Pizza wählen?",
    fr_CH: "Lequel choisir pour la pizza ?",
    en_US: "Which One to Choose for Pizza?"
  },
  "Per la pizza napoletana tradizionale:": {
    de_CH: "Für die traditionelle neapolitanische Pizza:",
    fr_CH: "Pour la pizza napolitaine traditionnelle :",
    en_US: "For traditional Neapolitan pizza:"
  },
  "Fior di latte: ideale per la cottura, si scioglie uniformemente senza rilasciare troppa acqua": {
    de_CH: "Fior di Latte: ideal zum Backen, schmilzt gleichmässig ohne zu viel Wasser abzugeben",
    fr_CH: "Fior di latte : idéal pour la cuisson, fond uniformément sans libérer trop d'eau",
    en_US: "Fior di latte: ideal for baking, melts evenly without releasing too much water"
  },
  "Bufala: da aggiungere a crudo dopo la cottura, o a pezzi negli ultimi secondi": {
    de_CH: "Büffelmozzarella: roh nach dem Backen hinzufügen oder in Stücken in den letzten Sekunden",
    fr_CH: "Bufala : à ajouter crue après la cuisson, ou en morceaux dans les dernières secondes",
    en_US: "Buffalo: to be added raw after cooking, or in pieces in the last seconds"
  },
  "Molti pizzaioli usano una combinazione: fior di latte per la base e bufala fresca aggiunta dopo.": {
    de_CH: "Viele Pizzabäcker verwenden eine Kombination: Fior di Latte für die Basis und frische Büffelmozzarella nachträglich hinzugefügt.",
    fr_CH: "Beaucoup de pizzaïolos utilisent une combinaison : fior di latte pour la base et bufala fraîche ajoutée après.",
    en_US: "Many pizza makers use a combination: fior di latte for the base and fresh buffalo added afterwards."
  },
  "Conservazione": {
    de_CH: "Aufbewahrung",
    fr_CH: "Conservation",
    en_US: "Storage"
  },
  "Entrambe le mozzarelle vanno conservate nel loro liquido di governo, in frigorifero. La bufala è più delicata e va consumata entro 2-3 giorni. Il fior di latte ha una shelf life leggermente più lunga.": {
    de_CH: "Beide Mozzarellasorten sollten in ihrer Aufbewahrungsflüssigkeit im Kühlschrank aufbewahrt werden. Büffelmozzarella ist empfindlicher und sollte innerhalb von 2-3 Tagen verbraucht werden. Fior di Latte hat eine etwas längere Haltbarkeit.",
    fr_CH: "Les deux mozzarellas doivent être conservées dans leur liquide de conservation, au réfrigérateur. La bufala est plus délicate et doit être consommée dans les 2-3 jours. Le fior di latte a une durée de conservation légèrement plus longue.",
    en_US: "Both mozzarellas should be stored in their brine, in the refrigerator. Buffalo is more delicate and should be consumed within 2-3 days. Fior di latte has a slightly longer shelf life."
  },
  "LAPA: Mozzarelle Italiane Autentiche": {
    de_CH: "LAPA: Authentische italienische Mozzarella",
    fr_CH: "LAPA : Mozzarellas italiennes authentiques",
    en_US: "LAPA: Authentic Italian Mozzarella"
  },
  "Forniamo sia mozzarella di bufala DOP che fior di latte di alta qualità, consegnati freschi in tutta la Svizzera. I nostri prodotti arrivano direttamente dai caseifici italiani.": {
    de_CH: "Wir liefern sowohl DOP-Büffelmozzarella als auch hochwertige Fior di Latte, frisch in die ganze Schweiz. Unsere Produkte kommen direkt von italienischen Käsereien.",
    fr_CH: "Nous fournissons aussi bien de la mozzarella di bufala DOP que du fior di latte de haute qualité, livrés frais dans toute la Suisse. Nos produits arrivent directement des fromageries italiennes.",
    en_US: "We supply both DOP buffalo mozzarella and high-quality fior di latte, delivered fresh throughout Switzerland. Our products come directly from Italian dairies."
  },
  "Scopri la nostra selezione di latticini nel catalogo.": {
    de_CH: "Entdecken Sie unsere Auswahl an Milchprodukten im Katalog.",
    fr_CH: "Découvrez notre sélection de produits laitiers dans le catalogue.",
    en_US: "Discover our selection of dairy products in the catalog."
  }
};

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 77: MOZZARELLA BUFALA VS FIOR DI LATTE ===\n');

  // 1. Scrivo contenuto italiano
  console.log('1. Scrivo contenuto ITALIANO...');
  await callOdoo('blog.post', 'write', [[postId], { content: italianContent }]);

  // 2. Leggo segmenti
  console.log('2. Leggo segmenti...');
  const segmentData = await callOdoo('blog.post', 'get_field_translations', [[postId], 'content']);
  const segments = segmentData[0];
  const sourceTexts = [...new Set(segments.map(s => s.source))];
  console.log(`   Trovati ${sourceTexts.length} segmenti`);

  // 3. Traduco
  for (const lang of ['de_CH', 'fr_CH', 'en_US']) {
    const langTranslations = {};
    let found = 0;

    for (const src of sourceTexts) {
      if (TRANSLATIONS[src] && TRANSLATIONS[src][lang]) {
        langTranslations[src] = TRANSLATIONS[src][lang];
        found++;
      }
    }

    if (found > 0) {
      await callOdoo('blog.post', 'update_field_translations',
        [[postId], 'content', { [lang]: langTranslations }]
      );
      console.log(`   ${lang}: ${found}/${sourceTexts.length} segmenti tradotti`);
    }
  }

  // 4. Verifica
  console.log('\n--- VERIFICA ---\n');
  for (const lang of ['it_IT', 'de_CH', 'fr_CH', 'en_US']) {
    const data = await callOdoo('blog.post', 'read', [[postId], ['content']], { context: { lang } });
    const contentText = (data?.[0]?.content || '').replace(/<[^>]*>/g, '').substring(0, 70);
    console.log(`[${lang}] ${contentText}...`);
  }

  console.log('\n✅ ARTICOLO 77 COMPLETATO!\n');
}

main();
