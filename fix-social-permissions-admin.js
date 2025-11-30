/**
 * FIX: Aggiungi permessi Social Marketing all'utente apphubplatform@lapa.ch
 * Usa l'account admin paul@lapa.ch per modificare i permessi
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
          ['name', '=', 'User'],
          ['name', '=', 'Manager'],
          ['category_id.name', 'ilike', 'Social']
        ]],
        kwargs: {
          fields: ['id', 'name', 'full_name', 'category_id'],
          limit: 20
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

  // Filtra solo i gruppi della categoria "Social Marketing"
  const socialGroups = data.result.filter(g =>
    g.category_id && g.category_id[1] && g.category_id[1].includes('Social')
  );

  console.log('📦 Gruppi Social Marketing trovati:');
  socialGroups.forEach(g => {
    console.log(`   - ID: ${g.id}, Nome: ${g.full_name || g.name}`);
  });

  return socialGroups;
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

async function verifyUserAccess(userId) {
  console.log(`\n🧪 Verifico se l'utente ${userId} ha ora accesso a social.stream.post...`);

  // Ri-leggi l'utente per verificare i gruppi aggiornati
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
        args: [[userId], ['name', 'groups_id']],
        kwargs: {}
      },
      id: 4
    })
  });

  const data = await response.json();

  if (data.error) {
    console.log('❌ Errore:', data.error.data?.message || data.error.message);
    return false;
  }

  const user = data.result[0];
  console.log(`✅ Utente ${user.name} ha ora ${user.groups_id.length} gruppi`);
  return true;
}

async function main() {
  try {
    console.log('🚀 FIX Permessi Social Marketing (Admin Mode)\n');
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

    // Trova gruppi social
    const socialGroups = await findSocialGroups();

    if (socialGroups.length === 0) {
      console.log('\n❌ Nessun gruppo Social trovato! Verifica che il modulo Social Marketing sia installato.');
      return;
    }

    // Cerca il gruppo "Social User" (è il gruppo base, sufficiente per accesso)
    const socialUserGroup = socialGroups.find(g =>
      g.name === 'User' && g.category_id && g.category_id[1].includes('Social')
    );

    if (!socialUserGroup) {
      console.log('\n⚠️  Gruppo "Social Marketing / User" non trovato.');
      console.log('Provo ad aggiungere il primo gruppo social disponibile...');

      if (socialGroups.length > 0) {
        await addUserToGroup(targetUser.id, socialGroups[0].id, socialGroups[0].full_name || socialGroups[0].name);
      }
    } else {
      // Aggiungi il gruppo User (base)
      await addUserToGroup(targetUser.id, socialUserGroup.id, socialUserGroup.full_name || socialUserGroup.name);
    }

    // Verifica che l'utente abbia ora i permessi
    await verifyUserAccess(targetUser.id);

    console.log('\n\n✅ FIX COMPLETATO!');
    console.log('🎉 L\'utente apphubplatform@lapa.ch ha ora accesso al modulo Social Marketing!');
    console.log('\n📝 Cosa fare ora:');
    console.log('   1. Esci da Odoo (logout)');
    console.log('   2. Ri-entra come apphubplatform@lapa.ch');
    console.log('   3. Vai su Marketing Sociale → Feed');
    console.log('   4. Dovresti vedere i post senza errore "Unauthorized"');
    console.log('\n🔗 Link diretto: https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com/web#action=369&model=social.stream.post');

  } catch (error) {
    console.error('\n❌ Errore generale:', error.message);
    console.error(error);
  }
}

main();
