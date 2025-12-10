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

  const italianTitle = "I Formaggi DOP Italiani che Ogni Ristorante Deve Avere";
  const italianSubtitle = "La guida definitiva ai formaggi italiani certificati per la ristorazione";
  const italianContent = `<h2>L'Eccellenza Casearia Italiana</h2>
<p>L'Italia vanta oltre 50 formaggi DOP, il numero più alto al mondo. Per un ristorante italiano autentico, alcuni di questi sono <strong>assolutamente essenziali</strong>.</p>

<h2>I Formaggi Imprescindibili</h2>

<h3>1. Parmigiano Reggiano DOP</h3>
<p>Il "Re dei formaggi" è indispensabile in ogni cucina italiana.</p>
<ul>
<li><strong>Stagionatura:</strong> minimo 12 mesi, ideale 24-36 mesi</li>
<li><strong>Utilizzi:</strong> grattugiato su pasta, risotti, insalate; a scaglie negli antipasti</li>
<li><strong>Conservazione:</strong> sottovuoto o avvolto in panno umido</li>
<li><strong>Consiglio:</strong> non buttare le croste, usale per insaporire brodi e minestre</li>
</ul>

<h3>2. Grana Padano DOP</h3>
<p>Simile al Parmigiano ma più dolce e versatile.</p>
<ul>
<li><strong>Stagionatura:</strong> minimo 9 mesi</li>
<li><strong>Utilizzi:</strong> alternativa più economica al Parmigiano</li>
<li><strong>Differenza:</strong> più delicato, meno granuloso</li>
</ul>

<h3>3. Mozzarella di Bufala Campana DOP</h3>
<p>Per caprese autentiche e pizze premium.</p>
<ul>
<li><strong>Freschezza:</strong> consumare entro 2-3 giorni</li>
<li><strong>Utilizzi:</strong> caprese, pizza (a crudo), antipasti</li>
<li><strong>Temperatura:</strong> servire a temperatura ambiente</li>
</ul>

<h3>4. Gorgonzola DOP</h3>
<p>L'erborinato italiano per eccellenza, in due versioni.</p>
<ul>
<li><strong>Dolce:</strong> cremoso, ideale per salse e primi</li>
<li><strong>Piccante:</strong> più stagionato, per taglieri e secondi</li>
<li><strong>Utilizzi:</strong> salsa per gnocchi, risotti, accompagnamento carni</li>
</ul>

<h3>5. Pecorino Romano DOP</h3>
<p>Essenziale per i piatti romani tradizionali.</p>
<ul>
<li><strong>Caratteristiche:</strong> sapore deciso, salato</li>
<li><strong>Utilizzi:</strong> carbonara, cacio e pepe, amatriciana, gricia</li>
<li><strong>Attenzione:</strong> non sostituire con Parmigiano nei piatti romani!</li>
</ul>

<h3>6. Pecorino Toscano DOP</h3>
<p>Più delicato del Romano, versatile.</p>
<ul>
<li><strong>Versioni:</strong> fresco, semi-stagionato, stagionato</li>
<li><strong>Utilizzi:</strong> taglieri, pici, zuppe toscane</li>
</ul>

<h3>7. Taleggio DOP</h3>
<p>Formaggio a crosta lavata, cremoso e aromatico.</p>
<ul>
<li><strong>Caratteristiche:</strong> pasta morbida, sapore intenso</li>
<li><strong>Utilizzi:</strong> risotti, polenta, taglieri</li>
</ul>

<h3>8. Fontina DOP</h3>
<p>Il formaggio valdostano per eccellenza.</p>
<ul>
<li><strong>Caratteristiche:</strong> si scioglie perfettamente</li>
<li><strong>Utilizzi:</strong> fonduta, gratinati, formaggi fusi</li>
</ul>

<h2>Formaggi per il Tagliere</h2>
<p>Un tagliere italiano completo dovrebbe includere:</p>
<ul>
<li>Un formaggio a pasta dura (Parmigiano, Grana)</li>
<li>Un formaggio a pasta molle (Taleggio, Stracchino)</li>
<li>Un erborinato (Gorgonzola)</li>
<li>Un pecorino</li>
<li>Un formaggio fresco (mozzarella, burrata)</li>
</ul>

<h2>Conservazione dei Formaggi</h2>
<ul>
<li><strong>Formaggi duri:</strong> 4-8°C, avvolti in carta da formaggio</li>
<li><strong>Formaggi molli:</strong> 2-4°C, contenitore chiuso</li>
<li><strong>Formaggi freschi:</strong> nel liquido di governo, consumare rapidamente</li>
<li><strong>Erborinati:</strong> separati dagli altri per l'odore</li>
</ul>

<h2>Formaggi DOP da LAPA</h2>
<p>Offriamo tutti i principali formaggi DOP italiani, selezionati dai migliori caseifici. Consegna in tutta la Svizzera con catena del freddo garantita.</p>

<p><a href="/shop/category/formaggi">Scopri la nostra selezione di formaggi</a></p>`;

  console.log('\n=== ARTICOLO 84 - ITALIANO ===\n');
  console.log('Scrittura titolo, sottotitolo e contenuto...');

  const result = await write(84, {
    name: italianTitle,
    subtitle: italianSubtitle,
    content: italianContent
  });

  if (result.result === true) {
    console.log('OK - Scritto con successo');

    const check = await read(84);
    console.log('\nVerifica:');
    console.log('Titolo:', check.name);
    console.log('Sottotitolo:', check.subtitle);
    console.log('Contenuto (primi 100 car):', check.content?.replace(/<[^>]*>/g, '').substring(0, 100));
  } else {
    console.log('ERRORE:', result.error);
  }
}

main();
