/**
 * Controlla le impostazioni di auto-refresh/sincronizzazione dei feed social
 * e cerca di capire cosa causa il popup "Unauthorized"
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

async function testStreamRefresh() {
  console.log('🔄 Test: Provo a fare il refresh di uno stream specifico...\n');

  // Prima, leggo gli stream disponibili
  const streamsResponse = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
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
          fields: ['id', 'name', 'media_id'],
          limit: 10
        }
      },
      id: 1
    })
  });

  const streamsData = await streamsResponse.json();

  if (streamsData.error || !streamsData.result || streamsData.result.length === 0) {
    console.log('⚠️  Nessuno stream trovato\n');
    return;
  }

  console.log(`Trovati ${streamsData.result.length} stream:\n`);

  // Prova a fare refresh per ogni stream
  for (const stream of streamsData.result) {
    console.log(`📡 Test refresh: ${stream.name} (${stream.media_id ? stream.media_id[1] : 'N/A'})`);

    // Prova metodo refresh
    const refreshResponse = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
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
          method: '_fetch_stream_data',
          args: [[stream.id]],
          kwargs: {}
        },
        id: 2
      })
    });

    const refreshData = await refreshResponse.json();

    if (refreshData.error) {
      console.log(`   ❌ ERRORE: ${refreshData.error.data?.message || refreshData.error.message}`);

      // Controlla se è un errore di autorizzazione
      const errorMsg = refreshData.error.data?.message || refreshData.error.message || '';
      if (errorMsg.toLowerCase().includes('unauthorized') || errorMsg.toLowerCase().includes('401')) {
        console.log('   🎯 QUESTO È IL PROBLEMA! Questo stream causa "Unauthorized"');
        console.log('   Media:', stream.media_id ? stream.media_id[1] : 'N/A');
        console.log('');
        return { stream, error: refreshData.error };
      }
      console.log('');
    } else {
      console.log('   ✅ OK\n');
    }
  }

  return null;
}

async function checkAccountsWithProblems() {
  console.log('\n🔍 Controllo dettagliato account per trovare problemi di autenticazione...\n');

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
          fields: ['id', 'name', 'media_type', 'is_media_disconnected'],
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

  console.log(`Account social:\n`);

  data.result.forEach(acc => {
    const status = acc.is_media_disconnected ? '❌ DISCONNESSO' : '✅ Connesso';
    console.log(`${status} - ${acc.name} (${acc.media_type})`);
  });

  console.log('');

  return data.result;
}

async function main() {
  try {
    console.log('🎯 ANALISI COMPLETA - Trova causa "Unauthorized"\n');
    console.log('='.repeat(70));
    console.log('');

    await authenticate();

    // Controlla account
    await checkAccountsWithProblems();

    console.log('='.repeat(70));
    console.log('');

    // Test refresh stream
    const problem = await testStreamRefresh();

    console.log('='.repeat(70));
    console.log('\n📊 CONCLUSIONE:\n');

    if (problem) {
      console.log(`🎯 PROBLEMA TROVATO!`);
      console.log(`   Stream: ${problem.stream.name}`);
      console.log(`   Media: ${problem.stream.media_id ? problem.stream.media_id[1] : 'N/A'}`);
      console.log(`   Errore: ${problem.error.data?.message || problem.error.message}`);
      console.log('');
      console.log('💡 SOLUZIONE:');
      console.log('   Devi riconnettere l\'account social per questo media:');
      console.log(`   Marketing Sociale → Configurazione → Social Media → ${problem.stream.media_id ? problem.stream.media_id[1] : 'Media'}`);
      console.log('');
    } else {
      console.log('⚠️  Non ho trovato errori di autorizzazione diretti.');
      console.log('');
      console.log('💡 Possibili cause alternative:');
      console.log('   1. L\'errore appare solo in determinati momenti');
      console.log('   2. Un\'azione JavaScript lato client fa la chiamata');
      console.log('   3. Un widget personalizzato causa il problema');
      console.log('');
      console.log('🔧 Prova a:');
      console.log('   1. Aprire DevTools del browser (F12)');
      console.log('   2. Andare su Network tab');
      console.log('   3. Ricaricare la pagina');
      console.log('   4. Cercare richieste con status 401 o errori');
      console.log('');
    }

  } catch (error) {
    console.error('\n❌ Errore:', error.message);
    console.error(error);
  }
}

main();
