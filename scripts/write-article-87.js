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

  const italianTitle = "I Salumi Italiani per Ristoranti: Guida Completa";
  const italianSubtitle = "Dalla selezione alla conservazione: tutto sui salumi italiani per la ristorazione";
  const italianContent = `<h2>L'Arte della Salumeria Italiana</h2>
<p>I salumi sono protagonisti della gastronomia italiana. Per un ristorante, offrire <strong>salumi di qualità</strong> significa rispettare una tradizione secolare e soddisfare i clienti più esigenti.</p>

<h2>I Grandi Classici DOP</h2>

<h3>Prosciutto di Parma DOP</h3>
<ul>
<li><strong>Stagionatura:</strong> minimo 12 mesi (meglio 18-24)</li>
<li><strong>Caratteristiche:</strong> dolce, delicato, rosa con grasso bianco</li>
<li><strong>Utilizzi:</strong> antipasti, pizza (a crudo), con melone, con fichi</li>
<li><strong>Taglio:</strong> fettine sottili, a mano o affettatrice</li>
</ul>

<h3>Prosciutto San Daniele DOP</h3>
<ul>
<li><strong>Stagionatura:</strong> minimo 13 mesi</li>
<li><strong>Caratteristiche:</strong> leggermente più dolce del Parma, forma a chitarra</li>
<li><strong>Differenza dal Parma:</strong> con piedino, stagionato con la cotenna</li>
</ul>

<h3>Mortadella Bologna IGP</h3>
<ul>
<li><strong>Caratteristiche:</strong> profumo delicato, pistacchi, cubetti di lardo</li>
<li><strong>Utilizzi:</strong> antipasti, panini, tortellini</li>
<li><strong>Taglio:</strong> fette medie, non troppo sottili</li>
</ul>

<h3>Bresaola della Valtellina IGP</h3>
<ul>
<li><strong>Caratteristiche:</strong> magra, dal manzo, sapore delicato</li>
<li><strong>Utilizzi:</strong> carpaccio con rucola e parmigiano, antipasti leggeri</li>
<li><strong>Condimento:</strong> olio, limone, pepe</li>
</ul>

<h2>Salumi per Carbonara e Amatriciana</h2>

<h3>Guanciale</h3>
<ul>
<li><strong>Essenziale per:</strong> carbonara, amatriciana, gricia</li>
<li><strong>Caratteristiche:</strong> grasso con venature magre, pepe</li>
<li><strong>Cottura:</strong> a fuoco medio-basso per sciogliere il grasso</li>
</ul>

<h3>Pancetta</h3>
<ul>
<li><strong>Versioni:</strong> tesa, arrotolata, affumicata</li>
<li><strong>Utilizzi:</strong> sughi, avvolgere carni, soffritti</li>
<li><strong>Nota:</strong> non sostituisce il guanciale nella carbonara!</li>
</ul>

<h2>Salami Regionali</h2>

<h3>Salame Milano</h3>
<ul>
<li>Grana fine, delicato</li>
<li>Ideale per: antipasti, panini</li>
</ul>

<h3>Salame Napoli</h3>
<ul>
<li>Grana grossa, speziato</li>
<li>Ideale per: pizza, antipasti</li>
</ul>

<h3>Nduja Calabrese</h3>
<ul>
<li>Cremoso, piccante</li>
<li>Ideale per: pizza, bruschette, pasta</li>
</ul>

<h3>Spianata Romana</h3>
<ul>
<li>Piccante, schiacciata</li>
<li>Ideale per: pizza, taglieri</li>
</ul>

<h2>Il Tagliere Perfetto</h2>
<p>Un tagliere di salumi completo dovrebbe includere:</p>
<ul>
<li>Un prosciutto crudo (Parma o San Daniele)</li>
<li>Un salame (Milano o regionale)</li>
<li>Una mortadella</li>
<li>Un salume piccante (nduja, spianata)</li>
<li>Accompagnamenti: grissini, focaccia, sottoli</li>
</ul>

<h2>Conservazione</h2>

<h3>Salumi Interi</h3>
<ul>
<li>Appendere in luogo fresco (12-18°C)</li>
<li>Coprire il taglio con pellicola o carta oleata</li>
<li>Affettare al momento quando possibile</li>
</ul>

<h3>Salumi Affettati</h3>
<ul>
<li>Temperatura: 2-4°C</li>
<li>Consumare entro 3-5 giorni</li>
<li>Conservare sottovuoto o a contatto con pellicola</li>
</ul>

<h2>Salumi Italiani da LAPA</h2>
<p>Offriamo una selezione completa di salumi italiani DOP e IGP per ristoranti. Prodotti autentici, consegnati freschi in tutta la Svizzera.</p>

<p><a href="/shop/category/salumi">Scopri i nostri salumi</a></p>`;

  console.log('\n=== ARTICOLO 87 - ITALIANO ===\n');
  console.log('Scrittura titolo, sottotitolo e contenuto...');

  const result = await write(87, {
    name: italianTitle,
    subtitle: italianSubtitle,
    content: italianContent
  });

  if (result.result === true) {
    console.log('OK - Scritto con successo');

    const check = await read(87);
    console.log('\nVerifica:');
    console.log('Titolo:', check.name);
    console.log('Sottotitolo:', check.subtitle);
    console.log('Contenuto (primi 100 car):', check.content?.replace(/<[^>]*>/g, '').substring(0, 100));
  } else {
    console.log('ERRORE:', result.error);
  }
}

main();
