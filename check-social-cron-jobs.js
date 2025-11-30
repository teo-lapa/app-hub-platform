/**
 * Controlla i CRON/Scheduled Actions che potrebbero causare
 * chiamate non autorizzate ai social network
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const USERNAME = 'paul@lapa.ch';
const PASSWORD = 'lapa201180';

let cookies = null;

async function authenticate() {
  const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { db: ODOO_DB, login: USERNAME, password: PASSWORD },
      id: 1
    })
  });

  let setCookies = [];
  if (typeof response.headers.getSetCookie === 'function') {
    setCookies = response.headers.getSetCookie();
  } else {
    const cookieHeader = response.headers.get('set-cookie');
    if (cookieHeader) setCookies = cookieHeader.split(',').map(c => c.trim());
  }

  if (setCookies && setCookies.length > 0) {
    cookies = setCookies.map(cookie => cookie.split(';')[0]).join('; ');
  }

  const data = await response.json();
  if (data.result && data.result.uid) {
    if (!cookies && data.result.session_id) {
      cookies = `session_id=${data.result.session_id}`;
    }
    console.log(`✅ Autenticato\n`);
    return true;
  }
  throw new Error('Authentication failed');
}

async function checkSocialCronJobs() {
  console.log('⏰ Cerco Scheduled Actions (cron) relativi a Social Marketing...\n');

  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookies
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model: 'ir.cron',
        method: 'search_read',
        args: [[
          '|', '|',
          ['name', 'ilike', 'social'],
          ['model_id', 'ilike', 'social'],
          ['code', 'ilike', 'social']
        ]],
        kwargs: {
          fields: [
            'id', 'name', 'model_id', 'state', 'active',
            'interval_number', 'interval_type', 'nextcall',
            'numbercall', 'code', 'lastcall'
          ],
          limit: 50
        }
      },
      id: 1
    })
  });

  const data = await response.json();

  if (data.error) {
    console.log('❌ Errore:', data.error.data?.message || data.error.message);
    return [];
  }

  if (data.result.length === 0) {
    console.log('⚠️  Nessun cron job social trovato\n');
    return [];
  }

  console.log(`Trovati ${data.result.length} scheduled actions:\n`);

  data.result.forEach(cron => {
    const status = cron.active ? '✅ Attivo' : '⏸️  Disattivo';
    const state = cron.state || 'N/A';

    console.log(`${status} - ${cron.name}`);
    console.log(`   ID: ${cron.id}`);
    console.log(`   Model: ${cron.model_id ? cron.model_id[1] : 'N/A'}`);
    console.log(`   State: ${state}`);
    console.log(`   Intervallo: Ogni ${cron.interval_number} ${cron.interval_type}(s)`);
    console.log(`   Ultima esecuzione: ${cron.lastcall || 'Mai'}`);
    console.log(`   Prossima esecuzione: ${cron.nextcall || 'N/A'}`);
    if (cron.code) {
      console.log(`   Codice: ${cron.code.substring(0, 100)}...`);
    }
    console.log('');
  });

  return data.result;
}

async function disableSocialCron(cronId, cronName) {
  console.log(`⏸️  Disattivo cron "${cronName}" (ID: ${cronId})...`);

  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookies
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model: 'ir.cron',
        method: 'write',
        args: [
          [cronId],
          { active: false }
        ],
        kwargs: {}
      },
      id: 2
    })
  });

  const data = await response.json();

  if (data.error) {
    console.log('❌ Errore:', data.error.data?.message || data.error.message);
    return false;
  }

  console.log('✅ Cron disattivato\n');
  return true;
}

async function main() {
  try {
    console.log('🔍 CONTROLLO CRON/SCHEDULED ACTIONS SOCIAL\n');
    console.log('='.repeat(60));
    console.log('');

    await authenticate();

    const crons = await checkSocialCronJobs();

    if (crons.length === 0) {
      console.log('💡 Nessun cron social trovato.');
      console.log('   L\'errore potrebbe essere causato da un\'azione manuale o automatica');
      console.log('   durante il caricamento della vista.\n');
      return;
    }

    const activeCrons = crons.filter(c => c.active);

    if (activeCrons.length > 0) {
      console.log('='.repeat(60));
      console.log('');
      console.log(`⚠️  Ci sono ${activeCrons.length} cron attivi che potrebbero causare l'errore!\n`);
      console.log('Vuoi disattivarli temporaneamente? (Modifica lo script per confermare)\n');

      // UNCOMMENT per disattivare:
      // for (const cron of activeCrons) {
      //   await disableSocialCron(cron.id, cron.name);
      // }
    }

  } catch (error) {
    console.error('\n❌ Errore:', error.message);
    console.error(error);
  }
}

main();
