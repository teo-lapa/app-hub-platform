/**
 * Test: Pubblica un post su Odoo con tutti i campi corretti
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const USERNAME = 'apphubplatform@lapa.ch';
const PASSWORD = 'apphubplatform2025';

let cookies = null;

async function authenticate() {
  console.log('🔐 Autenticazione...');

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
  }

  if (setCookies.length > 0) {
    cookies = setCookies.map(c => c.split(';')[0]).join('; ');
  }

  const data = await response.json();

  if (data.result && data.result.uid) {
    if (!cookies) cookies = `session_id=${data.result.session_id}`;
    console.log(`✅ Autenticato: UID ${data.result.uid}\n`);
    return true;
  }

  throw new Error('Auth failed');
}

async function callOdoo(model, method, args, kwargs = {}) {
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookies },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { model, method, args, kwargs },
      id: Math.floor(Math.random() * 1000000)
    })
  });

  const data = await response.json();
  if (data.error) {
    console.error('❌ Errore Odoo:', data.error.data?.message || data.error.message);
    throw new Error(data.error.data?.message || data.error.message);
  }
  return data.result;
}

async function main() {
  await authenticate();

  // 1. Verifica utm.source disponibili
  console.log('📊 Cerco utm.source disponibili...\n');

  try {
    const sources = await callOdoo('utm.source', 'search_read', [[]], {
      fields: ['id', 'name'],
      limit: 10
    });
    console.log('UTM Sources disponibili:');
    sources.forEach(s => console.log(`  [${s.id}] ${s.name}`));
    console.log('');
  } catch (e) {
    console.log('Errore lettura utm.source:', e.message);
  }

  // 2. Prova a creare un post con tutti i campi corretti
  console.log('📝 Creo un post di test...\n');

  const accountIds = [2, 4, 6]; // Facebook, Instagram, LinkedIn

  try {
    // Prima proviamo senza source_id per vedere l'errore esatto
    const postValues = {
      message: 'Test post da API - Questo è un test di pubblicazione automatica dall\'AI Studio.\n\n#Test #APITest\n\nVisita www.lapa.ch',
      account_ids: [[6, 0, accountIds]], // Many2many: set completo
      post_method: 'now',
      // Non settiamo state, lasciamo che Odoo lo gestisca
    };

    console.log('Valori del post:', JSON.stringify(postValues, null, 2));
    console.log('');

    const postId = await callOdoo('social.post', 'create', [postValues]);
    console.log(`✅ Post creato con ID: ${postId}`);

    // Leggi il post creato
    const posts = await callOdoo('social.post', 'search_read', [[['id', '=', postId]]], {
      fields: ['id', 'message', 'state', 'post_method', 'account_ids', 'image_ids', 'source_id']
    });
    console.log('\nPost creato:');
    console.log(JSON.stringify(posts[0], null, 2));

    // Prova a pubblicare
    console.log('\n🚀 Provo a pubblicare il post...');
    try {
      await callOdoo('social.post', 'action_post', [[postId]]);
      console.log('✅ Post pubblicato!');
    } catch (pubError) {
      console.log('⚠️ Errore pubblicazione:', pubError.message);
    }

    // Rileggi lo stato
    const updatedPosts = await callOdoo('social.post', 'search_read', [[['id', '=', postId]]], {
      fields: ['id', 'state', 'published_date']
    });
    console.log('\nStato finale:', JSON.stringify(updatedPosts[0], null, 2));

  } catch (e) {
    console.log('❌ Errore creazione post:', e.message);

    // Se fallisce, proviamo con source_id
    console.log('\n🔄 Riprovo con source_id...');

    // Cerca o crea un source
    let sourceId;
    try {
      const sources = await callOdoo('utm.source', 'search_read', [[['name', '=', 'AI Studio']]], {
        fields: ['id'],
        limit: 1
      });

      if (sources.length > 0) {
        sourceId = sources[0].id;
      } else {
        // Crea nuovo source
        sourceId = await callOdoo('utm.source', 'create', [{ name: 'AI Studio' }]);
      }
      console.log('Source ID:', sourceId);

      const postValues2 = {
        message: 'Test post da API con source - Pubblicazione automatica.\n\n#Test\n\nwww.lapa.ch',
        account_ids: [[6, 0, accountIds]],
        post_method: 'now',
        source_id: sourceId,
      };

      const postId2 = await callOdoo('social.post', 'create', [postValues2]);
      console.log(`✅ Post creato con ID: ${postId2}`);

      // Pubblica
      await callOdoo('social.post', 'action_post', [[postId2]]);
      console.log('✅ Post pubblicato!');

    } catch (e2) {
      console.log('❌ Errore anche con source:', e2.message);
    }
  }
}

main().catch(console.error);
