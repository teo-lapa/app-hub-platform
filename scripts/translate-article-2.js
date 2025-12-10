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

const POST_ID = 2;

// Traduzioni titolo e sottotitolo
const TITLE_TRANSLATIONS = {
  it_IT: "Il 24 marzo è la Giornata del Gelato Artigianale",
  de_CH: "Der 24. März ist der Tag des handwerklichen Speiseeises",
  fr_CH: "Le 24 mars est la Journée de la Glace Artisanale",
  en_US: "March 24th is Artisan Gelato Day"
};

const SUBTITLE_TRANSLATIONS = {
  it_IT: "Artigianale",
  de_CH: "Handwerklich",
  fr_CH: "Artisanale",
  en_US: "Artisan"
};

// Traduzioni contenuto
const CONTENT_TRANSLATIONS = {
  de_CH: `Ja, handwerklich hergestelltes Eis ist immer eine gute Wahl, auch im März! Der 24. März ist der Tag des handwerklichen Speiseeises, eine Gelegenheit, die Kunst der handwerklichen Eisherstellung, die Qualität der verwendeten Zutaten und die Kreativität der Eismacher zu feiern. An diesem Tag bieten viele handwerkliche Eisdielen Sonderaktionen und neue Eissorten an, es ist also eine großartige Gelegenheit, etwas Neues zu probieren und sich an einer kalten und leckeren Süßigkeit zu erfreuen. Außerdem markiert der März auch den Beginn des Frühlings, einer Jahreszeit, in der Eis noch angenehmer und erfrischender unter der Frühlingssonne genossen werden kann. <br><br>Wir feiern den Tag des handwerklichen Speiseeises, ein Fest, das unser Engagement für die Herstellung von hochwertigem Eis mit natürlichen Zutaten und handwerklicher Sorgfalt würdigt.<br><br>Handwerkliches Eis unterscheidet sich von industriellem Eis, weil es hochwertige Zutaten verwendet und in kleinen Mengen hergestellt wird. Auf diese Weise können wir einen authentischen Geschmack und kompromisslose Qualität in jedem Becher Eis garantieren, den wir servieren.<br><br>Der März ist die perfekte Zeit, um handwerkliches Eis zu genießen - der 24. März ist der Tag des handwerklichen Speiseeises <br><br>Wir sind stolz darauf, nicht nur unser handwerkliches Eis anzubieten, sondern auch die Zutaten für dessen Herstellung. Rufen Sie an und Sie finden alle hochwertigen Zutaten, die Sie für die Herstellung Ihres handwerklichen Eises für Ihr Restaurant benötigen.<br><br>Für unsere Restaurantkunden bieten wir hochwertige Zutaten in großen Mengen an. Wir haben eine große Auswahl an Geschmacksrichtungen, darunter Vanille, Schokolade, Erdbeere, Pistazie, Zitrone und viele mehr. Unsere Zutaten wurden ausgewählt, um einen authentischen Geschmack und eine cremige Konsistenz zu garantieren, alles zu wettbewerbsfähigen Preisen.<br>`,

  fr_CH: `Oui, la glace artisanale est toujours un bon choix, même au mois de mars ! Le 24 mars est la Journée de la Glace Artisanale, une occasion de célébrer l'art de la production de glace artisanale, la qualité des ingrédients utilisés et la créativité des glaciers. En cette journée, de nombreuses glaceries artisanales proposent des promotions spéciales et de nouvelles saveurs de glace, c'est donc une excellente occasion de goûter quelque chose de nouveau et de se régaler avec une douceur froide et savoureuse. De plus, le mois de mars marque aussi le début du printemps, une saison où la glace devient encore plus agréable et rafraîchissante à déguster sous le soleil printanier. <br><br>Nous sommes ici pour célébrer la journée de la glace artisanale, une fête qui célèbre notre engagement à préparer des glaces de haute qualité avec des ingrédients naturels et un soin artisanal.<br><br>La glace artisanale est différente de la glace industrielle car elle utilise des ingrédients de haute qualité et est produite en petites quantités. De cette façon, nous sommes en mesure de garantir un goût authentique et une qualité sans compromis dans chaque coupe de glace que nous servons.<br><br>Le mois de mars est le moment parfait pour apprécier la glace artisanale - le 24 mars est la journée de la glace artisanale <br><br>Nous sommes fiers d'offrir non seulement notre glace artisanale, mais aussi les ingrédients pour la faire. Appelez et vous trouverez tous les ingrédients de haute qualité nécessaires pour préparer votre glace artisanale pour votre restaurant.<br><br>Pour nos clients restaurateurs, nous offrons des ingrédients de haute qualité en grandes quantités. Nous avons une vaste gamme de saveurs parmi lesquelles choisir, notamment vanille, chocolat, fraise, pistache, citron et bien d'autres. Nos ingrédients ont été sélectionnés pour garantir une saveur authentique et une consistance crémeuse, le tout à des prix compétitifs.<br>`,

  en_US: `Yes, artisan gelato is always a good choice, even in March! March 24th is Artisan Gelato Day, an occasion to celebrate the art of artisan gelato production, the quality of ingredients used, and the creativity of gelato makers. On this day, many artisan gelaterias offer special promotions and new gelato flavors, so it's a great opportunity to taste something new and delight in a cold and tasty treat. Furthermore, March also marks the beginning of spring, a season when gelato becomes even more pleasant and refreshing to enjoy under the spring sun. <br><br>We're here to celebrate Artisan Gelato Day, a celebration that honors our commitment to preparing high-quality gelato with natural ingredients and artisanal care.<br><br>Artisan gelato is different from industrial ice cream because it uses high-quality ingredients and is produced in small quantities. This way, we can guarantee an authentic taste and uncompromising quality in every cup of gelato we serve.<br><br>March is the perfect time to appreciate artisan gelato - March 24th is Artisan Gelato Day <br><br>We're proud to offer not only our artisan gelato, but also the ingredients to make it. Call and you'll find all the high-quality ingredients needed to prepare your artisan gelato for your restaurant.<br><br>For our restaurant clients, we offer high-quality ingredients in large quantities. We have a wide range of flavors to choose from, including vanilla, chocolate, strawberry, pistachio, lemon, and many more. Our ingredients have been selected to guarantee an authentic flavor and creamy consistency, all at competitive prices.<br>`
};

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 2: GIORNATA DEL GELATO ARTIGIANALE ===\n');

  // 1. Aggiorno titolo e sottotitolo per ogni lingua
  console.log('1. Aggiorno titolo e sottotitolo...');
  for (const lang of ['it_IT', 'de_CH', 'fr_CH', 'en_US']) {
    await callOdoo('blog.post', 'write',
      [[POST_ID], { name: TITLE_TRANSLATIONS[lang], subtitle: SUBTITLE_TRANSLATIONS[lang] }],
      { context: { lang } }
    );
    console.log(`   ${lang}: OK`);
  }

  // 2. Leggo i segmenti da Odoo (source esatto)
  console.log('2. Leggo segmenti da tradurre...');
  const segmentData = await callOdoo('blog.post', 'get_field_translations', [[POST_ID], 'content']);

  if (!segmentData || !segmentData[0]) {
    console.log('   ERRORE: Nessun segmento trovato');
    return;
  }

  const segments = segmentData[0];
  // Prendo solo il source (sono tutti uguali per le diverse lingue)
  const sourceTexts = [...new Set(segments.map(s => s.source))];
  console.log(`   Trovati ${sourceTexts.length} segmenti`);

  // 3. Applico traduzioni
  console.log('3. Applico traduzioni contenuto...');

  for (const lang of ['de_CH', 'fr_CH', 'en_US']) {
    // Per ogni source, creo la traduzione
    const langTranslations = {};

    for (const src of sourceTexts) {
      // Il source è il testo italiano, la traduzione è il testo nella lingua target
      langTranslations[src] = CONTENT_TRANSLATIONS[lang];
    }

    const result = await callOdoo('blog.post', 'update_field_translations',
      [[POST_ID], 'content', { [lang]: langTranslations }]
    );
    console.log(`   ${lang}: ${result ? 'OK' : 'ERRORE'}`);
  }

  // 4. Verifica
  console.log('\n--- VERIFICA ---\n');
  for (const lang of ['it_IT', 'de_CH', 'fr_CH', 'en_US']) {
    const data = await callOdoo('blog.post', 'read',
      [[POST_ID], ['name', 'content']],
      { context: { lang } }
    );
    const title = data?.[0]?.name || '';
    const text = (data?.[0]?.content || '').replace(/<[^>]*>/g, '').substring(0, 50);
    console.log(`[${lang}] ${title}`);
    console.log(`        ${text}...`);
  }

  console.log('\n✅ ARTICOLO 2 COMPLETATO!');
}

main();
