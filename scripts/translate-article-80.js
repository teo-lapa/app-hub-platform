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

const POST_ID = 80;

// Contenuto ITALIANO
const ITALIAN_CONTENT = `<section class="s_text_block pt40 pb40 o_colored_level" data-snippet="s_text_block">
<div class="container">
<h2>Due Protagonisti della Cucina Italiana</h2>
<p>Guanciale e pancetta sono due salumi italiani che spesso vengono confusi, ma le loro differenze sono sostanziali. Conoscerle e fondamentale per chi vuole preparare piatti autentici della tradizione italiana.</p>

<h3>Che Cos'e il Guanciale?</h3>
<p>Il guanciale e un salume ottenuto dalla guancia del maiale. Viene stagionato con sale, pepe nero e spezie aromatiche per almeno 3 mesi. Ha un sapore intenso e un alto contenuto di grasso che lo rende perfetto per sciogliersi durante la cottura.</p>

<h4>Caratteristiche del Guanciale:</h4>
<ul>
<li>Provenienza: guancia del maiale</li>
<li>Stagionatura: minimo 3 mesi</li>
<li>Sapore: intenso e aromatico</li>
<li>Grasso: abbondante, si scioglie in cottura</li>
<li>Uso tipico: carbonara, amatriciana, gricia</li>
</ul>

<h3>Che Cos'e la Pancetta?</h3>
<p>La pancetta proviene dalla pancia del maiale. Puo essere tesa (piatta) o arrotolata, stagionata o affumicata. Ha un sapore piu delicato rispetto al guanciale.</p>

<h4>Caratteristiche della Pancetta:</h4>
<ul>
<li>Provenienza: pancia del maiale</li>
<li>Varianti: tesa, arrotolata, affumicata</li>
<li>Sapore: piu delicato</li>
<li>Grasso: equilibrato con la carne</li>
<li>Uso tipico: sughi, contorni, antipasti</li>
</ul>

<h3>Quale Usare per la Carbonara?</h3>
<p>La vera carbonara romana richiede il guanciale. Il suo grasso si scioglie creando quella cremosita caratteristica che lega perfettamente con l'uovo e il pecorino. La pancetta puo essere un'alternativa, ma il risultato sara diverso.</p>

<h3>Quale Usare per l'Amatriciana?</h3>
<p>Anche l'amatriciana tradizionale prevede il guanciale. La sua intensita di sapore si sposa perfettamente con il pomodoro e il pecorino romano.</p>

<h3>Dove Trovare Guanciale di Qualita in Svizzera</h3>
<p>LAPA importa direttamente dall'Italia guanciale e pancetta di alta qualita. I nostri prodotti arrivano freschi e sono perfetti per preparare piatti autentici della tradizione italiana.</p>

<h3>Conclusione</h3>
<p>Guanciale e pancetta hanno caratteristiche diverse e non sono intercambiabili nelle ricette tradizionali. Per un risultato autentico, usa sempre l'ingrediente giusto.</p>
</div>
</section>`;

// Traduzioni per ogni segmento
const TRANSLATIONS = {
  "Due Protagonisti della Cucina Italiana": {
    de_CH: "Zwei Protagonisten der italienischen Kueche",
    fr_CH: "Deux protagonistes de la cuisine italienne",
    en_US: "Two Protagonists of Italian Cuisine"
  },
  "Guanciale e pancetta sono due salumi italiani che spesso vengono confusi, ma le loro differenze sono sostanziali. Conoscerle e fondamentale per chi vuole preparare piatti autentici della tradizione italiana.": {
    de_CH: "Guanciale und Pancetta sind zwei italienische Wurstwaren, die oft verwechselt werden, aber ihre Unterschiede sind erheblich. Sie zu kennen ist grundlegend fuer jeden, der authentische Gerichte der italienischen Tradition zubereiten moechte.",
    fr_CH: "Le guanciale et la pancetta sont deux charcuteries italiennes souvent confondues, mais leurs differences sont substantielles. Les connaitre est fondamental pour qui veut preparer des plats authentiques de la tradition italienne.",
    en_US: "Guanciale and pancetta are two Italian cured meats that are often confused, but their differences are substantial. Knowing them is fundamental for anyone who wants to prepare authentic dishes of Italian tradition."
  },
  "Che Cos'e il Guanciale?": {
    de_CH: "Was ist Guanciale?",
    fr_CH: "Qu'est-ce que le Guanciale?",
    en_US: "What is Guanciale?"
  },
  "Il guanciale e un salume ottenuto dalla guancia del maiale. Viene stagionato con sale, pepe nero e spezie aromatiche per almeno 3 mesi. Ha un sapore intenso e un alto contenuto di grasso che lo rende perfetto per sciogliersi durante la cottura.": {
    de_CH: "Guanciale ist eine Wurst aus der Schweinebacke. Sie wird mit Salz, schwarzem Pfeffer und aromatischen Gewuerzen mindestens 3 Monate gereift. Sie hat einen intensiven Geschmack und einen hohen Fettgehalt, der sie perfekt zum Schmelzen beim Kochen macht.",
    fr_CH: "Le guanciale est une charcuterie obtenue a partir de la joue de porc. Il est affine avec du sel, du poivre noir et des epices aromatiques pendant au moins 3 mois. Il a un gout intense et une teneur elevee en graisse qui le rend parfait pour fondre pendant la cuisson.",
    en_US: "Guanciale is a cured meat made from pork cheek. It is aged with salt, black pepper and aromatic spices for at least 3 months. It has an intense flavor and high fat content that makes it perfect for melting during cooking."
  },
  "Caratteristiche del Guanciale:": {
    de_CH: "Eigenschaften des Guanciale:",
    fr_CH: "Caracteristiques du Guanciale:",
    en_US: "Characteristics of Guanciale:"
  },
  "Provenienza: guancia del maiale": {
    de_CH: "Herkunft: Schweinebacke",
    fr_CH: "Provenance: joue de porc",
    en_US: "Origin: pork cheek"
  },
  "Stagionatura: minimo 3 mesi": {
    de_CH: "Reifung: mindestens 3 Monate",
    fr_CH: "Affinage: minimum 3 mois",
    en_US: "Aging: minimum 3 months"
  },
  "Sapore: intenso e aromatico": {
    de_CH: "Geschmack: intensiv und aromatisch",
    fr_CH: "Saveur: intense et aromatique",
    en_US: "Flavor: intense and aromatic"
  },
  "Grasso: abbondante, si scioglie in cottura": {
    de_CH: "Fett: reichlich, schmilzt beim Kochen",
    fr_CH: "Graisse: abondante, fond a la cuisson",
    en_US: "Fat: abundant, melts during cooking"
  },
  "Uso tipico: carbonara, amatriciana, gricia": {
    de_CH: "Typische Verwendung: Carbonara, Amatriciana, Gricia",
    fr_CH: "Utilisation typique: carbonara, amatriciana, gricia",
    en_US: "Typical use: carbonara, amatriciana, gricia"
  },
  "Che Cos'e la Pancetta?": {
    de_CH: "Was ist Pancetta?",
    fr_CH: "Qu'est-ce que la Pancetta?",
    en_US: "What is Pancetta?"
  },
  "La pancetta proviene dalla pancia del maiale. Puo essere tesa (piatta) o arrotolata, stagionata o affumicata. Ha un sapore piu delicato rispetto al guanciale.": {
    de_CH: "Pancetta stammt vom Schweinebauch. Sie kann flach oder gerollt, gereift oder geraeuchert sein. Sie hat einen delikateren Geschmack als Guanciale.",
    fr_CH: "La pancetta provient du ventre du porc. Elle peut etre plate ou roulee, affinee ou fumee. Elle a un gout plus delicat que le guanciale.",
    en_US: "Pancetta comes from the pork belly. It can be flat or rolled, cured or smoked. It has a more delicate flavor than guanciale."
  },
  "Caratteristiche della Pancetta:": {
    de_CH: "Eigenschaften der Pancetta:",
    fr_CH: "Caracteristiques de la Pancetta:",
    en_US: "Characteristics of Pancetta:"
  },
  "Provenienza: pancia del maiale": {
    de_CH: "Herkunft: Schweinebauch",
    fr_CH: "Provenance: ventre de porc",
    en_US: "Origin: pork belly"
  },
  "Varianti: tesa, arrotolata, affumicata": {
    de_CH: "Varianten: flach, gerollt, geraeuchert",
    fr_CH: "Variantes: plate, roulee, fumee",
    en_US: "Variants: flat, rolled, smoked"
  },
  "Sapore: piu delicato": {
    de_CH: "Geschmack: delikater",
    fr_CH: "Saveur: plus delicate",
    en_US: "Flavor: more delicate"
  },
  "Grasso: equilibrato con la carne": {
    de_CH: "Fett: ausgewogen mit dem Fleisch",
    fr_CH: "Graisse: equilibree avec la viande",
    en_US: "Fat: balanced with the meat"
  },
  "Uso tipico: sughi, contorni, antipasti": {
    de_CH: "Typische Verwendung: Saucen, Beilagen, Vorspeisen",
    fr_CH: "Utilisation typique: sauces, accompagnements, antipasti",
    en_US: "Typical use: sauces, side dishes, appetizers"
  },
  "Quale Usare per la Carbonara?": {
    de_CH: "Welches fuer die Carbonara verwenden?",
    fr_CH: "Lequel utiliser pour la Carbonara?",
    en_US: "Which One to Use for Carbonara?"
  },
  "La vera carbonara romana richiede il guanciale. Il suo grasso si scioglie creando quella cremosita caratteristica che lega perfettamente con l'uovo e il pecorino. La pancetta puo essere un'alternativa, ma il risultato sara diverso.": {
    de_CH: "Die echte roemische Carbonara erfordert Guanciale. Sein Fett schmilzt und schafft diese charakteristische Cremigkeit, die perfekt mit Ei und Pecorino harmoniert. Pancetta kann eine Alternative sein, aber das Ergebnis wird anders sein.",
    fr_CH: "La vraie carbonara romaine exige le guanciale. Sa graisse fond en creant cette onctuosite caracteristique qui se lie parfaitement avec l'oeuf et le pecorino. La pancetta peut etre une alternative, mais le resultat sera different.",
    en_US: "True Roman carbonara requires guanciale. Its fat melts creating that characteristic creaminess that binds perfectly with egg and pecorino. Pancetta can be an alternative, but the result will be different."
  },
  "Quale Usare per l'Amatriciana?": {
    de_CH: "Welches fuer die Amatriciana verwenden?",
    fr_CH: "Lequel utiliser pour l'Amatriciana?",
    en_US: "Which One to Use for Amatriciana?"
  },
  "Anche l'amatriciana tradizionale prevede il guanciale. La sua intensita di sapore si sposa perfettamente con il pomodoro e il pecorino romano.": {
    de_CH: "Auch die traditionelle Amatriciana verlangt Guanciale. Ihre Geschmacksintensitaet passt perfekt zu Tomate und Pecorino Romano.",
    fr_CH: "L'amatriciana traditionnelle prevoit egalement le guanciale. Son intensite de saveur s'associe parfaitement avec la tomate et le pecorino romano.",
    en_US: "Traditional amatriciana also calls for guanciale. Its flavor intensity pairs perfectly with tomato and pecorino romano."
  },
  "Dove Trovare Guanciale di Qualita in Svizzera": {
    de_CH: "Wo man in der Schweiz hochwertigen Guanciale findet",
    fr_CH: "Ou trouver du Guanciale de qualite en Suisse",
    en_US: "Where to Find Quality Guanciale in Switzerland"
  },
  "LAPA importa direttamente dall'Italia guanciale e pancetta di alta qualita. I nostri prodotti arrivano freschi e sono perfetti per preparare piatti autentici della tradizione italiana.": {
    de_CH: "LAPA importiert Guanciale und Pancetta hoher Qualitaet direkt aus Italien. Unsere Produkte kommen frisch an und sind perfekt fuer die Zubereitung authentischer Gerichte der italienischen Tradition.",
    fr_CH: "LAPA importe directement d'Italie du guanciale et de la pancetta de haute qualite. Nos produits arrivent frais et sont parfaits pour preparer des plats authentiques de la tradition italienne.",
    en_US: "LAPA imports high-quality guanciale and pancetta directly from Italy. Our products arrive fresh and are perfect for preparing authentic dishes of Italian tradition."
  },
  "Conclusione": {
    de_CH: "Fazit",
    fr_CH: "Conclusion",
    en_US: "Conclusion"
  },
  "Guanciale e pancetta hanno caratteristiche diverse e non sono intercambiabili nelle ricette tradizionali. Per un risultato autentico, usa sempre l'ingrediente giusto.": {
    de_CH: "Guanciale und Pancetta haben unterschiedliche Eigenschaften und sind in traditionellen Rezepten nicht austauschbar. Fuer ein authentisches Ergebnis verwenden Sie immer die richtige Zutat.",
    fr_CH: "Le guanciale et la pancetta ont des caracteristiques differentes et ne sont pas interchangeables dans les recettes traditionnelles. Pour un resultat authentique, utilisez toujours le bon ingredient.",
    en_US: "Guanciale and pancetta have different characteristics and are not interchangeable in traditional recipes. For an authentic result, always use the right ingredient."
  }
};

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 80: GUANCIALE VS PANCETTA ===\n');

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

  console.log('\n✅ ARTICOLO 80 COMPLETATO!');
}

main();
