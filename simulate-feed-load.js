/**
 * SIMULA esattamente il caricamento del Feed come fa il browser
 * per replicare l'errore "Unauthorized"
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
    console.log(`✅ Autenticato come: ${data.result.name}\n`);
    return true;
  }
  throw new Error('Authentication failed');
}

async function loadKanbanView() {
  console.log('🔄 Simulo il caricamento della vista Kanban del Feed...\n');

  // Step 1: Load view definition
  console.log('1️⃣ Carico la definizione della vista Kanban...');

  const viewResponse = await fetch(`${ODOO_URL}/web/dataset/call_kw/social.stream.post/load_views`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookies
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        args: [],
        kwargs: {
          views: [[false, 'kanban'], [false, 'form']],
          options: {}
        }
      },
      id: 1
    })
  });

  const viewData = await viewResponse.json();

  if (viewData.error) {
    console.log('   ❌ ERRORE caricamento vista:');
    console.log('   ', viewData.error.data?.message || viewData.error.message);
    return false;
  }

  console.log('   ✅ Vista Kanban caricata\n');

  // Step 2: Web read group (per le colonne Kanban)
  console.log('2️⃣ Carico i gruppi per le colonne Kanban...');

  const groupResponse = await fetch(`${ODOO_URL}/web/dataset/call_kw/social.stream.post/web_read_group`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookies
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model: 'social.stream.post',
        domain: [],
        fields: ['stream_id'],
        groupby: ['stream_id'],
        limit: 80,
        offset: 0,
        orderby: '',
        lazy: true
      },
      id: 2
    })
  });

  const groupData = await groupResponse.json();

  if (groupData.error) {
    console.log('   ❌ ERRORE web_read_group:');
    console.log('   ', groupData.error.data?.message || groupData.error.message);
    console.log('   Dettagli:', JSON.stringify(groupData.error, null, 2));
    return false;
  }

  console.log('   ✅ Gruppi caricati\n');

  // Step 3: Search read posts
  console.log('3️⃣ Carico i post del feed...');

  const postsResponse = await fetch(`${ODOO_URL}/web/dataset/call_kw/social.stream.post/web_search_read`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookies
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model: 'social.stream.post',
        domain: [],
        fields: [
          'stream_id', 'message', 'published_date',
          'author_name', 'link_url'
        ],
        limit: 40,
        offset: 0,
        sort: 'published_date DESC'
      },
      id: 3
    })
  });

  const postsData = await postsResponse.json();

  if (postsData.error) {
    console.log('   ❌ ERRORE caricamento post:');
    console.log('   ', postsData.error.data?.message || postsData.error.message);
    console.log('   Dettagli:', JSON.stringify(postsData.error, null, 2));
    return false;
  }

  console.log(`   ✅ Caricati ${postsData.result.records ? postsData.result.records.length : 0} post\n`);

  return true;
}

async function fetchStreamPosts() {
  console.log('\n📡 Provo a fare il refresh dei post dai social network...\n');

  // Questa è l'operazione che probabilmente causa l'errore "Unauthorized"
  // quando Odoo prova a connettersi ai social per scaricare nuovi post

  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw/social.stream/fetch_stream_data`, {
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
        method: 'fetch_stream_data',
        args: [],
        kwargs: {}
      },
      id: 4
    })
  });

  const data = await response.json();

  if (data.error) {
    console.log('❌ ERRORE DURANTE FETCH_STREAM_DATA:');
    console.log('   QUESTO È PROBABILMENTE LA CAUSA DEL POPUP "Unauthorized"!');
    console.log('');
    console.log('   Messaggio:', data.error.data?.message || data.error.message);
    console.log('   Tipo:', data.error.data?.name || data.error.code);
    console.log('');
    console.log('   Dettagli completi:');
    console.log(JSON.stringify(data.error, null, 2));
    return false;
  }

  console.log('✅ Fetch completato senza errori\n');
  return true;
}

async function main() {
  try {
    console.log('🎯 SIMULAZIONE CARICAMENTO FEED - DEBUG "Unauthorized"\n');
    console.log('='.repeat(70));
    console.log('');

    await authenticate();

    console.log('='.repeat(70));
    console.log('');

    // Simula il caricamento della vista Kanban
    await loadKanbanView();

    console.log('='.repeat(70));
    console.log('');

    // Prova il refresh dei post (questa operazione contatta i social)
    await fetchStreamPosts();

    console.log('='.repeat(70));
    console.log('\n✅ Simulazione completata!\n');

  } catch (error) {
    console.error('\n❌ Errore durante la simulazione:', error.message);
    console.error(error);
  }
}

main();
