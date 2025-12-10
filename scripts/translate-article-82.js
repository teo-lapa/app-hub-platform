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

const POST_ID = 82;

// Contenuto ITALIANO
const ITALIAN_CONTENT = `<section class="s_text_block pt40 pb40 o_colored_level" data-snippet="s_text_block">
<div class="container">
<h2>L'Oro Verde della Cucina Italiana</h2>
<p>L'olio extravergine d'oliva e l'ingrediente piu importante della cucina mediterranea. Ma non tutti gli oli sono uguali. Sapere come scegliere e usare l'olio giusto puo trasformare i tuoi piatti.</p>

<h3>Cosa Significa Extravergine?</h3>
<p>Per essere classificato come extravergine, un olio deve:</p>
<ul>
<li>Essere estratto solo meccanicamente (spremitura a freddo)</li>
<li>Avere acidita inferiore allo 0.8%</li>
<li>Non presentare difetti organolettici</li>
<li>Avere caratteristiche positive: fruttato, amaro, piccante</li>
</ul>

<h3>Le Principali Regioni Produttrici</h3>
<p>L'Italia produce oli con caratteristiche diverse a seconda della regione:</p>
<ul>
<li>Toscana: oli robusti e piccanti, perfetti per la carne</li>
<li>Puglia: oli fruttati e morbidi, ideali per pesce e verdure</li>
<li>Sicilia: oli intensi con note di pomodoro verde</li>
<li>Liguria: oli delicati e dolci, ottimi per il pesto</li>
<li>Umbria: oli equilibrati con note di carciofo</li>
</ul>

<h3>Come Usare l'Olio in Cucina</h3>
<h4>A Crudo</h4>
<p>L'olio extravergine da il meglio di se a crudo: su insalate, bruschette, zuppe, e come condimento finale su pasta e risotti.</p>

<h4>Per Cucinare</h4>
<p>Usa olio extravergine di qualita media per cotture a temperatura moderata. Per le fritture, scegli oli con punto di fumo piu alto.</p>

<h3>Come Conservare l'Olio</h3>
<ul>
<li>Lontano dalla luce: in bottiglie scure o in dispensa chiusa</li>
<li>Lontano dal calore: mai vicino ai fornelli</li>
<li>Ben chiuso: l'ossigeno degrada rapidamente l'olio</li>
<li>Consumo: preferibilmente entro 12-18 mesi dalla produzione</li>
</ul>

<h3>I Nostri Oli Selezionati</h3>
<p>LAPA seleziona oli extravergine d'oliva dalle migliori regioni italiane. I nostri oli sono:</p>
<ul>
<li>100% italiani e tracciabili</li>
<li>Spremuti a freddo</li>
<li>Selezionati per qualita e freschezza</li>
<li>Disponibili in diversi formati per ogni esigenza</li>
</ul>

<h3>Conclusione</h3>
<p>Un buon olio extravergine d'oliva e un investimento nella qualita dei tuoi piatti. Non risparmiare su questo ingrediente fondamentale: i tuoi clienti noteranno la differenza.</p>
</div>
</section>`;

// Traduzioni per ogni segmento
const TRANSLATIONS = {
  "L'Oro Verde della Cucina Italiana": {
    de_CH: "Das gruene Gold der italienischen Kueche",
    fr_CH: "L'or vert de la cuisine italienne",
    en_US: "The Green Gold of Italian Cuisine"
  },
  "L'olio extravergine d'oliva e l'ingrediente piu importante della cucina mediterranea. Ma non tutti gli oli sono uguali. Sapere come scegliere e usare l'olio giusto puo trasformare i tuoi piatti.": {
    de_CH: "Natives Olivenoel extra ist die wichtigste Zutat der mediterranen Kueche. Aber nicht alle Oele sind gleich. Zu wissen, wie man das richtige Oel auswaehlt und verwendet, kann Ihre Gerichte verwandeln.",
    fr_CH: "L'huile d'olive extra vierge est l'ingredient le plus important de la cuisine mediterraneenne. Mais toutes les huiles ne se valent pas. Savoir comment choisir et utiliser la bonne huile peut transformer vos plats.",
    en_US: "Extra virgin olive oil is the most important ingredient in Mediterranean cuisine. But not all oils are equal. Knowing how to choose and use the right oil can transform your dishes."
  },
  "Cosa Significa Extravergine?": {
    de_CH: "Was bedeutet Extra Vergine?",
    fr_CH: "Que signifie Extra Vierge?",
    en_US: "What Does Extra Virgin Mean?"
  },
  "Per essere classificato come extravergine, un olio deve:": {
    de_CH: "Um als extra vergine klassifiziert zu werden, muss ein Oel:",
    fr_CH: "Pour etre classee comme extra vierge, une huile doit:",
    en_US: "To be classified as extra virgin, an oil must:"
  },
  "Essere estratto solo meccanicamente (spremitura a freddo)": {
    de_CH: "Nur mechanisch extrahiert werden (Kaltpressung)",
    fr_CH: "Etre extraite uniquement mecaniquement (pression a froid)",
    en_US: "Be extracted only mechanically (cold pressing)"
  },
  "Avere acidita inferiore allo 0.8%": {
    de_CH: "Einen Saeuregehalt unter 0,8% haben",
    fr_CH: "Avoir une acidite inferieure a 0,8%",
    en_US: "Have acidity below 0.8%"
  },
  "Non presentare difetti organolettici": {
    de_CH: "Keine organoleptischen Maengel aufweisen",
    fr_CH: "Ne presenter aucun defaut organoleptique",
    en_US: "Have no organoleptic defects"
  },
  "Avere caratteristiche positive: fruttato, amaro, piccante": {
    de_CH: "Positive Eigenschaften haben: fruchtig, bitter, scharf",
    fr_CH: "Avoir des caracteristiques positives: fruite, amer, piquant",
    en_US: "Have positive characteristics: fruity, bitter, pungent"
  },
  "Le Principali Regioni Produttrici": {
    de_CH: "Die wichtigsten Produktionsregionen",
    fr_CH: "Les principales regions productrices",
    en_US: "The Main Producing Regions"
  },
  "L'Italia produce oli con caratteristiche diverse a seconda della regione:": {
    de_CH: "Italien produziert Oele mit unterschiedlichen Eigenschaften je nach Region:",
    fr_CH: "L'Italie produit des huiles aux caracteristiques differentes selon la region:",
    en_US: "Italy produces oils with different characteristics depending on the region:"
  },
  "Toscana: oli robusti e piccanti, perfetti per la carne": {
    de_CH: "Toskana: kraeftige und scharfe Oele, perfekt fuer Fleisch",
    fr_CH: "Toscane: huiles robustes et piquantes, parfaites pour la viande",
    en_US: "Tuscany: robust and pungent oils, perfect for meat"
  },
  "Puglia: oli fruttati e morbidi, ideali per pesce e verdure": {
    de_CH: "Apulien: fruchtige und milde Oele, ideal fuer Fisch und Gemuese",
    fr_CH: "Pouilles: huiles fruitees et douces, ideales pour le poisson et les legumes",
    en_US: "Puglia: fruity and mild oils, ideal for fish and vegetables"
  },
  "Sicilia: oli intensi con note di pomodoro verde": {
    de_CH: "Sizilien: intensive Oele mit Noten von gruener Tomate",
    fr_CH: "Sicile: huiles intenses avec des notes de tomate verte",
    en_US: "Sicily: intense oils with green tomato notes"
  },
  "Liguria: oli delicati e dolci, ottimi per il pesto": {
    de_CH: "Ligurien: zarte und suesse Oele, hervorragend fuer Pesto",
    fr_CH: "Ligurie: huiles delicates et douces, excellentes pour le pesto",
    en_US: "Liguria: delicate and sweet oils, excellent for pesto"
  },
  "Umbria: oli equilibrati con note di carciofo": {
    de_CH: "Umbrien: ausgewogene Oele mit Artischockennoten",
    fr_CH: "Ombrie: huiles equilibrees avec des notes d'artichaut",
    en_US: "Umbria: balanced oils with artichoke notes"
  },
  "Come Usare l'Olio in Cucina": {
    de_CH: "Wie man Oel in der Kueche verwendet",
    fr_CH: "Comment utiliser l'huile en cuisine",
    en_US: "How to Use Oil in the Kitchen"
  },
  "A Crudo": {
    de_CH: "Roh",
    fr_CH: "A cru",
    en_US: "Raw"
  },
  "L'olio extravergine da il meglio di se a crudo: su insalate, bruschette, zuppe, e come condimento finale su pasta e risotti.": {
    de_CH: "Natives Olivenoel extra zeigt sich am besten roh: auf Salaten, Bruschetta, Suppen und als letztes Gewuerz auf Pasta und Risotto.",
    fr_CH: "L'huile d'olive extra vierge donne le meilleur d'elle-meme a cru: sur les salades, bruschetta, soupes, et comme assaisonnement final sur les pates et risottos.",
    en_US: "Extra virgin olive oil is at its best raw: on salads, bruschetta, soups, and as a final dressing on pasta and risottos."
  },
  "Per Cucinare": {
    de_CH: "Zum Kochen",
    fr_CH: "Pour cuisiner",
    en_US: "For Cooking"
  },
  "Usa olio extravergine di qualita media per cotture a temperatura moderata. Per le fritture, scegli oli con punto di fumo piu alto.": {
    de_CH: "Verwenden Sie mittelwertiges natives Olivenoel extra fuer das Kochen bei maessigen Temperaturen. Fuer das Frittieren waehlen Sie Oele mit hoeherem Rauchpunkt.",
    fr_CH: "Utilisez une huile d'olive extra vierge de qualite moyenne pour les cuissons a temperature moderee. Pour les fritures, choisissez des huiles avec un point de fumee plus eleve.",
    en_US: "Use medium-quality extra virgin olive oil for cooking at moderate temperatures. For frying, choose oils with a higher smoke point."
  },
  "Come Conservare l'Olio": {
    de_CH: "Wie man Oel aufbewahrt",
    fr_CH: "Comment conserver l'huile",
    en_US: "How to Store Oil"
  },
  "Lontano dalla luce: in bottiglie scure o in dispensa chiusa": {
    de_CH: "Fern von Licht: in dunklen Flaschen oder in geschlossenem Schrank",
    fr_CH: "A l'abri de la lumiere: dans des bouteilles sombres ou dans un placard ferme",
    en_US: "Away from light: in dark bottles or in a closed pantry"
  },
  "Lontano dal calore: mai vicino ai fornelli": {
    de_CH: "Fern von Waerme: niemals in der Naehe des Herds",
    fr_CH: "A l'abri de la chaleur: jamais pres des fourneaux",
    en_US: "Away from heat: never near the stove"
  },
  "Ben chiuso: l'ossigeno degrada rapidamente l'olio": {
    de_CH: "Gut verschlossen: Sauerstoff baut das Oel schnell ab",
    fr_CH: "Bien ferme: l'oxygene degrade rapidement l'huile",
    en_US: "Well sealed: oxygen quickly degrades the oil"
  },
  "Consumo: preferibilmente entro 12-18 mesi dalla produzione": {
    de_CH: "Verbrauch: vorzugsweise innerhalb von 12-18 Monaten nach der Produktion",
    fr_CH: "Consommation: de preference dans les 12-18 mois suivant la production",
    en_US: "Consumption: preferably within 12-18 months of production"
  },
  "I Nostri Oli Selezionati": {
    de_CH: "Unsere ausgewaehlten Oele",
    fr_CH: "Nos huiles selectionnees",
    en_US: "Our Selected Oils"
  },
  "LAPA seleziona oli extravergine d'oliva dalle migliori regioni italiane. I nostri oli sono:": {
    de_CH: "LAPA waehlt native Olivenoel extra aus den besten italienischen Regionen aus. Unsere Oele sind:",
    fr_CH: "LAPA selectionne des huiles d'olive extra vierge des meilleures regions italiennes. Nos huiles sont:",
    en_US: "LAPA selects extra virgin olive oils from the best Italian regions. Our oils are:"
  },
  "100% italiani e tracciabili": {
    de_CH: "100% italienisch und rueckverfolgbar",
    fr_CH: "100% italiennes et tracables",
    en_US: "100% Italian and traceable"
  },
  "Spremuti a freddo": {
    de_CH: "Kaltgepresst",
    fr_CH: "Pressees a froid",
    en_US: "Cold pressed"
  },
  "Selezionati per qualita e freschezza": {
    de_CH: "Ausgewaehlt fuer Qualitaet und Frische",
    fr_CH: "Selectionnees pour leur qualite et fraicheur",
    en_US: "Selected for quality and freshness"
  },
  "Disponibili in diversi formati per ogni esigenza": {
    de_CH: "In verschiedenen Formaten fuer jeden Bedarf erhaeltlich",
    fr_CH: "Disponibles en differents formats pour chaque besoin",
    en_US: "Available in different formats for every need"
  },
  "Conclusione": {
    de_CH: "Fazit",
    fr_CH: "Conclusion",
    en_US: "Conclusion"
  },
  "Un buon olio extravergine d'oliva e un investimento nella qualita dei tuoi piatti. Non risparmiare su questo ingrediente fondamentale: i tuoi clienti noteranno la differenza.": {
    de_CH: "Ein gutes natives Olivenoel extra ist eine Investition in die Qualitaet Ihrer Gerichte. Sparen Sie nicht an dieser grundlegenden Zutat: Ihre Kunden werden den Unterschied bemerken.",
    fr_CH: "Une bonne huile d'olive extra vierge est un investissement dans la qualite de vos plats. N'economisez pas sur cet ingredient fondamental: vos clients remarqueront la difference.",
    en_US: "A good extra virgin olive oil is an investment in the quality of your dishes. Don't skimp on this fundamental ingredient: your customers will notice the difference."
  }
};

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 82: OLIO EXTRAVERGINE D\'OLIVA ===\n');

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

  console.log('\n✅ ARTICOLO 82 COMPLETATO!');
}

main();
