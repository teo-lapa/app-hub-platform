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

  const italianTitle = "Attrezzature Essenziali per una Pizzeria: La Lista Completa";
  const italianSubtitle = "Tutto quello che serve per avviare e gestire una pizzeria di successo";
  const italianContent = `<h2>Investire nelle Attrezzature Giuste</h2>
<p>Aprire una pizzeria richiede un investimento significativo in attrezzature. Ecco la <strong>lista completa</strong> di tutto ciò che serve, dal forno agli utensili più piccoli.</p>

<h2>Il Forno: Il Cuore della Pizzeria</h2>

<h3>Forno a Legna</h3>
<ul>
<li><strong>Vantaggi:</strong> sapore autentico, cottura perfetta, scenografico</li>
<li><strong>Svantaggi:</strong> richiede esperienza, manutenzione, spazio</li>
<li><strong>Ideale per:</strong> pizzerie napoletane tradizionali</li>
<li><strong>Temperatura:</strong> 450-500°C</li>
</ul>

<h3>Forno a Gas</h3>
<ul>
<li><strong>Vantaggi:</strong> controllo preciso temperatura, manutenzione ridotta</li>
<li><strong>Svantaggi:</strong> sapore leggermente diverso dal legna</li>
<li><strong>Ideale per:</strong> pizzerie con alto volume</li>
</ul>

<h3>Forno Elettrico</h3>
<ul>
<li><strong>Vantaggi:</strong> facilità d'uso, temperatura costante, compatto</li>
<li><strong>Svantaggi:</strong> consumo energetico, meno autentico</li>
<li><strong>Ideale per:</strong> pizzerie al taglio, piccoli spazi</li>
</ul>

<h2>Attrezzature per l'Impasto</h2>

<h3>Impastatrice</h3>
<ul>
<li>Impastatrice a spirale: ideale per impasti idratati</li>
<li>Impastatrice a forcella: tradizionale napoletana</li>
<li>Capacità: calcolare in base alla produzione giornaliera</li>
</ul>

<h3>Contenitori per Lievitazione</h3>
<ul>
<li>Cassette in plastica alimentare</li>
<li>Coperchi per evitare formazione di crosta</li>
<li>Dimensioni standard: 60x40 cm</li>
</ul>

<h3>Cella di Lievitazione</h3>
<ul>
<li>Temperatura controllata (4-25°C)</li>
<li>Umidità controllata</li>
<li>Essenziale per lievitazioni lunghe</li>
</ul>

<h2>Banco Pizza</h2>

<h3>Banco Refrigerato</h3>
<ul>
<li>Piano in marmo o granito (ideale per stendere)</li>
<li>Vaschette GN per ingredienti</li>
<li>Temperatura 2-4°C</li>
</ul>

<h3>Utensili Essenziali</h3>
<ul>
<li><strong>Pale:</strong> per infornare e sfornare (diverse misure)</li>
<li><strong>Palino:</strong> per girare la pizza nel forno</li>
<li><strong>Rotella tagliapizza:</strong> professionale</li>
<li><strong>Bilance:</strong> di precisione per ingredienti</li>
<li><strong>Dosatori:</strong> per olio e condimenti</li>
</ul>

<h2>Refrigerazione</h2>

<h3>Frigoriferi</h3>
<ul>
<li>Armadio frigorifero per ingredienti</li>
<li>Cella frigorifera (per volumi alti)</li>
<li>Frigorifero per bevande (sala)</li>
</ul>

<h3>Congelatore</h3>
<ul>
<li>Per scorte e prodotti congelati</li>
<li>Abbattitore (opzionale, per conservazione avanzata)</li>
</ul>

<h2>Piccole Attrezzature</h2>
<ul>
<li>Coltelli professionali</li>
<li>Taglieri (diversi per ingredienti)</li>
<li>Contenitori per ingredienti</li>
<li>Grattugia per formaggio</li>
<li>Spruzzatore per olio</li>
<li>Timer</li>
<li>Termometro a infrarossi</li>
</ul>

<h2>Attrezzature per la Sala</h2>
<ul>
<li>Sistema POS/cassa</li>
<li>Espositori per pizze al taglio</li>
<li>Scaldapizze</li>
<li>Carrelli porta pizze</li>
</ul>

<h2>Checklist di Avvio</h2>
<ol>
<li>Forno adeguato al tipo di pizza</li>
<li>Impastatrice dimensionata alla produzione</li>
<li>Sistema di refrigerazione completo</li>
<li>Banco pizza professionale</li>
<li>Set completo di utensili</li>
<li>Sistema di lievitazione controllata</li>
</ol>

<h2>E gli Ingredienti?</h2>
<p>Le attrezzature sono fondamentali, ma servono anche ingredienti di qualità. LAPA fornisce tutti i prodotti italiani necessari per la tua pizzeria, consegnati freschi in Svizzera.</p>

<p><a href="/shop">Scopri i nostri prodotti per pizzerie</a></p>`;

  console.log('\n=== ARTICOLO 86 - ITALIANO ===\n');
  console.log('Scrittura titolo, sottotitolo e contenuto...');

  const result = await write(86, {
    name: italianTitle,
    subtitle: italianSubtitle,
    content: italianContent
  });

  if (result.result === true) {
    console.log('OK - Scritto con successo');

    const check = await read(86);
    console.log('\nVerifica:');
    console.log('Titolo:', check.name);
    console.log('Sottotitolo:', check.subtitle);
    console.log('Contenuto (primi 100 car):', check.content?.replace(/<[^>]*>/g, '').substring(0, 100));
  } else {
    console.log('ERRORE:', result.error);
  }
}

main();
