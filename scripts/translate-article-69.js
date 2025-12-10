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

const POST_ID = 69;

const TITLE_TRANSLATIONS = {
  it_IT: "Spaghetti alla Chitarra al Nero di Seppia con Seppia Fresca e Pomodorini",
  de_CH: "Chitarra-Spaghetti mit Tintenfischtinte, frischem Tintenfisch und Kirschtomaten",
  fr_CH: "Spaghetti alla Chitarra à l'Encre de Seiche avec Seiche Fraîche et Tomates Cerises",
  en_US: "Chitarra Spaghetti with Cuttlefish Ink, Fresh Cuttlefish and Cherry Tomatoes"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Un piatto di mare intenso e avvolgente')) {
      t[src] = {
        de_CH: 'Ein intensives und umhüllendes Meeresgericht, berühmt in der italienischen Küstentraditon, das den Geschmack der Tintenfischtinte mit der Frische des Fangs und der Süße der Kirschtomaten hervorhebt.',
        fr_CH: 'Un plat de mer intense et enveloppant, célèbre dans la tradition côtière italienne, qui exalte la saveur de l\'encre de seiche avec la fraîcheur de la pêche et la douceur des tomates cerises.',
        en_US: 'An intense and enveloping seafood dish, famous in the Italian coastal tradition, that enhances the flavor of cuttlefish ink with the freshness of the catch and the sweetness of cherry tomatoes.'
      };
    }
    else if (src.includes('📍 <strong>Regione:</strong> Sicilia')) {
      t[src] = {
        de_CH: '<span>📍 <strong>Region:</strong> Sizilien</span> |\n    <span>⏱️ <strong>Zubereitung:</strong> 25 Minuten</span> |',
        fr_CH: '<span>📍 <strong>Région:</strong> Sicile</span> |\n    <span>⏱️ <strong>Préparation:</strong> 25 minutes</span> |',
        en_US: '<span>📍 <strong>Region:</strong> Sicily</span> |\n    <span>⏱️ <strong>Preparation:</strong> 25 minutes</span> |'
      };
    }
    else if (src === '🏛️ Tradizione') {
      t[src] = { de_CH: '🏛️ Tradition', fr_CH: '🏛️ Tradition', en_US: '🏛️ Tradition' };
    }
    else if (src.includes('Classico primo piatto della cucina di mare siciliana')) {
      t[src] = {
        de_CH: 'Klassisches erstes Gericht der sizilianischen Meeresküche, feiert die robusten und marinen Aromen.',
        fr_CH: 'Premier plat classique de la cuisine de mer sicilienne, célèbre les saveurs robustes et marines.',
        en_US: 'Classic first course of Sicilian seafood cuisine, celebrates robust and marine flavors.'
      };
    }
    else if (src === '🛒 Ingredienti') {
      t[src] = { de_CH: '🛒 Zutaten', fr_CH: '🛒 Ingrédients', en_US: '🛒 Ingredients' };
    }
    else if (src.includes('Spaghetti alla Chitarra al Nero di Seppia')) {
      t[src] = {
        de_CH: '<strong>320 Gramm</strong> Chitarra-Spaghetti mit Tintenfischtinte',
        fr_CH: '<strong>320 grammes</strong> Spaghetti alla Chitarra à l\'Encre de Seiche',
        en_US: '<strong>320 grams</strong> Chitarra Spaghetti with Cuttlefish Ink'
      };
    }
    else if (src.includes('Seppie fresche medie')) {
      t[src] = {
        de_CH: '<strong>400 Gramm</strong> Frische mittelgroße Tintenfische (bereits gereinigt)',
        fr_CH: '<strong>400 grammes</strong> Seiches fraîches moyennes (déjà nettoyées)',
        en_US: '<strong>400 grams</strong> Fresh medium cuttlefish (already cleaned)'
      };
    }
    else if (src.includes('Nero di seppia')) {
      t[src] = {
        de_CH: '<strong>8 Gramm</strong> Tintenfischtinte (in Beuteln oder von den Tintenfischen)',
        fr_CH: '<strong>8 grammes</strong> Encre de seiche (en sachets ou des seiches)',
        en_US: '<strong>8 grams</strong> Cuttlefish ink (in sachets or from the cuttlefish)'
      };
    }
    else if (src.includes('Pomodorini Ciliegino')) {
      t[src] = {
        de_CH: '<strong>200 Gramm</strong> Kirschtomaten',
        fr_CH: '<strong>200 grammes</strong> Tomates Cerises',
        en_US: '<strong>200 grams</strong> Cherry Tomatoes'
      };
    }
    else if (src.includes('<strong>2 spicchi</strong> Aglio')) {
      t[src] = {
        de_CH: '<strong>2 Zehen</strong> Knoblauch',
        fr_CH: '<strong>2 gousses</strong> Ail',
        en_US: '<strong>2 cloves</strong> Garlic'
      };
    }
    else if (src.includes('Vino bianco secco')) {
      t[src] = {
        de_CH: '<strong>80 ml</strong> Trockener Weißwein',
        fr_CH: '<strong>80 ml</strong> Vin blanc sec',
        en_US: '<strong>80 ml</strong> Dry white wine'
      };
    }
    else if (src.includes('<strong>60 ml</strong> Olio extra vergine')) {
      t[src] = {
        de_CH: '<strong>60 ml</strong> Natives Olivenöl extra',
        fr_CH: '<strong>60 ml</strong> Huile d\'olive extra vierge',
        en_US: '<strong>60 ml</strong> Extra virgin olive oil'
      };
    }
    else if (src.includes('Peperoncino fresco')) {
      t[src] = {
        de_CH: '<strong>1 (optional)</strong> Frische Chilischote',
        fr_CH: '<strong>1 (optionnel)</strong> Piment frais',
        en_US: '<strong>1 (optional)</strong> Fresh chili pepper'
      };
    }
    else if (src.includes('Prezzemolo fresco')) {
      t[src] = {
        de_CH: '<strong>30 Gramm</strong> Frische Petersilie',
        fr_CH: '<strong>30 grammes</strong> Persil frais',
        en_US: '<strong>30 grams</strong> Fresh parsley'
      };
    }
    else if (src.includes('Sale marino fino')) {
      t[src] = {
        de_CH: '<strong>8 Gramm (für das Nudelwasser) + 2 Gramm (für die Sauce)</strong> Feines Meersalz',
        fr_CH: '<strong>8 grammes (pour l\'eau des pâtes) + 2 grammes (pour la sauce)</strong> Sel marin fin',
        en_US: '<strong>8 grams (for pasta water) + 2 grams (for the sauce)</strong> Fine sea salt'
      };
    }
    else if (src === '👨‍🍳 Procedimento') {
      t[src] = { de_CH: '👨‍🍳 Zubereitung', fr_CH: '👨‍🍳 Préparation', en_US: '👨‍🍳 Instructions' };
    }
    else if (src.includes('<strong>Passo 1:</strong> Pulire accuratamente le seppie')) {
      t[src] = {
        de_CH: '<strong>Schritt 1:</strong> Die Tintenfische gründlich reinigen. Den Körper von den Tentakeln trennen, Schnabel und Augen entfernen. Falls vorhanden, die Tintenbeutel vorsichtig herausnehmen (wenn keine vorgefertigten verwendet werden). Die Körper der Tintenfische in dünne Streifen und die Tentakel in Stücke schneiden.',
        fr_CH: '<strong>Étape 1:</strong> Nettoyer soigneusement les seiches. Séparer le corps des tentacules, retirer le bec et les yeux. Si présents, extraire délicatement les poches d\'encre (si on n\'utilise pas ceux préemballés). Couper les corps des seiches en fines lanières et les tentacules en morceaux.',
        en_US: '<strong>Step 1:</strong> Thoroughly clean the cuttlefish. Separate the body from the tentacles, remove the beak and eyes. If present, carefully extract the ink sacs (if not using pre-packaged ones). Cut the cuttlefish bodies into thin strips and the tentacles into pieces.'
      };
    }
    else if (src.includes('<strong>Passo 2:</strong> In una padella ampia')) {
      t[src] = {
        de_CH: '<strong>Schritt 2:</strong> In einer großen Pfanne das native Olivenöl extra eingießen und bei mittlerer Hitze...',
        fr_CH: '<strong>Étape 2:</strong> Dans une grande poêle, verser l\'huile d\'olive extra vierge et faire revenir à feu moyen...',
        en_US: '<strong>Step 2:</strong> In a large pan, pour the extra virgin olive oil and sauté over medium heat...'
      };
    }
    else if (src.includes('<strong>Passo 3:</strong> Aggiungere le seppie')) {
      t[src] = {
        de_CH: '<strong>Schritt 3:</strong> Die geschnittenen Tintenfische in die Pfanne geben und 5 Minuten anbraten, dabei...',
        fr_CH: '<strong>Étape 3:</strong> Ajouter les seiches coupées dans la poêle et les faire rissoler pendant 5 minutes, en...',
        en_US: '<strong>Step 3:</strong> Add the cut cuttlefish to the pan and sear them for 5 minutes, stirring...'
      };
    }
    else if (src.includes('<strong>Passo 4:</strong> Unire i pomodorini')) {
      t[src] = {
        de_CH: '<strong>Schritt 4:</strong> Die halbierten Kirschtomaten und die Tintenfischtinte hinzufügen (wenn flüssig...',
        fr_CH: '<strong>Étape 4:</strong> Ajouter les tomates cerises coupées en deux et l\'encre de seiche (si liquide...',
        en_US: '<strong>Step 4:</strong> Add the halved cherry tomatoes and the cuttlefish ink (if liquid...'
      };
    }
    else if (src === '💡 Consigli dello Chef') {
      t[src] = { de_CH: '💡 Tipps vom Chef', fr_CH: '💡 Conseils du Chef', en_US: '💡 Chef\'s Tips' };
    }
    else if (src === '📚 Fonti') {
      t[src] = { de_CH: '📚 Quellen', fr_CH: '📚 Sources', en_US: '📚 Sources' };
    }
    else if (src.includes('Scopri il Catalogo LAPA')) {
      t[src] = {
        de_CH: 'Entdecke den LAPA Katalog',
        fr_CH: 'Découvre le Catalogue LAPA',
        en_US: 'Discover the LAPA Catalog'
      };
    }
    else if (src.includes('Questo prodotto è disponibile nel nostro catalogo')) {
      t[src] = {
        de_CH: 'Dieses Produkt ist in unserem Katalog erhältlich!',
        fr_CH: 'Ce produit est disponible dans notre catalogue !',
        en_US: 'This product is available in our catalog!'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 69: SPAGHETTI CHITARRA NERO DI SEPPIA ===\n');

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

  console.log('\n✅ ARTICOLO 69 COMPLETATO!');
}

main();
