// Script per verificare che i dati siano stati salvati correttamente in Odoo
const ODOO_URL = 'https://lapadevadmin-lapa-v2-staging-2406-24063382.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-staging-2406-24063382';
const ODOO_LOGIN = 'paul@lapa.ch';
const ODOO_PASSWORD = 'lapa201180';

async function authenticateOdoo() {
  console.log('🔐 Autenticazione con Odoo...');

  const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      params: {
        db: ODOO_DB,
        login: ODOO_LOGIN,
        password: ODOO_PASSWORD
      }
    })
  });

  const data = await response.json();

  if (data.error) {
    throw new Error('Autenticazione fallita: ' + JSON.stringify(data.error));
  }

  const setCookie = response.headers.get('set-cookie');
  const sessionMatch = setCookie?.match(/session_id=([^;]+)/);

  if (!sessionMatch) {
    throw new Error('Nessun session_id ricevuto');
  }

  console.log('✅ Autenticazione riuscita, uid:', data.result.uid);
  return `session_id=${sessionMatch[1]}`;
}

async function callOdoo(cookies, model, method, args = [], kwargs = {}) {
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'Cookie': cookies
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model,
        method,
        args,
        kwargs: kwargs || {}
      },
      id: Math.floor(Math.random() * 1000000000)
    })
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.data?.message || data.error.message || 'Errore Odoo');
  }

  return data.result;
}

async function verifyData() {
  try {
    const cookies = await authenticateOdoo();

    console.log('\n📋 Verifica ultimi 5 picking...');
    const pickings = await callOdoo(cookies, 'stock.picking', 'search_read', [
      [],
      ['id', 'name', 'state', 'signature', 'partner_id']
    ], {
      limit: 5,
      order: 'id desc'
    });

    console.log('\n📦 Ultimi 5 picking trovati:');
    pickings.forEach(p => {
      console.log(`  - ID: ${p.id}, Nome: ${p.name}, Stato: ${p.state}, Ha firma: ${p.signature ? '✅ SI' : '❌ NO'}`);
    });

    console.log('\n💬 Verifica ultimi 5 messaggi nel chatter...');
    const messages = await callOdoo(cookies, 'mail.message', 'search_read', [
      [['model', '=', 'stock.picking']],
      ['id', 'body', 'res_id', 'create_date']
    ], {
      limit: 5,
      order: 'id desc'
    });

    console.log('\n📨 Ultimi 5 messaggi trovati:');
    messages.forEach(m => {
      const bodyPreview = m.body.replace(/<[^>]*>/g, '').substring(0, 100);
      console.log(`  - ID: ${m.id}, Picking: ${m.res_id}, Data: ${m.create_date}`);
      console.log(`    Contenuto: ${bodyPreview}...`);
    });

    // Verifica il messaggio specifico creato dal test (ID 2814775)
    console.log('\n🔍 Verifica messaggio ID 2814775 (creato dal test)...');
    try {
      const specificMessage = await callOdoo(cookies, 'mail.message', 'read', [
        [2814775],
        ['id', 'body', 'res_id', 'model', 'create_date']
      ]);

      if (specificMessage && specificMessage.length > 0) {
        console.log('\n✅ MESSAGGIO TROVATO:');
        console.log(`  ID: ${specificMessage[0].id}`);
        console.log(`  Picking ID: ${specificMessage[0].res_id}`);
        console.log(`  Data creazione: ${specificMessage[0].create_date}`);
        console.log(`  Contenuto: ${specificMessage[0].body}`);
      }
    } catch (e) {
      console.log('⚠️  Messaggio 2814775 non trovato (potrebbe essere stato eliminato)');
    }

    console.log('\n✅ Verifica completata!');

  } catch (error) {
    console.error('\n❌ ERRORE durante verifica:', error.message);
    console.error(error);
  }
}

verifyData();
