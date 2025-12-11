const https = require('https');

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_LOGIN = 'paul@lapa.ch';
const ODOO_PASSWORD = 'lapa201180';

async function authenticate() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      jsonrpc: '2.0',
      params: {
        db: ODOO_DB,
        login: ODOO_LOGIN,
        password: ODOO_PASSWORD
      }
    });

    const url = new URL(ODOO_URL + '/web/session/authenticate');
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      const cookies = res.headers['set-cookie'];
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const result = JSON.parse(body);
        if (result.result && result.result.uid) {
          const sessionMatch = cookies?.find(c => c.includes('session_id'))?.match(/session_id=([^;]+)/);
          resolve({ cookie: 'session_id=' + sessionMatch[1], uid: result.result.uid });
        } else {
          reject(new Error('Auth failed: ' + JSON.stringify(result)));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function callOdoo(cookie, model, method, args, kwargs) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { model, method, args, kwargs: kwargs || {} },
      id: Math.floor(Math.random() * 1000000000)
    });

    const url = new URL(ODOO_URL + '/web/dataset/call_kw');
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Cookie': cookie
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const result = JSON.parse(body);
        if (result.error) reject(new Error(JSON.stringify(result.error)));
        else resolve(result.result);
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('Connessione a Odoo con paul@lapa.ch...');
  const { cookie } = await authenticate();
  console.log('Connesso!\n');

  // Paesi reali (clienti potenziali)
  const realCountries = ['Switzerland', 'Italy', 'France', 'Germany', 'Austria', 'Liechtenstein'];

  // Recupera ID dei paesi reali
  const countryIds = await callOdoo(cookie, 'res.country', 'search_read',
    [[['name', 'in', realCountries]]],
    { fields: ['id', 'name'] }
  );
  const realCountryIds = countryIds.map(c => c.id);
  console.log('Paesi filtrati:', countryIds.map(c => c.name).join(', '));

  // Conta totale visitatori per giorno negli ultimi 7 giorni (SOLO PAESI REALI)
  const days = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }

  console.log('\n=== VISITATORI REALI PER GIORNO (CH/IT/FR/DE/AT) ===');
  for (let i = 0; i < days.length - 1; i++) {
    const count = await callOdoo(cookie, 'website.visitor', 'search_count',
      [[['last_connection_datetime', '>=', days[i]], ['last_connection_datetime', '<', days[i+1]], ['country_id', 'in', realCountryIds]]]
    );
    console.log(`${days[i]}: ${count} visitatori`);
  }

  // Recupera visitatori con più dettagli (SOLO PAESI REALI)
  const sevenDaysAgo = days[0];
  console.log('\nRecupero dettagli visitatori REALI...');

  const visitors = await callOdoo(cookie, 'website.visitor', 'search_read',
    [[['last_connection_datetime', '>=', sevenDaysAgo], ['country_id', 'in', realCountryIds]]],
    { fields: ['name', 'visit_count', 'visitor_page_count', 'last_connection_datetime', 'country_id', 'lang_id', 'last_visited_page_id', 'page_count'], limit: 1000 }
  );

  console.log('\nTotale visitatori unici:', visitors.length);

  let totalVisite = 0;
  let totalPageViews = 0;
  const countries = {};
  const languages = {};
  const lastPages = {};

  visitors.forEach(v => {
    totalVisite += v.visit_count || 1;
    totalPageViews += v.visitor_page_count || 0;

    const country = v.country_id ? v.country_id[1] : 'Sconosciuto';
    countries[country] = (countries[country] || 0) + 1;

    const lang = v.lang_id ? v.lang_id[1] : 'Sconosciuto';
    languages[lang] = (languages[lang] || 0) + 1;

    if (v.last_visited_page_id) {
      const page = v.last_visited_page_id[1];
      lastPages[page] = (lastPages[page] || 0) + 1;
    }
  });

  console.log('Totale visite:', totalVisite);
  console.log('Totale page views:', totalPageViews);

  console.log('\n=== PAESI (top 10) ===');
  Object.entries(countries).sort((a,b) => b[1]-a[1]).slice(0,10).forEach(([k,v]) => {
    const pct = ((v/visitors.length)*100).toFixed(1);
    console.log(`${k}: ${v} visitatori (${pct}%)`);
  });

  console.log('\n=== LINGUE ===');
  Object.entries(languages).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => {
    const pct = ((v/visitors.length)*100).toFixed(1);
    console.log(`${k}: ${v} visitatori (${pct}%)`);
  });

  console.log('\n=== PAGINE PIU VISITATE (ultime viste) ===');
  Object.entries(lastPages).sort((a,b) => b[1]-a[1]).slice(0,15).forEach(([k,v]) => {
    console.log(`${k}: ${v}`);
  });

  // Prova a vedere website.track per capire referrer
  console.log('\n=== VERIFICO MODELLO website.track ===');
  try {
    const trackFields = await callOdoo(cookie, 'website.track', 'fields_get', [], { attributes: ['string', 'type'] });
    console.log('Campi website.track:');
    Object.entries(trackFields).forEach(([k, v]) => {
      console.log(`  ${k}: ${v.string} (${v.type})`);
    });

    // Recupera ultimi track
    const tracks = await callOdoo(cookie, 'website.track', 'search_read',
      [[['visit_datetime', '>=', sevenDaysAgo]]],
      { fields: ['page_id', 'visit_datetime', 'url'], limit: 20, order: 'visit_datetime desc' }
    );
    console.log('\nUltimi 20 track:');
    tracks.forEach(t => {
      console.log(`${t.visit_datetime} | ${t.url || (t.page_id ? t.page_id[1] : '-')}`);
    });
  } catch(e) {
    console.log('website.track non accessibile:', e.message);
  }
}

main().catch(e => console.error('Errore:', e.message));
