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

const POST_ID = 73;

const TITLE_TRANSLATIONS = {
  it_IT: "Spaghetti alla Carbonara Autentica",
  de_CH: "Authentische Spaghetti Carbonara",
  fr_CH: "Spaghetti à la Carbonara Authentique",
  en_US: "Authentic Spaghetti Carbonara"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Un\'icona della cucina romana, la Carbonara è un primo piatto cremoso')) {
      t[src] = {
        de_CH: 'Eine Ikone der römischen Küche, die Carbonara ist ein cremiges und schmackhaftes erstes Gericht, bei dem der Guanciale unbestrittener Protagonist ist.',
        fr_CH: 'Une icône de la cuisine romaine, la Carbonara est un premier plat crémeux et savoureux, où le guanciale est le protagoniste incontesté.',
        en_US: 'An icon of Roman cuisine, Carbonara is a creamy and flavorful first course, where guanciale is the undisputed protagonist.'
      };
    }
    else if (src.includes('📍 <strong>Regione:</strong> Lazio')) {
      t[src] = {
        de_CH: '<span>📍 <strong>Region:</strong> Latium (Rom)</span> |\n    <span>⏱️ <strong>Zubereitung:</strong> 15 Minuten</span> |',
        fr_CH: '<span>📍 <strong>Région:</strong> Latium (Rome)</span> |\n    <span>⏱️ <strong>Préparation:</strong> 15 minutes</span> |',
        en_US: '<span>📍 <strong>Region:</strong> Lazio (Rome)</span> |\n    <span>⏱️ <strong>Preparation:</strong> 15 minutes</span> |'
      };
    }
    else if (src === '🏛️ Tradizione') {
      t[src] = { de_CH: '🏛️ Tradition', fr_CH: '🏛️ Tradition', en_US: '🏛️ Tradition' };
    }
    else if (src.includes('Ricetta storica della tradizione culinaria romana')) {
      t[src] = {
        de_CH: 'Historisches Rezept der römischen Küchentradition, entstanden aus der Begegnung von einfachen und robusten Zutaten.',
        fr_CH: 'Recette historique de la tradition culinaire romaine, née de la rencontre d\'ingrédients simples et robustes.',
        en_US: 'Historic recipe of Roman culinary tradition, born from the meeting of simple and robust ingredients.'
      };
    }
    else if (src === '🛒 Ingredienti') {
      t[src] = { de_CH: '🛒 Zutaten', fr_CH: '🛒 Ingrédients', en_US: '🛒 Ingredients' };
    }
    else if (src.includes('Guanciale di Suino al Pepe')) {
      t[src] = {
        de_CH: '<strong>180 g</strong> Schweinebacke mit Pfeffer S.V. Sorr',
        fr_CH: '<strong>180 g</strong> Guanciale de Porc au Poivre S.V. Sorr',
        en_US: '<strong>180 g</strong> Pork Jowl with Pepper S.V. Sorr'
      };
    }
    else if (src.includes('<strong>400 g</strong> Spaghetti')) {
      t[src] = {
        de_CH: '<strong>400 g</strong> Spaghetti',
        fr_CH: '<strong>400 g</strong> Spaghetti',
        en_US: '<strong>400 g</strong> Spaghetti'
      };
    }
    else if (src.includes('Uova (solo tuorli grandi)')) {
      t[src] = {
        de_CH: '<strong>4</strong> Eier (nur große Eigelb)',
        fr_CH: '<strong>4</strong> Œufs (seulement gros jaunes)',
        en_US: '<strong>4</strong> Eggs (large yolks only)'
      };
    }
    else if (src.includes('Uova (intere grandi)')) {
      t[src] = {
        de_CH: '<strong>1</strong> Ei (ganz groß)',
        fr_CH: '<strong>1</strong> Œuf (entier grand)',
        en_US: '<strong>1</strong> Egg (whole large)'
      };
    }
    else if (src.includes('Pecorino Romano DOP grattugiato')) {
      t[src] = {
        de_CH: '<strong>100 g</strong> Pecorino Romano DOP gerieben',
        fr_CH: '<strong>100 g</strong> Pecorino Romano DOP râpé',
        en_US: '<strong>100 g</strong> Pecorino Romano DOP grated'
      };
    }
    else if (src.includes('Pepe nero macinato fresco') && src.includes('8 g')) {
      t[src] = {
        de_CH: '<strong>8 g (reichlich)</strong> Frisch gemahlener schwarzer Pfeffer',
        fr_CH: '<strong>8 g (abondant)</strong> Poivre noir fraîchement moulu',
        en_US: '<strong>8 g (generous)</strong> Freshly ground black pepper'
      };
    }
    else if (src.includes('Acqua di cottura della pasta')) {
      t[src] = {
        de_CH: '<strong>100 ml (ca.)</strong> Nudelkochwasser',
        fr_CH: '<strong>100 ml (environ)</strong> Eau de cuisson des pâtes',
        en_US: '<strong>100 ml (approx.)</strong> Pasta cooking water'
      };
    }
    else if (src === '👨‍🍳 Procedimento') {
      t[src] = { de_CH: '👨‍🍳 Zubereitung', fr_CH: '👨‍🍳 Préparation', en_US: '👨‍🍳 Instructions' };
    }
    else if (src.includes('<strong>Passo 1:</strong> Tagliare il guanciale')) {
      t[src] = {
        de_CH: '<strong>Schritt 1:</strong> Den Guanciale in Streifen von ca. 1 cm Dicke und 3-4 cm Länge schneiden. Die Schwarte nicht entfernen, sie gibt Geschmack beim Kochen.',
        fr_CH: '<strong>Étape 1:</strong> Couper le guanciale en lanières d\'environ 1 cm d\'épaisseur et 3-4 cm de longueur. Éviter de retirer la couenne, qui donnera du goût pendant la cuisson.',
        en_US: '<strong>Step 1:</strong> Cut the guanciale into strips about 1 cm thick and 3-4 cm long. Avoid removing the rind, which will add flavor during cooking.'
      };
    }
    else if (src.includes('<strong>Passo 2:</strong> Versare il guanciale tagliato')) {
      t[src] = {
        de_CH: '<strong>Schritt 2:</strong> Den geschnittenen Guanciale in eine kalte beschichtete Pfanne geben und bei mittlerer Hitze auf den Herd stellen. Den Guanciale langsam sein Fett abgeben und knusprig werden lassen. Kein Öl hinzufügen.',
        fr_CH: '<strong>Étape 2:</strong> Verser le guanciale coupé dans une poêle antiadhésive froide et mettre sur le feu à flamme moyenne. Laisser le guanciale libérer lentement sa graisse et devenir croustillant. Ne pas ajouter d\'huile.',
        en_US: '<strong>Step 2:</strong> Pour the cut guanciale into a cold non-stick pan and place on medium heat. Let the guanciale slowly release its fat and become crispy. Do not add oil.'
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

  console.log('\n=== ARTICOLO 73: SPAGHETTI CARBONARA ===\n');

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

  console.log('\n✅ ARTICOLO 73 COMPLETATO!');
}

main();
