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

const POST_ID = 85;

// Contenuto ITALIANO
const ITALIAN_CONTENT = `<section class="s_text_block pt40 pb40 o_colored_level" data-snippet="s_text_block">
<div class="container">
<h2>Il Cuore Rosso della Pizza Perfetta</h2>
<p>Il pomodoro e l'ingrediente che definisce una pizza. Una buona salsa di pomodoro puo elevare una pizza da buona a straordinaria. Ma non tutti i pomodori sono adatti alla pizza.</p>

<h3>San Marzano DOP: Il Re dei Pomodori</h3>
<p>Il pomodoro San Marzano, coltivato alle pendici del Vesuvio, e considerato il migliore per la pizza napoletana. Le sue caratteristiche uniche:</p>
<ul>
<li>Forma allungata e polpa densa</li>
<li>Pochi semi e poco liquido</li>
<li>Sapore dolce con acidita equilibrata</li>
<li>Buccia facile da rimuovere</li>
<li>Certificazione DOP che garantisce origine e qualita</li>
</ul>

<h3>Pomodoro Pelato vs Passata</h3>
<h4>Pomodoro Pelato</h4>
<p>Ideale per chi vuole schiacciare i pomodori a mano, ottenendo una consistenza rustica. I pizzaioli tradizionali preferiscono questa opzione per avere piu controllo.</p>

<h4>Passata di Pomodoro</h4>
<p>Perfetta per una salsa uniforme e veloce da applicare. Ottima per pizzerie con alto volume di produzione.</p>

<h3>Come Preparare la Salsa Perfetta</h3>
<ul>
<li>Usa pomodori San Marzano DOP di qualita</li>
<li>Schiaccia delicatamente, non frullare</li>
<li>Aggiungi solo sale e un filo d'olio</li>
<li>Non cuocere la salsa prima di metterla sulla pizza</li>
<li>La cottura avverra nel forno</li>
</ul>

<h3>Gli Errori da Evitare</h3>
<ul>
<li>Usare pomodori troppo acquosi</li>
<li>Aggiungere troppi ingredienti alla salsa</li>
<li>Cuocere troppo la salsa prima</li>
<li>Usare pomodori non maturi o fuori stagione</li>
</ul>

<h3>Altre Varieta di Pomodori per Pizza</h3>
<ul>
<li>Datterino: dolce, perfetto per pizze gourmet</li>
<li>Ciliegino: ideale per guarnizione a crudo dopo cottura</li>
<li>Corbarino: simile al San Marzano, sapore intenso</li>
<li>Piennolo del Vesuvio DOP: dolcissimo, per pizze speciali</li>
</ul>

<h3>La Selezione LAPA</h3>
<p>LAPA importa i migliori pomodori italiani per pizzerie professionali:</p>
<ul>
<li>San Marzano DOP in latta da 2.5 kg</li>
<li>Passata di pomodoro premium</li>
<li>Pomodorini datterino</li>
<li>Pelati di alta qualita</li>
</ul>

<h3>Conclusione</h3>
<p>La scelta del pomodoro giusto e fondamentale per una pizza di qualita. Investi in materie prime eccellenti: i tuoi clienti assaggeranno la differenza.</p>
</div>
</section>`;

// Traduzioni per ogni segmento
const TRANSLATIONS = {
  "Il Cuore Rosso della Pizza Perfetta": {
    de_CH: "Das rote Herz der perfekten Pizza",
    fr_CH: "Le coeur rouge de la pizza parfaite",
    en_US: "The Red Heart of the Perfect Pizza"
  },
  "Il pomodoro e l'ingrediente che definisce una pizza. Una buona salsa di pomodoro puo elevare una pizza da buona a straordinaria. Ma non tutti i pomodori sono adatti alla pizza.": {
    de_CH: "Die Tomate ist die Zutat, die eine Pizza definiert. Eine gute Tomatensauce kann eine Pizza von gut zu aussergewoehnlich machen. Aber nicht alle Tomaten sind fuer Pizza geeignet.",
    fr_CH: "La tomate est l'ingredient qui definit une pizza. Une bonne sauce tomate peut elever une pizza de bonne a extraordinaire. Mais toutes les tomates ne conviennent pas a la pizza.",
    en_US: "The tomato is the ingredient that defines a pizza. A good tomato sauce can elevate a pizza from good to extraordinary. But not all tomatoes are suitable for pizza."
  },
  "San Marzano DOP: Il Re dei Pomodori": {
    de_CH: "San Marzano DOP: Der Koenig der Tomaten",
    fr_CH: "San Marzano DOP: Le Roi des Tomates",
    en_US: "San Marzano DOP: The King of Tomatoes"
  },
  "Il pomodoro San Marzano, coltivato alle pendici del Vesuvio, e considerato il migliore per la pizza napoletana. Le sue caratteristiche uniche:": {
    de_CH: "Die San Marzano Tomate, die an den Haengen des Vesuvs angebaut wird, gilt als die beste fuer neapolitanische Pizza. Ihre einzigartigen Eigenschaften:",
    fr_CH: "La tomate San Marzano, cultivee sur les pentes du Vesuve, est consideree comme la meilleure pour la pizza napolitaine. Ses caracteristiques uniques:",
    en_US: "The San Marzano tomato, grown on the slopes of Vesuvius, is considered the best for Neapolitan pizza. Its unique characteristics:"
  },
  "Forma allungata e polpa densa": {
    de_CH: "Laengliche Form und dichtes Fruchtfleisch",
    fr_CH: "Forme allongee et chair dense",
    en_US: "Elongated shape and dense flesh"
  },
  "Pochi semi e poco liquido": {
    de_CH: "Wenige Samen und wenig Fluessigkeit",
    fr_CH: "Peu de graines et peu de liquide",
    en_US: "Few seeds and little liquid"
  },
  "Sapore dolce con acidita equilibrata": {
    de_CH: "Suesser Geschmack mit ausgewogener Saeure",
    fr_CH: "Saveur douce avec une acidite equilibree",
    en_US: "Sweet flavor with balanced acidity"
  },
  "Buccia facile da rimuovere": {
    de_CH: "Leicht zu entfernende Schale",
    fr_CH: "Peau facile a enlever",
    en_US: "Easy-to-remove skin"
  },
  "Certificazione DOP che garantisce origine e qualita": {
    de_CH: "DOP-Zertifizierung, die Herkunft und Qualitaet garantiert",
    fr_CH: "Certification DOP qui garantit l'origine et la qualite",
    en_US: "DOP certification that guarantees origin and quality"
  },
  "Pomodoro Pelato vs Passata": {
    de_CH: "Geschaelte Tomaten vs Passata",
    fr_CH: "Tomates Pelees vs Passata",
    en_US: "Peeled Tomatoes vs Passata"
  },
  "Pomodoro Pelato": {
    de_CH: "Geschaelte Tomaten",
    fr_CH: "Tomates Pelees",
    en_US: "Peeled Tomatoes"
  },
  "Ideale per chi vuole schiacciare i pomodori a mano, ottenendo una consistenza rustica. I pizzaioli tradizionali preferiscono questa opzione per avere piu controllo.": {
    de_CH: "Ideal fuer diejenigen, die die Tomaten von Hand zerdruecken moechten, um eine rustikale Konsistenz zu erhalten. Traditionelle Pizzabaecker bevorzugen diese Option fuer mehr Kontrolle.",
    fr_CH: "Ideal pour ceux qui veulent ecraser les tomates a la main, obtenant une consistance rustique. Les pizzaiolos traditionnels preferent cette option pour plus de controle.",
    en_US: "Ideal for those who want to crush tomatoes by hand, getting a rustic consistency. Traditional pizza makers prefer this option for more control."
  },
  "Passata di Pomodoro": {
    de_CH: "Tomatenpassata",
    fr_CH: "Passata de Tomates",
    en_US: "Tomato Passata"
  },
  "Perfetta per una salsa uniforme e veloce da applicare. Ottima per pizzerie con alto volume di produzione.": {
    de_CH: "Perfekt fuer eine gleichmaessige und schnell aufzutragende Sauce. Hervorragend fuer Pizzerien mit hohem Produktionsvolumen.",
    fr_CH: "Parfaite pour une sauce uniforme et rapide a appliquer. Excellente pour les pizzerias a haut volume de production.",
    en_US: "Perfect for a uniform sauce that's quick to apply. Excellent for pizzerias with high production volume."
  },
  "Come Preparare la Salsa Perfetta": {
    de_CH: "Wie man die perfekte Sauce zubereitet",
    fr_CH: "Comment preparer la sauce parfaite",
    en_US: "How to Prepare the Perfect Sauce"
  },
  "Usa pomodori San Marzano DOP di qualita": {
    de_CH: "Verwenden Sie hochwertige San Marzano DOP Tomaten",
    fr_CH: "Utilisez des tomates San Marzano DOP de qualite",
    en_US: "Use quality San Marzano DOP tomatoes"
  },
  "Schiaccia delicatamente, non frullare": {
    de_CH: "Sanft zerdruecken, nicht mixen",
    fr_CH: "Ecrasez delicatement, ne mixez pas",
    en_US: "Crush gently, don't blend"
  },
  "Aggiungi solo sale e un filo d'olio": {
    de_CH: "Nur Salz und einen Schuss Oel hinzufuegen",
    fr_CH: "Ajoutez seulement du sel et un filet d'huile",
    en_US: "Add only salt and a drizzle of oil"
  },
  "Non cuocere la salsa prima di metterla sulla pizza": {
    de_CH: "Die Sauce nicht kochen, bevor sie auf die Pizza kommt",
    fr_CH: "Ne faites pas cuire la sauce avant de la mettre sur la pizza",
    en_US: "Don't cook the sauce before putting it on the pizza"
  },
  "La cottura avverra nel forno": {
    de_CH: "Das Kochen erfolgt im Ofen",
    fr_CH: "La cuisson se fera au four",
    en_US: "The cooking will happen in the oven"
  },
  "Gli Errori da Evitare": {
    de_CH: "Zu vermeidende Fehler",
    fr_CH: "Les erreurs a eviter",
    en_US: "Mistakes to Avoid"
  },
  "Usare pomodori troppo acquosi": {
    de_CH: "Zu waessrige Tomaten verwenden",
    fr_CH: "Utiliser des tomates trop aqueuses",
    en_US: "Using tomatoes that are too watery"
  },
  "Aggiungere troppi ingredienti alla salsa": {
    de_CH: "Der Sauce zu viele Zutaten hinzufuegen",
    fr_CH: "Ajouter trop d'ingredients a la sauce",
    en_US: "Adding too many ingredients to the sauce"
  },
  "Cuocere troppo la salsa prima": {
    de_CH: "Die Sauce vorher zu lange kochen",
    fr_CH: "Faire trop cuire la sauce avant",
    en_US: "Cooking the sauce too much beforehand"
  },
  "Usare pomodori non maturi o fuori stagione": {
    de_CH: "Unreife oder saisonale Tomaten verwenden",
    fr_CH: "Utiliser des tomates pas mures ou hors saison",
    en_US: "Using unripe or out-of-season tomatoes"
  },
  "Altre Varieta di Pomodori per Pizza": {
    de_CH: "Andere Tomatensorten fuer Pizza",
    fr_CH: "Autres varietes de tomates pour pizza",
    en_US: "Other Tomato Varieties for Pizza"
  },
  "Datterino: dolce, perfetto per pizze gourmet": {
    de_CH: "Datterino: suess, perfekt fuer Gourmet-Pizzen",
    fr_CH: "Datterino: sucree, parfaite pour les pizzas gourmet",
    en_US: "Datterino: sweet, perfect for gourmet pizzas"
  },
  "Ciliegino: ideale per guarnizione a crudo dopo cottura": {
    de_CH: "Kirschtomaten: ideal als rohe Garnierung nach dem Backen",
    fr_CH: "Cerise: ideale pour garnir cru apres cuisson",
    en_US: "Cherry: ideal for raw garnish after cooking"
  },
  "Corbarino: simile al San Marzano, sapore intenso": {
    de_CH: "Corbarino: aehnlich wie San Marzano, intensiver Geschmack",
    fr_CH: "Corbarino: similaire au San Marzano, saveur intense",
    en_US: "Corbarino: similar to San Marzano, intense flavor"
  },
  "Piennolo del Vesuvio DOP: dolcissimo, per pizze speciali": {
    de_CH: "Piennolo del Vesuvio DOP: sehr suess, fuer spezielle Pizzen",
    fr_CH: "Piennolo del Vesuvio DOP: tres sucree, pour pizzas speciales",
    en_US: "Piennolo del Vesuvio DOP: very sweet, for special pizzas"
  },
  "La Selezione LAPA": {
    de_CH: "Die LAPA-Auswahl",
    fr_CH: "La selection LAPA",
    en_US: "The LAPA Selection"
  },
  "LAPA importa i migliori pomodori italiani per pizzerie professionali:": {
    de_CH: "LAPA importiert die besten italienischen Tomaten fuer professionelle Pizzerien:",
    fr_CH: "LAPA importe les meilleures tomates italiennes pour pizzerias professionnelles:",
    en_US: "LAPA imports the best Italian tomatoes for professional pizzerias:"
  },
  "San Marzano DOP in latta da 2.5 kg": {
    de_CH: "San Marzano DOP in 2,5-kg-Dosen",
    fr_CH: "San Marzano DOP en boite de 2,5 kg",
    en_US: "San Marzano DOP in 2.5 kg cans"
  },
  "Passata di pomodoro premium": {
    de_CH: "Premium-Tomatenpassata",
    fr_CH: "Passata de tomates premium",
    en_US: "Premium tomato passata"
  },
  "Pomodorini datterino": {
    de_CH: "Datterino-Tomaten",
    fr_CH: "Tomates datterino",
    en_US: "Datterino tomatoes"
  },
  "Pelati di alta qualita": {
    de_CH: "Hochwertige geschaelte Tomaten",
    fr_CH: "Tomates pelees de haute qualite",
    en_US: "High-quality peeled tomatoes"
  },
  "Conclusione": {
    de_CH: "Fazit",
    fr_CH: "Conclusion",
    en_US: "Conclusion"
  },
  "La scelta del pomodoro giusto e fondamentale per una pizza di qualita. Investi in materie prime eccellenti: i tuoi clienti assaggeranno la differenza.": {
    de_CH: "Die Wahl der richtigen Tomate ist grundlegend fuer eine Qualitaetspizza. Investieren Sie in ausgezeichnete Rohstoffe: Ihre Kunden werden den Unterschied schmecken.",
    fr_CH: "Le choix de la bonne tomate est fondamental pour une pizza de qualite. Investissez dans des matieres premieres excellentes: vos clients gouteront la difference.",
    en_US: "Choosing the right tomato is fundamental for a quality pizza. Invest in excellent raw materials: your customers will taste the difference."
  }
};

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 85: POMODORI PER PIZZA ===\n');

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

  console.log('\n✅ ARTICOLO 85 COMPLETATO!');
}

main();
