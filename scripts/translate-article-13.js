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

const POST_ID = 13;

const TITLE_TRANSLATIONS = {
  it_IT: "Ecco le differenze tra calamaro e totano: caratteristiche, proprietà e utilizzo in cucina",
  de_CH: "Hier sind die Unterschiede zwischen Tintenfisch und Kalmar: Eigenschaften, Merkmale und Verwendung in der Küche",
  fr_CH: "Voici les différences entre calmar et encornet : caractéristiques, propriétés et utilisation en cuisine",
  en_US: "Here are the differences between squid and flying squid: characteristics, properties and use in cooking"
};

function getTranslations(sources) {
  const t = {};

  for (const src of sources) {
    if (src === 'Calamaro e il totano') {
      t[src] = {
        de_CH: 'Tintenfisch und Kalmar',
        fr_CH: 'Calmar et encornet',
        en_US: 'Squid and flying squid'
      };
    }
    else if (src.includes('Il calamaro e il totano sono entrambi molluschi')) {
      t[src] = {
        de_CH: 'Tintenfisch und Kalmar sind beides Kopffüßer-Weichtiere und haben einige Ähnlichkeiten, aber es gibt auch einige Unterschiede zwischen ihnen.',
        fr_CH: 'Le calmar et l\'encornet sont tous deux des mollusques céphalopodes et ont quelques similitudes, mais il existe également quelques différences entre eux.',
        en_US: 'Squid and flying squid are both cephalopod mollusks and have some similarities, but there are also some differences between them.'
      };
    }
    else if (src.includes('Il calamaro è generalmente più grande')) {
      t[src] = {
        de_CH: 'Der Tintenfisch ist im Allgemeinen größer als der Kalmar und kann beträchtliche Größen erreichen, sogar bis zu einem Meter Länge. Der Kalmar ist normalerweise kleiner, mit einer durchschnittlichen Länge von etwa 15-20 cm.',
        fr_CH: 'Le calmar est généralement plus grand que l\'encornet et peut atteindre des tailles considérables, même jusqu\'à un mètre de longueur. L\'encornet est généralement plus petit, avec une longueur moyenne d\'environ 15-20 cm.',
        en_US: 'Squid is generally larger than flying squid and can reach significant sizes, even up to a meter in length. Flying squid is usually smaller, with an average length of about 15-20 cm.'
      };
    }
    else if (src.includes('Un\'altra differenza tra i due è la forma')) {
      t[src] = {
        de_CH: 'Ein weiterer Unterschied zwischen den beiden ist die Körperform. Der Tintenfisch hat einen länglichen und zylindrischen Körper, während der Kalmar einen kürzeren und runderen Körper hat.',
        fr_CH: 'Une autre différence entre les deux est la forme du corps. Le calmar a un corps allongé et cylindrique, tandis que l\'encornet a un corps plus court et arrondi.',
        en_US: 'Another difference between the two is the body shape. Squid has an elongated and cylindrical body, while flying squid has a shorter and rounder body.'
      };
    }
    else if (src.includes('le ventose dei tentacoli del calamaro')) {
      t[src] = {
        de_CH: 'Außerdem sind die Saugnäpfe der Tentakel des Tintenfisches mit kleinen Zähnchen versehen, die ihm helfen, die Beute zu greifen, während die des Kalmars glatt sind.',
        fr_CH: 'De plus, les ventouses des tentacules du calmar sont dotées de petites dents qui l\'aident à saisir sa proie, tandis que celles de l\'encornet sont lisses.',
        en_US: 'Furthermore, the suckers on squid tentacles are equipped with small teeth that help it grip its prey, while those of flying squid are smooth.'
      };
    }
    else if (src.includes('Infine, il sapore dei due molluschi')) {
      t[src] = {
        de_CH: 'Schließlich kann der Geschmack der beiden Weichtiere leicht unterschiedlich sein: der Kalmar hat einen zarteren und süßeren Geschmack, während der Tintenfisch einen intensiveren und kräftigeren Geschmack hat.',
        fr_CH: 'Enfin, le goût des deux mollusques peut être légèrement différent : l\'encornet a un goût plus délicat et doux, tandis que le calmar a un goût plus intense et prononcé.',
        en_US: 'Finally, the taste of the two mollusks can be slightly different: flying squid has a more delicate and sweet taste, while squid has a more intense and decisive taste.'
      };
    }
    else if (src.includes('In cucina, i due molluschi possono essere utilizzati')) {
      t[src] = {
        de_CH: 'In der Küche können die beiden Weichtiere auf ähnliche Weise verwendet werden, aber manchmal werden sie je nach regionalen kulinarischen Vorlieben in verschiedenen Gerichten bevorzugt.',
        fr_CH: 'En cuisine, les deux mollusques peuvent être utilisés de manière similaire, mais parfois ils sont préférés dans différents plats selon les préférences culinaires régionales.',
        en_US: 'In the kitchen, the two mollusks can be used in similar ways, but sometimes they are preferred in different dishes depending on regional culinary preferences.'
      };
    }
    else if (src.includes('In generale, il calamaro è considerato più pregiato')) {
      t[src] = {
        de_CH: 'Im Allgemeinen wird der Tintenfisch als wertvoller als der Kalmar angesehen, vor allem wegen seines intensiven Geschmacks und seiner weichen Konsistenz. Der Tintenfisch wird oft in der Küche für die Zubereitung von gehobenen Gerichten verwendet, wie zum Beispiel das berühmte "Risotto mit Tintenfisch".',
        fr_CH: 'En général, le calmar est considéré comme plus précieux que l\'encornet, surtout pour son goût intense et sa consistance tendre. Le calmar est souvent utilisé en cuisine pour la préparation de plats de haute cuisine, comme par exemple le célèbre "risotto au calmar".',
        en_US: 'In general, squid is considered more valuable than flying squid, especially for its intense flavor and soft texture. Squid is often used in cooking for preparing high-end dishes, such as the famous "squid risotto".'
      };
    }
    else if (src.includes('Tuttavia, la qualità e il valore dei due molluschi')) {
      t[src] = {
        de_CH: 'Die Qualität und der Wert der beiden Weichtiere hängen jedoch auch von der Sorte und den Fanggebieten ab. Zum Beispiel kann hochwertiger Kalmar, der in bestimmten Gebieten gefangen wird, genauso wertvoll sein wie Tintenfisch. In jedem Fall sind beide Weichtiere eine wertvolle Quelle für Nährstoffe.',
        fr_CH: 'Cependant, la qualité et la valeur des deux mollusques dépendent également de la variété et des zones de pêche. Par exemple, l\'encornet de haute qualité pêché dans certaines zones peut être tout aussi précieux que le calmar. Dans tous les cas, les deux mollusques sont une source précieuse de nutriments.',
        en_US: 'However, the quality and value of the two mollusks also depend on the variety and fishing areas. For example, high-quality flying squid caught in certain areas can be just as valuable as squid. In any case, both mollusks are a valuable source of nutrients.'
      };
    }
    else if (src === 'Perché viene preferito il calamaro') {
      t[src] = {
        de_CH: 'Warum wird der Tintenfisch bevorzugt',
        fr_CH: 'Pourquoi le calmar est-il préféré',
        en_US: 'Why squid is preferred'
      };
    }
    else if (src.includes('Il calamaro viene spesso preferito al totano')) {
      t[src] = {
        de_CH: 'Der Tintenfisch wird oft dem Kalmar vorgezogen wegen einiger Eigenschaften, die ihn in der Küche besonders geschätzt machen.',
        fr_CH: 'Le calmar est souvent préféré à l\'encornet pour certaines caractéristiques qui le rendent particulièrement apprécié en cuisine.',
        en_US: 'Squid is often preferred over flying squid for some characteristics that make it particularly appreciated in cooking.'
      };
    }
    else if (src.includes('Innanzitutto, il calamaro ha una carne più morbida')) {
      t[src] = {
        de_CH: 'Zunächst hat der Tintenfisch ein weicheres und zarteres Fleisch als der Kalmar, was ihn vielseitiger in der Küche und leicht zuzubereiten macht. Außerdem hat der Tintenfisch einen intensiven und charakteristischen Geschmack, der ihn ideal für die Zubereitung von schmackhaften Gerichten macht.',
        fr_CH: 'Tout d\'abord, le calmar a une chair plus tendre et délicate que l\'encornet, ce qui le rend plus polyvalent en cuisine et facile à préparer. De plus, le calmar a un goût intense et caractéristique, ce qui le rend idéal pour la préparation de plats savoureux.',
        en_US: 'First of all, squid has softer and more delicate meat than flying squid, which makes it more versatile in cooking and easy to prepare. Furthermore, squid has an intense and characteristic flavor, which makes it ideal for preparing tasty dishes.'
      };
    }
    else if (src.includes('il calamaro è spesso usato per la preparazione di piatti tradizionali')) {
      t[src] = {
        de_CH: 'Außerdem wird der Tintenfisch oft für die Zubereitung traditioneller Gerichte in vielen Kulturen verwendet, wie zum Beispiel in der mediterranen, asiatischen und südamerikanischen Küche, was seine Beliebtheit erhöht.',
        fr_CH: 'De plus, le calmar est souvent utilisé pour la préparation de plats traditionnels dans de nombreuses cultures, comme par exemple la cuisine méditerranéenne, asiatique et sud-américaine, ce qui augmente sa popularité.',
        en_US: 'Furthermore, squid is often used for preparing traditional dishes in many cultures, such as Mediterranean, Asian, and South American cuisine, which increases its popularity.'
      };
    }
    else if (src.includes('Infine, il calamaro è una fonte di proteine')) {
      t[src] = {
        de_CH: 'Schließlich ist der Tintenfisch eine Quelle für hochwertige Proteine, fettarm und reich an Mineralstoffen wie Eisen, Selen und Zink. Dies macht ihn zu einem nahrhaften und gesunden Lebensmittel, das auch von denen geschätzt wird, die eine ausgewogene Ernährung einhalten.',
        fr_CH: 'Enfin, le calmar est une source de protéines de haute qualité, pauvre en graisses et riche en minéraux comme le fer, le sélénium et le zinc. Cela en fait un aliment nutritif et sain, qui est également apprécié par ceux qui suivent un régime équilibré.',
        en_US: 'Finally, squid is a source of high-quality proteins, low in fat and rich in minerals such as iron, selenium and zinc. This makes it a nutritious and healthy food, which is also appreciated by those who follow a balanced diet.'
      };
    }
    else if (src.includes('ordina adesso')) {
      t[src] = {
        de_CH: '<font class="text-o-color-4">jetzt bestellen</font>',
        fr_CH: '<font class="text-o-color-4">commandez maintenant</font>',
        en_US: '<font class="text-o-color-4">order now</font>'
      };
    }
    else if (src.includes('Calamar') && src.includes('P2')) {
      t[src] = {
        de_CH: '<font class="text-o-color-4">Tintenfisch P2</font>',
        fr_CH: '<font class="text-o-color-4">Calmar P2</font>',
        en_US: '<font class="text-o-color-4">Squid P2</font>'
      };
    }
    else if (src.includes('sconto 20%')) {
      t[src] = {
        de_CH: '<font class="text-o-color-4">20% Rabatt auf Ihre Bestellung.</font>',
        fr_CH: '<font class="text-o-color-4">20% de réduction sur votre commande.</font>',
        en_US: '<font class="text-o-color-4">20% discount on your order.</font>'
      };
    }
    else if (src === 'La tua offerta') {
      t[src] = {
        de_CH: 'Ihr Angebot',
        fr_CH: 'Votre offre',
        en_US: 'Your offer'
      };
    }
  }

  return t;
}

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 13: CALAMARO VS TOTANO ===\n');

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

  console.log('\n✅ ARTICOLO 13 COMPLETATO!');
}

main();
