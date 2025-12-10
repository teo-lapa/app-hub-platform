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
}

async function callOdoo(model, method, args, kwargs = {}) {
  const r = await fetch(ODOO.url + '/web/dataset/call_kw', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': 'session_id=' + sid,
      'X-Requested-With': 'XMLHttpRequest'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { model, method, args, kwargs: kwargs || {} },
      id: Math.floor(Math.random() * 1000000000)
    })
  });
  return (await r.json()).result;
}

// Le traduzioni che ho
const translations = {
  "Perché la Scelta del Fornitore è Fondamentale": true,
  "Aprire una pizzeria di successo in Svizzera richiede molto più di una buona ricetta.": true,
  "La qualità degli ingredienti": true,
  "fa la differenza tra una pizza mediocre e una eccezionale. Per questo, scegliere il fornitore giusto è una delle decisioni più importanti che prenderai.": true,
  "I 5 Criteri Essenziali per Scegliere un Fornitore": true,
  "1. Qualità dei Prodotti": true,
  "Non tutti i fornitori sono uguali. Cerca un grossista che:": true,
  "Importi direttamente dall'Italia": true,
  "Offra prodotti DOP e IGP certificati": true,
  "Garantisca la catena del freddo per i freschi": true,
  "Abbia una selezione ampia di mozzarelle (fior di latte, bufala, burrata)": true,
  "2. Affidabilità delle Consegne": true,
  "Una pizzeria non può permettersi di restare senza ingredienti. Il tuo fornitore deve garantire:": true,
  "Consegne puntuali e regolari": true,
  "Flessibilità negli orari": true,
  "Possibilità di ordini urgenti": true,
  "Copertura in tutta la Svizzera": true,
  "3. Rapporto Qualità-Prezzo": true,
  "Il prezzo più basso non è sempre la scelta migliore. Valuta il": true,
  "valore complessivo": true,
  ": qualità, servizio, affidabilità e supporto.": true,
  "4. Gamma di Prodotti": true,
  "Un buon fornitore dovrebbe offrirti tutto ciò di cui hai bisogno:": true,
  "Farine professionali per pizza": true,
  "Pomodori San Marzano DOP": true,
  "Mozzarelle fresche italiane": true,
  "Salumi e formaggi di qualità": true,
  "Olio extravergine d'oliva": true,
  "5. Servizio Clienti": true,
  "Un partner affidabile offre supporto quando ne hai bisogno: consulenza sui prodotti, gestione degli ordini semplice e assistenza rapida.": true,
  "Perché Scegliere LAPA come Fornitore": true,
  "LAPA è il grossista di riferimento per pizzerie e ristoranti italiani in Svizzera. Offriamo:": true,
  "Oltre 3.000 prodotti italiani autentici": true,
  "Consegna in tutta la Svizzera": true,
  "Nessun minimo d'ordine": true,
  "Prodotti freschi consegnati in 24-48 ore": true,
  "Assistenza dedicata per ogni cliente": true,
  "Conclusione": true,
  "Scegliere il fornitore giusto è un investimento nel successo della tua pizzeria. Non accontentarti: i tuoi clienti meritano ingredienti di qualità, e tu meriti un partner affidabile.": true,
  "Vuoi scoprire i nostri prodotti?": true,
  "Visita il nostro catalogo": true,
  "contattaci": true,
  "per una consulenza gratuita.": true
};

async function main() {
  await auth();

  const segmentData = await callOdoo('blog.post', 'get_field_translations', [[75], 'content']);
  const segments = segmentData[0];
  const sourceTexts = [...new Set(segments.map(s => s.source))];

  console.log('SEGMENTI MANCANTI:\n');
  for (const src of sourceTexts) {
    if (!translations[src]) {
      console.log(`"${src}"`);
    }
  }
}

main();
