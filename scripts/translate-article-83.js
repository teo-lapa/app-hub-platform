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

const POST_ID = 83;

// Contenuto ITALIANO
const ITALIAN_CONTENT = `<section class="s_text_block pt40 pb40 o_colored_level" data-snippet="s_text_block">
<div class="container">
<h2>Due Mondi della Tradizione Italiana</h2>
<p>Pasta fresca e pasta secca sono entrambe protagoniste della cucina italiana, ma hanno caratteristiche e utilizzi diversi. Conoscere le differenze ti aiutera a scegliere quella giusta per ogni piatto.</p>

<h3>La Pasta Fresca</h3>
<p>La pasta fresca e preparata con uova e farina, ha una consistenza morbida e un sapore ricco. E la scelta tradizionale per molti piatti regionali.</p>

<h4>Caratteristiche della Pasta Fresca:</h4>
<ul>
<li>Ingredienti: farina e uova (a volte solo acqua)</li>
<li>Consistenza: morbida e porosa</li>
<li>Cottura: tempi brevi, 2-4 minuti</li>
<li>Conservazione: in frigo per 2-3 giorni, o congelata</li>
<li>Formati tipici: tagliatelle, pappardelle, ravioli, tortellini</li>
</ul>

<h3>La Pasta Secca</h3>
<p>La pasta secca e preparata con semola di grano duro e acqua, poi essiccata. Ha una consistenza piu compatta e si conserva a lungo.</p>

<h4>Caratteristiche della Pasta Secca:</h4>
<ul>
<li>Ingredienti: semola di grano duro e acqua</li>
<li>Consistenza: compatta e al dente</li>
<li>Cottura: tempi variabili, 8-15 minuti</li>
<li>Conservazione: a temperatura ambiente per mesi</li>
<li>Formati tipici: spaghetti, penne, rigatoni, fusilli</li>
</ul>

<h3>Quale Scegliere per Ogni Piatto?</h3>
<h4>Usa Pasta Fresca per:</h4>
<ul>
<li>Sughi cremosi e burro</li>
<li>Ragu alla bolognese</li>
<li>Piatti ripieni (ravioli, tortellini)</li>
<li>Lasagne al forno</li>
</ul>

<h4>Usa Pasta Secca per:</h4>
<ul>
<li>Sughi a base di pomodoro</li>
<li>Pasta aglio, olio e peperoncino</li>
<li>Carbonara e amatriciana</li>
<li>Pasta fredda in estate</li>
</ul>

<h3>La Qualita della Semola</h3>
<p>Per la pasta secca, la qualita della semola fa la differenza. Cerca pasta trafilata al bronzo: ha una superficie ruvida che trattiene meglio il sugo.</p>

<h3>La Nostra Selezione</h3>
<p>LAPA offre sia pasta fresca che pasta secca di alta qualita:</p>
<ul>
<li>Pasta fresca artigianale dalle migliori regioni</li>
<li>Pasta secca trafilata al bronzo</li>
<li>Formati speciali e regionali</li>
<li>Pasta all'uovo e senza uova</li>
</ul>

<h3>Conclusione</h3>
<p>Non esiste una pasta migliore dell'altra: dipende dal piatto che vuoi preparare. Con i prodotti LAPA, potrai offrire ai tuoi clienti il meglio di entrambe le tradizioni.</p>
</div>
</section>`;

// Traduzioni per ogni segmento
const TRANSLATIONS = {
  "Due Mondi della Tradizione Italiana": {
    de_CH: "Zwei Welten der italienischen Tradition",
    fr_CH: "Deux mondes de la tradition italienne",
    en_US: "Two Worlds of Italian Tradition"
  },
  "Pasta fresca e pasta secca sono entrambe protagoniste della cucina italiana, ma hanno caratteristiche e utilizzi diversi. Conoscere le differenze ti aiutera a scegliere quella giusta per ogni piatto.": {
    de_CH: "Frische und trockene Pasta sind beide Protagonisten der italienischen Kueche, haben aber unterschiedliche Eigenschaften und Verwendungszwecke. Die Unterschiede zu kennen hilft Ihnen, die richtige fuer jedes Gericht zu waehlen.",
    fr_CH: "Les pates fraiches et les pates seches sont toutes deux protagonistes de la cuisine italienne, mais ont des caracteristiques et des utilisations differentes. Connaitre les differences vous aidera a choisir la bonne pour chaque plat.",
    en_US: "Fresh pasta and dried pasta are both protagonists of Italian cuisine, but have different characteristics and uses. Knowing the differences will help you choose the right one for each dish."
  },
  "La Pasta Fresca": {
    de_CH: "Frische Pasta",
    fr_CH: "Les Pates Fraiches",
    en_US: "Fresh Pasta"
  },
  "La pasta fresca e preparata con uova e farina, ha una consistenza morbida e un sapore ricco. E la scelta tradizionale per molti piatti regionali.": {
    de_CH: "Frische Pasta wird mit Eiern und Mehl zubereitet, hat eine weiche Konsistenz und einen reichhaltigen Geschmack. Sie ist die traditionelle Wahl fuer viele regionale Gerichte.",
    fr_CH: "Les pates fraiches sont preparees avec des oeufs et de la farine, ont une consistance moelleuse et un gout riche. C'est le choix traditionnel pour de nombreux plats regionaux.",
    en_US: "Fresh pasta is prepared with eggs and flour, has a soft consistency and rich flavor. It's the traditional choice for many regional dishes."
  },
  "Caratteristiche della Pasta Fresca:": {
    de_CH: "Eigenschaften frischer Pasta:",
    fr_CH: "Caracteristiques des pates fraiches:",
    en_US: "Characteristics of Fresh Pasta:"
  },
  "Ingredienti: farina e uova (a volte solo acqua)": {
    de_CH: "Zutaten: Mehl und Eier (manchmal nur Wasser)",
    fr_CH: "Ingredients: farine et oeufs (parfois juste de l'eau)",
    en_US: "Ingredients: flour and eggs (sometimes just water)"
  },
  "Consistenza: morbida e porosa": {
    de_CH: "Konsistenz: weich und poroes",
    fr_CH: "Consistance: moelleuse et poreuse",
    en_US: "Consistency: soft and porous"
  },
  "Cottura: tempi brevi, 2-4 minuti": {
    de_CH: "Kochzeit: kurz, 2-4 Minuten",
    fr_CH: "Cuisson: temps courts, 2-4 minutes",
    en_US: "Cooking: short times, 2-4 minutes"
  },
  "Conservazione: in frigo per 2-3 giorni, o congelata": {
    de_CH: "Aufbewahrung: im Kuehlschrank fuer 2-3 Tage oder eingefroren",
    fr_CH: "Conservation: au refrigerateur pendant 2-3 jours, ou congelee",
    en_US: "Storage: in refrigerator for 2-3 days, or frozen"
  },
  "Formati tipici: tagliatelle, pappardelle, ravioli, tortellini": {
    de_CH: "Typische Formate: Tagliatelle, Pappardelle, Ravioli, Tortellini",
    fr_CH: "Formats typiques: tagliatelles, pappardelles, raviolis, tortellinis",
    en_US: "Typical formats: tagliatelle, pappardelle, ravioli, tortellini"
  },
  "La Pasta Secca": {
    de_CH: "Trockene Pasta",
    fr_CH: "Les Pates Seches",
    en_US: "Dried Pasta"
  },
  "La pasta secca e preparata con semola di grano duro e acqua, poi essiccata. Ha una consistenza piu compatta e si conserva a lungo.": {
    de_CH: "Trockene Pasta wird aus Hartweizengrieß und Wasser hergestellt und dann getrocknet. Sie hat eine kompaktere Konsistenz und ist lange haltbar.",
    fr_CH: "Les pates seches sont preparees avec de la semoule de ble dur et de l'eau, puis sechees. Elles ont une consistance plus compacte et se conservent longtemps.",
    en_US: "Dried pasta is prepared with durum wheat semolina and water, then dried. It has a more compact consistency and keeps for a long time."
  },
  "Caratteristiche della Pasta Secca:": {
    de_CH: "Eigenschaften trockener Pasta:",
    fr_CH: "Caracteristiques des pates seches:",
    en_US: "Characteristics of Dried Pasta:"
  },
  "Ingredienti: semola di grano duro e acqua": {
    de_CH: "Zutaten: Hartweizengrieß und Wasser",
    fr_CH: "Ingredients: semoule de ble dur et eau",
    en_US: "Ingredients: durum wheat semolina and water"
  },
  "Consistenza: compatta e al dente": {
    de_CH: "Konsistenz: kompakt und al dente",
    fr_CH: "Consistance: compacte et al dente",
    en_US: "Consistency: compact and al dente"
  },
  "Cottura: tempi variabili, 8-15 minuti": {
    de_CH: "Kochzeit: variabel, 8-15 Minuten",
    fr_CH: "Cuisson: temps variables, 8-15 minutes",
    en_US: "Cooking: variable times, 8-15 minutes"
  },
  "Conservazione: a temperatura ambiente per mesi": {
    de_CH: "Aufbewahrung: bei Raumtemperatur fuer Monate",
    fr_CH: "Conservation: a temperature ambiante pendant des mois",
    en_US: "Storage: at room temperature for months"
  },
  "Formati tipici: spaghetti, penne, rigatoni, fusilli": {
    de_CH: "Typische Formate: Spaghetti, Penne, Rigatoni, Fusilli",
    fr_CH: "Formats typiques: spaghettis, penne, rigatoni, fusilli",
    en_US: "Typical formats: spaghetti, penne, rigatoni, fusilli"
  },
  "Quale Scegliere per Ogni Piatto?": {
    de_CH: "Welche fuer jedes Gericht waehlen?",
    fr_CH: "Laquelle choisir pour chaque plat?",
    en_US: "Which One to Choose for Each Dish?"
  },
  "Usa Pasta Fresca per:": {
    de_CH: "Verwenden Sie frische Pasta fuer:",
    fr_CH: "Utilisez les pates fraiches pour:",
    en_US: "Use Fresh Pasta for:"
  },
  "Sughi cremosi e burro": {
    de_CH: "Cremige Saucen und Butter",
    fr_CH: "Sauces cremeuses et beurre",
    en_US: "Creamy sauces and butter"
  },
  "Ragu alla bolognese": {
    de_CH: "Ragu alla bolognese",
    fr_CH: "Ragu a la bolognaise",
    en_US: "Bolognese ragu"
  },
  "Piatti ripieni (ravioli, tortellini)": {
    de_CH: "Gefuellte Gerichte (Ravioli, Tortellini)",
    fr_CH: "Plats farcis (raviolis, tortellinis)",
    en_US: "Stuffed dishes (ravioli, tortellini)"
  },
  "Lasagne al forno": {
    de_CH: "Lasagne aus dem Ofen",
    fr_CH: "Lasagnes au four",
    en_US: "Baked lasagna"
  },
  "Usa Pasta Secca per:": {
    de_CH: "Verwenden Sie trockene Pasta fuer:",
    fr_CH: "Utilisez les pates seches pour:",
    en_US: "Use Dried Pasta for:"
  },
  "Sughi a base di pomodoro": {
    de_CH: "Tomatenbasierte Saucen",
    fr_CH: "Sauces a base de tomate",
    en_US: "Tomato-based sauces"
  },
  "Pasta aglio, olio e peperoncino": {
    de_CH: "Pasta mit Knoblauch, Oel und Peperoncino",
    fr_CH: "Pates a l'ail, huile et piment",
    en_US: "Pasta with garlic, oil and chili"
  },
  "Carbonara e amatriciana": {
    de_CH: "Carbonara und Amatriciana",
    fr_CH: "Carbonara et amatriciana",
    en_US: "Carbonara and amatriciana"
  },
  "Pasta fredda in estate": {
    de_CH: "Kalte Pasta im Sommer",
    fr_CH: "Pates froides en ete",
    en_US: "Cold pasta in summer"
  },
  "La Qualita della Semola": {
    de_CH: "Die Qualitaet des Grießes",
    fr_CH: "La qualite de la semoule",
    en_US: "The Quality of Semolina"
  },
  "Per la pasta secca, la qualita della semola fa la differenza. Cerca pasta trafilata al bronzo: ha una superficie ruvida che trattiene meglio il sugo.": {
    de_CH: "Bei trockener Pasta macht die Qualitaet des Grießes den Unterschied. Suchen Sie nach bronze-gezogener Pasta: Sie hat eine raue Oberflaeche, die die Sauce besser haelt.",
    fr_CH: "Pour les pates seches, la qualite de la semoule fait la difference. Recherchez les pates trefilee au bronze: elles ont une surface rugueuse qui retient mieux la sauce.",
    en_US: "For dried pasta, the quality of semolina makes the difference. Look for bronze-drawn pasta: it has a rough surface that holds sauce better."
  },
  "La Nostra Selezione": {
    de_CH: "Unsere Auswahl",
    fr_CH: "Notre selection",
    en_US: "Our Selection"
  },
  "LAPA offre sia pasta fresca che pasta secca di alta qualita:": {
    de_CH: "LAPA bietet sowohl hochwertige frische als auch trockene Pasta:",
    fr_CH: "LAPA propose des pates fraiches et seches de haute qualite:",
    en_US: "LAPA offers both high-quality fresh and dried pasta:"
  },
  "Pasta fresca artigianale dalle migliori regioni": {
    de_CH: "Handwerkliche frische Pasta aus den besten Regionen",
    fr_CH: "Pates fraiches artisanales des meilleures regions",
    en_US: "Artisanal fresh pasta from the best regions"
  },
  "Pasta secca trafilata al bronzo": {
    de_CH: "Bronze-gezogene trockene Pasta",
    fr_CH: "Pates seches trefilee au bronze",
    en_US: "Bronze-drawn dried pasta"
  },
  "Formati speciali e regionali": {
    de_CH: "Spezielle und regionale Formate",
    fr_CH: "Formats speciaux et regionaux",
    en_US: "Special and regional formats"
  },
  "Pasta all'uovo e senza uova": {
    de_CH: "Eiernudeln und eifreie Pasta",
    fr_CH: "Pates aux oeufs et sans oeufs",
    en_US: "Egg pasta and egg-free pasta"
  },
  "Conclusione": {
    de_CH: "Fazit",
    fr_CH: "Conclusion",
    en_US: "Conclusion"
  },
  "Non esiste una pasta migliore dell'altra: dipende dal piatto che vuoi preparare. Con i prodotti LAPA, potrai offrire ai tuoi clienti il meglio di entrambe le tradizioni.": {
    de_CH: "Es gibt keine bessere Pasta als die andere: Es haengt vom Gericht ab, das Sie zubereiten moechten. Mit LAPA-Produkten koennen Sie Ihren Kunden das Beste aus beiden Traditionen anbieten.",
    fr_CH: "Il n'y a pas de pates meilleures que d'autres: cela depend du plat que vous voulez preparer. Avec les produits LAPA, vous pourrez offrir a vos clients le meilleur des deux traditions.",
    en_US: "There is no better pasta than the other: it depends on the dish you want to prepare. With LAPA products, you can offer your customers the best of both traditions."
  }
};

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 83: PASTA FRESCA VS SECCA ===\n');

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

  console.log('\n✅ ARTICOLO 83 COMPLETATO!');
}

main();
