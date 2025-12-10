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

const postId = 78;

const italianContent = `<h2>Gli Ingredienti che Fanno la Differenza</h2>
<p>Una pizzeria di successo si costruisce sulla qualità degli ingredienti. Ecco i 10 prodotti essenziali che non possono mancare nella tua dispensa.</p>

<h2>1. Farina per Pizza</h2>
<p>La base di tutto. Scegli farine professionali specifiche per pizza:</p>
<ul>
<li>Tipo 00 per pizza napoletana, alta digeribilità</li>
<li>Tipo 0 per pizza romana, più croccante</li>
<li>W 260-320 per lievitazioni lunghe</li>
</ul>

<h2>2. Pomodoro San Marzano DOP</h2>
<p>Il pomodoro San Marzano DOP è lo standard per la pizza napoletana. Il suo sapore dolce e la bassa acidità lo rendono perfetto per il condimento.</p>

<h2>3. Mozzarella Fior di Latte</h2>
<p>Per la pizza in cottura, il fior di latte è ideale: si scioglie uniformemente e non rilascia troppa acqua. Scegli prodotti freschi di qualità.</p>

<h2>4. Mozzarella di Bufala DOP</h2>
<p>Per le pizze premium e per l'aggiunta a crudo. La bufala aggiunge cremosità e un sapore inconfondibile.</p>

<h2>5. Olio Extravergine d'Oliva</h2>
<p>Indispensabile per condire la pizza prima e dopo la cottura. Scegli un olio italiano di qualità, preferibilmente monocultivar.</p>

<h2>6. Basilico Fresco</h2>
<p>Il tocco finale della margherita. Il basilico fresco aggiunge profumo e colore. Tienilo sempre disponibile.</p>

<h2>7. Prosciutto Crudo</h2>
<p>Parma o San Daniele DOP per le pizze con crudo. Da aggiungere rigorosamente a crudo dopo la cottura.</p>

<h2>8. Salame Piccante</h2>
<p>Per le pizze saporite. La nduja calabrese o la spianata romana aggiungono carattere.</p>

<h2>9. Verdure Grigliate</h2>
<p>Melanzane, zucchine, peperoni: le verdure grigliate di qualità sono essenziali per pizze vegetariane e non solo.</p>

<h2>10. Parmigiano Reggiano DOP</h2>
<p>Per la grattugiata finale o come ingrediente. Il Parmigiano aggiunge sapore umami a qualsiasi pizza.</p>

<h2>Bonus: Lievito e Sale</h2>
<p>Non dimenticare lievito di birra fresco di qualità e sale marino. Sono la base dell'impasto perfetto.</p>

<h2>Dove Trovare Questi Prodotti?</h2>
<p>LAPA offre tutti questi ingredienti essenziali, importati direttamente dall'Italia. Consegniamo in tutta la Svizzera con prodotti freschi garantiti.</p>

<p>Esplora il nostro catalogo completo.</p>`;

const TRANSLATIONS = {
  "Gli Ingredienti che Fanno la Differenza": {
    de_CH: "Die Zutaten, die den Unterschied machen",
    fr_CH: "Les ingrédients qui font la différence",
    en_US: "The Ingredients That Make the Difference"
  },
  "Una pizzeria di successo si costruisce sulla qualità degli ingredienti. Ecco i 10 prodotti essenziali che non possono mancare nella tua dispensa.": {
    de_CH: "Eine erfolgreiche Pizzeria basiert auf der Qualität der Zutaten. Hier sind die 10 wesentlichen Produkte, die in Ihrer Vorratskammer nicht fehlen dürfen.",
    fr_CH: "Une pizzeria à succès se construit sur la qualité des ingrédients. Voici les 10 produits essentiels qui ne peuvent pas manquer dans votre garde-manger.",
    en_US: "A successful pizzeria is built on the quality of ingredients. Here are the 10 essential products that cannot be missing from your pantry."
  },
  "1. Farina per Pizza": {
    de_CH: "1. Pizzamehl",
    fr_CH: "1. Farine pour Pizza",
    en_US: "1. Pizza Flour"
  },
  "La base di tutto. Scegli farine professionali specifiche per pizza:": {
    de_CH: "Die Basis von allem. Wählen Sie professionelle Mehle speziell für Pizza:",
    fr_CH: "La base de tout. Choisissez des farines professionnelles spécifiques pour la pizza :",
    en_US: "The foundation of everything. Choose professional flours specifically for pizza:"
  },
  "Tipo 00 per pizza napoletana, alta digeribilità": {
    de_CH: "Typ 00 für neapolitanische Pizza, hohe Verdaulichkeit",
    fr_CH: "Type 00 pour pizza napolitaine, haute digestibilité",
    en_US: "Type 00 for Neapolitan pizza, high digestibility"
  },
  "Tipo 0 per pizza romana, più croccante": {
    de_CH: "Typ 0 für römische Pizza, knuspriger",
    fr_CH: "Type 0 pour pizza romaine, plus croustillante",
    en_US: "Type 0 for Roman pizza, crispier"
  },
  "W 260-320 per lievitazioni lunghe": {
    de_CH: "W 260-320 für lange Gehzeiten",
    fr_CH: "W 260-320 pour les longues levées",
    en_US: "W 260-320 for long fermentation"
  },
  "2. Pomodoro San Marzano DOP": {
    de_CH: "2. San Marzano DOP Tomaten",
    fr_CH: "2. Tomates San Marzano DOP",
    en_US: "2. San Marzano DOP Tomatoes"
  },
  "Il pomodoro San Marzano DOP è lo standard per la pizza napoletana. Il suo sapore dolce e la bassa acidità lo rendono perfetto per il condimento.": {
    de_CH: "Die San Marzano DOP Tomate ist der Standard für die neapolitanische Pizza. Ihr süsser Geschmack und die geringe Säure machen sie perfekt für den Belag.",
    fr_CH: "La tomate San Marzano DOP est le standard pour la pizza napolitaine. Sa saveur douce et sa faible acidité la rendent parfaite pour la garniture.",
    en_US: "San Marzano DOP tomato is the standard for Neapolitan pizza. Its sweet flavor and low acidity make it perfect for the topping."
  },
  "3. Mozzarella Fior di Latte": {
    de_CH: "3. Mozzarella Fior di Latte",
    fr_CH: "3. Mozzarella Fior di Latte",
    en_US: "3. Fior di Latte Mozzarella"
  },
  "Per la pizza in cottura, il fior di latte è ideale: si scioglie uniformemente e non rilascia troppa acqua. Scegli prodotti freschi di qualità.": {
    de_CH: "Zum Backen ist Fior di Latte ideal: Er schmilzt gleichmässig und gibt nicht zu viel Wasser ab. Wählen Sie frische Qualitätsprodukte.",
    fr_CH: "Pour la pizza en cuisson, le fior di latte est idéal : il fond uniformément et ne libère pas trop d'eau. Choisissez des produits frais de qualité.",
    en_US: "For baking pizza, fior di latte is ideal: it melts evenly and doesn't release too much water. Choose fresh quality products."
  },
  "4. Mozzarella di Bufala DOP": {
    de_CH: "4. Büffelmozzarella DOP",
    fr_CH: "4. Mozzarella di Bufala DOP",
    en_US: "4. Buffalo Mozzarella DOP"
  },
  "Per le pizze premium e per l'aggiunta a crudo. La bufala aggiunge cremosità e un sapore inconfondibile.": {
    de_CH: "Für Premium-Pizzen und zum rohen Hinzufügen. Büffelmozzarella verleiht Cremigkeit und einen unverwechselbaren Geschmack.",
    fr_CH: "Pour les pizzas premium et pour l'ajout à cru. La bufala ajoute de l'onctuosité et une saveur inimitable.",
    en_US: "For premium pizzas and for adding raw. Buffalo adds creaminess and an unmistakable flavor."
  },
  "5. Olio Extravergine d'Oliva": {
    de_CH: "5. Natives Olivenöl Extra",
    fr_CH: "5. Huile d'Olive Extra Vierge",
    en_US: "5. Extra Virgin Olive Oil"
  },
  "Indispensabile per condire la pizza prima e dopo la cottura. Scegli un olio italiano di qualità, preferibilmente monocultivar.": {
    de_CH: "Unverzichtbar zum Würzen der Pizza vor und nach dem Backen. Wählen Sie ein italienisches Qualitätsöl, vorzugsweise sortenrein.",
    fr_CH: "Indispensable pour assaisonner la pizza avant et après la cuisson. Choisissez une huile italienne de qualité, de préférence monovariétale.",
    en_US: "Indispensable for seasoning pizza before and after baking. Choose a quality Italian oil, preferably single-variety."
  },
  "6. Basilico Fresco": {
    de_CH: "6. Frisches Basilikum",
    fr_CH: "6. Basilic Frais",
    en_US: "6. Fresh Basil"
  },
  "Il tocco finale della margherita. Il basilico fresco aggiunge profumo e colore. Tienilo sempre disponibile.": {
    de_CH: "Der letzte Schliff der Margherita. Frisches Basilikum verleiht Duft und Farbe. Halten Sie es immer verfügbar.",
    fr_CH: "La touche finale de la margherita. Le basilic frais ajoute parfum et couleur. Gardez-le toujours disponible.",
    en_US: "The final touch of the margherita. Fresh basil adds aroma and color. Keep it always available."
  },
  "7. Prosciutto Crudo": {
    de_CH: "7. Rohschinken",
    fr_CH: "7. Prosciutto Crudo",
    en_US: "7. Prosciutto Crudo"
  },
  "Parma o San Daniele DOP per le pizze con crudo. Da aggiungere rigorosamente a crudo dopo la cottura.": {
    de_CH: "Parma oder San Daniele DOP für Pizzen mit rohem Schinken. Strikt roh nach dem Backen hinzufügen.",
    fr_CH: "Parma ou San Daniele DOP pour les pizzas au jambon cru. À ajouter rigoureusement cru après la cuisson.",
    en_US: "Parma or San Daniele DOP for pizzas with prosciutto. To be added strictly raw after baking."
  },
  "8. Salame Piccante": {
    de_CH: "8. Scharfe Salami",
    fr_CH: "8. Salami Piquant",
    en_US: "8. Spicy Salami"
  },
  "Per le pizze saporite. La nduja calabrese o la spianata romana aggiungono carattere.": {
    de_CH: "Für herzhafte Pizzen. Kalabrische Nduja oder römische Spianata verleihen Charakter.",
    fr_CH: "Pour les pizzas savoureuses. La nduja calabraise ou la spianata romaine ajoutent du caractère.",
    en_US: "For flavorful pizzas. Calabrian nduja or Roman spianata add character."
  },
  "9. Verdure Grigliate": {
    de_CH: "9. Gegrilltes Gemüse",
    fr_CH: "9. Légumes Grillés",
    en_US: "9. Grilled Vegetables"
  },
  "Melanzane, zucchine, peperoni: le verdure grigliate di qualità sono essenziali per pizze vegetariane e non solo.": {
    de_CH: "Auberginen, Zucchini, Paprika: Qualitativ gegrilltes Gemüse ist unerlässlich für vegetarische Pizzen und nicht nur.",
    fr_CH: "Aubergines, courgettes, poivrons : les légumes grillés de qualité sont essentiels pour les pizzas végétariennes et pas seulement.",
    en_US: "Eggplants, zucchini, peppers: quality grilled vegetables are essential for vegetarian pizzas and beyond."
  },
  "10. Parmigiano Reggiano DOP": {
    de_CH: "10. Parmigiano Reggiano DOP",
    fr_CH: "10. Parmigiano Reggiano DOP",
    en_US: "10. Parmigiano Reggiano DOP"
  },
  "Per la grattugiata finale o come ingrediente. Il Parmigiano aggiunge sapore umami a qualsiasi pizza.": {
    de_CH: "Für das abschliessende Reiben oder als Zutat. Parmigiano fügt jeder Pizza Umami-Geschmack hinzu.",
    fr_CH: "Pour le râpage final ou comme ingrédient. Le Parmigiano ajoute une saveur umami à toute pizza.",
    en_US: "For the final grating or as an ingredient. Parmigiano adds umami flavor to any pizza."
  },
  "Bonus: Lievito e Sale": {
    de_CH: "Bonus: Hefe und Salz",
    fr_CH: "Bonus : Levure et Sel",
    en_US: "Bonus: Yeast and Salt"
  },
  "Non dimenticare lievito di birra fresco di qualità e sale marino. Sono la base dell'impasto perfetto.": {
    de_CH: "Vergessen Sie nicht frische Qualitätshefe und Meersalz. Sie sind die Basis des perfekten Teigs.",
    fr_CH: "N'oubliez pas la levure de bière fraîche de qualité et le sel marin. Ils sont la base de la pâte parfaite.",
    en_US: "Don't forget quality fresh brewer's yeast and sea salt. They are the foundation of the perfect dough."
  },
  "Dove Trovare Questi Prodotti?": {
    de_CH: "Wo finden Sie diese Produkte?",
    fr_CH: "Où trouver ces produits ?",
    en_US: "Where to Find These Products?"
  },
  "LAPA offre tutti questi ingredienti essenziali, importati direttamente dall'Italia. Consegniamo in tutta la Svizzera con prodotti freschi garantiti.": {
    de_CH: "LAPA bietet all diese wesentlichen Zutaten an, direkt aus Italien importiert. Wir liefern in die ganze Schweiz mit garantiert frischen Produkten.",
    fr_CH: "LAPA offre tous ces ingrédients essentiels, importés directement d'Italie. Nous livrons dans toute la Suisse avec des produits frais garantis.",
    en_US: "LAPA offers all these essential ingredients, imported directly from Italy. We deliver throughout Switzerland with guaranteed fresh products."
  },
  "Esplora il nostro catalogo completo.": {
    de_CH: "Entdecken Sie unseren vollständigen Katalog.",
    fr_CH: "Explorez notre catalogue complet.",
    en_US: "Explore our complete catalog."
  }
};

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 78: I 10 PRODOTTI ESSENZIALI PER PIZZERIE ===\n');

  console.log('1. Scrivo contenuto ITALIANO...');
  await callOdoo('blog.post', 'write', [[postId], { content: italianContent }]);

  console.log('2. Leggo segmenti...');
  const segmentData = await callOdoo('blog.post', 'get_field_translations', [[postId], 'content']);
  const segments = segmentData[0];
  const sourceTexts = [...new Set(segments.map(s => s.source))];
  console.log(`   Trovati ${sourceTexts.length} segmenti`);

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

  console.log('\n--- VERIFICA ---\n');
  for (const lang of ['it_IT', 'de_CH', 'fr_CH', 'en_US']) {
    const data = await callOdoo('blog.post', 'read', [[postId], ['content']], { context: { lang } });
    const contentText = (data?.[0]?.content || '').replace(/<[^>]*>/g, '').substring(0, 70);
    console.log(`[${lang}] ${contentText}...`);
  }

  console.log('\n✅ ARTICOLO 78 COMPLETATO!\n');
}

main();
