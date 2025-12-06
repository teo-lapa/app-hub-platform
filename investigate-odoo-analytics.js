/**
 * Investigazione: Scopri i modelli Odoo per analytics social
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

  throw new Error('Auth failed: ' + JSON.stringify(data));
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
  if (data.error) throw new Error(data.error.data?.message || data.error.message);
  return data.result;
}

async function main() {
  await authenticate();

  // 1. Analizza social.stream.post (dove sono i post pubblicati con metriche)
  console.log('\n\n📊 CAMPI DI social.stream.post:\n');
  console.log('='.repeat(60));

  try {
    const streamFields = await callOdoo('social.stream.post', 'fields_get', [], {
      attributes: ['string', 'type', 'required']
    });

    const relevantFields = Object.entries(streamFields)
      .filter(([name, info]) =>
        name.includes('like') ||
        name.includes('comment') ||
        name.includes('share') ||
        name.includes('view') ||
        name.includes('engagement') ||
        name.includes('message') ||
        name.includes('date') ||
        name.includes('account') ||
        name.includes('media')
      );

    for (const [name, info] of relevantFields) {
      console.log(`\n${name}`);
      console.log(`  Label: ${info.string}`);
      console.log(`  Tipo: ${info.type}`);
    }
  } catch (e) {
    console.log('Errore:', e.message);
  }

  // 3. Leggi alcuni post pubblicati come esempio
  console.log('\n\n📝 ESEMPI POST STREAM (con metriche):\n');
  console.log('='.repeat(60));

  try {
    const streamPosts = await callOdoo('social.stream.post', 'search_read', [[]], {
      fields: ['id', 'message', 'published_date', 'account_id', 'stream_id',
               'likes_count', 'comments_count', 'shares_count', 'engagement'],
      limit: 5,
      order: 'published_date DESC'
    });

    for (const post of streamPosts) {
      console.log(`\nPost ID: ${post.id}`);
      console.log(`  Account: ${post.account_id}`);
      console.log(`  Data: ${post.published_date}`);
      console.log(`  Likes: ${post.likes_count || 0}`);
      console.log(`  Comments: ${post.comments_count || 0}`);
      console.log(`  Shares: ${post.shares_count || 0}`);
      console.log(`  Messaggio: ${(post.message || '').substring(0, 50)}...`);
    }
  } catch (e) {
    console.log('Errore social.stream.post:', e.message);
  }

  // 4. Prova social.live.post (post live dal social.post)
  console.log('\n\n📝 ESEMPI SOCIAL.LIVE.POST:\n');
  console.log('='.repeat(60));

  try {
    const livePosts = await callOdoo('social.live.post', 'search_read', [[]], {
      fields: ['id', 'message', 'post_id', 'account_id', 'state',
               'likes', 'engagement', 'comments_count', 'published_date'],
      limit: 5,
      order: 'id DESC'
    });

    for (const post of livePosts) {
      console.log(`\nLive Post ID: ${post.id}`);
      console.log(`  Post ID: ${post.post_id}`);
      console.log(`  Account: ${post.account_id}`);
      console.log(`  State: ${post.state}`);
      console.log(`  Likes: ${post.likes || 0}`);
      console.log(`  Comments: ${post.comments_count || 0}`);
      console.log(`  Published: ${post.published_date}`);
    }
  } catch (e) {
    console.log('Errore social.live.post:', e.message);
  }

  // 5. Controlla i social.post esistenti
  console.log('\n\n📝 SOCIAL.POST (tutti i post creati):\n');
  console.log('='.repeat(60));

  try {
    const posts = await callOdoo('social.post', 'search_read', [[]], {
      fields: ['id', 'message', 'state', 'post_method', 'account_ids',
               'published_date', 'create_date', 'engagement'],
      limit: 10,
      order: 'id DESC'
    });

    console.log(`Trovati ${posts.length} post totali`);
    for (const post of posts) {
      console.log(`\n[${post.id}] State: ${post.state}`);
      console.log(`  Method: ${post.post_method}`);
      console.log(`  Accounts: ${post.account_ids}`);
      console.log(`  Published: ${post.published_date || 'N/A'}`);
      console.log(`  Created: ${post.create_date}`);
      console.log(`  Engagement: ${post.engagement || 0}`);
      console.log(`  Msg: ${(post.message || '').substring(0, 60)}...`);
    }
  } catch (e) {
    console.log('Errore social.post:', e.message);
  }

  // 6. Controlla social.account per capire i tipi di media
  console.log('\n\n📱 SOCIAL.ACCOUNT DETTAGLI:\n');
  console.log('='.repeat(60));

  try {
    const accounts = await callOdoo('social.account', 'search_read', [[]], {
      fields: ['id', 'name', 'media_type', 'social_account_handle',
               'stats_link', 'audience', 'is_media_disconnected'],
      limit: 10
    });

    for (const acc of accounts) {
      console.log(`\n[${acc.id}] ${acc.name} (${acc.media_type})`);
      console.log(`  Handle: ${acc.social_account_handle || 'N/A'}`);
      console.log(`  Audience: ${acc.audience || 0}`);
      console.log(`  Connected: ${!acc.is_media_disconnected}`);
    }
  } catch (e) {
    console.log('Errore:', e.message);
  }
}

main().catch(console.error);
