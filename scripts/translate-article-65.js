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

const POST_ID = 65;

const TITLE_TRANSLATIONS = {
  it_IT: "Pappardelle al Ragù di Cinghiale (Toscano)",
  de_CH: "Pappardelle mit Wildschweinragout (Toskanisch)",
  fr_CH: "Pappardelle au Ragù de Sanglier (Toscan)",
  en_US: "Pappardelle with Wild Boar Ragù (Tuscan)"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Un piatto iconico della tradizione toscana, le pappardelle all\'uovo abbracciano')) {
      t[src] = {
        de_CH: 'Ein ikonisches Gericht der toskanischen Tradition, Eierpappardelle umhüllen ein reichhaltiges Wildschweinragout, langsam gegart, um seinen Geschmack zu entfalten.',
        fr_CH: 'Un plat iconique de la tradition toscane, les pappardelle aux œufs embrassent un riche ragù de sanglier cuit lentement pour en exalter la saveur.',
        en_US: 'An iconic dish of Tuscan tradition, egg pappardelle embrace a rich wild boar ragù slowly cooked to enhance its flavor.'
      };
    }
    else if (src.includes('📍 <strong>Regione:</strong> Toscana')) {
      t[src] = {
        de_CH: '<span>📍 <strong>Region:</strong> Toskana</span> |\n    <span>⏱️ <strong>Zubereitung:</strong> 30 Minuten (aktiv) + 12-24 Stunden (Marinieren)</span> |',
        fr_CH: '<span>📍 <strong>Région:</strong> Toscane</span> |\n    <span>⏱️ <strong>Préparation:</strong> 30 minutes (active) + 12-24 heures (marinade)</span> |',
        en_US: '<span>📍 <strong>Region:</strong> Tuscany</span> |\n    <span>⏱️ <strong>Preparation:</strong> 30 minutes (active) + 12-24 hours (marinating)</span> |'
      };
    }
    else if (src === '🏛️ Tradizione') {
      t[src] = {
        de_CH: '🏛️ Tradition',
        fr_CH: '🏛️ Tradition',
        en_US: '🏛️ Tradition'
      };
    }
    else if (src.includes('Un classico della cucina contadina e venatoria toscana')) {
      t[src] = {
        de_CH: 'Ein Klassiker der toskanischen Bauern- und Jagdküche, zubereitet für Feste und Wintermahlzeiten.',
        fr_CH: 'Un classique de la cuisine paysanne et cynégétique toscane, préparé pour les fêtes et les repas d\'hiver.',
        en_US: 'A classic of Tuscan peasant and hunting cuisine, prepared for holidays and winter meals.'
      };
    }
    else if (src === '🛒 Ingredienti') {
      t[src] = {
        de_CH: '🛒 Zutaten',
        fr_CH: '🛒 Ingrédients',
        en_US: '🛒 Ingredients'
      };
    }
    else if (src.includes('Pappardelle all\'Uovo')) {
      t[src] = {
        de_CH: '<strong>360 Gramm</strong> Eierpappardelle',
        fr_CH: '<strong>360 grammes</strong> Pappardelle aux œufs',
        en_US: '<strong>360 grams</strong> Egg Pappardelle'
      };
    }
    else if (src.includes('Polpa di cinghiale')) {
      t[src] = {
        de_CH: '<strong>500 Gramm</strong> Wildschweinfleisch (ohne Knochen)',
        fr_CH: '<strong>500 grammes</strong> Chair de sanglier (sans os)',
        en_US: '<strong>500 grams</strong> Wild boar meat (boneless)'
      };
    }
    else if (src.includes('Vino rosso robusto')) {
      t[src] = {
        de_CH: '<strong>700 Milliliter</strong> Kräftiger Rotwein (z.B. Chianti Classico)',
        fr_CH: '<strong>700 millilitres</strong> Vin rouge robuste (ex. Chianti Classico)',
        en_US: '<strong>700 milliliters</strong> Robust red wine (e.g. Chianti Classico)'
      };
    }
    else if (src.includes('Carote') && src.includes('160 grammi')) {
      t[src] = {
        de_CH: '<strong>2 mittlere (ca. 160 Gramm gesamt)</strong> Karotten',
        fr_CH: '<strong>2 moyennes (environ 160 grammes au total)</strong> Carottes',
        en_US: '<strong>2 medium (about 160 grams total)</strong> Carrots'
      };
    }
    else if (src.includes('Coste di sedano')) {
      t[src] = {
        de_CH: '<strong>2 mittlere (ca. 160 Gramm gesamt)</strong> Selleriestangen',
        fr_CH: '<strong>2 moyennes (environ 160 grammes au total)</strong> Branches de céleri',
        en_US: '<strong>2 medium (about 160 grams total)</strong> Celery stalks'
      };
    }
    else if (src.includes('Cipolle dorate')) {
      t[src] = {
        de_CH: '<strong>2 kleine (ca. 200 Gramm gesamt)</strong> Goldene Zwiebeln',
        fr_CH: '<strong>2 petites (environ 200 grammes au total)</strong> Oignons dorés',
        en_US: '<strong>2 small (about 200 grams total)</strong> Golden onions'
      };
    }
    else if (src.includes('Aglio') && src.includes('spicchi')) {
      t[src] = {
        de_CH: '<strong>2 Zehen</strong> Knoblauch',
        fr_CH: '<strong>2 gousses</strong> Ail',
        en_US: '<strong>2 cloves</strong> Garlic'
      };
    }
    else if (src.includes('Rosmarino fresco')) {
      t[src] = {
        de_CH: '<strong>1 Zweig</strong> Frischer Rosmarin',
        fr_CH: '<strong>1 branche</strong> Romarin frais',
        en_US: '<strong>1 sprig</strong> Fresh rosemary'
      };
    }
    else if (src.includes('Alloro') && src.includes('foglie')) {
      t[src] = {
        de_CH: '<strong>2 Blätter</strong> Lorbeer',
        fr_CH: '<strong>2 feuilles</strong> Laurier',
        en_US: '<strong>2 leaves</strong> Bay leaf'
      };
    }
    else if (src.includes('Bacche di ginepro')) {
      t[src] = {
        de_CH: '<strong>5 ganze</strong> Wacholderbeeren',
        fr_CH: '<strong>5 entières</strong> Baies de genièvre',
        en_US: '<strong>5 whole</strong> Juniper berries'
      };
    }
    else if (src.includes('Chiodi di garofano')) {
      t[src] = {
        de_CH: '<strong>3 ganze</strong> Gewürznelken',
        fr_CH: '<strong>3 entier</strong> Clous de girofle',
        en_US: '<strong>3 whole</strong> Cloves'
      };
    }
    else if (src.includes('Concentrato di pomodoro')) {
      t[src] = {
        de_CH: '<strong>2 Esslöffel (ca. 40 Gramm)</strong> Tomatenmark',
        fr_CH: '<strong>2 cuillères à soupe (environ 40 grammes)</strong> Concentré de tomate',
        en_US: '<strong>2 tablespoons (about 40 grams)</strong> Tomato paste'
      };
    }
    else if (src.includes('Passata di pomodoro')) {
      t[src] = {
        de_CH: '<strong>400 Gramm</strong> Passierte Tomaten',
        fr_CH: '<strong>400 grammes</strong> Passata de tomate',
        en_US: '<strong>400 grams</strong> Tomato passata'
      };
    }
    else if (src.includes('Brodo di carne o vegetale')) {
      t[src] = {
        de_CH: '<strong>200 Milliliter</strong> Fleisch- oder Gemüsebrühe (warm)',
        fr_CH: '<strong>200 millilitres</strong> Bouillon de viande ou végétal (chaud)',
        en_US: '<strong>200 milliliters</strong> Meat or vegetable broth (hot)'
      };
    }
    else if (src.includes('Olio extra vergine d\'oliva')) {
      t[src] = {
        de_CH: '<strong>4 Esslöffel</strong> Natives Olivenöl extra',
        fr_CH: '<strong>4 cuillères à soupe</strong> Huile d\'olive extra vierge',
        en_US: '<strong>4 tablespoons</strong> Extra virgin olive oil'
      };
    }
    else if (src.includes('Sale fino') && src.includes('q.b.')) {
      t[src] = {
        de_CH: '<strong>n.B.</strong> Feines Salz',
        fr_CH: '<strong>q.s.</strong> Sel fin',
        en_US: '<strong>to taste</strong> Fine salt'
      };
    }
    else if (src.includes('Pepe nero macinato')) {
      t[src] = {
        de_CH: '<strong>n.B.</strong> Frisch gemahlener schwarzer Pfeffer',
        fr_CH: '<strong>q.s.</strong> Poivre noir fraîchement moulu',
        en_US: '<strong>to taste</strong> Freshly ground black pepper'
      };
    }
    else if (src.includes('Pecorino Toscano stagionato')) {
      t[src] = {
        de_CH: '<strong>50 Gramm</strong> Gereifter toskanischer Pecorino (gerieben)',
        fr_CH: '<strong>50 grammes</strong> Pecorino Toscan affiné (râpé)',
        en_US: '<strong>50 grams</strong> Aged Tuscan Pecorino (grated)'
      };
    }
    else if (src === '👨‍🍳 Procedimento') {
      t[src] = {
        de_CH: '👨‍🍳 Zubereitung',
        fr_CH: '👨‍🍳 Préparation',
        en_US: '👨‍🍳 Instructions'
      };
    }
    else if (src.includes('<strong>Passo 1:</strong> Marinatura della carne')) {
      t[src] = {
        de_CH: '<strong>Schritt 1:</strong> Marinieren des Fleisches (12-24 Stunden vorher): Das Wildschweinfleisch in 2-3 cm große Würfel schneiden. In einer großen Schüssel vereinen...',
        fr_CH: '<strong>Étape 1:</strong> Marinade de la viande (12-24 heures avant) : Couper la chair de sanglier en cubes de 2-3 cm. Dans un saladier assez grand, mélanger...',
        en_US: '<strong>Step 1:</strong> Marinating the meat (12-24 hours before): Cut the wild boar meat into 2-3 cm cubes. In a large bowl, combine...'
      };
    }
    else if (src.includes('<strong>Passo 2:</strong> Preparazione del soffritto')) {
      t[src] = {
        de_CH: '<strong>Schritt 2:</strong> Zubereitung des Soffritto: Das Fleisch aus der Marinade nehmen und die gefilterte Flüssigkeit aufbewahren. Das Fleisch gut mit...',
        fr_CH: '<strong>Étape 2:</strong> Préparation du soffritto : Égoutter la viande de la marinade, en conservant le liquide filtré. Bien sécher la viande avec...',
        en_US: '<strong>Step 2:</strong> Preparing the soffritto: Drain the meat from the marinade, saving the filtered liquid. Pat the meat dry thoroughly with...'
      };
    }
    else if (src.includes('<strong>Passo 3:</strong> Rosolatura del cinghiale')) {
      t[src] = {
        de_CH: '<strong>Schritt 3:</strong> Anbraten des Wildschweins: In einem dickwandigen Topf (oder einem gusseisernen Schmortopf) das native Olivenöl extra erhitzen...',
        fr_CH: '<strong>Étape 3:</strong> Saisir le sanglier : Dans une casserole à fond épais (ou une cocotte en fonte), chauffer l\'huile d\'olive extra vierge...',
        en_US: '<strong>Step 3:</strong> Searing the wild boar: In a thick-bottomed pot (or cast iron casserole), heat the extra virgin olive oil...'
      };
    }
    else if (src.includes('<strong>Passo 4:</strong> Aggiunta della carne')) {
      t[src] = {
        de_CH: '<strong>Schritt 4:</strong> Hinzufügen des Fleisches: Die Hitze leicht erhöhen und die getrockneten Wildschweinstücke hinzufügen. Das Fleisch gut anbraten...',
        fr_CH: '<strong>Étape 4:</strong> Ajout de la viande : Augmenter légèrement le feu et ajouter les cubes de sanglier séchés. Bien faire rissoler la viande...',
        en_US: '<strong>Step 4:</strong> Adding the meat: Raise the heat slightly and add the dried wild boar cubes. Brown the meat well...'
      };
    }
    else if (src.includes('<strong>Passo 5:</strong> Sfumatura e cottura')) {
      t[src] = {
        de_CH: '<strong>Schritt 5:</strong> Ablöschen und Kochen: Mit den restlichen 200 ml frischem Rotwein ablöschen und vollständig verdampfen lassen. Das Tomatenmark hinzufügen...',
        fr_CH: '<strong>Étape 5:</strong> Déglaçage et cuisson : Déglacer avec les 200 ml restants de vin rouge frais et laisser évaporer complètement. Ajouter le concentré de tomate...',
        en_US: '<strong>Step 5:</strong> Deglazing and cooking: Deglaze with the remaining 200 ml of fresh red wine and let it evaporate completely. Add the tomato paste...'
      };
    }
    else if (src.includes('<strong>Passo 6:</strong> Cottura lenta del ragù')) {
      t[src] = {
        de_CH: '<strong>Schritt 6:</strong> Langsames Kochen des Ragouts: Das Ragout leicht zum Kochen bringen, dann die Hitze auf ein Minimum reduzieren, den Topf abdecken und kochen...',
        fr_CH: '<strong>Étape 6:</strong> Cuisson lente du ragù : Porter le ragù à légère ébullition, puis baisser le feu au minimum, couvrir la casserole et cuire...',
        en_US: '<strong>Step 6:</strong> Slow cooking the ragù: Bring the ragù to a gentle boil, then lower the heat to minimum, cover the pot and cook...'
      };
    }
    else if (src.includes('<strong>Passo 7:</strong> Sfilacciamento della carne')) {
      t[src] = {
        de_CH: '<strong>Schritt 7:</strong> Zupfen des Fleisches: Sobald das Fleisch zart ist, aus dem Topf nehmen und mit...',
        fr_CH: '<strong>Étape 7:</strong> Effilochage de la viande : Une fois que la viande est tendre, la retirer de la casserole et l\'effilocher grossièrement avec...',
        en_US: '<strong>Step 7:</strong> Shredding the meat: Once the meat is tender, remove it from the pot and roughly shred it with...'
      };
    }
    else if (src.includes('<strong>Passo 8:</strong> Cottura delle pappardelle')) {
      t[src] = {
        de_CH: '<strong>Schritt 8:</strong> Kochen der Pappardelle: Reichlich Salzwasser in einem großen Topf zum Kochen bringen. Die Eierpappardelle kochen...',
        fr_CH: '<strong>Étape 8:</strong> Cuisson des pappardelle : Porter à ébullition une grande quantité d\'eau salée dans une grande casserole. Cuire les pappardelle aux œufs...',
        en_US: '<strong>Step 8:</strong> Cooking the pappardelle: Bring plenty of salted water to a boil in a large pot. Cook the egg pappardelle...'
      };
    }
    else if (src.includes('<strong>Passo 9:</strong> Condimento e servizio')) {
      t[src] = {
        de_CH: '<strong>Schritt 9:</strong> Würzen und Servieren: Die Pappardelle abgießen und dabei eine Kelle Kochwasser aufbewahren. Direkt in den Topf...',
        fr_CH: '<strong>Étape 9:</strong> Assaisonnement et service : Égoutter les pappardelle, en conservant une petite louche d\'eau de cuisson. Les transférer directement dans la...',
        en_US: '<strong>Step 9:</strong> Seasoning and serving: Drain the pappardelle, reserving a small ladle of cooking water. Transfer them directly to the...'
      };
    }
    else if (src.includes('<strong>Passo 10:</strong> Servire immediatamente')) {
      t[src] = {
        de_CH: '<strong>Schritt 10:</strong> Sofort auf warmen Tellern servieren, mit reichlich geriebenem toskanischem Pecorino garnieren.',
        fr_CH: '<strong>Étape 10:</strong> Servir immédiatement dans des assiettes chaudes, en garnissant d\'abondant Pecorino Toscan râpé.',
        en_US: '<strong>Step 10:</strong> Serve immediately on warm plates, garnishing with abundant grated Tuscan Pecorino.'
      };
    }
    else if (src === '💡 Consigli dello Chef') {
      t[src] = {
        de_CH: '💡 Tipps vom Chef',
        fr_CH: '💡 Conseils du Chef',
        en_US: '💡 Chef\'s Tips'
      };
    }
    else if (src.includes('La qualità del vino è fondamentale')) {
      t[src] = {
        de_CH: 'Die Qualität des Weines ist entscheidend: verwende einen Wein, den du gerne trinken würdest, sowohl zum Marinieren als auch zum Ablöschen.',
        fr_CH: 'La qualité du vin est fondamentale : utilise un vin que tu boirais volontiers, tant pour la marinade que pour le déglaçage.',
        en_US: 'The quality of the wine is fundamental: use a wine you would happily drink, both for marinating and deglazing.'
      };
    }
    else if (src.includes('La marinatura è essenziale per ammorbidire')) {
      t[src] = {
        de_CH: 'Das Marinieren ist essentiell, um das Wildschweinfleisch zarter zu machen und den wilden Geschmack abzumildern.',
        fr_CH: 'La marinade est essentielle pour attendrir la viande de sanglier et atténuer le goût sauvage.',
        en_US: 'Marinating is essential to tenderize the wild boar meat and soften the gamey flavor.'
      };
    }
    else if (src.includes('Non avere fretta con la cottura del ragù')) {
      t[src] = {
        de_CH: 'Hab keine Eile beim Kochen des Ragouts: je langsamer es kocht, desto mehr entwickeln sich die Aromen und das Fleisch wird zarter.',
        fr_CH: 'Ne sois pas pressé avec la cuisson du ragù : plus il cuit lentement, plus les saveurs se développeront et la viande deviendra tendre.',
        en_US: 'Don\'t rush the ragù cooking: the slower it cooks, the more the flavors will develop and the meat will become tender.'
      };
    }
    else if (src === '📚 Fonti') {
      t[src] = {
        de_CH: '📚 Quellen',
        fr_CH: '📚 Sources',
        en_US: '📚 Sources'
      };
    }
    else if (src.includes('🛍️ Ordina PAPPARDELLE ALL\'UOVO')) {
      t[src] = {
        de_CH: '🛍️ Bestelle EIERPAPPARDELLE 1KG PACK 5KG KRT MARC',
        fr_CH: '🛍️ Commande PAPPARDELLE AUX ŒUFS 1KG CONF 5KG CRT MARC',
        en_US: '🛍️ Order EGG PAPPARDELLE 1KG PACK 5KG CRT MARC'
      };
    }
    else if (src.includes('Questo prodotto è disponibile nel nostro catalogo')) {
      t[src] = {
        de_CH: 'Dieses Produkt ist in unserem Katalog erhältlich!',
        fr_CH: 'Ce produit est disponible dans notre catalogue !',
        en_US: 'This product is available in our catalog!'
      };
    }
    else if (src.includes('Scopri il Catalogo LAPA')) {
      t[src] = {
        de_CH: 'Entdecke den LAPA Katalog',
        fr_CH: 'Découvre le Catalogue LAPA',
        en_US: 'Discover the LAPA Catalog'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 65: PAPPARDELLE AL RAGU DI CINGHIALE ===\n');

  console.log('1. Aggiorno titolo...');
  for (const lang of ['it_IT', 'de_CH', 'fr_CH', 'en_US']) {
    await callOdoo('blog.post', 'write',
      [[POST_ID], { name: TITLE_TRANSLATIONS[lang] }],
      { context: { lang } }
    );
    console.log(`   ${lang}: OK`);
  }

  console.log('2. Leggo segmenti...');
  const segmentData = await callOdoo('blog.post', 'get_field_translations', [[POST_ID], 'content']);
  const segments = segmentData[0];
  const sourceTexts = [...new Set(segments.map(s => s.source))];
  console.log(`   Trovati ${sourceTexts.length} segmenti`);

  const TRANSLATIONS = getTranslations(sourceTexts);

  console.log('3. Applico traduzioni...');
  for (const lang of ['de_CH', 'fr_CH', 'en_US']) {
    const langTranslations = {};
    let count = 0;
    for (const src of sourceTexts) {
      if (TRANSLATIONS[src] && TRANSLATIONS[src][lang]) {
        langTranslations[src] = TRANSLATIONS[src][lang];
        count++;
      }
    }
    if (Object.keys(langTranslations).length > 0) {
      await callOdoo('blog.post', 'update_field_translations',
        [[POST_ID], 'content', { [lang]: langTranslations }]
      );
    }
    console.log(`   ${lang}: ${count} segmenti`);
  }

  console.log('\n--- VERIFICA ---\n');
  for (const lang of ['it_IT', 'de_CH', 'fr_CH', 'en_US']) {
    const data = await callOdoo('blog.post', 'read',
      [[POST_ID], ['name', 'content']],
      { context: { lang } }
    );
    const title = data?.[0]?.name || '';
    const text = (data?.[0]?.content || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().substring(0, 60);
    console.log(`[${lang}] ${title.substring(0, 50)}...`);
    console.log(`        ${text}...`);
  }

  console.log('\n✅ ARTICOLO 65 COMPLETATO!');
}

main();
