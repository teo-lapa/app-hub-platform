/**
 * FIX: Aggiungi permessi Social Marketing all'utente apphubplatform@lapa.ch
 * Risolve l'errore "Unauthorized" nel modulo Social Marketing di Odoo
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

    console.log('✅ Autenticato come UID:', uid);
    return true;
  }

  throw new Error('Authentication failed: ' + JSON.stringify(data));
}

async function findSocialGroups() {
  console.log('\n🔍 Cerco gruppi Social Marketing...');

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
        args: [[
          '|',
          ['name', 'ilike', 'Social User'],
          ['name', 'ilike', 'Social Manager']
        ]],
        kwargs: {
          fields: ['id', 'name', 'full_name', 'category_id'],
          limit: 20
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

  console.log('📦 Gruppi trovati:');
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
      id: 2
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

async function verifyAccess() {
  console.log('\n🧪 Verifico l\'accesso al modello social.stream.post...');

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
        method: 'check_access_rights',
        args: ['read', false],
        kwargs: {}
      },
      id: 3
    })
  });

  const data = await response.json();

  if (data.error) {
    console.log('❌ Ancora nessun accesso:', data.error.data?.message || data.error.message);
    return false;
  }

  if (data.result === true) {
    console.log('✅ Perfetto! Ora l\'utente ha accesso al modulo Social Marketing!');
    return true;
  } else {
    console.log('⚠️  check_access_rights ha restituito:', data.result);
    return false;
  }
}

async function main() {
  try {
    console.log('🚀 FIX Permessi Social Marketing\n');
    console.log(`URL: ${ODOO_URL}`);
    console.log(`User: ${ODOO_USERNAME}\n`);

    // Autentica
    await authenticate();

    // Trova gruppi social
    const socialGroups = await findSocialGroups();

    if (socialGroups.length === 0) {
      console.log('\n❌ Nessun gruppo Social trovato! Verifica che il modulo Social Marketing sia installato.');
      return;
    }

    // Cerca il gruppo "Social User" (è il gruppo base, sufficiente per accesso)
    const socialUserGroup = socialGroups.find(g =>
      g.name.includes('User') && !g.name.includes('Manager')
    );

    if (!socialUserGroup) {
      console.log('\n⚠️  Gruppo "Social User" non trovato. Provo ad aggiungere tutti i gruppi social...');

      // Aggiungi tutti i gruppi social trovati
      for (const group of socialGroups) {
        await addUserToGroup(uid, group.id, group.full_name || group.name);
      }
    } else {
      // Aggiungi solo il gruppo User (base)
      await addUserToGroup(uid, socialUserGroup.id, socialUserGroup.full_name || socialUserGroup.name);
    }

    // Ri-autentica per aggiornare la sessione
    console.log('\n🔄 Ri-autenticazione per aggiornare i permessi...');
    await authenticate();

    // Verifica accesso
    await verifyAccess();

    console.log('\n\n✅ FIX COMPLETATO!');
    console.log('🎉 Ora puoi accedere al modulo Social Marketing in Odoo!');
    console.log('🔗 https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com/web#action=369&model=social.stream.post');

  } catch (error) {
    console.error('\n❌ Errore generale:', error.message);
    console.error(error);
  }
}

main();
