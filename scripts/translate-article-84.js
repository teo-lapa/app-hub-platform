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

const POST_ID = 84;

// Contenuto ITALIANO
const ITALIAN_CONTENT = `<section class="s_text_block pt40 pb40 o_colored_level" data-snippet="s_text_block">
<div class="container">
<h2>L'Eccellenza Casearia Italiana</h2>
<p>I formaggi DOP italiani rappresentano il meglio della tradizione casearia. La certificazione DOP (Denominazione di Origine Protetta) garantisce che ogni formaggio sia prodotto seguendo metodi tradizionali in zone geografiche specifiche.</p>

<h3>I Principali Formaggi DOP</h3>

<h4>Parmigiano Reggiano DOP</h4>
<p>Il re dei formaggi italiani. Prodotto in Emilia-Romagna con latte crudo di vacca. Stagionatura minima di 12 mesi, ma raggiunge l'eccellenza a 24-36 mesi. Perfetto grattugiato su pasta, in scaglie su insalate, o da solo.</p>

<h4>Grana Padano DOP</h4>
<p>Simile al Parmigiano ma prodotto nella Pianura Padana con latte parzialmente scremato. Gusto piu delicato, stagionatura da 9 a oltre 20 mesi. Ottimo rapporto qualita-prezzo.</p>

<h4>Gorgonzola DOP</h4>
<p>Formaggio erborinato prodotto in Lombardia e Piemonte. Due varianti: dolce (cremoso e delicato) e piccante (piu stagionato e intenso). Perfetto per risotti e salse.</p>

<h4>Pecorino Romano DOP</h4>
<p>Formaggio di latte di pecora, protagonista della carbonara e dell'amatriciana. Sapore intenso e salato. Stagionatura minima 8 mesi.</p>

<h4>Mozzarella di Bufala Campana DOP</h4>
<p>Prodotta con latte di bufala in Campania. Consistenza morbida, sapore delicato e leggermente acidulo. Da consumare freschissima.</p>

<h3>Come Riconoscere un DOP Autentico</h3>
<ul>
<li>Cerca il marchio DOP sulla confezione</li>
<li>Verifica il consorzio di tutela</li>
<li>Controlla la zona di produzione</li>
<li>Diffida di prezzi troppo bassi</li>
</ul>

<h3>Come Conservarli</h3>
<ul>
<li>Formaggi stagionati: in frigo avvolti in carta alimentare</li>
<li>Formaggi freschi: nel loro liquido, consumare in fretta</li>
<li>Temperatura ideale: tra 4 e 8 gradi</li>
<li>Mai congelare i formaggi freschi</li>
</ul>

<h3>La Selezione LAPA</h3>
<p>LAPA importa direttamente dall'Italia i migliori formaggi DOP. La nostra selezione include:</p>
<ul>
<li>Parmigiano Reggiano di diverse stagionature</li>
<li>Grana Padano selezionato</li>
<li>Gorgonzola dolce e piccante</li>
<li>Pecorino Romano e Sardo</li>
<li>Mozzarella di bufala freschissima</li>
</ul>

<h3>Conclusione</h3>
<p>I formaggi DOP sono garanzia di qualita e autenticita. Offrire ai tuoi clienti formaggi certificati significa distinguerti dalla concorrenza e valorizzare la vera tradizione italiana.</p>
</div>
</section>`;

// Traduzioni per ogni segmento
const TRANSLATIONS = {
  "L'Eccellenza Casearia Italiana": {
    de_CH: "Die italienische Kaese-Exzellenz",
    fr_CH: "L'excellence fromagere italienne",
    en_US: "Italian Cheese Excellence"
  },
  "I formaggi DOP italiani rappresentano il meglio della tradizione casearia. La certificazione DOP (Denominazione di Origine Protetta) garantisce che ogni formaggio sia prodotto seguendo metodi tradizionali in zone geografiche specifiche.": {
    de_CH: "Italienische DOP-Kaese repraesentieren das Beste der Kaesetradition. Die DOP-Zertifizierung (Geschuetzte Ursprungsbezeichnung) garantiert, dass jeder Kaese nach traditionellen Methoden in bestimmten geografischen Gebieten hergestellt wird.",
    fr_CH: "Les fromages DOP italiens representent le meilleur de la tradition fromagere. La certification DOP (Denomination d'Origine Protegee) garantit que chaque fromage est produit selon des methodes traditionnelles dans des zones geographiques specifiques.",
    en_US: "Italian DOP cheeses represent the best of cheese-making tradition. The DOP certification (Protected Designation of Origin) guarantees that each cheese is produced following traditional methods in specific geographical areas."
  },
  "I Principali Formaggi DOP": {
    de_CH: "Die wichtigsten DOP-Kaese",
    fr_CH: "Les principaux fromages DOP",
    en_US: "The Main DOP Cheeses"
  },
  "Parmigiano Reggiano DOP": {
    de_CH: "Parmigiano Reggiano DOP",
    fr_CH: "Parmigiano Reggiano DOP",
    en_US: "Parmigiano Reggiano DOP"
  },
  "Il re dei formaggi italiani. Prodotto in Emilia-Romagna con latte crudo di vacca. Stagionatura minima di 12 mesi, ma raggiunge l'eccellenza a 24-36 mesi. Perfetto grattugiato su pasta, in scaglie su insalate, o da solo.": {
    de_CH: "Der Koenig der italienischen Kaese. Hergestellt in der Emilia-Romagna aus roher Kuhmilch. Mindestens 12 Monate Reifung, erreicht aber Exzellenz bei 24-36 Monaten. Perfekt gerieben auf Pasta, in Stuecken auf Salaten oder pur.",
    fr_CH: "Le roi des fromages italiens. Produit en Emilie-Romagne avec du lait cru de vache. Affinage minimum de 12 mois, mais atteint l'excellence a 24-36 mois. Parfait rape sur les pates, en copeaux sur les salades, ou seul.",
    en_US: "The king of Italian cheeses. Produced in Emilia-Romagna with raw cow's milk. Minimum aging of 12 months, but reaches excellence at 24-36 months. Perfect grated on pasta, in flakes on salads, or alone."
  },
  "Grana Padano DOP": {
    de_CH: "Grana Padano DOP",
    fr_CH: "Grana Padano DOP",
    en_US: "Grana Padano DOP"
  },
  "Simile al Parmigiano ma prodotto nella Pianura Padana con latte parzialmente scremato. Gusto piu delicato, stagionatura da 9 a oltre 20 mesi. Ottimo rapporto qualita-prezzo.": {
    de_CH: "Aehnlich wie Parmigiano, aber in der Po-Ebene aus teilentrahmter Milch hergestellt. Delikaterer Geschmack, Reifung von 9 bis ueber 20 Monaten. Ausgezeichnetes Preis-Leistungs-Verhaeltnis.",
    fr_CH: "Similaire au Parmigiano mais produit dans la plaine du Po avec du lait partiellement ecreme. Gout plus delicat, affinage de 9 a plus de 20 mois. Excellent rapport qualite-prix.",
    en_US: "Similar to Parmigiano but produced in the Po Valley with partially skimmed milk. More delicate taste, aging from 9 to over 20 months. Excellent value for money."
  },
  "Gorgonzola DOP": {
    de_CH: "Gorgonzola DOP",
    fr_CH: "Gorgonzola DOP",
    en_US: "Gorgonzola DOP"
  },
  "Formaggio erborinato prodotto in Lombardia e Piemonte. Due varianti: dolce (cremoso e delicato) e piccante (piu stagionato e intenso). Perfetto per risotti e salse.": {
    de_CH: "Blauschimmelkaese, hergestellt in der Lombardei und im Piemont. Zwei Varianten: mild (cremig und delikat) und scharf (reifer und intensiver). Perfekt fuer Risottos und Saucen.",
    fr_CH: "Fromage a pate persillee produit en Lombardie et au Piemont. Deux variantes: doux (cremeux et delicat) et piquant (plus affine et intense). Parfait pour les risottos et les sauces.",
    en_US: "Blue cheese produced in Lombardy and Piedmont. Two variants: sweet (creamy and delicate) and sharp (more aged and intense). Perfect for risottos and sauces."
  },
  "Pecorino Romano DOP": {
    de_CH: "Pecorino Romano DOP",
    fr_CH: "Pecorino Romano DOP",
    en_US: "Pecorino Romano DOP"
  },
  "Formaggio di latte di pecora, protagonista della carbonara e dell'amatriciana. Sapore intenso e salato. Stagionatura minima 8 mesi.": {
    de_CH: "Schafsmilchkaese, Protagonist der Carbonara und Amatriciana. Intensiver und salziger Geschmack. Mindestens 8 Monate Reifung.",
    fr_CH: "Fromage au lait de brebis, protagoniste de la carbonara et de l'amatriciana. Saveur intense et salee. Affinage minimum de 8 mois.",
    en_US: "Sheep's milk cheese, protagonist of carbonara and amatriciana. Intense and salty flavor. Minimum aging 8 months."
  },
  "Mozzarella di Bufala Campana DOP": {
    de_CH: "Mozzarella di Bufala Campana DOP",
    fr_CH: "Mozzarella di Bufala Campana DOP",
    en_US: "Mozzarella di Bufala Campana DOP"
  },
  "Prodotta con latte di bufala in Campania. Consistenza morbida, sapore delicato e leggermente acidulo. Da consumare freschissima.": {
    de_CH: "Hergestellt aus Bueffelmilch in Kampanien. Weiche Konsistenz, delikater und leicht saeuerlicher Geschmack. Sehr frisch zu verzehren.",
    fr_CH: "Produite avec du lait de bufflonne en Campanie. Consistance moelleuse, saveur delicate et legerement acidulee. A consommer tres fraiche.",
    en_US: "Produced with buffalo milk in Campania. Soft consistency, delicate and slightly acidic flavor. To be consumed very fresh."
  },
  "Come Riconoscere un DOP Autentico": {
    de_CH: "Wie man einen authentischen DOP erkennt",
    fr_CH: "Comment reconnaitre un DOP authentique",
    en_US: "How to Recognize an Authentic DOP"
  },
  "Cerca il marchio DOP sulla confezione": {
    de_CH: "Suchen Sie das DOP-Zeichen auf der Verpackung",
    fr_CH: "Recherchez le logo DOP sur l'emballage",
    en_US: "Look for the DOP mark on the packaging"
  },
  "Verifica il consorzio di tutela": {
    de_CH: "Ueberpruefen Sie das Schutzkonsortium",
    fr_CH: "Verifiez le consortium de protection",
    en_US: "Verify the protection consortium"
  },
  "Controlla la zona di produzione": {
    de_CH: "Ueberpruefen Sie das Produktionsgebiet",
    fr_CH: "Verifiez la zone de production",
    en_US: "Check the production area"
  },
  "Diffida di prezzi troppo bassi": {
    de_CH: "Seien Sie bei zu niedrigen Preisen misstrauisch",
    fr_CH: "Mefiez-vous des prix trop bas",
    en_US: "Be wary of prices that are too low"
  },
  "Come Conservarli": {
    de_CH: "Wie man sie aufbewahrt",
    fr_CH: "Comment les conserver",
    en_US: "How to Store Them"
  },
  "Formaggi stagionati: in frigo avvolti in carta alimentare": {
    de_CH: "Gereifte Kaese: im Kuehlschrank in Lebensmittelpapier eingewickelt",
    fr_CH: "Fromages affines: au refrigerateur enveloppes dans du papier alimentaire",
    en_US: "Aged cheeses: in refrigerator wrapped in food paper"
  },
  "Formaggi freschi: nel loro liquido, consumare in fretta": {
    de_CH: "Frischkaese: in ihrer Fluessigkeit, schnell verbrauchen",
    fr_CH: "Fromages frais: dans leur liquide, consommer rapidement",
    en_US: "Fresh cheeses: in their liquid, consume quickly"
  },
  "Temperatura ideale: tra 4 e 8 gradi": {
    de_CH: "Ideale Temperatur: zwischen 4 und 8 Grad",
    fr_CH: "Temperature ideale: entre 4 et 8 degres",
    en_US: "Ideal temperature: between 4 and 8 degrees"
  },
  "Mai congelare i formaggi freschi": {
    de_CH: "Niemals Frischkaese einfrieren",
    fr_CH: "Ne jamais congeler les fromages frais",
    en_US: "Never freeze fresh cheeses"
  },
  "La Selezione LAPA": {
    de_CH: "Die LAPA-Auswahl",
    fr_CH: "La selection LAPA",
    en_US: "The LAPA Selection"
  },
  "LAPA importa direttamente dall'Italia i migliori formaggi DOP. La nostra selezione include:": {
    de_CH: "LAPA importiert die besten DOP-Kaese direkt aus Italien. Unsere Auswahl umfasst:",
    fr_CH: "LAPA importe directement d'Italie les meilleurs fromages DOP. Notre selection comprend:",
    en_US: "LAPA imports the best DOP cheeses directly from Italy. Our selection includes:"
  },
  "Parmigiano Reggiano di diverse stagionature": {
    de_CH: "Parmigiano Reggiano verschiedener Reifegrade",
    fr_CH: "Parmigiano Reggiano de differents affinages",
    en_US: "Parmigiano Reggiano of different aging periods"
  },
  "Grana Padano selezionato": {
    de_CH: "Ausgewaehlter Grana Padano",
    fr_CH: "Grana Padano selectionne",
    en_US: "Selected Grana Padano"
  },
  "Gorgonzola dolce e piccante": {
    de_CH: "Gorgonzola mild und scharf",
    fr_CH: "Gorgonzola doux et piquant",
    en_US: "Sweet and sharp Gorgonzola"
  },
  "Pecorino Romano e Sardo": {
    de_CH: "Pecorino Romano und Sardo",
    fr_CH: "Pecorino Romano et Sardo",
    en_US: "Pecorino Romano and Sardo"
  },
  "Mozzarella di bufala freschissima": {
    de_CH: "Frischeste Bueffelmozzarella",
    fr_CH: "Mozzarella di bufala tres fraiche",
    en_US: "Very fresh buffalo mozzarella"
  },
  "Conclusione": {
    de_CH: "Fazit",
    fr_CH: "Conclusion",
    en_US: "Conclusion"
  },
  "I formaggi DOP sono garanzia di qualita e autenticita. Offrire ai tuoi clienti formaggi certificati significa distinguerti dalla concorrenza e valorizzare la vera tradizione italiana.": {
    de_CH: "DOP-Kaese sind eine Garantie fuer Qualitaet und Authentizitaet. Ihren Kunden zertifizierte Kaese anzubieten bedeutet, sich von der Konkurrenz abzuheben und die wahre italienische Tradition zu schaetzen.",
    fr_CH: "Les fromages DOP sont une garantie de qualite et d'authenticite. Offrir a vos clients des fromages certifies signifie vous distinguer de la concurrence et valoriser la vraie tradition italienne.",
    en_US: "DOP cheeses are a guarantee of quality and authenticity. Offering your customers certified cheeses means standing out from the competition and valuing true Italian tradition."
  }
};

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 84: FORMAGGI DOP ITALIANI ===\n');

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

  console.log('\n✅ ARTICOLO 84 COMPLETATO!');
}

main();
