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

async function read(id) {
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
        kwargs: { fields: ['name', 'subtitle', 'content'] }
      },
      id: Date.now()
    })
  });
  return (await r.json()).result?.[0];
}

async function main() {
  await auth();

  const italianTitle = "Mozzarella di Bufala vs Fior di Latte: Le Differenze";
  const italianSubtitle = "Guida completa per scegliere la mozzarella giusta per ogni piatto";
  const italianContent = `<h2>Due Formaggi, Due Mondi Diversi</h2>
<p>Spesso confuse o considerate intercambiabili, la <strong>mozzarella di bufala</strong> e il <strong>fior di latte</strong> sono in realtà due formaggi molto diversi. Conoscere le differenze è fondamentale per ogni ristoratore e pizzaiolo.</p>

<h2>Mozzarella di Bufala</h2>

<h3>Origine e Produzione</h3>
<p>La mozzarella di bufala è prodotta esclusivamente con latte di bufala. La versione DOP proviene dalla Campania e dal basso Lazio, dove le bufale vengono allevate secondo tradizione.</p>

<h3>Caratteristiche</h3>
<ul>
<li><strong>Sapore:</strong> intenso, leggermente acidulo, con note di latte fresco</li>
<li><strong>Consistenza:</strong> morbida, succosa, con la caratteristica "lacrima" quando tagliata</li>
<li><strong>Colore:</strong> bianco porcellana</li>
<li><strong>Contenuto di grassi:</strong> più alto rispetto al fior di latte</li>
</ul>

<h3>Utilizzi Ideali</h3>
<ul>
<li>Caprese e insalate fresche</li>
<li>Pizza margherita (aggiunta a fine cottura)</li>
<li>Antipasti e taglieri</li>
<li>Consumo fresco con pomodorini e basilico</li>
</ul>

<h2>Fior di Latte</h2>

<h3>Origine e Produzione</h3>
<p>Il fior di latte è prodotto con latte vaccino fresco. Può essere prodotto in tutta Italia, ma le versioni più pregiate provengono dalla Campania (fior di latte di Agerola).</p>

<h3>Caratteristiche</h3>
<ul>
<li><strong>Sapore:</strong> delicato, dolce, meno intenso della bufala</li>
<li><strong>Consistenza:</strong> più compatta, meno acquosa</li>
<li><strong>Colore:</strong> bianco latte</li>
<li><strong>Contenuto di grassi:</strong> inferiore alla bufala</li>
</ul>

<h3>Utilizzi Ideali</h3>
<ul>
<li>Pizza (si scioglie meglio e rilascia meno acqua)</li>
<li>Lasagne e timballi</li>
<li>Parmigiana di melanzane</li>
<li>Piatti al forno in generale</li>
</ul>

<h2>Quale Scegliere per la Pizza?</h2>
<p>Per la <strong>pizza napoletana</strong> tradizionale:</p>
<ul>
<li><strong>Fior di latte:</strong> ideale per la cottura, si scioglie uniformemente senza rilasciare troppa acqua</li>
<li><strong>Bufala:</strong> da aggiungere a crudo dopo la cottura, o a pezzi negli ultimi secondi</li>
</ul>
<p>Molti pizzaioli usano una combinazione: fior di latte per la base e bufala fresca aggiunta dopo.</p>

<h2>Conservazione</h2>
<p>Entrambe le mozzarelle vanno conservate nel loro liquido di governo, in frigorifero. La bufala è più delicata e va consumata entro 2-3 giorni dall'acquisto. Il fior di latte ha una shelf life leggermente più lunga.</p>

<h2>LAPA: Mozzarelle Italiane Autentiche</h2>
<p>Forniamo sia mozzarella di bufala DOP che fior di latte di alta qualità, consegnati freschi in tutta la Svizzera. I nostri prodotti arrivano direttamente dai caseifici italiani.</p>

<p><a href="/shop/category/latticini">Scopri la nostra selezione di latticini</a></p>`;

  console.log('\n=== ARTICOLO 77 - ITALIANO ===\n');
  console.log('Scrittura titolo, sottotitolo e contenuto...');

  const result = await write(77, {
    name: italianTitle,
    subtitle: italianSubtitle,
    content: italianContent
  });

  if (result.result === true) {
    console.log('OK - Scritto con successo');

    const check = await read(77);
    console.log('\nVerifica:');
    console.log('Titolo:', check.name);
    console.log('Sottotitolo:', check.subtitle);
    console.log('Contenuto (primi 100 car):', check.content?.replace(/<[^>]*>/g, '').substring(0, 100));
  } else {
    console.log('ERRORE:', result.error);
  }
}

main();
