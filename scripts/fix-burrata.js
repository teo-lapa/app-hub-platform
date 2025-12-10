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

async function write(id, values) {
  const r = await fetch(ODOO.url + '/web/dataset/call_kw/blog.post/write', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': 'session_id=' + sid },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model: 'blog.post',
        method: 'write',
        args: [[id], values],
        kwargs: {}
      },
      id: Date.now()
    })
  });
  return (await r.json());
}

async function readWithLang(id, lang) {
  const r = await fetch(ODOO.url + '/web/dataset/call_kw/blog.post/read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': 'session_id=' + sid },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model: 'blog.post',
        method: 'read',
        args: [[id]],
        kwargs: { fields: ['name', 'subtitle', 'content'], context: { lang } }
      },
      id: Date.now()
    })
  });
  return (await r.json()).result?.[0];
}

async function main() {
  await auth();

  const italianTitle = "La Burrata: Un Cuore Cremoso dalla Tradizione Pugliese";
  const italianSubtitle = "Scopri la storia autentica di questo gioiello caseario, dalle sue origini ingegnose alla tavola moderna";
  const italianContent = `<h2>Un Formaggio Nato dall'Ingegno</h2>
<p>Immagina un formaggio fresco, morbido come una nuvola, che quando lo tagli rivela un cuore di panna e filamenti di mozzarella. Questa è la <strong>Burrata</strong>, un autentico gioiello della tradizione casearia italiana.</p>

<h2>Le Origini della Burrata</h2>
<p>La burrata nasce negli anni '20 del Novecento ad Andria, in Puglia. Fu creata da Lorenzo Bianchino come modo ingegnoso per utilizzare i ritagli della lavorazione della mozzarella. Questi "straccetti" venivano mescolati con panna fresca e avvolti in un involucro di pasta filata, creando un formaggio unico nel suo genere.</p>

<h3>Dalla Necessità all'Eccellenza</h3>
<p>Quello che nacque come soluzione per non sprecare nulla è diventato oggi uno dei formaggi italiani più apprezzati al mondo. La burrata rappresenta perfettamente la filosofia italiana: trasformare ingredienti semplici in qualcosa di straordinario.</p>

<h2>Come si Produce la Burrata</h2>
<p>La produzione della burrata è un'arte che richiede maestria:</p>
<ol>
<li><strong>La pasta filata:</strong> Si parte dal latte fresco, che viene cagliato e lavorato fino a ottenere la pasta filata</li>
<li><strong>L'involucro:</strong> La pasta viene modellata a mano in una sacca sottile</li>
<li><strong>Il ripieno:</strong> All'interno si inserisce la stracciatella (filamenti di mozzarella) mescolata con panna fresca</li>
<li><strong>La chiusura:</strong> Il sacchetto viene chiuso a mano, creando la caratteristica forma</li>
</ol>

<h2>Come Riconoscere una Burrata di Qualità</h2>
<ul>
<li><strong>Aspetto esterno:</strong> superficie liscia, bianco porcellana, senza macchie</li>
<li><strong>Consistenza:</strong> morbida ma non troppo cedevole</li>
<li><strong>Al taglio:</strong> deve "piangere" rilasciando la stracciatella cremosa</li>
<li><strong>Sapore:</strong> dolce, fresco, con note di latte appena munto</li>
<li><strong>Freschezza:</strong> la burrata va consumata entro 48 ore dalla produzione</li>
</ul>

<h2>Come Servire la Burrata</h2>
<p>La burrata dà il meglio di sé quando viene servita nel modo giusto:</p>
<ul>
<li><strong>Temperatura:</strong> toglierla dal frigo 20-30 minuti prima</li>
<li><strong>Accompagnamenti classici:</strong> pomodorini freschi, basilico, olio extravergine</li>
<li><strong>Con il pane:</strong> focaccia pugliese o pane casereccio</li>
<li><strong>Sulla pizza:</strong> aggiunta a crudo dopo la cottura</li>
<li><strong>Con i salumi:</strong> prosciutto crudo, bresaola</li>
</ul>

<h2>La Burrata in Cucina</h2>
<p>Versatile e raffinata, la burrata si presta a molte preparazioni:</p>
<ul>
<li>Insalata con pomodori e basilico</li>
<li>Sulla pizza margherita (aggiunta a fine cottura)</li>
<li>Con verdure grigliate</li>
<li>Abbinata a prosciutto crudo</li>
<li>In primi piatti estivi (pasta fredda)</li>
</ul>

<h2>Conservazione</h2>
<p>La burrata è un prodotto estremamente delicato:</p>
<ul>
<li><strong>Temperatura:</strong> 4-6°C</li>
<li><strong>Nel suo liquido:</strong> conservare sempre nella sua acqua di governo</li>
<li><strong>Consumo:</strong> idealmente entro 48 ore dalla produzione</li>
<li><strong>Mai congelare:</strong> la consistenza verrebbe compromessa</li>
</ul>

<h2>Burrata Pugliese da LAPA</h2>
<p>LAPA importa burrata fresca direttamente dalla Puglia, garantendo la catena del freddo e la massima freschezza. Consegniamo in tutta la Svizzera per portare l'autentico sapore italiano nel tuo ristorante.</p>

<p><a href="/shop/category/latticini">Scopri la nostra selezione di latticini</a></p>`;

  console.log('\n=== RIPRISTINO ARTICOLO 74 (BURRATA) IN ITALIANO ===\n');
  console.log('Scrittura titolo, sottotitolo e contenuto in italiano...');

  const result = await write(74, {
    name: italianTitle,
    subtitle: italianSubtitle,
    content: italianContent
  });

  if (result.result === true) {
    console.log('OK - Scritto con successo');

    // Verifica
    console.log('\n--- VERIFICA ---\n');
    const langs = ['it_IT', 'de_CH', 'fr_CH', 'en_US'];
    for (const lang of langs) {
      const data = await readWithLang(74, lang);
      console.log(`[${lang}]`);
      console.log(`  Titolo: ${data?.name}`);
      const content = (data?.content || '').replace(/<[^>]*>/g, '').substring(0, 60);
      console.log(`  Contenuto: ${content}...`);
      console.log('');
    }
  } else {
    console.log('ERRORE:', result.error);
  }
}

main();
