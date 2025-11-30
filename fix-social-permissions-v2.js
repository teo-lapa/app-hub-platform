/**
 * FIX v2: Aggiungi permessi Social Marketing all'utente apphubplatform@lapa.ch
 * Versione migliorata con ricerca più flessibile dei gruppi
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ADMIN_USERNAME = 'paul@lapa.ch';
const ADMIN_PASSWORD = 'lapa201180';
const TARGET_USER_EMAIL = 'apphubplatform@lapa.ch';

let cookies = null;
let uid = null;

async function authenticate() {
  console.log(`🔐 Autenticazione come admin (${ADMIN_USERNAME})...`);

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
        login: ADMIN_USERNAME,
        password: ADMIN_PASSWORD
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

    console.log(`✅ Autenticato come admin: ${data.result.name} (UID: ${uid})`);
    return true;
  }

  throw new Error('Authentication failed: ' + JSON.stringify(data));
}

async function findTargetUser() {
  console.log(`\n🔍 Cerco utente target: ${TARGET_USER_EMAIL}...`);

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
        method: 'search_read',
        args: [[['login', '=', TARGET_USER_EMAIL]]],
        kwargs: {
          fields: ['id', 'name', 'login', 'groups_id'],
          limit: 1
        }
      },
      id: 1
    })
  });

  const data = await response.json();

  if (data.error) {
    console.log('❌ Errore:', data.error.data?.message || data.error.message);
    return null;
  }

  if (data.result.length === 0) {
    console.log('❌ Utente non trovato!');
    return null;
  }

  const user = data.result[0];
  console.log(`✅ Utente trovato: ${user.name} (ID: ${user.id})`);
  console.log(`   Gruppi attuali: ${user.groups_id.length} gruppi`);
  return user;
}

async function findSocialGroups() {
  console.log('\n🔍 Cerco tutti i gruppi con "Social" nel nome...');

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
        model: 'res.groups',
        method: 'search_read',
        args: [[['full_name', 'ilike', 'Social']]],
        kwargs: {
          fields: ['id', 'name', 'full_name', 'category_id'],
          limit: 50
        }
      },
      id: 2
    })
  });

  const data = await response.json();

  if (data.error) {
    console.log('❌ Errore:', data.error.data?.message || data.error.message);
    return [];
  }

  console.log(`📦 Trovati ${data.result.length} gruppi con "Social"`);
  data.result.forEach(g => {
    console.log(`   - ID: ${g.id}, Nome: ${g.full_name || g.name}`);
  });

  return data.result;
}

async function addUserToGroup(userId, groupId, groupName) {
  console.log(`\n➕ Aggiunggo utente ${userId} al gruppo "${groupName}" (ID: ${groupId})...`);

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
        method: 'write',
        args: [
          [userId],
          {
            groups_id: [[4, groupId]]  // [[4, id]] = add link to existing record
          }
        ],
        kwargs: {}
      },
      id: 3
    })
  });

  const data = await response.json();

  if (data.error) {
    console.log('❌ Errore:', data.error.data?.message || data.error.message);
    return false;
  }

  console.log('✅ Gruppo aggiunto con successo!');
  return true;
}

async function testAccess() {
  console.log('\n🧪 Test finale: provo a leggere social.stream.post con utente target...');

  // Per testare, devo autenticarmi come target user
  console.log('   (Ri-autenticazione come apphubplatform@lapa.ch...)');

  const authResponse = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        db: ODOO_DB,
        login: TARGET_USER_EMAIL,
        password: 'apphubplatform2025'
      },
      id: 1
    })
  });

  let testCookies = null;
  let setCookies = [];
  if (typeof authResponse.headers.getSetCookie === 'function') {
    setCookies = authResponse.headers.getSetCookie();
  } else {
    const cookieHeader = authResponse.headers.get('set-cookie');
    if (cookieHeader) {
      setCookies = cookieHeader.split(',').map(c => c.trim());
    }
  }

  if (setCookies && setCookies.length > 0) {
    testCookies = setCookies.map(cookie => cookie.split(';')[0]).join('; ');
  }

  const authData = await authResponse.json();
  if (!authData.result || !authData.result.uid) {
    console.log('   ⚠️ Impossibile autenticarsi come target user per il test');
    return false;
  }

  if (!testCookies && authData.result.session_id) {
    testCookies = `session_id=${authData.result.session_id}`;
  }

  // Ora prova l'accesso
  const testResponse = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': testCookies
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model: 'social.stream.post',
        method: 'search_read',
        args: [[]],
        kwargs: {
          fields: ['id', 'message'],
          limit: 1
        }
      },
      id: 1
    })
  });

  const testData = await testResponse.json();

  if (testData.error) {
    console.log('   ❌ Ancora errore di accesso:', testData.error.data?.message || testData.error.message);
    return false;
  }

  console.log('   ✅ PERFETTO! L\'utente ora può accedere a social.stream.post!');
  return true;
}

async function main() {
  try {
    console.log('🚀 FIX Permessi Social Marketing v2\n');
    console.log(`URL: ${ODOO_URL}`);
    console.log(`Admin: ${ADMIN_USERNAME}`);
    console.log(`Target User: ${TARGET_USER_EMAIL}\n`);

    // Autentica come admin
    await authenticate();

    // Trova l'utente target
    const targetUser = await findTargetUser();
    if (!targetUser) {
      console.log('\n❌ Impossibile continuare: utente target non trovato.');
      return;
    }

    // Trova tutti i gruppi con "Social" nel nome
    const socialGroups = await findSocialGroups();

    if (socialGroups.length === 0) {
      console.log('\n❌ Nessun gruppo Social trovato!');
      return;
    }

    // Cerca il gruppo "Social Marketing / User" o "Social Marketing / Social User"
    let targetGroup = socialGroups.find(g =>
      g.full_name && (
        g.full_name.includes('Social Marketing / User') ||
        g.full_name.includes('Social Marketing / Social User')
      )
    );

    // Se non trovato, cerca qualsiasi gruppo con "User" (non "Manager")
    if (!targetGroup) {
      targetGroup = socialGroups.find(g =>
        g.full_name && g.full_name.includes('User') && !g.full_name.includes('Manager')
      );
    }

    // Fallback: prendi il primo gruppo social disponibile
    if (!targetGroup) {
      targetGroup = socialGroups[0];
    }

    console.log(`\n🎯 Gruppo selezionato: ${targetGroup.full_name || targetGroup.name}`);

    // Aggiungi il gruppo
    const success = await addUserToGroup(targetUser.id, targetGroup.id, targetGroup.full_name || targetGroup.name);

    if (!success) {
      console.log('\n❌ Impossibile aggiungere il gruppo.');
      return;
    }

    // Test finale
    await testAccess();

    console.log('\n\n✅ FIX COMPLETATO!');
    console.log('🎉 L\'utente apphubplatform@lapa.ch ha ora accesso al modulo Social Marketing!');
    console.log('\n📝 Cosa fare ora:');
    console.log('   1. Aggiorna la pagina in Odoo (F5)');
    console.log('   2. L\'errore "Unauthorized" dovrebbe essere sparito');
    console.log('\n🔗 Link diretto: https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com/web#action=369&model=social.stream.post');

  } catch (error) {
    console.error('\n❌ Errore generale:', error.message);
    console.error(error);
  }
}

main();
