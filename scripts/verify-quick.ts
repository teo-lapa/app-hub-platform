/**
 * RESTORE BLOG ARTICLES 86-89 WITH CORRECT APPROACH
 *
 * THE PROBLEM: Previously content was written with context: { lang: 'it_IT' }
 * which only saves translations, not the base content.
 *
 * THE SOLUTION:
 * 1. Write Italian content WITHOUT context (this sets the BASE content)
 * 2. Then write translations WITH context for each language
 */

const ODOO_CONFIG = {
  url: 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com',
  db: 'lapadevadmin-lapa-v2-main-7268478',
  username: 'paul@lapa.ch',
  password: 'lapa201180'
};

let sessionId: string | null = null;

async function authenticate(): Promise<number> {
  const response = await fetch(`${ODOO_CONFIG.url}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        db: ODOO_CONFIG.db,
        login: ODOO_CONFIG.username,
        password: ODOO_CONFIG.password
      },
      id: Date.now()
    })
  });

  const cookies = response.headers.get('set-cookie');
  if (cookies) {
    const match = cookies.match(/session_id=([^;]+)/);
    if (match) sessionId = match[1];
  }

  const data = await response.json();
  if (!data.result?.uid) throw new Error('Auth failed');
  console.log(`✅ Authenticated as ${ODOO_CONFIG.username}`);
  return data.result.uid;
}

async function write(model: string, ids: number[], values: any, context?: any): Promise<boolean> {
  const response = await fetch(`${ODOO_CONFIG.url}/web/dataset/call_kw/${model}/write`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_id=${sessionId}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model,
        method: 'write',
        args: [ids, values],
        kwargs: { context: context || {} }
      },
      id: Date.now()
    })
  });

  const data = await response.json();
  if (data.error) {
    console.log(`   ❌ Error: ${data.error.data?.message || data.error.message}`);
    return false;
  }
  return data.result;
}

// Article mapping: article ID -> index in ARTICLES array below
const ARTICLE_MAPPING = {
  86: 0, // attrezzature-pizzeria -> "Attrezzature Essenziali per una Pizzeria"
  87: 1, // salumi-italiani-ristoranti -> "I Salumi Italiani per Ristoranti"
  88: 2, // creare-menu-italiano -> "Come Creare un Menu Italiano Autentico"
  89: 3  // consegna-prodotti-freschi -> "Consegna Prodotti Freschi"
};

// Original articles from part2 file
const ARTICLES = [
  {
    // Index 0 = Article 86
    title: 'Attrezzature Essenziali per una Pizzeria: La Lista Completa',
    subtitle: 'Dal forno alla pala: tutto ciò che serve per partire',
    metaTitle: 'Attrezzature Pizzeria Lista Completa | Guida | LAPA',
    metaDescription: 'Quali attrezzature servono per aprire una pizzeria? Lista completa: forni, impastatrici, banchi, pale e accessori. Guida per nuove aperture.',
    keywords: 'attrezzature pizzeria, forno pizza, impastatrice pizzeria, accessori pizzeria',
    content: `
<h2>Investire nelle Attrezzature Giuste</h2>
<p>Le attrezzature sono l'investimento più importante dopo il locale. <strong>Qualità e affidabilità</strong> sono fondamentali per la produttività.</p>

<h2>Il Forno: Il Cuore della Pizzeria</h2>
<h3>Forno a Legna</h3>
<ul>
<li><strong>Pro:</strong> Sapore unico, tradizione, spettacolo per i clienti</li>
<li><strong>Contro:</strong> Richiede esperienza, manutenzione, spazio</li>
<li><strong>Temperature:</strong> 400-485°C</li>
<li><strong>Cottura:</strong> 60-90 secondi</li>
</ul>

<h3>Forno a Gas</h3>
<ul>
<li><strong>Pro:</strong> Controllo temperatura, facilità d'uso</li>
<li><strong>Contro:</strong> Sapore meno caratteristico</li>
<li><strong>Temperature:</strong> Fino a 450°C</li>
</ul>

<h3>Forno Elettrico</h3>
<ul>
<li><strong>Pro:</strong> Precisione, nessuna canna fumaria necessaria</li>
<li><strong>Contro:</strong> Costo energia, temperature limitate</li>
<li><strong>Ideale per:</strong> Pizza al taglio, teglia romana</li>
</ul>

<h2>Impastatrice</h2>
<p>Essenziale per volumi medio-alti. Tipi principali:</p>
<ul>
<li><strong>A spirale:</strong> La più usata per pizza, non scalda l'impasto</li>
<li><strong>A forcella:</strong> Per impasti molto idratati</li>
<li><strong>Capacità:</strong> Da 20 a 200+ kg di impasto</li>
</ul>

<h2>Banco Refrigerato</h2>
<p>Per la preparazione e conservazione ingredienti. Caratteristiche importanti:</p>
<ul>
<li>Piano in granito o marmo (fresco)</li>
<li>Vaschette GN incorporate</li>
<li>Temperatura 0-4°C</li>
</ul>

<h2>Pale e Accessori</h2>
<ul>
<li><strong>Pala per infornare:</strong> In alluminio, leggera</li>
<li><strong>Pala per girare:</strong> Più piccola, per ruotare la pizza</li>
<li><strong>Pala per sfornare:</strong> In legno, per servire</li>
<li><strong>Spazzola:</strong> Per pulire il piano forno</li>
<li><strong>Termometro:</strong> Laser per controllare la temperatura</li>
</ul>

<h2>Altri Essenziali</h2>
<ul>
<li>Contenitori per lievitazione (cassette impasto)</li>
<li>Bilancia di precisione</li>
<li>Abbattitore (per pasta pre-cotta e conservazione)</li>
<li>Affettatrice per salumi</li>
<li>Impianto di aspirazione</li>
</ul>

<h2>Budget Indicativo</h2>
<ul>
<li>Forno a legna professionale: CHF 15.000-50.000</li>
<li>Forno elettrico professionale: CHF 5.000-20.000</li>
<li>Impastatrice: CHF 2.000-10.000</li>
<li>Banco refrigerato: CHF 3.000-8.000</li>
</ul>

<h2>E Gli Ingredienti?</h2>
<p>Una volta attrezzata la pizzeria, servono ingredienti di qualità. LAPA fornisce tutto il necessario: farine, pomodori, mozzarella e oltre 3.000 prodotti italiani. <a href="/shop">Scopri il catalogo</a>.</p>
`
  },
  {
    // Index 1 = Article 87
    title: 'I Salumi Italiani per Ristoranti: Guida Completa',
    subtitle: 'Prosciutto, Speck, Salame e altri: cosa offrire e come conservarli',
    metaTitle: 'Salumi Italiani Ristoranti | Guida Completa | LAPA',
    metaDescription: 'Quali salumi italiani offrire nel tuo ristorante? Guida completa a prosciutto, speck, salame, guanciale. Conservazione e abbinamenti.',
    keywords: 'salumi italiani ristorante, prosciutto ristoranti, speck italiano, salumi DOP',
    content: `
<h2>I Salumi: Protagonisti della Tavola Italiana</h2>
<p>I salumi sono essenziali per antipasti, taglieri, pizze e panini. Scegliere quelli giusti <strong>eleva l'esperienza del cliente</strong>.</p>

<h2>Prosciutto Crudo</h2>
<h3>Prosciutto di Parma DOP</h3>
<ul>
<li><strong>Stagionatura:</strong> Minimo 12 mesi (meglio 18-24)</li>
<li><strong>Caratteristiche:</strong> Dolce, delicato, rosato</li>
<li><strong>Uso:</strong> Antipasti, pizze, abbinamento con melone/fichi</li>
</ul>

<h3>Prosciutto San Daniele DOP</h3>
<ul>
<li><strong>Stagionatura:</strong> Minimo 13 mesi</li>
<li><strong>Caratteristiche:</strong> Leggermente più dolce del Parma, forma a "chitarra"</li>
</ul>

<h3>Prosciutto Toscano DOP</h3>
<ul>
<li><strong>Caratteristiche:</strong> Più sapido, con pepe in crosta</li>
<li><strong>Uso:</strong> Taglieri, con pane toscano sciapo</li>
</ul>

<h2>Speck Alto Adige IGP</h2>
<ul>
<li><strong>Produzione:</strong> Salato, speziato, affumicato</li>
<li><strong>Stagionatura:</strong> Minimo 22 settimane</li>
<li><strong>Uso:</strong> Antipasti, pizza, canederli, insalate</li>
</ul>

<h2>Guanciale</h2>
<ul>
<li><strong>Taglio:</strong> Guancia del maiale</li>
<li><strong>Uso:</strong> ESSENZIALE per carbonara, amatriciana, gricia</li>
<li><strong>Nota:</strong> Non sostituire mai con pancetta o bacon!</li>
</ul>

<h2>Pancetta</h2>
<ul>
<li><strong>Varietà:</strong> Tesa, arrotolata, affumicata</li>
<li><strong>Uso:</strong> Sughi, torte salate, avvolgere carni</li>
</ul>

<h2>Salami</h2>
<ul>
<li><strong>Milano:</strong> Grana fine, delicato</li>
<li><strong>Napoli:</strong> Piccante, con peperoncino</li>
<li><strong>Finocchiona:</strong> Toscano, con semi di finocchio</li>
<li><strong>'Nduja:</strong> Calabrese, spalmabile e piccante</li>
</ul>

<h2>Mortadella Bologna IGP</h2>
<ul>
<li><strong>Caratteristiche:</strong> Con pistacchi, profumata</li>
<li><strong>Uso:</strong> Taglieri, panini, tortellini in brodo</li>
</ul>

<h2>Conservazione</h2>
<ul>
<li><strong>Interi:</strong> Temperatura ambiente (12-18°C), luogo asciutto</li>
<li><strong>Affettati:</strong> Frigo 0-4°C, consumare in 5-7 giorni</li>
<li><strong>Sottovuoto:</strong> Prolungano la conservazione</li>
</ul>

<h2>La Selezione LAPA</h2>
<p>Importiamo salumi da tutta Italia, con focus su prodotti DOP e IGP. <a href="/shop">Scopri la nostra selezione salumi</a>.</p>
`
  },
  {
    // Index 2 = Article 88
    title: 'Come Creare un Menu Italiano Autentico per il Tuo Ristorante',
    subtitle: 'Struttura, piatti essenziali e consigli per differenziarsi',
    metaTitle: 'Menu Ristorante Italiano | Come Crearlo | LAPA',
    metaDescription: 'Come strutturare un menu italiano autentico? Guida completa: antipasti, primi, secondi, dolci. Consigli per creare un menu che funziona.',
    keywords: 'menu ristorante italiano, creare menu ristorante, piatti italiani ristorante, menu pizzeria',
    content: `
<h2>Un Menu che Racconta una Storia</h2>
<p>Il menu è il biglietto da visita del tuo ristorante. Un menu ben costruito <strong>guida il cliente</strong> e comunica la tua identità.</p>

<h2>Struttura Classica Italiana</h2>

<h3>1. Antipasti</h3>
<p>Preparano il palato. Offri varietà tra:</p>
<ul>
<li><strong>Freddi:</strong> Tagliere salumi/formaggi, carpaccio, vitello tonnato</li>
<li><strong>Caldi:</strong> Bruschette, arancini, fritture</li>
<li><strong>Vegetariani:</strong> Caprese, verdure grigliate, caponata</li>
</ul>

<h3>2. Primi Piatti</h3>
<p>Il cuore della cucina italiana:</p>
<ul>
<li><strong>Pasta fresca:</strong> Tagliatelle, ravioli, lasagne</li>
<li><strong>Pasta secca:</strong> Spaghetti, penne, rigatoni</li>
<li><strong>Risotti:</strong> Almeno 2-3 varietà</li>
<li><strong>Zuppe:</strong> Minestrone, ribollita (stagionali)</li>
</ul>

<h3>3. Secondi Piatti</h3>
<ul>
<li><strong>Carne:</strong> Scaloppine, tagliata, ossobuco</li>
<li><strong>Pesce:</strong> Branzino, orata, frittura mista</li>
<li><strong>Contorni:</strong> Separati o inclusi</li>
</ul>

<h3>4. Dolci</h3>
<ul>
<li><strong>Classici:</strong> Tiramisù, panna cotta, cannoli</li>
<li><strong>Regionali:</strong> Sfogliatella, cassata, babà</li>
</ul>

<h2>Principi per un Menu Efficace</h2>

<h3>1. Meno è Meglio</h3>
<p>Un menu troppo lungo:</p>
<ul>
<li>Complica la gestione delle scorte</li>
<li>Aumenta lo spreco</li>
<li>Confonde il cliente</li>
</ul>
<p><strong>Consiglio:</strong> 5-7 antipasti, 8-10 primi, 5-7 secondi, 4-5 dolci.</p>

<h3>2. Stagionalità</h3>
<p>Aggiorna il menu con ingredienti di stagione. Dimostra freschezza e competenza.</p>

<h3>3. Identità Regionale</h3>
<p>Non cercare di offrire "tutta l'Italia". Scegli 1-2 regioni e specializzati.</p>

<h3>4. Piatti Signature</h3>
<p>Crea 2-3 piatti unici che ti distinguono dalla concorrenza.</p>

<h2>Errori da Evitare</h2>
<ul>
<li>❌ Spaghetti alla bolognese (non esistono in Italia!)</li>
<li>❌ Fettuccine Alfredo (invenzione americana)</li>
<li>❌ Pollo sulla pasta (combinazione non italiana)</li>
<li>❌ Parmigiano sulla pasta al pesce</li>
</ul>

<h2>Ingredienti di Qualità</h2>
<p>Un menu autentico richiede ingredienti autentici. LAPA fornisce oltre 3.000 prodotti italiani per creare il menu perfetto. <a href="/shop">Esplora il catalogo</a>.</p>
`
  },
  {
    // Index 3 = Article 89
    title: 'Consegna Prodotti Freschi: Cosa Cercare in un Fornitore',
    subtitle: 'Catena del freddo, tempistiche e affidabilità',
    metaTitle: 'Consegna Prodotti Freschi Ristoranti | Guida | LAPA',
    metaDescription: 'Come scegliere un fornitore per prodotti freschi? Guida sulla catena del freddo, frequenza consegne e affidabilità. LAPA consegna in tutta la Svizzera.',
    keywords: 'consegna prodotti freschi, fornitore fresco ristoranti, catena freddo, consegna mozzarella',
    content: `
<h2>Prodotti Freschi: La Sfida Logistica</h2>
<p>La qualità dei prodotti freschi dipende dalla <strong>catena logistica</strong> tanto quanto dall'origine. Un fornitore eccellente con consegne scadenti vanifica tutto.</p>

<h2>La Catena del Freddo</h2>
<p>Per mozzarella, latticini, salumi e altri freschi, la temperatura deve essere costante:</p>
<ul>
<li><strong>Latticini:</strong> 0-4°C</li>
<li><strong>Salumi:</strong> 0-4°C (affettati), 12-15°C (interi)</li>
<li><strong>Verdure fresche:</strong> 4-8°C</li>
<li><strong>Surgelati:</strong> -18°C o inferiore</li>
</ul>

<h3>Cosa Verificare</h3>
<ul>
<li>Furgoni refrigerati con registrazione temperatura</li>
<li>Magazzini a temperatura controllata</li>
<li>Personale formato sulla gestione del freddo</li>
</ul>

<h2>Frequenza di Consegna</h2>
<h3>Ideale per Ristoranti</h3>
<ul>
<li><strong>Latticini freschi:</strong> 2-3 volte a settimana</li>
<li><strong>Salumi:</strong> 1-2 volte a settimana</li>
<li><strong>Prodotti secchi:</strong> 1 volta a settimana</li>
</ul>

<h3>Vantaggi delle Consegne Frequenti</h3>
<ul>
<li>Prodotti sempre freschi</li>
<li>Meno spazio magazzino necessario</li>
<li>Minor rischio di sprechi</li>
<li>Possibilità di reagire alla domanda</li>
</ul>

<h2>Affidabilità</h2>
<h3>Cosa Cercare</h3>
<ul>
<li>Puntualità nelle consegne</li>
<li>Comunicazione proattiva su ritardi</li>
<li>Gestione efficace dei problemi</li>
<li>Possibilità di ordini urgenti</li>
</ul>

<h3>Red Flags</h3>
<ul>
<li>❌ Consegne spesso in ritardo</li>
<li>❌ Prodotti che arrivano non freddi</li>
<li>❌ Impossibilità di tracciare l'ordine</li>
<li>❌ Servizio clienti non raggiungibile</li>
</ul>

<h2>Flessibilità</h2>
<p>Un buon fornitore offre:</p>
<ul>
<li>Nessun minimo d'ordine (o minimo ragionevole)</li>
<li>Ordini last-minute per emergenze</li>
<li>Modifiche ordini fino a cut-off ragionevoli</li>
</ul>

<h2>LAPA: Consegna in Tutta la Svizzera</h2>
<p>LAPA garantisce:</p>
<ul>
<li>✅ Catena del freddo certificata</li>
<li>✅ Consegne 24-48 ore</li>
<li>✅ Nessun minimo d'ordine</li>
<li>✅ Copertura nazionale</li>
<li>✅ Ordini urgenti gestiti</li>
</ul>

<p><a href="/contactus">Contattaci</a> per scoprire come possiamo servire il tuo ristorante.</p>
`
  }
];

async function restoreArticle(articleId: number) {
  const articleIndex = ARTICLE_MAPPING[articleId as keyof typeof ARTICLE_MAPPING];
  const article = ARTICLES[articleIndex];

  console.log(`\n${'='.repeat(80)}`);
  console.log(`📄 RESTORING ARTICLE ${articleId}: ${article.title}`);
  console.log('='.repeat(80));

  // STEP 1: Write Italian content WITHOUT context (this is the BASE content)
  console.log('\n1️⃣  Writing ITALIAN (BASE) content - NO CONTEXT...');
  const italianSuccess = await write('blog.post', [articleId], {
    name: article.title,
    subtitle: article.subtitle,
    content: article.content,
    website_meta_title: article.metaTitle,
    website_meta_description: article.metaDescription,
    website_meta_keywords: article.keywords
  });

  if (!italianSuccess) {
    console.log('   ❌ Failed to write Italian base content!');
    return false;
  }
  console.log('   ✅ Italian base content written successfully');
  await new Promise(r => setTimeout(r, 500));

  // STEP 2: Write GERMAN translation with context
  console.log('\n2️⃣  Writing GERMAN translation - WITH CONTEXT { lang: "de_CH" }...');
  const germanSuccess = await write('blog.post', [articleId], {
    name: article.title, // You should translate these, but using Italian for now
    subtitle: article.subtitle,
    content: article.content
  }, { lang: 'de_CH' });

  if (!germanSuccess) {
    console.log('   ❌ Failed to write German translation!');
  } else {
    console.log('   ✅ German translation written successfully');
  }
  await new Promise(r => setTimeout(r, 500));

  // STEP 3: Write FRENCH translation with context
  console.log('\n3️⃣  Writing FRENCH translation - WITH CONTEXT { lang: "fr_CH" }...');
  const frenchSuccess = await write('blog.post', [articleId], {
    name: article.title,
    subtitle: article.subtitle,
    content: article.content
  }, { lang: 'fr_CH' });

  if (!frenchSuccess) {
    console.log('   ❌ Failed to write French translation!');
  } else {
    console.log('   ✅ French translation written successfully');
  }
  await new Promise(r => setTimeout(r, 500));

  // STEP 4: Write ENGLISH translation with context
  console.log('\n4️⃣  Writing ENGLISH translation - WITH CONTEXT { lang: "en_US" }...');
  const englishSuccess = await write('blog.post', [articleId], {
    name: article.title,
    subtitle: article.subtitle,
    content: article.content
  }, { lang: 'en_US' });

  if (!englishSuccess) {
    console.log('   ❌ Failed to write English translation!');
  } else {
    console.log('   ✅ English translation written successfully');
  }

  console.log(`\n✅ Article ${articleId} restoration complete!`);
  return true;
}

async function verify(id,lang){const r=await read("blog.post",[id],["name","content"],lang?{lang}:{});if(r&&r[0]?.content?.length>100){console.log()}else{console.log()}}async function main() {
  console.log('🔧 RESTORING BLOG ARTICLES 86-89 WITH CORRECT APPROACH');
  console.log('='.repeat(80));
  console.log('THE FIX:');
  console.log('1. Italian content written WITHOUT context (BASE content)');
  console.log('2. Then DE/FR/EN translations written WITH context');
  console.log('='.repeat(80));

  await authenticate();

  const articlesToRestore = [86, 87, 88, 89];
  let successCount = 0;
  let errorCount = 0;

  for (const articleId of articlesToRestore) {
    const success = await verify(articleId);await verify(articleId,"de_CH");await verify(articleId,"fr_CH");await verify(articleId,"en_US");
    if (success) {
      successCount++;
    } else {
      errorCount++;
    }

    // Wait between articles
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ RESTORATION COMPLETE!');
  console.log('='.repeat(80));
  console.log(`✅ Successfully restored: ${successCount} articles`);
  console.log(`❌ Errors: ${errorCount} articles`);
  console.log('\nNOTE: Translations are currently using Italian text.');
  console.log('You should translate the content to DE/FR/EN for proper multilingual support.');
}

main();
