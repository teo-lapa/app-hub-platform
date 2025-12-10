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

  const italianTitle = "Guida Completa: Aprire un Ristorante Italiano in Svizzera";
  const italianSubtitle = "Tutto quello che devi sapere per avviare la tua attività di ristorazione italiana";
  const italianContent = `<h2>Il Sogno di Aprire un Ristorante Italiano</h2>
<p>La Svizzera è un mercato ideale per la ristorazione italiana. Con una forte comunità italiana e una passione diffusa per la cucina mediterranea, aprire un ristorante italiano può essere un'ottima opportunità di business.</p>

<h2>I Passi Fondamentali</h2>

<h3>1. Business Plan e Finanziamenti</h3>
<p>Prima di tutto, devi avere un piano solido:</p>
<ul>
<li>Definisci il tuo concept (trattoria, pizzeria, fine dining)</li>
<li>Stima i costi di avvio (location, attrezzature, licenze)</li>
<li>Calcola i costi operativi mensili</li>
<li>Prevedi il break-even point</li>
</ul>

<h3>2. Location e Permessi</h3>
<p>La scelta della location è cruciale. Considera:</p>
<ul>
<li>Traffico pedonale e visibilità</li>
<li>Parcheggio e accessibilità</li>
<li>Concorrenza nella zona</li>
<li>Costi di affitto</li>
</ul>
<p>Ricorda di ottenere tutti i permessi necessari: licenza per la somministrazione, autorizzazioni sanitarie, permessi comunali.</p>

<h3>3. Attrezzature e Arredamento</h3>
<p>Investi in attrezzature di qualità:</p>
<ul>
<li>Cucina professionale completa</li>
<li>Forno per pizza (se applicabile)</li>
<li>Sistemi di refrigerazione adeguati</li>
<li>Arredamento che rifletta l'atmosfera italiana</li>
</ul>

<h3>4. Menu e Fornitori</h3>
<p>Il menu è il cuore del tuo ristorante. Per distinguerti:</p>
<ul>
<li>Usa ingredienti italiani autentici</li>
<li>Scegli fornitori affidabili per prodotti freschi</li>
<li>Offri piatti tradizionali eseguiti alla perfezione</li>
<li>Considera specialità regionali italiane</li>
</ul>

<h3>5. Staff e Formazione</h3>
<p>Il personale fa la differenza:</p>
<ul>
<li>Assumi chef con esperienza in cucina italiana</li>
<li>Forma il personale di sala sui piatti e sui vini</li>
<li>Crea un ambiente di lavoro positivo</li>
</ul>

<h2>L'Importanza dei Fornitori Giusti</h2>
<p>Un ristorante italiano autentico ha bisogno di ingredienti autentici. Scegli un grossista che possa fornirti:</p>
<ul>
<li>Pasta fresca e secca di qualità</li>
<li>Formaggi DOP italiani</li>
<li>Salumi tradizionali</li>
<li>Olio extravergine d'oliva</li>
<li>Prodotti freschi consegnati regolarmente</li>
</ul>

<h2>LAPA: Il Partner per il Tuo Ristorante</h2>
<p>LAPA supporta ristoranti italiani in tutta la Svizzera con oltre 3.000 prodotti autentici. Consegniamo in tutto il paese senza minimi d'ordine, permettendoti di gestire il tuo inventario con flessibilità.</p>

<p><strong>Stai pianificando il tuo ristorante?</strong> <a href="/contactus">Contattaci</a> per scoprire come possiamo supportare la tua attività.</p>`;

  console.log('\n=== ARTICOLO 76 - ITALIANO ===\n');
  console.log('Scrittura titolo, sottotitolo e contenuto...');

  const result = await write(76, {
    name: italianTitle,
    subtitle: italianSubtitle,
    content: italianContent
  });

  if (result.result === true) {
    console.log('OK - Scritto con successo');

    const check = await read(76);
    console.log('\nVerifica:');
    console.log('Titolo:', check.name);
    console.log('Sottotitolo:', check.subtitle);
    console.log('Contenuto (primi 100 car):', check.content?.replace(/<[^>]*>/g, '').substring(0, 100));
  } else {
    console.log('ERRORE:', result.error);
  }
}

main();
