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

  const italianTitle = "Consegna Prodotti Freschi: Cosa Cercare in un Fornitore";
  const italianSubtitle = "I criteri fondamentali per garantire la qualità dei prodotti freschi nel tuo ristorante";
  const italianContent = `<h2>La Freschezza Non Ammette Compromessi</h2>
<p>Per un ristorante italiano, la <strong>freschezza degli ingredienti</strong> è tutto. Ma come assicurarsi che il fornitore garantisca veramente prodotti freschi? Ecco cosa valutare.</p>

<h2>La Catena del Freddo</h2>

<h3>Cos'è la Catena del Freddo</h3>
<p>È il mantenimento costante della temperatura corretta dal produttore al tuo ristorante, senza interruzioni.</p>

<h3>Cosa Chiedere al Fornitore</h3>
<ul>
<li><strong>Veicoli refrigerati:</strong> temperature controllate durante il trasporto</li>
<li><strong>Magazzini refrigerati:</strong> stoccaggio a temperature adeguate</li>
<li><strong>Monitoraggio:</strong> registrazione delle temperature</li>
<li><strong>Certificazioni:</strong> HACCP e standard di sicurezza alimentare</li>
</ul>

<h2>Frequenza delle Consegne</h2>

<h3>Prodotti Freschi</h3>
<ul>
<li><strong>Latticini (mozzarella, burrata):</strong> ideale 2-3 volte a settimana</li>
<li><strong>Salumi affettati:</strong> 2 volte a settimana</li>
<li><strong>Verdure fresche:</strong> giornaliera o a giorni alterni</li>
</ul>

<h3>Prodotti a Media Conservazione</h3>
<ul>
<li><strong>Formaggi stagionati:</strong> settimanale</li>
<li><strong>Salumi interi:</strong> settimanale/bisettimanale</li>
</ul>

<h3>Prodotti a Lunga Conservazione</h3>
<ul>
<li><strong>Pasta, conserve, olio:</strong> mensile o su richiesta</li>
</ul>

<h2>Orari di Consegna</h2>

<h3>Perché Contano</h3>
<ul>
<li>Consegne mattutine permettono di controllare i prodotti prima del servizio</li>
<li>Evitare consegne durante il servizio pranzo/cena</li>
<li>Flessibilità per ordini urgenti</li>
</ul>

<h3>Cosa Cercare</h3>
<ul>
<li>Finestre di consegna definite</li>
<li>Possibilità di scegliere l'orario</li>
<li>Avviso in caso di ritardi</li>
</ul>

<h2>Qualità alla Consegna</h2>

<h3>Cosa Controllare</h3>
<ul>
<li><strong>Temperatura:</strong> prodotti freddi devono essere freddi</li>
<li><strong>Imballaggio:</strong> integro, adeguato al prodotto</li>
<li><strong>Etichettatura:</strong> date di scadenza/produzione visibili</li>
<li><strong>Aspetto:</strong> nessun segno di deterioramento</li>
</ul>

<h3>Documentazione</h3>
<ul>
<li>Bolla di consegna completa</li>
<li>Tracciabilità dei lotti</li>
<li>Certificati di origine per DOP/IGP</li>
</ul>

<h2>Gestione dei Problemi</h2>

<h3>Cosa Deve Offrire il Fornitore</h3>
<ul>
<li><strong>Politica di reso:</strong> sostituzione prodotti danneggiati</li>
<li><strong>Risposte rapide:</strong> gestione reclami in giornata</li>
<li><strong>Contatto diretto:</strong> numero per emergenze</li>
</ul>

<h2>Copertura Geografica</h2>

<h3>In Svizzera</h3>
<p>Verifica che il fornitore copra la tua zona con:</p>
<ul>
<li>Consegne regolari nella tua città</li>
<li>Costi di spedizione ragionevoli</li>
<li>Tempi di consegna affidabili</li>
</ul>

<h2>Domande da Fare</h2>
<ol>
<li>Quali temperature mantenete durante il trasporto?</li>
<li>Con quale frequenza consegnate nella mia zona?</li>
<li>Quali sono i vostri orari di consegna?</li>
<li>Come gestite i prodotti danneggiati o non conformi?</li>
<li>Avete minimi d'ordine?</li>
<li>Posso tracciare il mio ordine?</li>
</ol>

<h2>LAPA: Freschezza Garantita</h2>
<p>LAPA consegna prodotti freschi italiani in tutta la Svizzera con:</p>
<ul>
<li>Veicoli refrigerati per la catena del freddo</li>
<li>Consegne regolari in tutto il paese</li>
<li>Nessun minimo d'ordine</li>
<li>Prodotti freschi in 24-48 ore</li>
<li>Assistenza clienti dedicata</li>
</ul>

<p><a href="/contactus">Contattaci per saperne di più</a> o <a href="/shop">ordina subito</a></p>`;

  console.log('\n=== ARTICOLO 89 - ITALIANO ===\n');
  console.log('Scrittura titolo, sottotitolo e contenuto...');

  const result = await write(89, {
    name: italianTitle,
    subtitle: italianSubtitle,
    content: italianContent
  });

  if (result.result === true) {
    console.log('OK - Scritto con successo');

    const check = await read(89);
    console.log('\nVerifica:');
    console.log('Titolo:', check.name);
    console.log('Sottotitolo:', check.subtitle);
    console.log('Contenuto (primi 100 car):', check.content?.replace(/<[^>]*>/g, '').substring(0, 100));
  } else {
    console.log('ERRORE:', result.error);
  }
}

main();
