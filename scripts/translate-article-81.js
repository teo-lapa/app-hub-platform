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

const POST_ID = 81;

// Contenuto ITALIANO
const ITALIAN_CONTENT = `<section class="s_text_block pt40 pb40 o_colored_level" data-snippet="s_text_block">
<div class="container">
<h2>La Freschezza e Tutto</h2>
<p>I prodotti freschi italiani sono il cuore della cucina mediterranea. Ma una volta arrivati nel tuo ristorante, come conservarli al meglio per mantenere qualita e sicurezza alimentare? Ecco la guida completa.</p>

<h3>Conservare la Mozzarella Fresca</h3>
<p>La mozzarella e uno dei prodotti piu delicati. Ecco come conservarla:</p>
<ul>
<li>Temperatura: tra 4 e 8 gradi Celsius</li>
<li>Nel suo liquido: mantienila sempre nel siero di conservazione</li>
<li>Consumo: entro 3-5 giorni dall'apertura</li>
<li>Mai congelare: perde consistenza e sapore</li>
</ul>

<h3>Conservare la Burrata</h3>
<p>La burrata e ancora piu delicata della mozzarella:</p>
<ul>
<li>Temperatura: tra 4 e 6 gradi Celsius</li>
<li>Consumo: entro 48 ore dall'acquisto</li>
<li>Servire a temperatura ambiente per esaltare il sapore</li>
<li>Togliere dal frigo 30 minuti prima di servire</li>
</ul>

<h3>Conservare Salumi e Formaggi</h3>
<p>Salumi e formaggi richiedono attenzioni specifiche:</p>
<ul>
<li>Salumi interi: temperatura tra 12 e 15 gradi, luogo asciutto e ventilato</li>
<li>Salumi affettati: in frigo a 4 gradi, consumare entro 3 giorni</li>
<li>Formaggi freschi: in frigo tra 4 e 6 gradi</li>
<li>Formaggi stagionati: tra 8 e 12 gradi, avvolti in carta alimentare</li>
</ul>

<h3>Conservare le Verdure Fresche</h3>
<ul>
<li>Pomodori: a temperatura ambiente, lontano dalla luce diretta</li>
<li>Basilico: in un bicchiere d'acqua a temperatura ambiente</li>
<li>Verdure a foglia: in frigo, avvolte in carta umida</li>
<li>Aglio e cipolle: luogo fresco e asciutto, mai in frigo</li>
</ul>

<h3>La Catena del Freddo</h3>
<p>LAPA garantisce la catena del freddo per tutti i prodotti freschi. I nostri camion refrigerati mantengono la temperatura ottimale dalla partenza alla consegna. Questo assicura che i prodotti arrivino nelle condizioni ideali.</p>

<h3>Consigli per la Rotazione dello Stock</h3>
<ul>
<li>Usa il metodo FIFO: First In, First Out</li>
<li>Controlla le date di scadenza quotidianamente</li>
<li>Ordina quantita appropriate alle tue vendite</li>
<li>Con LAPA puoi ordinare anche piccole quantita senza minimi</li>
</ul>

<h3>Conclusione</h3>
<p>Una corretta conservazione dei prodotti freschi e fondamentale per la qualita dei tuoi piatti e la sicurezza dei tuoi clienti. Con i prodotti LAPA e questi consigli, potrai offrire sempre il meglio della cucina italiana.</p>
</div>
</section>`;

// Traduzioni per ogni segmento
const TRANSLATIONS = {
  "La Freschezza e Tutto": {
    de_CH: "Frische ist alles",
    fr_CH: "La fraicheur est tout",
    en_US: "Freshness is Everything"
  },
  "I prodotti freschi italiani sono il cuore della cucina mediterranea. Ma una volta arrivati nel tuo ristorante, come conservarli al meglio per mantenere qualita e sicurezza alimentare? Ecco la guida completa.": {
    de_CH: "Frische italienische Produkte sind das Herz der mediterranen Kueche. Aber wie bewahren Sie sie nach der Ankunft in Ihrem Restaurant am besten auf, um Qualitaet und Lebensmittelsicherheit zu gewaehrleisten? Hier ist der vollstaendige Leitfaden.",
    fr_CH: "Les produits frais italiens sont le coeur de la cuisine mediterraneenne. Mais une fois arrives dans votre restaurant, comment les conserver au mieux pour maintenir qualite et securite alimentaire? Voici le guide complet.",
    en_US: "Fresh Italian products are the heart of Mediterranean cuisine. But once they arrive at your restaurant, how do you best store them to maintain quality and food safety? Here's the complete guide."
  },
  "Conservare la Mozzarella Fresca": {
    de_CH: "Frischen Mozzarella aufbewahren",
    fr_CH: "Conserver la Mozzarella Fraiche",
    en_US: "Storing Fresh Mozzarella"
  },
  "La mozzarella e uno dei prodotti piu delicati. Ecco come conservarla:": {
    de_CH: "Mozzarella ist eines der empfindlichsten Produkte. So bewahren Sie ihn auf:",
    fr_CH: "La mozzarella est l'un des produits les plus delicats. Voici comment la conserver:",
    en_US: "Mozzarella is one of the most delicate products. Here's how to store it:"
  },
  "Temperatura: tra 4 e 8 gradi Celsius": {
    de_CH: "Temperatur: zwischen 4 und 8 Grad Celsius",
    fr_CH: "Temperature: entre 4 et 8 degres Celsius",
    en_US: "Temperature: between 4 and 8 degrees Celsius"
  },
  "Nel suo liquido: mantienila sempre nel siero di conservazione": {
    de_CH: "In ihrer Fluessigkeit: bewahren Sie sie immer in der Konservierungsmolke auf",
    fr_CH: "Dans son liquide: gardez-la toujours dans le petit-lait de conservation",
    en_US: "In its liquid: always keep it in the preservation whey"
  },
  "Consumo: entro 3-5 giorni dall'apertura": {
    de_CH: "Verbrauch: innerhalb von 3-5 Tagen nach dem Oeffnen",
    fr_CH: "Consommation: dans les 3-5 jours apres ouverture",
    en_US: "Consumption: within 3-5 days of opening"
  },
  "Mai congelare: perde consistenza e sapore": {
    de_CH: "Niemals einfrieren: verliert Konsistenz und Geschmack",
    fr_CH: "Ne jamais congeler: perd sa texture et son gout",
    en_US: "Never freeze: loses texture and flavor"
  },
  "Conservare la Burrata": {
    de_CH: "Burrata aufbewahren",
    fr_CH: "Conserver la Burrata",
    en_US: "Storing Burrata"
  },
  "La burrata e ancora piu delicata della mozzarella:": {
    de_CH: "Burrata ist noch empfindlicher als Mozzarella:",
    fr_CH: "La burrata est encore plus delicate que la mozzarella:",
    en_US: "Burrata is even more delicate than mozzarella:"
  },
  "Temperatura: tra 4 e 6 gradi Celsius": {
    de_CH: "Temperatur: zwischen 4 und 6 Grad Celsius",
    fr_CH: "Temperature: entre 4 et 6 degres Celsius",
    en_US: "Temperature: between 4 and 6 degrees Celsius"
  },
  "Consumo: entro 48 ore dall'acquisto": {
    de_CH: "Verbrauch: innerhalb von 48 Stunden nach dem Kauf",
    fr_CH: "Consommation: dans les 48 heures suivant l'achat",
    en_US: "Consumption: within 48 hours of purchase"
  },
  "Servire a temperatura ambiente per esaltare il sapore": {
    de_CH: "Bei Raumtemperatur servieren, um den Geschmack zu verstaerken",
    fr_CH: "Servir a temperature ambiante pour rehausser la saveur",
    en_US: "Serve at room temperature to enhance the flavor"
  },
  "Togliere dal frigo 30 minuti prima di servire": {
    de_CH: "30 Minuten vor dem Servieren aus dem Kuehlschrank nehmen",
    fr_CH: "Sortir du refrigerateur 30 minutes avant de servir",
    en_US: "Remove from refrigerator 30 minutes before serving"
  },
  "Conservare Salumi e Formaggi": {
    de_CH: "Wurstwaren und Kaese aufbewahren",
    fr_CH: "Conserver Charcuteries et Fromages",
    en_US: "Storing Cured Meats and Cheeses"
  },
  "Salumi e formaggi richiedono attenzioni specifiche:": {
    de_CH: "Wurstwaren und Kaese erfordern besondere Aufmerksamkeit:",
    fr_CH: "Les charcuteries et fromages necessitent une attention particuliere:",
    en_US: "Cured meats and cheeses require specific attention:"
  },
  "Salumi interi: temperatura tra 12 e 15 gradi, luogo asciutto e ventilato": {
    de_CH: "Ganze Wurstwaren: Temperatur zwischen 12 und 15 Grad, trockener und beluefteter Ort",
    fr_CH: "Charcuteries entieres: temperature entre 12 et 15 degres, endroit sec et ventile",
    en_US: "Whole cured meats: temperature between 12 and 15 degrees, dry and ventilated place"
  },
  "Salumi affettati: in frigo a 4 gradi, consumare entro 3 giorni": {
    de_CH: "Aufgeschnittene Wurstwaren: im Kuehlschrank bei 4 Grad, innerhalb von 3 Tagen verbrauchen",
    fr_CH: "Charcuteries tranchees: au refrigerateur a 4 degres, consommer dans les 3 jours",
    en_US: "Sliced cured meats: in refrigerator at 4 degrees, consume within 3 days"
  },
  "Formaggi freschi: in frigo tra 4 e 6 gradi": {
    de_CH: "Frischkaese: im Kuehlschrank zwischen 4 und 6 Grad",
    fr_CH: "Fromages frais: au refrigerateur entre 4 et 6 degres",
    en_US: "Fresh cheeses: in refrigerator between 4 and 6 degrees"
  },
  "Formaggi stagionati: tra 8 e 12 gradi, avvolti in carta alimentare": {
    de_CH: "Gereifte Kaese: zwischen 8 und 12 Grad, in Lebensmittelpapier eingewickelt",
    fr_CH: "Fromages affines: entre 8 et 12 degres, enveloppes dans du papier alimentaire",
    en_US: "Aged cheeses: between 8 and 12 degrees, wrapped in food paper"
  },
  "Conservare le Verdure Fresche": {
    de_CH: "Frisches Gemuese aufbewahren",
    fr_CH: "Conserver les Legumes Frais",
    en_US: "Storing Fresh Vegetables"
  },
  "Pomodori: a temperatura ambiente, lontano dalla luce diretta": {
    de_CH: "Tomaten: bei Raumtemperatur, fern von direktem Licht",
    fr_CH: "Tomates: a temperature ambiante, loin de la lumiere directe",
    en_US: "Tomatoes: at room temperature, away from direct light"
  },
  "Basilico: in un bicchiere d'acqua a temperatura ambiente": {
    de_CH: "Basilikum: in einem Glas Wasser bei Raumtemperatur",
    fr_CH: "Basilic: dans un verre d'eau a temperature ambiante",
    en_US: "Basil: in a glass of water at room temperature"
  },
  "Verdure a foglia: in frigo, avvolte in carta umida": {
    de_CH: "Blattgemuese: im Kuehlschrank, in feuchtes Papier eingewickelt",
    fr_CH: "Legumes a feuilles: au refrigerateur, enveloppes dans du papier humide",
    en_US: "Leafy vegetables: in refrigerator, wrapped in damp paper"
  },
  "Aglio e cipolle: luogo fresco e asciutto, mai in frigo": {
    de_CH: "Knoblauch und Zwiebeln: kuehler und trockener Ort, niemals im Kuehlschrank",
    fr_CH: "Ail et oignons: endroit frais et sec, jamais au refrigerateur",
    en_US: "Garlic and onions: cool and dry place, never in refrigerator"
  },
  "La Catena del Freddo": {
    de_CH: "Die Kuehlkette",
    fr_CH: "La Chaine du Froid",
    en_US: "The Cold Chain"
  },
  "LAPA garantisce la catena del freddo per tutti i prodotti freschi. I nostri camion refrigerati mantengono la temperatura ottimale dalla partenza alla consegna. Questo assicura che i prodotti arrivino nelle condizioni ideali.": {
    de_CH: "LAPA garantiert die Kuehlkette fuer alle Frischprodukte. Unsere Kuehlwagen halten die optimale Temperatur von der Abfahrt bis zur Lieferung. Dies stellt sicher, dass die Produkte in idealem Zustand ankommen.",
    fr_CH: "LAPA garantit la chaine du froid pour tous les produits frais. Nos camions refrigeres maintiennent la temperature optimale du depart a la livraison. Cela assure que les produits arrivent dans des conditions ideales.",
    en_US: "LAPA guarantees the cold chain for all fresh products. Our refrigerated trucks maintain optimal temperature from departure to delivery. This ensures products arrive in ideal conditions."
  },
  "Consigli per la Rotazione dello Stock": {
    de_CH: "Tipps fuer die Lagerrotation",
    fr_CH: "Conseils pour la Rotation des Stocks",
    en_US: "Tips for Stock Rotation"
  },
  "Usa il metodo FIFO: First In, First Out": {
    de_CH: "Verwenden Sie die FIFO-Methode: First In, First Out",
    fr_CH: "Utilisez la methode FIFO: Premier Entre, Premier Sorti",
    en_US: "Use the FIFO method: First In, First Out"
  },
  "Controlla le date di scadenza quotidianamente": {
    de_CH: "Ueberpruefen Sie die Verfallsdaten taeglich",
    fr_CH: "Verifiez les dates de peremption quotidiennement",
    en_US: "Check expiration dates daily"
  },
  "Ordina quantita appropriate alle tue vendite": {
    de_CH: "Bestellen Sie Mengen entsprechend Ihren Verkaeufen",
    fr_CH: "Commandez des quantites appropriees a vos ventes",
    en_US: "Order quantities appropriate to your sales"
  },
  "Con LAPA puoi ordinare anche piccole quantita senza minimi": {
    de_CH: "Mit LAPA koennen Sie auch kleine Mengen ohne Mindestbestellung bestellen",
    fr_CH: "Avec LAPA, vous pouvez commander meme de petites quantites sans minimum",
    en_US: "With LAPA you can order even small quantities without minimums"
  },
  "Conclusione": {
    de_CH: "Fazit",
    fr_CH: "Conclusion",
    en_US: "Conclusion"
  },
  "Una corretta conservazione dei prodotti freschi e fondamentale per la qualita dei tuoi piatti e la sicurezza dei tuoi clienti. Con i prodotti LAPA e questi consigli, potrai offrire sempre il meglio della cucina italiana.": {
    de_CH: "Die richtige Aufbewahrung von Frischprodukten ist grundlegend fuer die Qualitaet Ihrer Gerichte und die Sicherheit Ihrer Kunden. Mit LAPA-Produkten und diesen Tipps koennen Sie immer das Beste der italienischen Kueche anbieten.",
    fr_CH: "Une bonne conservation des produits frais est fondamentale pour la qualite de vos plats et la securite de vos clients. Avec les produits LAPA et ces conseils, vous pourrez toujours offrir le meilleur de la cuisine italienne.",
    en_US: "Proper storage of fresh products is fundamental for the quality of your dishes and the safety of your customers. With LAPA products and these tips, you can always offer the best of Italian cuisine."
  }
};

async function main() {
  await auth();

  console.log('\n=== ARTICOLO 81: CONSERVARE PRODOTTI FRESCHI ===\n');

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

  console.log('\n✅ ARTICOLO 81 COMPLETATO!');
}

main();
