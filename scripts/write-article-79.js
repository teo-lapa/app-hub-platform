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

  const italianTitle = "Come Scegliere un Grossista di Prodotti Italiani";
  const italianSubtitle = "I criteri fondamentali per selezionare il fornitore ideale per il tuo ristorante";
  const italianContent = `<h2>L'Importanza del Grossista Giusto</h2>
<p>Per un ristorante italiano autentico, la scelta del grossista è una decisione strategica. Un buon fornitore non è solo chi ti vende prodotti, ma un <strong>partner commerciale</strong> che contribuisce al successo della tua attività.</p>

<h2>I Criteri di Selezione</h2>

<h3>1. Autenticità dei Prodotti</h3>
<p>Il primo criterio è l'autenticità. Verifica che il grossista:</p>
<ul>
<li>Importi direttamente dall'Italia</li>
<li>Offra prodotti DOP e IGP certificati</li>
<li>Possa fornire documentazione sull'origine</li>
<li>Lavori con produttori italiani riconosciuti</li>
</ul>

<h3>2. Gamma di Prodotti</h3>
<p>Un grossista completo dovrebbe coprire tutte le tue esigenze:</p>
<ul>
<li>Latticini freschi (mozzarella, burrata, ricotta)</li>
<li>Salumi italiani (prosciutto, salame, mortadella)</li>
<li>Formaggi stagionati (Parmigiano, Pecorino, Gorgonzola)</li>
<li>Pasta secca e fresca</li>
<li>Conserve e sughi</li>
<li>Olio e aceto</li>
<li>Farine professionali</li>
</ul>

<h3>3. Logistica e Consegne</h3>
<p>La logistica è fondamentale, specialmente per i prodotti freschi:</p>
<ul>
<li>Frequenza delle consegne</li>
<li>Copertura geografica</li>
<li>Catena del freddo garantita</li>
<li>Flessibilità negli orari</li>
<li>Possibilità di ordini urgenti</li>
</ul>

<h3>4. Condizioni Commerciali</h3>
<p>Valuta attentamente:</p>
<ul>
<li>Minimi d'ordine (se esistono)</li>
<li>Termini di pagamento</li>
<li>Politiche di reso per prodotti danneggiati</li>
<li>Sconti per volumi</li>
</ul>

<h3>5. Servizio Clienti</h3>
<p>Un buon grossista offre supporto:</p>
<ul>
<li>Consulenza sui prodotti</li>
<li>Gestione ordini semplice (online, telefono, app)</li>
<li>Risposta rapida ai problemi</li>
<li>Informazioni su novità e stagionalità</li>
</ul>

<h2>Domande da Fare al Potenziale Fornitore</h2>
<ol>
<li>Da dove provengono i vostri prodotti?</li>
<li>Qual è la frequenza di consegna nella mia zona?</li>
<li>Avete minimi d'ordine?</li>
<li>Come gestite i reclami sui prodotti?</li>
<li>Posso visitare il vostro magazzino?</li>
</ol>

<h2>LAPA: Il Grossista per Ristoranti Italiani</h2>
<p>LAPA soddisfa tutti questi criteri:</p>
<ul>
<li>Oltre 3.000 prodotti italiani autentici</li>
<li>Consegna in tutta la Svizzera</li>
<li>Nessun minimo d'ordine</li>
<li>Ordini online 24/7</li>
<li>Assistenza dedicata</li>
</ul>

<p><a href="/contactus">Richiedi informazioni</a> o <a href="/shop">esplora il nostro catalogo</a></p>`;

  console.log('\n=== ARTICOLO 79 - ITALIANO ===\n');
  console.log('Scrittura titolo, sottotitolo e contenuto...');

  const result = await write(79, {
    name: italianTitle,
    subtitle: italianSubtitle,
    content: italianContent
  });

  if (result.result === true) {
    console.log('OK - Scritto con successo');

    const check = await read(79);
    console.log('\nVerifica:');
    console.log('Titolo:', check.name);
    console.log('Sottotitolo:', check.subtitle);
    console.log('Contenuto (primi 100 car):', check.content?.replace(/<[^>]*>/g, '').substring(0, 100));
  } else {
    console.log('ERRORE:', result.error);
  }
}

main();
