/**
 * Test per verificare accesso al modello social.stream.post in Odoo
 * Questo script testa se l'utente ha i permessi per accedere al modulo Social Marketing
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

let cookies = null;
let uid = null;

async function authenticate() {
  console.log('🔐 Autenticazione in corso...');

  const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        db: ODOO_DB,
        login: ODOO_USERNAME,
        password: ODOO_PASSWORD
      },
      id: 1
    })
  });

  // Estrai cookies
  let setCookies = [];
  if (typeof response.headers.getSetCookie === 'function') {
    setCookies = response.headers.getSetCookie();
  } else {
    const cookieHeader = response.headers.get('set-cookie');
    if (cookieHeader) {
      setCookies = cookieHeader.split(',').map(c => c.trim());
    }
  }

  if (setCookies && setCookies.length > 0) {
    cookies = setCookies.map(cookie => cookie.split(';')[0]).join('; ');
  }

  const data = await response.json();

  if (data.result && data.result.uid) {
    uid = data.result.uid;
    const sessionId = data.result.session_id;

    if (!cookies && sessionId) {
      cookies = `session_id=${sessionId}`;
    }

    console.log('✅ Autenticazione riuscita!');
    console.log(`   UID: ${uid}`);
    console.log(`   Database: ${data.result.db}`);
    console.log(`   Username: ${data.result.username}`);
    console.log(`   Session ID: ${sessionId}`);
    return true;
  }

  throw new Error('Authentication failed: ' + JSON.stringify(data));
}

async function checkModel(modelName) {
  console.log(`\n📋 Verifico accesso al modello: ${modelName}`);

  try {
    // Test 1: Check Access Rights
    console.log('   Test 1: Verifico diritti di accesso...');
    const accessResponse = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: modelName,
          method: 'check_access_rights',
          args: ['read', false],
          kwargs: {}
        },
        id: 1
      })
    });

    const accessData = await accessResponse.json();

    if (accessData.error) {
      console.log('   ❌ Errore check_access_rights:', accessData.error.data?.message || accessData.error.message);
      return false;
    }

    console.log('   ✅ Diritti di accesso:', accessData.result);

    // Test 2: Search Read (prova a leggere record)
    console.log('   Test 2: Provo a leggere i record...');
    const searchResponse = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: modelName,
          method: 'search_read',
          args: [[]],
          kwargs: {
            fields: ['id', 'display_name', 'message', 'state'],
            limit: 5
          }
        },
        id: 2
      })
    });

    const searchData = await searchResponse.json();

    if (searchData.error) {
      console.log('   ❌ Errore search_read:', searchData.error.data?.message || searchData.error.message);
      console.log('   Dettagli errore:', JSON.stringify(searchData.error, null, 2));
      return false;
    }

    console.log(`   ✅ Trovati ${searchData.result.length} record`);
    if (searchData.result.length > 0) {
      console.log('   Esempio record:');
      searchData.result.forEach(r => {
        console.log(`     - ID: ${r.id}, Name: ${r.display_name}`);
      });
    }

    return true;

  } catch (error) {
    console.log('   ❌ Errore:', error.message);
    return false;
  }
}

async function checkUserGroups() {
  console.log('\n👥 Verifico i gruppi dell\'utente...');

  try {
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
          model: 'res.users',
          method: 'read',
          args: [[uid], ['name', 'login', 'groups_id']],
          kwargs: {}
        },
        id: 3
      })
    });

    const data = await response.json();

    if (data.error) {
      console.log('   ❌ Errore:', data.error.data?.message || data.error.message);
      return;
    }

    const user = data.result[0];
    console.log(`   Nome: ${user.name}`);
    console.log(`   Login: ${user.login}`);
    console.log(`   Gruppi (IDs): ${user.groups_id.join(', ')}`);

    // Ora leggo i nomi dei gruppi
    const groupsResponse = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'res.groups',
          method: 'search_read',
          args: [[['id', 'in', user.groups_id]]],
          kwargs: {
            fields: ['name', 'full_name', 'category_id'],
            limit: 100
          }
        },
        id: 4
      })
    });

    const groupsData = await groupsResponse.json();

    if (!groupsData.error) {
      console.log('\n   📦 Gruppi attivi:');
      groupsData.result.forEach(g => {
        console.log(`     - ${g.full_name || g.name}`);
      });
    }

  } catch (error) {
    console.log('   ❌ Errore:', error.message);
  }
}

async function checkSocialModules() {
  console.log('\n🔍 Verifico moduli Social installati...');

  try {
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
          model: 'ir.module.module',
          method: 'search_read',
          args: [[['name', 'ilike', 'social'], ['state', '=', 'installed']]],
          kwargs: {
            fields: ['name', 'shortdesc', 'state'],
            limit: 20
          }
        },
        id: 5
      })
    });

    const data = await response.json();

    if (data.error) {
      console.log('   ❌ Errore:', data.error.data?.message || data.error.message);
      return;
    }

    if (data.result.length === 0) {
      console.log('   ⚠️  Nessun modulo Social installato!');
      return;
    }

    console.log('   📦 Moduli Social installati:');
    data.result.forEach(m => {
      console.log(`     - ${m.name}: ${m.shortdesc}`);
    });

  } catch (error) {
    console.log('   ❌ Errore:', error.message);
  }
}

async function main() {
  try {
    console.log('🚀 Test accesso Social Marketing in Odoo\n');
    console.log(`URL: ${ODOO_URL}`);
    console.log(`DB: ${ODOO_DB}`);
    console.log(`User: ${ODOO_USERNAME}\n`);

    // Autentica
    await authenticate();

    // Controlla moduli social installati
    await checkSocialModules();

    // Controlla gruppi utente
    await checkUserGroups();

    // Test modelli social
    console.log('\n═══════════════════════════════════════════════════════');
    await checkModel('social.stream.post');

    console.log('\n═══════════════════════════════════════════════════════');
    await checkModel('social.account');

    console.log('\n═══════════════════════════════════════════════════════');
    await checkModel('social.media');

    console.log('\n\n✅ Test completato!');

  } catch (error) {
    console.error('\n❌ Errore generale:', error.message);
    console.error(error);
  }
}

main();
