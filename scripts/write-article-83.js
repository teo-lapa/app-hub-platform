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

  const italianTitle = "Pasta Fresca vs Pasta Secca: Guida per Ristoratori";
  const italianSubtitle = "Quando usare pasta fresca e quando pasta secca nel tuo ristorante";
  const italianContent = `<h2>Due Tradizioni, Una Passione</h2>
<p>In Italia, sia la pasta fresca che quella secca hanno una lunga tradizione. <strong>Non esiste una "migliore"</strong> - dipende dal piatto, dalla regione e dalla tradizione culinaria che vuoi rappresentare.</p>

<h2>Pasta Secca</h2>

<h3>Caratteristiche</h3>
<ul>
<li><strong>Ingredienti:</strong> semola di grano duro e acqua</li>
<li><strong>Produzione:</strong> trafilata ed essiccata</li>
<li><strong>Conservazione:</strong> lunga durata, temperatura ambiente</li>
<li><strong>Cottura:</strong> tiene bene la cottura, al dente</li>
</ul>

<h3>Quando Sceglierla</h3>
<ul>
<li>Sughi a base di olio (aglio olio, pomodoro)</li>
<li>Sughi di pesce</li>
<li>Piatti della tradizione meridionale</li>
<li>Quando serve consistenza al dente</li>
</ul>

<h3>Formati Classici</h3>
<p>Spaghetti, penne, rigatoni, fusilli, paccheri, linguine, bucatini.</p>

<h3>Come Riconoscere la Qualità</h3>
<ul>
<li><strong>Trafilatura al bronzo:</strong> superficie ruvida che trattiene il sugo</li>
<li><strong>Essiccazione lenta:</strong> a bassa temperatura, preserva sapore e nutrienti</li>
<li><strong>Colore:</strong> giallo paglierino, non troppo brillante</li>
</ul>

<h2>Pasta Fresca</h2>

<h3>Caratteristiche</h3>
<ul>
<li><strong>Ingredienti:</strong> farina 00 (o semola), uova (spesso)</li>
<li><strong>Produzione:</strong> impastata e modellata, non essiccata</li>
<li><strong>Conservazione:</strong> breve, refrigerata o congelata</li>
<li><strong>Cottura:</strong> rapida, più morbida</li>
</ul>

<h3>Quando Sceglierla</h3>
<ul>
<li>Paste ripiene (tortellini, ravioli, agnolotti)</li>
<li>Tagliatelle con ragù</li>
<li>Lasagne</li>
<li>Piatti della tradizione emiliana e centro-nord</li>
</ul>

<h3>Formati Classici</h3>
<p>Tagliatelle, pappardelle, fettuccine, lasagne, tortellini, ravioli, gnocchi.</p>

<h2>Confronto Diretto</h2>
<table>
<tr><th>Aspetto</th><th>Pasta Secca</th><th>Pasta Fresca</th></tr>
<tr><td>Conservazione</td><td>Mesi</td><td>Giorni (o congelata)</td></tr>
<tr><td>Tempo di cottura</td><td>8-15 minuti</td><td>2-5 minuti</td></tr>
<tr><td>Consistenza</td><td>Al dente, strutturata</td><td>Morbida, delicata</td></tr>
<tr><td>Abbinamento ideale</td><td>Sughi leggeri, olio</td><td>Sughi ricchi, ragù, burro</td></tr>
<tr><td>Costo</td><td>Inferiore</td><td>Superiore</td></tr>
</table>

<h2>Consigli per Ristoratori</h2>

<h3>Gestione dell'Inventario</h3>
<ul>
<li>Pasta secca: scorte maggiori, nessun problema di conservazione</li>
<li>Pasta fresca: ordini frequenti, gestione più attenta</li>
</ul>

<h3>Menu Balance</h3>
<p>Un buon menu italiano dovrebbe includere entrambe:</p>
<ul>
<li>Primi con pasta secca per piatti tradizionali del sud</li>
<li>Primi con pasta fresca per specialità del centro-nord</li>
<li>La varietà arricchisce l'offerta</li>
</ul>

<h2>Pasta Italiana da LAPA</h2>
<p>Offriamo pasta secca di alta qualità (trafilata al bronzo) e pasta fresca italiana. Tutto consegnato fresco in Svizzera.</p>

<p><a href="/shop/category/pasta">Scopri la nostra selezione di pasta</a></p>`;

  console.log('\n=== ARTICOLO 83 - ITALIANO ===\n');
  console.log('Scrittura titolo, sottotitolo e contenuto...');

  const result = await write(83, {
    name: italianTitle,
    subtitle: italianSubtitle,
    content: italianContent
  });

  if (result.result === true) {
    console.log('OK - Scritto con successo');

    const check = await read(83);
    console.log('\nVerifica:');
    console.log('Titolo:', check.name);
    console.log('Sottotitolo:', check.subtitle);
    console.log('Contenuto (primi 100 car):', check.content?.replace(/<[^>]*>/g, '').substring(0, 100));
  } else {
    console.log('ERRORE:', result.error);
  }
}

main();
