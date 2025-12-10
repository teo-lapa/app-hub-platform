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

  const italianTitle = "Guanciale vs Pancetta: Qual è la Differenza";
  const italianSubtitle = "Guida completa per capire quando usare guanciale o pancetta nei tuoi piatti";
  const italianContent = `<h2>Due Salumi, Due Tradizioni</h2>
<p>Guanciale e pancetta sono spesso confusi, ma sono salumi molto diversi. Conoscere le differenze è essenziale per preparare <strong>piatti italiani autentici</strong> come la carbonara e l'amatriciana.</p>

<h2>Il Guanciale</h2>

<h3>Cos'è il Guanciale</h3>
<p>Il guanciale è un salume ottenuto dalla <strong>guancia del maiale</strong>. È tipico del Lazio e dell'Umbria, stagionato con sale, pepe e spezie.</p>

<h3>Caratteristiche</h3>
<ul>
<li><strong>Taglio:</strong> guancia del maiale</li>
<li><strong>Grasso:</strong> molto grasso, con venature di carne magra</li>
<li><strong>Stagionatura:</strong> minimo 3 mesi</li>
<li><strong>Sapore:</strong> intenso, leggermente dolce, con note di pepe</li>
<li><strong>Consistenza:</strong> si scioglie in cottura rilasciando grasso saporito</li>
</ul>

<h3>Utilizzi Tradizionali</h3>
<ul>
<li><strong>Carbonara:</strong> il guanciale è OBBLIGATORIO per la vera carbonara</li>
<li><strong>Amatriciana:</strong> insieme al pecorino romano</li>
<li><strong>Gricia:</strong> la "cacio e pepe con guanciale"</li>
</ul>

<h2>La Pancetta</h2>

<h3>Cos'è la Pancetta</h3>
<p>La pancetta è ottenuta dalla <strong>pancia del maiale</strong>. Può essere tesa (piatta) o arrotolata, stagionata o affumicata.</p>

<h3>Caratteristiche</h3>
<ul>
<li><strong>Taglio:</strong> pancia del maiale</li>
<li><strong>Grasso:</strong> strati alternati di grasso e carne</li>
<li><strong>Stagionatura:</strong> variabile, da fresca a stagionata</li>
<li><strong>Sapore:</strong> più delicato del guanciale, può essere affumicato</li>
<li><strong>Consistenza:</strong> più carnosa, meno grassa</li>
</ul>

<h3>Utilizzi Tradizionali</h3>
<ul>
<li>Sughi e ragù</li>
<li>Avvolgere carni e verdure</li>
<li>Pasta e fagioli</li>
<li>Minestre e zuppe</li>
</ul>

<h2>Le Differenze Principali</h2>
<table>
<tr><th>Caratteristica</th><th>Guanciale</th><th>Pancetta</th></tr>
<tr><td>Parte del maiale</td><td>Guancia</td><td>Pancia</td></tr>
<tr><td>Contenuto di grasso</td><td>Molto alto</td><td>Medio</td></tr>
<tr><td>Sapore</td><td>Intenso, dolce</td><td>Delicato</td></tr>
<tr><td>Uso in carbonara</td><td>Tradizionale</td><td>Non autentico</td></tr>
</table>

<h2>Posso Sostituire l'Uno con l'Altro?</h2>
<p>In emergenza sì, ma il risultato sarà diverso:</p>
<ul>
<li>La <strong>carbonara con pancetta</strong> non è autentica e sarà meno saporita</li>
<li>Per piatti dove il guanciale è protagonista, non c'è sostituto</li>
<li>La pancetta funziona meglio in piatti dove è un ingrediente tra tanti</li>
</ul>

<h2>Trova Guanciale e Pancetta di Qualità</h2>
<p>LAPA offre guanciale e pancetta italiani autentici per ristoranti in Svizzera. Prodotti selezionati, consegnati freschi.</p>

<p><a href="/shop/category/salumi">Scopri i nostri salumi</a></p>`;

  console.log('\n=== ARTICOLO 80 - ITALIANO ===\n');
  console.log('Scrittura titolo, sottotitolo e contenuto...');

  const result = await write(80, {
    name: italianTitle,
    subtitle: italianSubtitle,
    content: italianContent
  });

  if (result.result === true) {
    console.log('OK - Scritto con successo');

    const check = await read(80);
    console.log('\nVerifica:');
    console.log('Titolo:', check.name);
    console.log('Sottotitolo:', check.subtitle);
    console.log('Contenuto (primi 100 car):', check.content?.replace(/<[^>]*>/g, '').substring(0, 100));
  } else {
    console.log('ERRORE:', result.error);
  }
}

main();
