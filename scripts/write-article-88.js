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

  const italianTitle = "Come Creare un Menu Italiano Autentico per il Tuo Ristorante";
  const italianSubtitle = "Consigli pratici per costruire un menu che rappresenti la vera cucina italiana";
  const italianContent = `<h2>L'Arte del Menu Italiano</h2>
<p>Un menu italiano autentico non è solo una lista di piatti. È un <strong>racconto della tradizione culinaria</strong>, un viaggio attraverso le regioni e le stagioni. Ecco come crearlo.</p>

<h2>La Struttura Tradizionale</h2>

<h3>Antipasti</h3>
<p>L'inizio del pasto, per stuzzicare l'appetito:</p>
<ul>
<li><strong>Freddi:</strong> affettati misti, carpacci, bruschette, caprese</li>
<li><strong>Caldi:</strong> supplì, arancini, verdure grigliate, frittate</li>
<li><strong>Consiglio:</strong> offri sia opzioni leggere che sostanziose</li>
</ul>

<h3>Primi Piatti</h3>
<p>Il cuore del menu italiano:</p>
<ul>
<li><strong>Pasta:</strong> almeno 4-5 opzioni tra classici e stagionali</li>
<li><strong>Risotto:</strong> 1-2 opzioni, preparati al momento</li>
<li><strong>Zuppe:</strong> minestrone, ribollita, pasta e fagioli (stagionali)</li>
<li><strong>Must-have:</strong> carbonara, amatriciana, cacio e pepe, ragù</li>
</ul>

<h3>Secondi Piatti</h3>
<p>Portata principale, carne o pesce:</p>
<ul>
<li><strong>Carne:</strong> scaloppine, tagliata, ossobuco, saltimbocca</li>
<li><strong>Pesce:</strong> branzino, orata, fritto misto, baccalà</li>
<li><strong>Nota:</strong> in Italia i contorni sono separati</li>
</ul>

<h3>Contorni</h3>
<p>Da ordinare separatamente:</p>
<ul>
<li>Insalata mista, patate arrosto, verdure grigliate</li>
<li>Spinaci, cicoria, fagioli all'uccelletto</li>
</ul>

<h3>Dolci</h3>
<p>Per concludere in dolcezza:</p>
<ul>
<li><strong>Classici:</strong> tiramisù, panna cotta, cannoli</li>
<li><strong>Stagionali:</strong> fragole, macedonia, gelato</li>
</ul>

<h2>Principi di un Menu Autentico</h2>

<h3>1. Rispetta la Tradizione</h3>
<ul>
<li>Non inventare "pasta alla vodka con panna" come piatto italiano</li>
<li>Studia le ricette originali prima di proporle</li>
<li>Indica la regione di origine dei piatti</li>
</ul>

<h3>2. Stagionalità</h3>
<ul>
<li>Cambia il menu con le stagioni</li>
<li>Usa ingredienti di stagione</li>
<li>Proponi piatti speciali stagionali</li>
</ul>

<h3>3. Equilibrio</h3>
<ul>
<li>Mix di piatti leggeri e sostanziosi</li>
<li>Opzioni vegetariane autentiche</li>
<li>Varietà di preparazioni (crudo, cotto, al forno)</li>
</ul>

<h3>4. Qualità degli Ingredienti</h3>
<ul>
<li>Usa prodotti italiani autentici</li>
<li>Indica i prodotti DOP/IGP nel menu</li>
<li>La semplicità richiede ingredienti eccellenti</li>
</ul>

<h2>Errori da Evitare</h2>
<ol>
<li><strong>Menu troppo lungo:</strong> meglio pochi piatti fatti bene</li>
<li><strong>Piatti non italiani:</strong> fettuccine Alfredo, spaghetti con polpette</li>
<li><strong>Ingredienti sbagliati:</strong> panna nella carbonara, aglio nell'amatriciana</li>
<li><strong>Nomi inventati:</strong> usa i nomi tradizionali italiani</li>
<li><strong>Porzioni eccessive:</strong> in Italia le porzioni sono equilibrate</li>
</ol>

<h2>Il Menu delle Bevande</h2>
<ul>
<li><strong>Vini:</strong> selezione di vini italiani regionali</li>
<li><strong>Birre:</strong> birre italiane artigianali</li>
<li><strong>Aperitivi:</strong> Aperol Spritz, Negroni, Campari</li>
<li><strong>Digestivi:</strong> limoncello, grappa, amaro</li>
<li><strong>Caffè:</strong> espresso autentico</li>
</ul>

<h2>Presenta il Tuo Menu</h2>
<ul>
<li>Descrizioni brevi ma evocative</li>
<li>Indica allergeni e ingredienti principali</li>
<li>Prezzi chiari e giusti</li>
<li>Design pulito, facile da leggere</li>
</ul>

<h2>Gli Ingredienti Giusti per il Tuo Menu</h2>
<p>Per un menu italiano autentico servono ingredienti autentici. LAPA fornisce oltre 3.000 prodotti italiani per ristoranti in Svizzera.</p>

<p><a href="/shop">Scopri il nostro catalogo completo</a></p>`;

  console.log('\n=== ARTICOLO 88 - ITALIANO ===\n');
  console.log('Scrittura titolo, sottotitolo e contenuto...');

  const result = await write(88, {
    name: italianTitle,
    subtitle: italianSubtitle,
    content: italianContent
  });

  if (result.result === true) {
    console.log('OK - Scritto con successo');

    const check = await read(88);
    console.log('\nVerifica:');
    console.log('Titolo:', check.name);
    console.log('Sottotitolo:', check.subtitle);
    console.log('Contenuto (primi 100 car):', check.content?.replace(/<[^>]*>/g, '').substring(0, 100));
  } else {
    console.log('ERRORE:', result.error);
  }
}

main();
