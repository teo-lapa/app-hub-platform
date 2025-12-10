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

const POST_ID = 86;

// Contenuto ITALIANO
const ITALIAN_CONTENT = `<section class="s_text_block pt40 pb40 o_colored_level" data-snippet="s_text_block">
<div class="container">
<h2>Gli Strumenti del Mestiere</h2>
<p>Aprire una pizzeria richiede non solo ingredienti di qualita, ma anche le attrezzature giuste. Ecco una guida alle attrezzature essenziali per una pizzeria professionale.</p>

<h3>Il Forno: Il Cuore della Pizzeria</h3>
<p>Il forno e l'investimento piu importante. Le opzioni principali:</p>

<h4>Forno a Legna</h4>
<ul>
<li>Temperature fino a 450-500 gradi Celsius</li>
<li>Cottura in 60-90 secondi</li>
<li>Sapore unico e autentico</li>
<li>Richiede esperienza e manutenzione</li>
</ul>

<h4>Forno a Gas</h4>
<ul>
<li>Temperature elevate e costanti</li>
<li>Facile da controllare</li>
<li>Meno romantico ma piu pratico</li>
<li>Ottimo per alto volume</li>
</ul>

<h4>Forno Elettrico</h4>
<ul>
<li>Controllo preciso della temperatura</li>
<li>Ideale per pizzerie in citta</li>
<li>Nessuna canna fumaria necessaria</li>
<li>Costi energetici piu alti</li>
</ul>

<h3>L'Impastatrice</h3>
<p>Per impasti consistenti e di qualita, un'impastatrice professionale e indispensabile:</p>
<ul>
<li>Capacita adeguata al volume di produzione</li>
<li>Spirale o forcella a seconda dell'impasto</li>
<li>Velocita regolabile</li>
<li>Facile da pulire</li>
</ul>

<h3>Il Banco di Lavorazione</h3>
<ul>
<li>Piano in acciaio inox o marmo</li>
<li>Altezza ergonomica</li>
<li>Cassetti refrigerati per gli ingredienti</li>
<li>Spazio sufficiente per lavorare</li>
</ul>

<h3>Accessori Essenziali</h3>
<ul>
<li>Pale per pizza in legno e alluminio</li>
<li>Tagliere rotante</li>
<li>Rotella tagliapizza</li>
<li>Contenitori per ingredienti</li>
<li>Bilancia di precisione</li>
<li>Termometro per forno</li>
</ul>

<h3>Attrezzature per la Conservazione</h3>
<ul>
<li>Frigorifero professionale</li>
<li>Cella per la lievitazione controllata</li>
<li>Abbattitore per la mozzarella</li>
<li>Vetrina refrigerata per esposizione</li>
</ul>

<h3>Consigli per l'Acquisto</h3>
<ul>
<li>Investi in qualita: le attrezzature dureranno anni</li>
<li>Considera il volume di produzione previsto</li>
<li>Verifica le normative locali</li>
<li>Pianifica lo spazio prima di acquistare</li>
</ul>

<h3>Conclusione</h3>
<p>Le attrezzature giuste sono un investimento nel successo della tua pizzeria. Scegli con attenzione e non risparmiare sugli elementi fondamentali.</p>
</div>
</section>`;

// Traduzioni per ogni segmento
const TRANSLATIONS = {
  "Gli Strumenti del Mestiere": {
    de_CH: "Die Werkzeuge des Handwerks",
    fr_CH: "Les outils du metier",
    en_US: "The Tools of the Trade"
  },
  "Aprire una pizzeria richiede non solo ingredienti di qualita, ma anche le attrezzature giuste. Ecco una guida alle attrezzature essenziali per una pizzeria professionale.": {
    de_CH: "Eine Pizzeria zu eroeffnen erfordert nicht nur hochwertige Zutaten, sondern auch die richtige Ausstattung. Hier ist ein Leitfaden zur wesentlichen Ausstattung fuer eine professionelle Pizzeria.",
    fr_CH: "Ouvrir une pizzeria necessite non seulement des ingredients de qualite, mais aussi le bon equipement. Voici un guide des equipements essentiels pour une pizzeria professionnelle.",
    en_US: "Opening a pizzeria requires not only quality ingredients, but also the right equipment. Here's a guide to essential equipment for a professional pizzeria."
  },
  "Il Forno: Il Cuore della Pizzeria": {
    de_CH: "Der Ofen: Das Herz der Pizzeria",
    fr_CH: "Le Four: Le Coeur de la Pizzeria",
    en_US: "The Oven: The Heart of the Pizzeria"
  },
  "Il forno e l'investimento piu importante. Le opzioni principali:": {
    de_CH: "Der Ofen ist die wichtigste Investition. Die Hauptoptionen:",
    fr_CH: "Le four est l'investissement le plus important. Les principales options:",
    en_US: "The oven is the most important investment. The main options:"
  },
  "Forno a Legna": {
    de_CH: "Holzofen",
    fr_CH: "Four a bois",
    en_US: "Wood-Fired Oven"
  },
  "Temperature fino a 450-500 gradi Celsius": {
    de_CH: "Temperaturen bis zu 450-500 Grad Celsius",
    fr_CH: "Temperatures jusqu'a 450-500 degres Celsius",
    en_US: "Temperatures up to 450-500 degrees Celsius"
  },
  "Cottura in 60-90 secondi": {
    de_CH: "Backzeit von 60-90 Sekunden",
    fr_CH: "Cuisson en 60-90 secondes",
    en_US: "Cooking in 60-90 seconds"
  },
  "Sapore unico e autentico": {
    de_CH: "Einzigartiger und authentischer Geschmack",
    fr_CH: "Saveur unique et authentique",
    en_US: "Unique and authentic flavor"
  },
  "Richiede esperienza e manutenzione": {
    de_CH: "Erfordert Erfahrung und Wartung",
    fr_CH: "Necessite de l'experience et de l'entretien",
    en_US: "Requires experience and maintenance"
  },
  "Forno a Gas": {
    de_CH: "Gasofen",
    fr_CH: "Four a gaz",
    en_US: "Gas Oven"
  },
  "Temperature elevate e costanti": {
    de_CH: "Hohe und konstante Temperaturen",
    fr_CH: "Temperatures elevees et constantes",
    en_US: "High and constant temperatures"
  },
  "Facile da controllare": {
    de_CH: "Einfach zu kontrollieren",
    fr_CH: "Facile a controler",
    en_US: "Easy to control"
  },
  "Meno romantico ma piu pratico": {
    de_CH: "Weniger romantisch, aber praktischer",
    fr_CH: "Moins romantique mais plus pratique",
    en_US: "Less romantic but more practical"
  },
  "Ottimo per alto volume": {
    de_CH: "Hervorragend fuer hohe Produktionsmengen",
    fr_CH: "Excellent pour un volume eleve",
    en_US: "Excellent for high volume"
  },
  "Forno Elettrico": {
    de_CH: "Elektroofen",
    fr_CH: "Four electrique",
    en_US: "Electric Oven"
  },
  "Controllo preciso della temperatura": {
    de_CH: "Praezise Temperaturkontrolle",
    fr_CH: "Controle precis de la temperature",
    en_US: "Precise temperature control"
  },
  "Ideale per pizzerie in citta": {
    de_CH: "Ideal fuer Pizzerien in der Stadt",
    fr_CH: "Ideal pour les pizzerias en ville",
    en_US: "Ideal for city pizzerias"
  },
  "Nessuna canna fumaria necessaria": {
    de_CH: "Kein Schornstein erforderlich",
    fr_CH: "Aucune cheminee necessaire",
    en_US: "No chimney needed"
  },
  "Costi energetici piu alti": {
    de_CH: "Hoehere Energiekosten",
    fr_CH: "Couts energetiques plus eleves",
    en_US: "Higher energy costs"
  },
  "L'Impastatrice": {
    de_CH: "Die Knetmaschine",
    fr_CH: "Le Petrin",
    en_US: "The Dough Mixer"
  },
  "Per impasti consistenti e di qualita, un'impastatrice professionale e indispensabile:": {
    de_CH: "Fuer konsistente und hochwertige Teige ist eine professionelle Knetmaschine unverzichtbar:",
    fr_CH: "Pour des pates consistantes et de qualite, un petrin professionnel est indispensable:",
    en_US: "For consistent and quality doughs, a professional mixer is essential:"
  },
  "Capacita adeguata al volume di produzione": {
    de_CH: "Kapazitaet angemessen zum Produktionsvolumen",
    fr_CH: "Capacite adaptee au volume de production",
    en_US: "Capacity adequate for production volume"
  },
  "Spirale o forcella a seconda dell'impasto": {
    de_CH: "Spirale oder Gabel je nach Teig",
    fr_CH: "Spirale ou fourche selon la pate",
    en_US: "Spiral or fork depending on the dough"
  },
  "Velocita regolabile": {
    de_CH: "Einstellbare Geschwindigkeit",
    fr_CH: "Vitesse reglable",
    en_US: "Adjustable speed"
  },
  "Facile da pulire": {
    de_CH: "Leicht zu reinigen",
    fr_CH: "Facile a nettoyer",
    en_US: "Easy to clean"
  },
  "Il Banco di Lavorazione": {
    de_CH: "Die Arbeitsfläche",
    fr_CH: "Le Plan de Travail",
    en_US: "The Work Bench"
  },
  "Piano in acciaio inox o marmo": {
    de_CH: "Edelstahl- oder Marmorplatte",
    fr_CH: "Plan en acier inoxydable ou marbre",
    en_US: "Stainless steel or marble surface"
  },
  "Altezza ergonomica": {
    de_CH: "Ergonomische Hoehe",
    fr_CH: "Hauteur ergonomique",
    en_US: "Ergonomic height"
  },
  "Cassetti refrigerati per gli ingredienti": {
    de_CH: "Gekuehlte Schubladen fuer Zutaten",
    fr_CH: "Tiroirs refrigeres pour les ingredients",
    en_US: "Refrigerated drawers for ingredients"
  },
  "Spazio sufficiente per lavorare": {
    de_CH: "Genuegend Platz zum Arbeiten",
    fr_CH: "Espace suffisant pour travailler",
    en_US: "Sufficient space to work"
  },
  "Accessori Essenziali": {
    de_CH: "Wesentliches Zubehoer",
    fr_CH: "Accessoires Essentiels",
    en_US: "Essential Accessories"
  },
  "Pale per pizza in legno e alluminio": {
    de_CH: "Pizzaschaufeln aus Holz und Aluminium",
    fr_CH: "Pelles a pizza en bois et aluminium",
    en_US: "Wooden and aluminum pizza peels"
  },
  "Tagliere rotante": {
    de_CH: "Drehbares Schneidebrett",
    fr_CH: "Planche a decouper rotative",
    en_US: "Rotating cutting board"
  },
  "Rotella tagliapizza": {
    de_CH: "Pizzaschneider",
    fr_CH: "Roulette coupe-pizza",
    en_US: "Pizza cutter wheel"
  },
  "Contenitori per ingredienti": {
    de_CH: "Behaelter fuer Zutaten",
    fr_CH: "Conteneurs pour ingredients",
    en_US: "Ingredient containers"
  },
  "Bilancia di precisione": {
    de_CH: "Praezisionswaage",
    fr_CH: "Balance de precision",
    en_US: "Precision scale"
  },
  "Termometro per forno": {
    de_CH: "Ofenthermometer",
    fr_CH: "Thermometre de four",
    en_US: "Oven thermometer"
  },
  "Attrezzature per la Conservazione": {
    de_CH: "Kuehlgeraete",
    fr_CH: "Equipements de Conservation",
    en_US: "Storage Equipment"
  },
  "Frigorifero professionale": {
    de_CH: "Professioneller Kuehlschrank",
    fr_CH: "Refrigerateur professionnel",
    en_US: "Professional refrigerator"
  },
  "Cella per la lievitazione controllata": {
    de_CH: "Gaerzelle mit kontrollierter Temperatur",
    fr_CH: "Chambre de fermentation controlee",
    en_US: "Controlled proofing chamber"
  },
  "Abbattitore per la mozzarella": {
    de_CH: "Schnellkuehler fuer Mozzarella",
    fr_CH: "Cellule de refroidissement pour la mozzarella",
    en_US: "Blast chiller for mozzarella"
  },
  "Vetrina refrigerata per esposizione": {
    de_CH: "Gekuehlte Auslage",
    fr_CH: "Vitrine refrigeree pour exposition",
    en_US: "Refrigerated display case"
  },
  "Consigli per l'Acquisto": {
    de_CH: "Kauftipps",
    fr_CH: "Conseils d'Achat",
    en_US: "Purchasing Tips"
  },
  "Investi in qualita: le attrezzature dureranno anni": {
    de_CH: "Investieren Sie in Qualitaet: Die Ausruestung wird Jahre halten",
    fr_CH: "Investissez dans la qualite: les equipements dureront des annees",
    en_US: "Invest in quality: equipment will last for years"
  },
  "Considera il volume di produzione previsto": {
    de_CH: "Beruecksichtigen Sie das erwartete Produktionsvolumen",
    fr_CH: "Considerez le volume de production prevu",
    en_US: "Consider the expected production volume"
  },
  "Verifica le normative locali": {
    de_CH: "Ueberpruefen Sie die lokalen Vorschriften",
    fr_CH: "Verifiez les reglementations locales",
    en_US: "Check local regulations"
  },
  "Pianifica lo spazio prima di acquistare": {
    de_CH: "Planen Sie den Platz vor dem Kauf",
    fr_CH: "Planifiez l'espace avant d'acheter",
    en_US: "Plan the space before buying"
  },
  "Conclusione": {
    de_CH: "Fazit",
    fr_CH: "Conclusion",
    en_US: "Conclusion"
  },
  "Le attrezzature giuste sono un investimento nel successo della tua pizzeria. Scegli con attenzione e non risparmiare sugli elementi fondamentali.": {
    de_CH: "Die richtige Ausstattung ist eine Investition in den Erfolg Ihrer Pizzeria. Waehlen Sie sorgfaeltig und sparen Sie nicht an den grundlegenden Elementen.",
    fr_CH: "Le bon equipement est un investissement dans le succes de votre pizzeria. Choisissez avec soin et n'economisez pas sur les elements fondamentaux.",
    en_US: "The right equipment is an investment in the success of your pizzeria. Choose carefully and don't skimp on the fundamental elements."
  }
};

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 86: ATTREZZATURE PIZZERIA ===\n');

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

  console.log('\n✅ ARTICOLO 86 COMPLETATO!');
}

main();
