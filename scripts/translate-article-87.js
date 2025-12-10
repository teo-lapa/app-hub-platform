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

const POST_ID = 87;

// Contenuto ITALIANO
const ITALIAN_CONTENT = `<section class="s_text_block pt40 pb40 o_colored_level" data-snippet="s_text_block">
<div class="container">
<h2>L'Arte della Salumeria Italiana</h2>
<p>I salumi italiani sono un patrimonio gastronomico unico al mondo. Ogni regione ha le sue specialita, frutto di tradizioni secolari e saperi tramandati di generazione in generazione.</p>

<h3>I Salumi DOP e IGP</h3>

<h4>Prosciutto di Parma DOP</h4>
<p>Il re dei prosciutti italiani. Stagionato almeno 12 mesi nelle colline parmensi. Sapore dolce e delicato, perfetto tagliato sottile.</p>

<h4>Prosciutto San Daniele DOP</h4>
<p>Prodotto in Friuli. Forma caratteristica a chitarra. Gusto piu dolce e morbido rispetto al Parma.</p>

<h4>Mortadella Bologna IGP</h4>
<p>Il salume piu iconico di Bologna. Morbida, profumata, con cubetti di grasso e pistacchi. Ottima in panini o a cubetti nell'aperitivo.</p>

<h4>Speck Alto Adige IGP</h4>
<p>Prosciutto leggermente affumicato e speziato. Tipico dell'Alto Adige, perfetto su pizze e insalate.</p>

<h4>Bresaola della Valtellina IGP</h4>
<p>Carne di manzo salata e stagionata. Magra e saporita, ideale con rucola, grana e limone.</p>

<h3>Salumi da Cucina</h3>

<h4>Guanciale</h4>
<p>Dalla guancia del maiale, fondamentale per carbonara, amatriciana e gricia. Grasso abbondante che si scioglie in cottura.</p>

<h4>Pancetta</h4>
<p>Dalla pancia del maiale. Puo essere tesa o arrotolata, dolce o affumicata. Versatile in cucina.</p>

<h4>Lardo di Colonnata IGP</h4>
<p>Stagionato in vasche di marmo con erbe aromatiche. Si scioglie sulla lingua. Perfetto su crostini caldi.</p>

<h3>Come Conservare i Salumi</h3>
<ul>
<li>Salumi interi: luogo fresco e asciutto, 12-15 gradi</li>
<li>Salumi affettati: in frigo, consumare entro 3-4 giorni</li>
<li>Avvolti in carta alimentare, mai nella plastica</li>
<li>Togliere dal frigo 15 minuti prima di servire</li>
</ul>

<h3>Abbinamenti Classici</h3>
<ul>
<li>Prosciutto crudo con melone o fichi</li>
<li>Mortadella con pane fresco</li>
<li>Bresaola con rucola e parmigiano</li>
<li>Speck con formaggi di montagna</li>
</ul>

<h3>La Selezione LAPA</h3>
<p>LAPA importa i migliori salumi italiani direttamente dai produttori. La nostra selezione include:</p>
<ul>
<li>Prosciutti DOP stagionati</li>
<li>Mortadella Bologna autentica</li>
<li>Guanciale e pancetta per la cucina</li>
<li>Salumi regionali selezionati</li>
</ul>

<h3>Conclusione</h3>
<p>I salumi italiani sono molto piu che semplici affettati: sono espressione di territorio, tradizione e artigianalita. Offrire salumi di qualita significa valorizzare l'autentica gastronomia italiana.</p>
</div>
</section>`;

// Traduzioni per ogni segmento
const TRANSLATIONS = {
  "L'Arte della Salumeria Italiana": {
    de_CH: "Die Kunst der italienischen Wurstwaren",
    fr_CH: "L'art de la charcuterie italienne",
    en_US: "The Art of Italian Cured Meats"
  },
  "I salumi italiani sono un patrimonio gastronomico unico al mondo. Ogni regione ha le sue specialita, frutto di tradizioni secolari e saperi tramandati di generazione in generazione.": {
    de_CH: "Italienische Wurstwaren sind ein weltweit einzigartiges gastronomisches Erbe. Jede Region hat ihre Spezialitaeten, das Ergebnis jahrhundertealter Traditionen und von Generation zu Generation weitergegebenem Wissen.",
    fr_CH: "Les charcuteries italiennes sont un patrimoine gastronomique unique au monde. Chaque region a ses specialites, fruit de traditions seculaires et de savoirs transmis de generation en generation.",
    en_US: "Italian cured meats are a unique gastronomic heritage in the world. Each region has its specialties, the result of centuries-old traditions and knowledge passed down from generation to generation."
  },
  "I Salumi DOP e IGP": {
    de_CH: "DOP- und IGP-Wurstwaren",
    fr_CH: "Les charcuteries DOP et IGP",
    en_US: "DOP and IGP Cured Meats"
  },
  "Prosciutto di Parma DOP": {
    de_CH: "Prosciutto di Parma DOP",
    fr_CH: "Prosciutto di Parma DOP",
    en_US: "Prosciutto di Parma DOP"
  },
  "Il re dei prosciutti italiani. Stagionato almeno 12 mesi nelle colline parmensi. Sapore dolce e delicato, perfetto tagliato sottile.": {
    de_CH: "Der Koenig der italienischen Schinken. Mindestens 12 Monate in den Huegeln von Parma gereift. Suesser und zarter Geschmack, perfekt duenn geschnitten.",
    fr_CH: "Le roi des jambons italiens. Affine pendant au moins 12 mois dans les collines de Parme. Saveur douce et delicate, parfait coupe fin.",
    en_US: "The king of Italian hams. Aged at least 12 months in the hills of Parma. Sweet and delicate flavor, perfect sliced thin."
  },
  "Prosciutto San Daniele DOP": {
    de_CH: "Prosciutto San Daniele DOP",
    fr_CH: "Prosciutto San Daniele DOP",
    en_US: "Prosciutto San Daniele DOP"
  },
  "Prodotto in Friuli. Forma caratteristica a chitarra. Gusto piu dolce e morbido rispetto al Parma.": {
    de_CH: "Hergestellt in Friaul. Charakteristische Gitarrenform. Suesserer und weicherer Geschmack als Parma.",
    fr_CH: "Produit au Frioul. Forme caracteristique en guitare. Gout plus doux et plus tendre que le Parme.",
    en_US: "Produced in Friuli. Characteristic guitar shape. Sweeter and softer taste than Parma."
  },
  "Mortadella Bologna IGP": {
    de_CH: "Mortadella Bologna IGP",
    fr_CH: "Mortadella Bologna IGP",
    en_US: "Mortadella Bologna IGP"
  },
  "Il salume piu iconico di Bologna. Morbida, profumata, con cubetti di grasso e pistacchi. Ottima in panini o a cubetti nell'aperitivo.": {
    de_CH: "Die ikonischste Wurstware Bolognas. Weich, aromatisch, mit Fettwuerfeln und Pistazien. Ausgezeichnet in Sandwiches oder gewuerfelt zum Aperitif.",
    fr_CH: "La charcuterie la plus emblematique de Bologne. Moelleuse, parfumee, avec des cubes de gras et des pistaches. Excellente en sandwichs ou en cubes pour l'aperitif.",
    en_US: "Bologna's most iconic cured meat. Soft, fragrant, with fat cubes and pistachios. Excellent in sandwiches or cubed for aperitifs."
  },
  "Speck Alto Adige IGP": {
    de_CH: "Speck Alto Adige IGP",
    fr_CH: "Speck Alto Adige IGP",
    en_US: "Speck Alto Adige IGP"
  },
  "Prosciutto leggermente affumicato e speziato. Tipico dell'Alto Adige, perfetto su pizze e insalate.": {
    de_CH: "Leicht geraeucherter und gewuerzter Schinken. Typisch fuer Suedtirol, perfekt auf Pizzen und Salaten.",
    fr_CH: "Jambon legerement fume et epice. Typique du Haut-Adige, parfait sur les pizzas et les salades.",
    en_US: "Lightly smoked and spiced ham. Typical of South Tyrol, perfect on pizzas and salads."
  },
  "Bresaola della Valtellina IGP": {
    de_CH: "Bresaola della Valtellina IGP",
    fr_CH: "Bresaola della Valtellina IGP",
    en_US: "Bresaola della Valtellina IGP"
  },
  "Carne di manzo salata e stagionata. Magra e saporita, ideale con rucola, grana e limone.": {
    de_CH: "Gesalzenes und gereiftes Rindfleisch. Mager und schmackhaft, ideal mit Rucola, Grana und Zitrone.",
    fr_CH: "Viande de boeuf salee et affinee. Maigre et savoureuse, ideale avec roquette, grana et citron.",
    en_US: "Salted and aged beef. Lean and flavorful, ideal with arugula, grana and lemon."
  },
  "Salumi da Cucina": {
    de_CH: "Kochwurstwaren",
    fr_CH: "Charcuteries de Cuisine",
    en_US: "Cooking Cured Meats"
  },
  "Guanciale": {
    de_CH: "Guanciale",
    fr_CH: "Guanciale",
    en_US: "Guanciale"
  },
  "Dalla guancia del maiale, fondamentale per carbonara, amatriciana e gricia. Grasso abbondante che si scioglie in cottura.": {
    de_CH: "Aus der Schweinebacke, grundlegend fuer Carbonara, Amatriciana und Gricia. Reichlich Fett, das beim Kochen schmilzt.",
    fr_CH: "De la joue de porc, fondamental pour la carbonara, l'amatriciana et la gricia. Graisse abondante qui fond a la cuisson.",
    en_US: "From pork cheek, fundamental for carbonara, amatriciana and gricia. Abundant fat that melts during cooking."
  },
  "Pancetta": {
    de_CH: "Pancetta",
    fr_CH: "Pancetta",
    en_US: "Pancetta"
  },
  "Dalla pancia del maiale. Puo essere tesa o arrotolata, dolce o affumicata. Versatile in cucina.": {
    de_CH: "Vom Schweinebauch. Kann flach oder gerollt, mild oder geraeuchert sein. Vielseitig in der Kueche.",
    fr_CH: "Du ventre du porc. Peut etre plate ou roulee, douce ou fumee. Polyvalente en cuisine.",
    en_US: "From pork belly. Can be flat or rolled, sweet or smoked. Versatile in cooking."
  },
  "Lardo di Colonnata IGP": {
    de_CH: "Lardo di Colonnata IGP",
    fr_CH: "Lardo di Colonnata IGP",
    en_US: "Lardo di Colonnata IGP"
  },
  "Stagionato in vasche di marmo con erbe aromatiche. Si scioglie sulla lingua. Perfetto su crostini caldi.": {
    de_CH: "In Marmorbecken mit aromatischen Kraeutern gereift. Schmilzt auf der Zunge. Perfekt auf warmen Crostini.",
    fr_CH: "Affine dans des cuves en marbre avec des herbes aromatiques. Fond sur la langue. Parfait sur des crostini chauds.",
    en_US: "Aged in marble tubs with aromatic herbs. Melts on the tongue. Perfect on warm crostini."
  },
  "Come Conservare i Salumi": {
    de_CH: "Wie man Wurstwaren aufbewahrt",
    fr_CH: "Comment conserver les charcuteries",
    en_US: "How to Store Cured Meats"
  },
  "Salumi interi: luogo fresco e asciutto, 12-15 gradi": {
    de_CH: "Ganze Wurstwaren: kuehler und trockener Ort, 12-15 Grad",
    fr_CH: "Charcuteries entieres: endroit frais et sec, 12-15 degres",
    en_US: "Whole cured meats: cool and dry place, 12-15 degrees"
  },
  "Salumi affettati: in frigo, consumare entro 3-4 giorni": {
    de_CH: "Aufgeschnittene Wurstwaren: im Kuehlschrank, innerhalb von 3-4 Tagen verbrauchen",
    fr_CH: "Charcuteries tranchees: au refrigerateur, consommer dans les 3-4 jours",
    en_US: "Sliced cured meats: in refrigerator, consume within 3-4 days"
  },
  "Avvolti in carta alimentare, mai nella plastica": {
    de_CH: "In Lebensmittelpapier eingewickelt, niemals in Plastik",
    fr_CH: "Enveloppes dans du papier alimentaire, jamais dans du plastique",
    en_US: "Wrapped in food paper, never in plastic"
  },
  "Togliere dal frigo 15 minuti prima di servire": {
    de_CH: "15 Minuten vor dem Servieren aus dem Kuehlschrank nehmen",
    fr_CH: "Sortir du refrigerateur 15 minutes avant de servir",
    en_US: "Remove from refrigerator 15 minutes before serving"
  },
  "Abbinamenti Classici": {
    de_CH: "Klassische Kombinationen",
    fr_CH: "Accords Classiques",
    en_US: "Classic Pairings"
  },
  "Prosciutto crudo con melone o fichi": {
    de_CH: "Rohschinken mit Melone oder Feigen",
    fr_CH: "Jambon cru avec melon ou figues",
    en_US: "Raw ham with melon or figs"
  },
  "Mortadella con pane fresco": {
    de_CH: "Mortadella mit frischem Brot",
    fr_CH: "Mortadelle avec du pain frais",
    en_US: "Mortadella with fresh bread"
  },
  "Bresaola con rucola e parmigiano": {
    de_CH: "Bresaola mit Rucola und Parmesan",
    fr_CH: "Bresaola avec roquette et parmesan",
    en_US: "Bresaola with arugula and parmesan"
  },
  "Speck con formaggi di montagna": {
    de_CH: "Speck mit Bergkaese",
    fr_CH: "Speck avec fromages de montagne",
    en_US: "Speck with mountain cheeses"
  },
  "La Selezione LAPA": {
    de_CH: "Die LAPA-Auswahl",
    fr_CH: "La selection LAPA",
    en_US: "The LAPA Selection"
  },
  "LAPA importa i migliori salumi italiani direttamente dai produttori. La nostra selezione include:": {
    de_CH: "LAPA importiert die besten italienischen Wurstwaren direkt von den Herstellern. Unsere Auswahl umfasst:",
    fr_CH: "LAPA importe les meilleures charcuteries italiennes directement des producteurs. Notre selection comprend:",
    en_US: "LAPA imports the best Italian cured meats directly from producers. Our selection includes:"
  },
  "Prosciutti DOP stagionati": {
    de_CH: "Gereifte DOP-Schinken",
    fr_CH: "Jambons DOP affines",
    en_US: "Aged DOP hams"
  },
  "Mortadella Bologna autentica": {
    de_CH: "Authentische Mortadella Bologna",
    fr_CH: "Mortadelle Bologna authentique",
    en_US: "Authentic Bologna Mortadella"
  },
  "Guanciale e pancetta per la cucina": {
    de_CH: "Guanciale und Pancetta zum Kochen",
    fr_CH: "Guanciale et pancetta pour la cuisine",
    en_US: "Guanciale and pancetta for cooking"
  },
  "Salumi regionali selezionati": {
    de_CH: "Ausgewaehlte regionale Wurstwaren",
    fr_CH: "Charcuteries regionales selectionnees",
    en_US: "Selected regional cured meats"
  },
  "Conclusione": {
    de_CH: "Fazit",
    fr_CH: "Conclusion",
    en_US: "Conclusion"
  },
  "I salumi italiani sono molto piu che semplici affettati: sono espressione di territorio, tradizione e artigianalita. Offrire salumi di qualita significa valorizzare l'autentica gastronomia italiana.": {
    de_CH: "Italienische Wurstwaren sind viel mehr als nur Aufschnitt: Sie sind Ausdruck von Terroir, Tradition und Handwerkskunst. Qualitaetswurstwaren anzubieten bedeutet, die authentische italienische Gastronomie zu wuerdigen.",
    fr_CH: "Les charcuteries italiennes sont bien plus que de simples tranches: elles sont l'expression d'un terroir, d'une tradition et d'un savoir-faire artisanal. Offrir des charcuteries de qualite signifie valoriser l'authentique gastronomie italienne.",
    en_US: "Italian cured meats are much more than simple cold cuts: they are an expression of territory, tradition and craftsmanship. Offering quality cured meats means valuing authentic Italian gastronomy."
  }
};

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 87: SALUMI ITALIANI ===\n');

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

  console.log('\n✅ ARTICOLO 87 COMPLETATO!');
}

main();
