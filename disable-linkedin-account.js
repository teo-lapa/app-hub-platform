/**
 * SOLUZIONE: Disattiva/Rimuovi l'account LinkedIn disconnesso
 * per fermare gli errori "Unauthorized" nel feed
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

    console.log(`✅ Autenticato: ${data.result.name}\n`);
    return true;
  }

  throw new Error('Authentication failed');
}

async function findDisconnectedAccounts() {
  console.log('🔍 Cerco account social disconnessi...\n');

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
        args: [[['is_media_disconnected', '=', true]]],
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

  if (data.result.length === 0) {
    console.log('✅ Nessun account disconnesso trovato!\n');
    return [];
  }

  console.log(`Trovati ${data.result.length} account disconnessi:\n`);
  data.result.forEach(acc => {
    console.log(`❌ ${acc.name} (${acc.media_type}) - ID: ${acc.id}`);
  });
  console.log('');

  return data.result;
}

async function deleteAccount(accountId, accountName) {
  console.log(`🗑️  Eliminazione account "${accountName}" (ID: ${accountId})...`);

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
        method: 'unlink',
        args: [[accountId]],
        kwargs: {}
      },
      id: 2
    })
  });

  const data = await response.json();

  if (data.error) {
    console.log('❌ Errore eliminazione:', data.error.data?.message || data.error.message);
    return false;
  }

  console.log('✅ Account eliminato con successo!\n');
  return true;
}

async function archiveAccount(accountId, accountName) {
  console.log(`📦 Archiviazione account "${accountName}" (ID: ${accountId})...`);

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
        method: 'write',
        args: [
          [accountId],
          { active: false }
        ],
        kwargs: {}
      },
      id: 3
    })
  });

  const data = await response.json();

  if (data.error) {
    console.log('❌ Errore archiviazione:', data.error.data?.message || data.error.message);

    // Se non esiste il campo 'active', prova ad eliminare
    console.log('⚠️  Campo "active" non disponibile, provo a eliminare...\n');
    return await deleteAccount(accountId, accountName);
  }

  console.log('✅ Account archiviato con successo!\n');
  return true;
}

async function main() {
  try {
    console.log('🔧 FIX: Rimuovi account social disconnessi\n');
    console.log('='.repeat(60));
    console.log('');

    await authenticate();

    // Trova account disconnessi
    const disconnected = await findDisconnectedAccounts();

    if (disconnected.length === 0) {
      console.log('✅ Nessun account da rimuovere. Il problema potrebbe essere altrove.\n');
      return;
    }

    console.log('='.repeat(60));
    console.log('');

    // Elimina/archivia ogni account disconnesso
    for (const account of disconnected) {
      const success = await archiveAccount(account.id, account.name);

      if (!success) {
        console.log(`⚠️  Impossibile rimuovere ${account.name}\n`);
      }
    }

    console.log('='.repeat(60));
    console.log('');
    console.log('✅ COMPLETATO!\n');
    console.log('📝 Cosa fare ora:');
    console.log('   1. Aggiorna la pagina Odoo (F5)');
    console.log('   2. L\'errore "Unauthorized" dovrebbe essere sparito');
    console.log('   3. Il feed ora mostrerà solo account connessi');
    console.log('');
    console.log('💡 Per riconnettere LinkedIn in futuro:');
    console.log('   Marketing Sociale → Configurazione → Social Media → LinkedIn');
    console.log('   Clicca "Aggiungi Account" e autorizza');
    console.log('');

  } catch (error) {
    console.error('\n❌ Errore:', error.message);
    console.error(error);
  }
}

main();
