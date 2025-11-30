/**
 * DEBUG PROFONDO: Trova la causa esatta dell'errore "Unauthorized"
 * Controlla ogni singolo componente del Social Marketing
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const USERNAME = 'paul@lapa.ch';
const PASSWORD = 'lapa201180';

let cookies = null;
let uid = null;

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
    uid = data.result.uid;
    if (!cookies && data.result.session_id) {
      cookies = `session_id=${data.result.session_id}`;
    }
    console.log(`✅ Autenticato: ${data.result.name}\n`);
    return true;
  }
  throw new Error('Authentication failed');
}

async function testModel(modelName, description) {
  console.log(`\n🧪 Test: ${description}`);
  console.log(`   Modello: ${modelName}`);

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
          model: modelName,
          method: 'search_read',
          args: [[]],
          kwargs: { fields: ['id'], limit: 1 }
        },
        id: Math.random()
      })
    });

    const data = await response.json();

    if (data.error) {
      console.log(`   ❌ ERRORE: ${data.error.data?.message || data.error.message}`);
      console.log(`   Tipo: ${data.error.data?.name || 'unknown'}`);
      return false;
    }

    console.log(`   ✅ OK (${data.result.length} record)`);
    return true;

  } catch (error) {
    console.log(`   ❌ ECCEZIONE: ${error.message}`);
    return false;
  }
}

async function checkStreams() {
  console.log('\n📺 Controllo Social Streams (Feed)...\n');

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
        model: 'social.stream',
        method: 'search_read',
        args: [[]],
        kwargs: {
          fields: ['id', 'name', 'media_id', 'stream_type_id'],
          limit: 20
        }
      },
      id: 1
    })
  });

  const data = await response.json();

  if (data.error) {
    console.log('❌ Errore leggendo social.stream:');
    console.log('   ', data.error.data?.message || data.error.message);
    return [];
  }

  console.log(`Trovati ${data.result.length} stream/feed:\n`);

  data.result.forEach(stream => {
    console.log(`📡 ${stream.name}`);
    console.log(`   ID: ${stream.id}`);
    console.log(`   Media: ${stream.media_id ? stream.media_id[1] : 'N/A'}`);
    console.log(`   Tipo: ${stream.stream_type_id ? stream.stream_type_id[1] : 'N/A'}`);
    console.log('');
  });

  return data.result;
}

async function testStreamLoad(streamId, streamName) {
  console.log(`\n🔍 Test caricamento stream "${streamName}" (ID: ${streamId})...`);

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
          model: 'social.stream',
          method: 'read',
          args: [[streamId]],
          kwargs: {
            fields: ['id', 'name', 'account_ids']
          }
        },
        id: 1
      })
    });

    const data = await response.json();

    if (data.error) {
      console.log(`   ❌ ERRORE CARICAMENTO STREAM:`);
      console.log(`      ${data.error.data?.message || data.error.message}`);
      return false;
    }

    const stream = data.result[0];
    console.log(`   ✅ Stream caricato correttamente`);
    console.log(`      Account collegati: ${stream.account_ids ? stream.account_ids.length : 0}`);
    return true;

  } catch (error) {
    console.log(`   ❌ ECCEZIONE: ${error.message}`);
    return false;
  }
}

async function checkAccounts() {
  console.log('\n📱 Stato dettagliato account social...\n');

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
        model: 'social.account',
        method: 'search_read',
        args: [[]],
        kwargs: {
          fields: [
            'id', 'name', 'media_type', 'is_media_disconnected',
            'social_account_handle', 'has_account_token'
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

  data.result.forEach(acc => {
    const status = acc.is_media_disconnected ? '❌ DISCONNESSO' : '✅ Connesso';
    const token = acc.has_account_token ? '🔑 Token OK' : '⚠️ No Token';

    console.log(`${status} - ${acc.name} (${acc.media_type})`);
    console.log(`   ID: ${acc.id}`);
    console.log(`   Handle: ${acc.social_account_handle || 'N/A'}`);
    console.log(`   ${token}`);
    console.log('');
  });

  return data.result;
}

async function main() {
  try {
    console.log('🔍 DEBUG ERRORE "Unauthorized" - Analisi Profonda\n');
    console.log('='.repeat(60));

    await authenticate();

    // Test 1: Accesso base ai modelli
    console.log('\n📋 TEST ACCESSO MODELLI');
    console.log('='.repeat(60));

    await testModel('social.media', 'Social Media (Facebook, Instagram, ecc.)');
    await testModel('social.account', 'Account Social collegati');
    await testModel('social.stream', 'Stream/Feed');
    await testModel('social.stream.post', 'Post del Feed');

    // Test 2: Controllo account
    console.log('\n\n📱 CONTROLLO ACCOUNT SOCIAL');
    console.log('='.repeat(60));

    const accounts = await checkAccounts();

    // Test 3: Controllo stream
    console.log('\n📺 CONTROLLO STREAM/FEED');
    console.log('='.repeat(60));

    const streams = await checkStreams();

    // Test 4: Prova a caricare ogni stream
    if (streams.length > 0) {
      console.log('\n🧪 TEST CARICAMENTO SINGOLI STREAM');
      console.log('='.repeat(60));

      for (const stream of streams) {
        await testStreamLoad(stream.id, stream.name);
      }
    }

    // Analisi finale
    console.log('\n\n📊 ANALISI FINALE');
    console.log('='.repeat(60));
    console.log('');

    const disconnected = accounts.filter(a => a.is_media_disconnected);
    const noToken = accounts.filter(a => !a.has_account_token);

    if (disconnected.length > 0) {
      console.log(`⚠️  ${disconnected.length} account disconnessi:`);
      disconnected.forEach(a => console.log(`   - ${a.name} (${a.media_type})`));
      console.log('');
    }

    if (noToken.length > 0) {
      console.log(`⚠️  ${noToken.length} account senza token valido:`);
      noToken.forEach(a => console.log(`   - ${a.name} (${a.media_type})`));
      console.log('');
    }

    if (disconnected.length === 0 && noToken.length === 0) {
      console.log('✅ Tutti gli account sembrano OK');
      console.log('');
      console.log('🤔 L\'errore "Unauthorized" potrebbe essere causato da:');
      console.log('   1. Operazione specifica (es. pubblicare un post)');
      console.log('   2. Token scaduto ma non ancora rilevato da Odoo');
      console.log('   3. Problema con un social network specifico');
      console.log('   4. Problema di permessi lato app social');
      console.log('');
      console.log('💡 Prova a:');
      console.log('   - Aprire il browser DevTools (F12)');
      console.log('   - Andare sulla tab "Network"');
      console.log('   - Ricaricare la pagina');
      console.log('   - Cercare chiamate con status 401 o errori');
      console.log('');
    }

  } catch (error) {
    console.error('\n❌ Errore:', error.message);
    console.error(error);
  }
}

main();
