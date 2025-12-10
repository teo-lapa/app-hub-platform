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

  const italianTitle = "Come Conservare Correttamente i Prodotti Freschi Italiani";
  const italianSubtitle = "Guida pratica per mantenere la qualità di mozzarella, salumi e altri prodotti freschi";
  const italianContent = `<h2>La Conservazione Fa la Differenza</h2>
<p>Acquistare prodotti italiani di qualità è solo il primo passo. <strong>La corretta conservazione</strong> è fondamentale per mantenere freschezza, sapore e sicurezza alimentare nel tuo ristorante.</p>

<h2>Latticini Freschi</h2>

<h3>Mozzarella di Bufala e Fior di Latte</h3>
<ul>
<li><strong>Temperatura:</strong> 4-8°C (mai sotto i 4°C, diventa gommosa)</li>
<li><strong>Conservazione:</strong> nel liquido di governo originale</li>
<li><strong>Durata:</strong> 2-3 giorni dopo l'apertura</li>
<li><strong>Consiglio:</strong> togliere dal frigo 30 minuti prima dell'uso</li>
</ul>

<h3>Burrata</h3>
<ul>
<li><strong>Temperatura:</strong> 4-6°C</li>
<li><strong>Conservazione:</strong> nella sua bustina con liquido</li>
<li><strong>Durata:</strong> consumare entro 48 ore dalla produzione</li>
<li><strong>Importante:</strong> è il latticino più delicato, gestire con priorità</li>
</ul>

<h3>Ricotta</h3>
<ul>
<li><strong>Temperatura:</strong> 2-4°C</li>
<li><strong>Conservazione:</strong> contenitore chiuso</li>
<li><strong>Durata:</strong> 5-7 giorni</li>
</ul>

<h2>Salumi</h2>

<h3>Prosciutto Crudo (Intero)</h3>
<ul>
<li><strong>Temperatura:</strong> 12-18°C (cantina fresca)</li>
<li><strong>Conservazione:</strong> appendere o su supporto</li>
<li><strong>Protezione:</strong> coprire il taglio con pellicola o carta oleata</li>
</ul>

<h3>Salumi Affettati</h3>
<ul>
<li><strong>Temperatura:</strong> 2-4°C</li>
<li><strong>Conservazione:</strong> sottovuoto o pellicola a contatto</li>
<li><strong>Durata:</strong> 3-5 giorni dopo l'apertura</li>
<li><strong>Consiglio:</strong> affettare al momento quando possibile</li>
</ul>

<h3>Guanciale e Pancetta</h3>
<ul>
<li><strong>Temperatura:</strong> 4-8°C</li>
<li><strong>Conservazione:</strong> avvolti in carta da macelleria</li>
<li><strong>Durata:</strong> 2-3 settimane se interi</li>
</ul>

<h2>Formaggi Stagionati</h2>

<h3>Parmigiano Reggiano</h3>
<ul>
<li><strong>Temperatura:</strong> 4-8°C</li>
<li><strong>Conservazione:</strong> avvolto in carta da formaggio o panno umido</li>
<li><strong>Evitare:</strong> pellicola trasparente che soffoca il formaggio</li>
<li><strong>Durata:</strong> diverse settimane se ben conservato</li>
</ul>

<h3>Gorgonzola e Formaggi Erborinati</h3>
<ul>
<li><strong>Temperatura:</strong> 2-4°C</li>
<li><strong>Conservazione:</strong> contenitore ermetico separato</li>
<li><strong>Importante:</strong> isolare dagli altri alimenti per l'odore</li>
</ul>

<h2>Conserve e Olio</h2>

<h3>Pomodori Pelati e Passate</h3>
<ul>
<li>Prima dell'apertura: ambiente fresco e buio</li>
<li>Dopo l'apertura: frigorifero, contenitore non metallico, 4-5 giorni</li>
</ul>

<h3>Olio Extravergine d'Oliva</h3>
<ul>
<li><strong>Temperatura:</strong> 14-18°C</li>
<li><strong>Conservazione:</strong> al buio, lontano da fonti di calore</li>
<li><strong>Evitare:</strong> luce diretta e calore</li>
</ul>

<h2>Regole Generali</h2>
<ol>
<li>Rispettare sempre la catena del freddo</li>
<li>Usare il sistema FIFO (first in, first out)</li>
<li>Controllare le date di scadenza regolarmente</li>
<li>Non ricongelare prodotti scongelati</li>
<li>Separare i prodotti crudi da quelli cotti</li>
</ol>

<h2>LAPA: Prodotti Freschi Garantiti</h2>
<p>I nostri prodotti arrivano con la catena del freddo garantita. Consegniamo in tutta la Svizzera con veicoli refrigerati.</p>

<p><a href="/shop">Ordina prodotti freschi italiani</a></p>`;

  console.log('\n=== ARTICOLO 81 - ITALIANO ===\n');
  console.log('Scrittura titolo, sottotitolo e contenuto...');

  const result = await write(81, {
    name: italianTitle,
    subtitle: italianSubtitle,
    content: italianContent
  });

  if (result.result === true) {
    console.log('OK - Scritto con successo');

    const check = await read(81);
    console.log('\nVerifica:');
    console.log('Titolo:', check.name);
    console.log('Sottotitolo:', check.subtitle);
    console.log('Contenuto (primi 100 car):', check.content?.replace(/<[^>]*>/g, '').substring(0, 100));
  } else {
    console.log('ERRORE:', result.error);
  }
}

main();
