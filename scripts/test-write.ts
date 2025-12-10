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
  console.log('Autenticato:', !!sid);
}

async function write(id: number, values: any): Promise<any> {
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

  return await r.json();
}

async function read(id: number): Promise<any> {
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
        kwargs: { fields: ['name', 'content'] }
      },
      id: Date.now()
    })
  });

  return await r.json();
}

async function main() {
  await auth();

  const italianContent = `<h2>Perché la Scelta del Fornitore è Fondamentale</h2>
<p>Aprire una pizzeria di successo in Svizzera richiede molto più di una buona ricetta. <strong>La qualità degli ingredienti</strong> fa la differenza tra una pizza mediocre e una eccezionale. Per questo, scegliere il fornitore giusto è una delle decisioni più importanti che prenderai.</p>

<h2>I 5 Criteri Essenziali per Scegliere un Fornitore</h2>

<h3>1. Qualità dei Prodotti</h3>
<p>Non tutti i fornitori sono uguali. Cerca un grossista che:</p>
<ul>
<li>Importi direttamente dall'Italia</li>
<li>Offra prodotti DOP e IGP certificati</li>
<li>Garantisca la catena del freddo per i freschi</li>
<li>Abbia una selezione ampia di mozzarelle (fior di latte, bufala, burrata)</li>
</ul>

<h3>2. Affidabilità delle Consegne</h3>
<p>Una pizzeria non può permettersi di restare senza ingredienti. Il tuo fornitore deve garantire:</p>
<ul>
<li>Consegne puntuali e regolari</li>
<li>Flessibilità negli orari</li>
<li>Possibilità di ordini urgenti</li>
<li>Copertura in tutta la Svizzera</li>
</ul>

<h3>3. Rapporto Qualità-Prezzo</h3>
<p>Il prezzo più basso non è sempre la scelta migliore. Valuta il <strong>valore complessivo</strong>: qualità, servizio, affidabilità e supporto.</p>

<h2>Perché Scegliere LAPA come Fornitore</h2>
<p>LAPA è il grossista di riferimento per pizzerie e ristoranti italiani in Svizzera. Offriamo:</p>
<ul>
<li>✅ Oltre 3.000 prodotti italiani autentici</li>
<li>✅ Consegna in tutta la Svizzera</li>
<li>✅ Nessun minimo d'ordine</li>
<li>✅ Prodotti freschi consegnati in 24-48 ore</li>
<li>✅ Assistenza dedicata per ogni cliente</li>
</ul>

<h2>Conclusione</h2>
<p>Scegliere il fornitore giusto è un investimento nel successo della tua pizzeria. Non accontentarti: i tuoi clienti meritano ingredienti di qualità, e tu meriti un partner affidabile.</p>

<p><strong>Vuoi scoprire i nostri prodotti?</strong> <a href="/shop">Visita il nostro catalogo</a> o <a href="/contactus">contattaci</a> per una consulenza gratuita.</p>`;

  console.log('Scrittura contenuto italiano per articolo 75 (SENZA context lingua)...');
  const writeResult = await write(75, { content: italianContent });
  console.log('Risultato:', writeResult.result ? 'OK' : 'ERRORE');

  console.log('\nVerifica...');
  const after = await read(75);
  console.log('Contenuto dopo:', after.result?.[0]?.content?.substring(0, 80));
}

main();
