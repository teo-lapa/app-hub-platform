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

  const italianTitle = "Olio Extravergine d'Oliva: Guida alla Scelta per Ristoranti";
  const italianSubtitle = "Come selezionare l'olio giusto per ogni piatto del tuo menu";
  const italianContent = `<h2>L'Oro Verde della Cucina Italiana</h2>
<p>L'olio extravergine d'oliva è uno degli ingredienti più importanti della cucina italiana. <strong>La scelta dell'olio giusto</strong> può elevare un piatto da buono a eccellente.</p>

<h2>Cosa Significa "Extravergine"</h2>
<p>Un olio si definisce extravergine quando:</p>
<ul>
<li>È ottenuto esclusivamente mediante processi meccanici</li>
<li>Ha un'acidità inferiore allo 0,8%</li>
<li>Non presenta difetti organolettici</li>
<li>Ha attributi positivi (fruttato, amaro, piccante)</li>
</ul>

<h2>Le Principali Cultivar Italiane</h2>

<h3>Taggiasca (Liguria)</h3>
<ul>
<li><strong>Profilo:</strong> delicato, dolce, mandorlato</li>
<li><strong>Ideale per:</strong> pesce, verdure delicate, focaccia</li>
</ul>

<h3>Frantoio (Toscana)</h3>
<ul>
<li><strong>Profilo:</strong> fruttato medio, note erbacee, piccante</li>
<li><strong>Ideale per:</strong> bruschette, zuppe, carni alla griglia</li>
</ul>

<h3>Coratina (Puglia)</h3>
<ul>
<li><strong>Profilo:</strong> intenso, amaro e piccante pronunciati</li>
<li><strong>Ideale per:</strong> piatti robusti, legumi, condimenti a crudo</li>
</ul>

<h3>Nocellara (Sicilia)</h3>
<ul>
<li><strong>Profilo:</strong> fruttato medio, pomodoro verde, carciofo</li>
<li><strong>Ideale per:</strong> pasta, pesce, insalate</li>
</ul>

<h2>Come Scegliere l'Olio per il Ristorante</h2>

<h3>1. Definisci l'Uso</h3>
<ul>
<li><strong>Cottura:</strong> oli più stabili, non necessariamente premium</li>
<li><strong>Condimento a crudo:</strong> oli di alta qualità, caratterizzati</li>
<li><strong>Frittura:</strong> oli con alto punto di fumo (oliva raffinato o altri)</li>
</ul>

<h3>2. Considera il Menu</h3>
<ul>
<li>Cucina di pesce: oli delicati (Taggiasca, Leccino)</li>
<li>Cucina di carne: oli più strutturati (Frantoio, Moraiolo)</li>
<li>Cucina mediterranea: oli versatili (Nocellara, Carolea)</li>
</ul>

<h3>3. Valuta il Rapporto Qualità-Prezzo</h3>
<p>Non serve l'olio più costoso per cucinare. Usa:</p>
<ul>
<li>Olio premium per condimento e tavola</li>
<li>Olio di buona qualità per cottura</li>
<li>Considera formati grandi per ridurre i costi</li>
</ul>

<h2>Conservazione Corretta</h2>
<ul>
<li><strong>Temperatura:</strong> 14-18°C, costante</li>
<li><strong>Luce:</strong> al buio, contenitori scuri o acciaio</li>
<li><strong>Aria:</strong> minimizzare l'esposizione, chiudere bene</li>
<li><strong>Durata:</strong> consumare entro 12-18 mesi dalla spremitura</li>
</ul>

<h2>Come Riconoscere un Buon Olio</h2>
<ol>
<li><strong>Colore:</strong> dal verde al giallo dorato (non è indice di qualità)</li>
<li><strong>Profumo:</strong> fruttato, erbaceo, mai rancido</li>
<li><strong>Gusto:</strong> amaro e piccante sono segni di qualità</li>
<li><strong>Origine:</strong> cerca certificazioni DOP/IGP</li>
</ol>

<h2>Oli Italiani da LAPA</h2>
<p>Offriamo una selezione di oli extravergini italiani di alta qualità, dalle diverse regioni. Ideali per ristoranti che vogliono offrire il meglio.</p>

<p><a href="/shop/category/olio-aceto">Scopri la nostra selezione di oli</a></p>`;

  console.log('\n=== ARTICOLO 82 - ITALIANO ===\n');
  console.log('Scrittura titolo, sottotitolo e contenuto...');

  const result = await write(82, {
    name: italianTitle,
    subtitle: italianSubtitle,
    content: italianContent
  });

  if (result.result === true) {
    console.log('OK - Scritto con successo');

    const check = await read(82);
    console.log('\nVerifica:');
    console.log('Titolo:', check.name);
    console.log('Sottotitolo:', check.subtitle);
    console.log('Contenuto (primi 100 car):', check.content?.replace(/<[^>]*>/g, '').substring(0, 100));
  } else {
    console.log('ERRORE:', result.error);
  }
}

main();
