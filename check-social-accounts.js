/**
 * Investigazione: Controlla gli account social collegati in Odoo
 * e identifica quale ha problemi di autorizzazione
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const USERNAME = 'paul@lapa.ch';
const PASSWORD = 'lapa201180';

let cookies = null;
let uid = null;

async function authenticate() {
  console.log(`🔐 Autenticazione come ${USERNAME}...`);

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
        login: USERNAME,
        password: PASSWORD
      },
      id: 1
    })
  });

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

    console.log(`✅ Autenticato: ${data.result.name} (UID: ${uid})\n`);
    return true;
  }

  throw new Error('Authentication failed');
}

async function checkSocialAccounts() {
  console.log('📱 Controllo Social Accounts collegati...\n');

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
            'id', 'name', 'media_id', 'media_type',
            'is_media_disconnected', 'social_account_handle',
            'create_date', 'write_date'
          ],
          limit: 50
        }
      },
      id: 1
    })
  });

  const data = await response.json();

  if (data.error) {
    console.log('❌ Errore leggendo social.account:');
    console.log('   ', data.error.data?.message || data.error.message);
    return [];
  }

  if (data.result.length === 0) {
    console.log('⚠️  Nessun account social collegato trovato!\n');
    return [];
  }

  console.log(`Trovati ${data.result.length} account social:\n`);

  data.result.forEach(account => {
    const status = account.is_media_disconnected ? '❌ DISCONNESSO' : '✅ Connesso';
    const mediaType = account.media_type || 'N/A';
    const handle = account.social_account_handle || 'N/A';

    console.log(`${status} - ${account.name}`);
    console.log(`   Tipo: ${mediaType}`);
    console.log(`   Handle: ${handle}`);
    console.log(`   ID: ${account.id}`);
    console.log(`   Media ID: ${account.media_id ? account.media_id[1] : 'N/A'}`);
    console.log(`   Ultima modifica: ${account.write_date}`);
    console.log('');
  });

  return data.result;
}

async function checkSocialMedia() {
  console.log('🌐 Controllo Social Media configurati...\n');

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
        model: 'social.media',
        method: 'search_read',
        args: [[]],
        kwargs: {
          fields: ['id', 'name', 'media_type'],
          limit: 20
        }
      },
      id: 2
    })
  });

  const data = await response.json();

  if (data.error) {
    console.log('❌ Errore leggendo social.media:');
    console.log('   ', data.error.data?.message || data.error.message);
    return [];
  }

  console.log(`Trovati ${data.result.length} social media:\n`);

  data.result.forEach(media => {
    console.log(`📢 ${media.name} (${media.media_type})`);
    console.log(`   ID: ${media.id}`);
    console.log('');
  });

  return data.result;
}

async function checkRecentPosts() {
  console.log('📝 Controllo ultimi post nel feed...\n');

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
        model: 'social.stream.post',
        method: 'search_read',
        args: [[]],
        kwargs: {
          fields: [
            'id', 'message', 'stream_id', 'author_id',
            'published_date', 'account_id'
          ],
          limit: 5,
          order: 'published_date DESC'
        }
      },
      id: 3
    })
  });

  const data = await response.json();

  if (data.error) {
    console.log('❌ Errore leggendo social.stream.post:');
    console.log('   ', data.error.data?.message || data.error.message);
    return [];
  }

  console.log(`Trovati ${data.result.length} post recenti:\n`);

  data.result.forEach(post => {
    console.log(`📄 Post ID: ${post.id}`);
    console.log(`   Messaggio: ${post.message ? post.message.substring(0, 80) + '...' : 'N/A'}`);
    console.log(`   Account: ${post.account_id ? post.account_id[1] : 'N/A'}`);
    console.log(`   Data: ${post.published_date || 'N/A'}`);
    console.log('');
  });

  return data.result;
}

async function main() {
  try {
    console.log('🔍 INVESTIGAZIONE ERRORE "Unauthorized" SOCIAL MARKETING\n');
    console.log('='.repeat(60));
    console.log('');

    await authenticate();

    // Controlla gli account social
    const accounts = await checkSocialAccounts();

    console.log('='.repeat(60));
    console.log('');

    // Controlla i social media disponibili
    await checkSocialMedia();

    console.log('='.repeat(60));
    console.log('');

    // Controlla i post recenti
    await checkRecentPosts();

    console.log('='.repeat(60));
    console.log('');

    // Analisi
    console.log('📊 ANALISI:\n');

    const disconnected = accounts.filter(a => a.is_media_disconnected);
    if (disconnected.length > 0) {
      console.log('⚠️  PROBLEMA TROVATO!');
      console.log(`   Ci sono ${disconnected.length} account social DISCONNESSI:\n`);
      disconnected.forEach(acc => {
        console.log(`   ❌ ${acc.name} (${acc.media_type})`);
        console.log(`      Devi ri-autorizzare questo account!`);
        console.log('');
      });
      console.log('💡 SOLUZIONE:');
      console.log('   1. Vai su: Marketing Sociale → Configurazione → Social Media');
      console.log('   2. Trova gli account DISCONNESSI');
      console.log('   3. Clicca "Riconnetti" e autorizza nuovamente');
      console.log('');
    } else if (accounts.length === 0) {
      console.log('⚠️  Nessun account social collegato!');
      console.log('   Devi prima collegare almeno un account social.');
      console.log('');
      console.log('💡 Per collegare un account:');
      console.log('   1. Vai su: Marketing Sociale → Configurazione → Social Media');
      console.log('   2. Seleziona il social (Facebook, Instagram, ecc.)');
      console.log('   3. Clicca "Aggiungi Account" e autorizza');
      console.log('');
    } else {
      console.log('✅ Tutti gli account social sono connessi correttamente.');
      console.log('');
      console.log('🤔 L\'errore "Unauthorized" potrebbe essere causato da:');
      console.log('   1. Token OAuth scaduto (anche se segnato come connesso)');
      console.log('   2. Permessi revocati lato social network');
      console.log('   3. Tentativo di pubblicare su un account senza permessi');
      console.log('');
      console.log('💡 Prova a:');
      console.log('   1. Disconnettere e riconnettere l\'account problematico');
      console.log('   2. Verificare i permessi sull\'app social network');
      console.log('');
    }

  } catch (error) {
    console.error('\n❌ Errore:', error.message);
    console.error(error);
  }
}

main();
