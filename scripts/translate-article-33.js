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

const POST_ID = 33;

const TITLE_TRANSLATIONS = {
  it_IT: "🍕La Rivoluzione dei Friarielli: Salute, Gusto e Tradizione sulla tua Pizza🔥",
  de_CH: "🍕Die Friarielli-Revolution: Gesundheit, Geschmack und Tradition auf deiner Pizza🔥",
  fr_CH: "🍕La Révolution des Friarielli : Santé, Goût et Tradition sur ta Pizza🔥",
  en_US: "🍕The Friarielli Revolution: Health, Taste and Tradition on Your Pizza🔥"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src.includes('Cosa c\'è in comune tra un ortaggio pugliese')) {
      t[src] = {
        de_CH: 'Was haben ein apulisches Gemüse 🌱 und deine erfolgreiche Pizzeria 🏆 gemeinsam? Die Antwort ist so einfach wie überraschend: die tiefgekühlten Feld-Friarielli von Spirito Contadino. Es ist Zeit, dir das Geheimnis 🗝️ eines Produkts zu verraten, das nicht nur die Geschmacksknospen deiner Kunden zum Strahlen bringt 😋, sondern deine Pizzeria zu neuen Höhen der Exzellenz führen wird.',
        fr_CH: 'Qu\'y a-t-il de commun entre un légume des Pouilles 🌱 et ta pizzeria à succès 🏆 ? La réponse est aussi simple que surprenante : les Friarielli de champ surgelés Spirito Contadino. Il est temps de te révéler le secret 🗝️ d\'un produit qui non seulement fera briller les papilles de tes clients 😋, mais portera ta pizzeria vers de nouveaux sommets d\'excellence.',
        en_US: 'What do an Apulian vegetable 🌱 and your successful pizzeria 🏆 have in common? The answer is as simple as it is surprising: the frozen field Friarielli from Spirito Contadino. It\'s time to reveal the secret 🗝️ of a product that will not only make your customers\' taste buds shine 😋, but will take your pizzeria to new heights of excellence.'
      };
    }
    else if (src.includes('E se ti dicessi che non si tratta solo di un ingrediente')) {
      t[src] = {
        de_CH: 'Und wenn ich dir sage, dass es nicht nur um eine außergewöhnliche Zutat für deine Pizza geht, sondern um ein echtes Lebenselixier 💪🏼? Friarielli sind nicht nur ein Gemüse. Sie sind ein Schatz der Natur 🌿, reich an Mineralien, Kalzium, Phosphor, Eisen und Vitaminen A, B2 und C. Ein kleines Meisterwerk, das entgiftende Funktionen erfüllt, dem Körper hilft, sich von Giftstoffen zu reinigen, vor Anämie schützt, die Knochen stärkt und nach einigen Forschungen zur Vorbeugung verschiedener Tumore beiträgt 🏥.',
        fr_CH: 'Et si je te disais qu\'il ne s\'agit pas seulement d\'un ingrédient extraordinaire pour ta pizza, mais d\'un véritable élixir de longue vie 💪🏼 ? Les Friarielli ne sont pas seulement un légume. Ce sont un trésor de la Nature 🌿, riche en minéraux, calcium, phosphore, fer et vitamines A, B2 et C. Un petit chef-d\'œuvre qui remplit des fonctions détoxifiantes, aide le corps à se purifier des toxines, protège de l\'anémie, renforce les os et, selon certaines recherches, contribue à prévenir la formation de divers cancers 🏥.',
        en_US: 'And what if I told you it\'s not just an extraordinary ingredient for your pizza, but a true elixir of life 💪🏼? Friarielli are not just a vegetable. They are a treasure of Nature 🌿, rich in minerals, calcium, phosphorus, iron and vitamins A, B2 and C. A small masterpiece that performs detoxifying functions, helps the body cleanse itself of toxins, protects against anemia, strengthens bones and, according to some research, helps prevent the formation of various cancers 🏥.'
      };
    }
    else if (src.includes('Ma attenzione, non è tutto! Questo ortaggio magico')) {
      t[src] = {
        de_CH: 'Aber Achtung, das ist nicht alles! Dieses magische Gemüse 🧙‍♂️ hat auch die Fähigkeit, den Blutdruck, das Cholesterin und den Diabetes unter Kontrolle zu halten, das Herz-Kreislauf-System zu schützen und die Durchblutung zu verbessern. Kurz gesagt, eine kleine Revolution auf deiner Pizza!',
        fr_CH: 'Mais attention, ce n\'est pas tout ! Ce légume magique 🧙‍♂️ a également la capacité de contrôler la tension, le cholestérol et le diabète, de protéger l\'appareil cardiovasculaire et d\'améliorer la circulation sanguine. En bref, une petite révolution sur ta pizza !',
        en_US: 'But wait, there\'s more! This magical vegetable 🧙‍♂️ also has the ability to keep blood pressure, cholesterol and diabetes under control, protect the cardiovascular system and improve blood circulation. In short, a small revolution on your pizza!'
      };
    }
    else if (src.includes('Ma come utilizzarli nel tuo locale? È semplicissimo')) {
      t[src] = {
        de_CH: 'Aber wie verwendest du sie in deinem Lokal? Es ist ganz einfach! Gib das gefrorene Produkt in eine kalte Pfanne mit 20 ml Wasser pro Gemüseschicht, decke ab und koche bei mittlerer Hitze 4 Minuten. Nimm den Deckel ab und koche noch 3 Minuten weiter. Et voilà, deine Friarielli sind bereit, deine Pizzen zu revolutionieren 🍳.',
        fr_CH: 'Mais comment les utiliser dans ton établissement ? C\'est très simple ! Mets le produit surgelé dans une poêle froide avec 20 ml d\'eau par couche de légume, couvre et cuis à feu modéré pendant 4 minutes. Retire le couvercle et cuis encore 3 minutes. Et voilà, tes Friarielli sont prêts à révolutionner tes pizzas 🍳.',
        en_US: 'But how do you use them in your venue? It\'s super easy! Put the frozen product in a cold pan with 20 ml of water per vegetable layer, cover and cook over medium heat for 4 minutes. Remove the lid and cook for another 3 minutes. Et voilà, your Friarielli are ready to revolutionize your pizzas 🍳.'
      };
    }
    else if (src.includes('Non è solo questione di sapore, è questione di qualità')) {
      t[src] = {
        de_CH: 'Es geht nicht nur um Geschmack, es geht um Qualität 🌟. Und welcher bessere Partner könnte dir höchste Qualität garantieren als LAPA? Lieferungen 6 Tage von 7, weil deine kulinarische Kreativität nie aufhört. Eine personalisierte Preisliste, weil wir wissen, dass jeder Koch einzigartig ist. Heute bestellen, morgen geliefert, weil jeder Tag eine Gelegenheit ist, deine Kunden zu überraschen. Und vor allem, kein Mindestbestellwert, weil Größe nicht in Menge gemessen wird 📦.',
        fr_CH: 'Ce n\'est pas seulement une question de saveur, c\'est une question de qualité 🌟. Et quel meilleur partenaire que LAPA pour t\'assurer le maximum de qualité ? Livraisons 6 jours sur 7, parce que ta créativité culinaire ne s\'arrête jamais. Un tarif personnalisé, parce que nous savons que chaque cuisinier est unique. Commande aujourd\'hui pour demain, parce que chaque jour est une opportunité de surprendre tes clients. Et, surtout, pas de minimum de commande, parce que la grandeur ne se mesure pas en quantité 📦.',
        en_US: 'It\'s not just about taste, it\'s about quality 🌟. And what better partner to ensure maximum quality than LAPA? Deliveries 6 days out of 7, because your culinary creativity never stops. A customized price list, because we know every chef is unique. Order today for tomorrow, because every day is an opportunity to surprise your customers. And most importantly, no minimum order, because greatness is not measured in quantity 📦.'
      };
    }
    else if (src.includes('Vuoi saperne di più su questo incredibile ortaggio')) {
      t[src] = {
        de_CH: 'Möchtest du mehr über dieses unglaubliche Gemüse erfahren und wie es deine Küche revolutionieren kann? Dann hinterlasse einen Kommentar 💬, teile deine Ideen 💡 oder stelle eine Frage❓! Ich garantiere dir, sobald du die tiefgekühlten Feld-Friarielli von Spirito Contadino probierst, wirst du nicht mehr ohne sie auskommen wollen. Also, worauf wartest du? Experimentiere, kreiere, wage und... guten Appetit!🍴',
        fr_CH: 'Tu veux en savoir plus sur cet incroyable légume et comment il peut révolutionner ta cuisine ? Alors laisse un commentaire 💬, partage tes idées 💡 ou pose une question❓! Je te garantis, une fois que tu auras essayé les Friarielli de champ surgelés Spirito Contadino, tu ne voudras plus t\'en passer. Alors, qu\'attends-tu ? Expérimente, crée, ose et... bon appétit !🍴',
        en_US: 'Want to know more about this incredible vegetable and how it can revolutionize your kitchen? Then leave a comment 💬, share your ideas 💡 or ask a question❓! I guarantee you, once you try the frozen field Friarielli from Spirito Contadino, you won\'t want to do without them anymore. So, what are you waiting for? Experiment, create, dare and... enjoy your meal!🍴'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 33: FRIARIELLI ===\n');

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

  console.log('\n✅ ARTICOLO 33 COMPLETATO!');
}

main();
