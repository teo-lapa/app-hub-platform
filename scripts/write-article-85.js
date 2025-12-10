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

  const italianTitle = "Pomodori per Pizza: San Marzano e Alternative di Qualità";
  const italianSubtitle = "Come scegliere i pomodori giusti per la tua pizza napoletana";
  const italianContent = `<h2>Il Cuore Rosso della Pizza</h2>
<p>Il pomodoro è uno degli ingredienti più importanti della pizza. La <strong>scelta del pomodoro giusto</strong> influenza profondamente il sapore finale. Ma quali usare?</p>

<h2>Pomodoro San Marzano DOP</h2>

<h3>Perché è Speciale</h3>
<p>Il San Marzano dell'Agro Sarnese-Nocerino DOP è considerato il pomodoro per eccellenza per la pizza napoletana.</p>
<ul>
<li><strong>Forma:</strong> allungata, cilindrica</li>
<li><strong>Polpa:</strong> carnosa, pochi semi</li>
<li><strong>Sapore:</strong> dolce, bassa acidità</li>
<li><strong>Buccia:</strong> si pela facilmente</li>
</ul>

<h3>Come Riconoscere il Vero San Marzano DOP</h3>
<ul>
<li>Marchio DOP sulla confezione</li>
<li>Numero di lotto e codice del consorzio</li>
<li>Provenienza: Agro Sarnese-Nocerino (provincia di Napoli e Salerno)</li>
<li>Prezzo: non può essere troppo economico</li>
</ul>

<h3>Utilizzo sulla Pizza</h3>
<ul>
<li>Schiacciare a mano o passare grossolanamente</li>
<li>Non cuocere il pomodoro prima</li>
<li>Condire con sale, olio e basilico</li>
<li>Stendere uniformemente sulla pizza</li>
</ul>

<h2>Alternative di Qualità</h2>

<h3>Pomodorino del Piennolo del Vesuvio DOP</h3>
<ul>
<li><strong>Caratteristiche:</strong> piccolo, a grappolo, sapore intenso</li>
<li><strong>Utilizzo:</strong> pizza marinara, focacce, bruschette</li>
<li><strong>Nota:</strong> più costoso, per pizze premium</li>
</ul>

<h3>Pomodoro Corbarino</h3>
<ul>
<li><strong>Caratteristiche:</strong> piccolo, dolce, poco acido</li>
<li><strong>Utilizzo:</strong> alternativa al San Marzano, sughi veloci</li>
<li><strong>Vantaggio:</strong> ottimo rapporto qualità-prezzo</li>
</ul>

<h3>Pomodoro Datterino</h3>
<ul>
<li><strong>Caratteristiche:</strong> piccolo, molto dolce</li>
<li><strong>Utilizzo:</strong> pizze gourmet, decorazione, crudo</li>
</ul>

<h3>Passata di Pomodoro</h3>
<ul>
<li><strong>Utilizzo:</strong> base per sughi, pizze con pomodoro più liscio</li>
<li><strong>Consiglio:</strong> scegliere passate di pomodori italiani al 100%</li>
</ul>

<h2>Pelati vs Passata vs Pomodorini</h2>
<table>
<tr><th>Tipo</th><th>Utilizzo Ideale</th><th>Consistenza</th></tr>
<tr><td>Pelati San Marzano</td><td>Pizza napoletana classica</td><td>Pezzi, rustico</td></tr>
<tr><td>Passata</td><td>Pizza romana, base sughi</td><td>Liscia, uniforme</td></tr>
<tr><td>Pomodorini</td><td>Pizze gourmet, marinara</td><td>Pezzi interi o tagliati</td></tr>
</table>

<h2>Conservazione</h2>
<ul>
<li><strong>Prima dell'apertura:</strong> ambiente fresco e asciutto</li>
<li><strong>Dopo l'apertura:</strong> trasferire in contenitore non metallico, frigorifero, 4-5 giorni</li>
<li><strong>Consiglio:</strong> non lasciare nella latta aperta</li>
</ul>

<h2>Errori da Evitare</h2>
<ol>
<li>Usare pomodori troppo acidi</li>
<li>Cuocere il sugo prima di metterlo sulla pizza</li>
<li>Mettere troppo pomodoro (la pizza diventa acquosa)</li>
<li>Usare concentrato di pomodoro puro</li>
</ol>

<h2>Pomodori Italiani da LAPA</h2>
<p>Offriamo San Marzano DOP e altre varietà di pomodori italiani di alta qualità per pizzerie e ristoranti. Prodotti selezionati, consegnati in tutta la Svizzera.</p>

<p><a href="/shop/category/conserve">Scopri i nostri pomodori</a></p>`;

  console.log('\n=== ARTICOLO 85 - ITALIANO ===\n');
  console.log('Scrittura titolo, sottotitolo e contenuto...');

  const result = await write(85, {
    name: italianTitle,
    subtitle: italianSubtitle,
    content: italianContent
  });

  if (result.result === true) {
    console.log('OK - Scritto con successo');

    const check = await read(85);
    console.log('\nVerifica:');
    console.log('Titolo:', check.name);
    console.log('Sottotitolo:', check.subtitle);
    console.log('Contenuto (primi 100 car):', check.content?.replace(/<[^>]*>/g, '').substring(0, 100));
  } else {
    console.log('ERRORE:', result.error);
  }
}

main();
