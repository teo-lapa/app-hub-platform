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

  const italianTitle = "I 10 Prodotti Essenziali per Pizzerie";
  const italianSubtitle = "La lista completa degli ingredienti che ogni pizzeria deve avere";
  const italianContent = `<h2>Gli Ingredienti che Fanno la Differenza</h2>
<p>Una pizzeria di successo si costruisce sulla qualità degli ingredienti. Ecco i <strong>10 prodotti essenziali</strong> che non possono mancare nella tua dispensa.</p>

<h2>1. Farina per Pizza</h2>
<p>La base di tutto. Scegli farine professionali specifiche per pizza:</p>
<ul>
<li><strong>Tipo 00:</strong> per pizza napoletana, alta digeribilità</li>
<li><strong>Tipo 0:</strong> per pizza romana, più croccante</li>
<li>W 260-320 per lievitazioni lunghe</li>
</ul>

<h2>2. Pomodoro San Marzano DOP</h2>
<p>Il pomodoro San Marzano DOP è lo standard per la pizza napoletana. Il suo sapore dolce e la bassa acidità lo rendono perfetto per il condimento.</p>

<h2>3. Mozzarella Fior di Latte</h2>
<p>Per la pizza in cottura, il fior di latte è ideale: si scioglie uniformemente e non rilascia troppa acqua. Scegli prodotti freschi di qualità.</p>

<h2>4. Mozzarella di Bufala DOP</h2>
<p>Per le pizze premium e per l'aggiunta a crudo. La bufala aggiunge cremosità e un sapore inconfondibile.</p>

<h2>5. Olio Extravergine d'Oliva</h2>
<p>Indispensabile per condire la pizza prima e dopo la cottura. Scegli un olio italiano di qualità, preferibilmente monocultivar.</p>

<h2>6. Basilico Fresco</h2>
<p>Il tocco finale della margherita. Il basilico fresco aggiunge profumo e colore. Tienilo sempre disponibile.</p>

<h2>7. Prosciutto Crudo</h2>
<p>Parma o San Daniele DOP per le pizze con crudo. Da aggiungere rigorosamente a crudo dopo la cottura.</p>

<h2>8. Salame Piccante (Nduja/Spianata)</h2>
<p>Per le pizze saporite. La nduja calabrese o la spianata romana aggiungono carattere.</p>

<h2>9. Verdure Grigliate</h2>
<p>Melanzane, zucchine, peperoni: le verdure grigliate di qualità sono essenziali per pizze vegetariane e non solo.</p>

<h2>10. Parmigiano Reggiano DOP</h2>
<p>Per la grattugiata finale o come ingrediente. Il Parmigiano aggiunge sapore umami a qualsiasi pizza.</p>

<h2>Bonus: Lievito e Sale</h2>
<p>Non dimenticare lievito di birra fresco di qualità e sale marino. Sono la base dell'impasto perfetto.</p>

<h2>Dove Trovare Questi Prodotti?</h2>
<p>LAPA offre tutti questi ingredienti essenziali, importati direttamente dall'Italia. Consegniamo in tutta la Svizzera con prodotti freschi garantiti.</p>

<p><a href="/shop">Esplora il nostro catalogo completo</a></p>`;

  console.log('\n=== ARTICOLO 78 - ITALIANO ===\n');
  console.log('Scrittura titolo, sottotitolo e contenuto...');

  const result = await write(78, {
    name: italianTitle,
    subtitle: italianSubtitle,
    content: italianContent
  });

  if (result.result === true) {
    console.log('OK - Scritto con successo');

    const check = await read(78);
    console.log('\nVerifica:');
    console.log('Titolo:', check.name);
    console.log('Sottotitolo:', check.subtitle);
    console.log('Contenuto (primi 100 car):', check.content?.replace(/<[^>]*>/g, '').substring(0, 100));
  } else {
    console.log('ERRORE:', result.error);
  }
}

main();
