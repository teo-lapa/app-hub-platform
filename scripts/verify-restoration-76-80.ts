/**
 * Verify that articles 76-80 were restored correctly
 */

const ODOO_CONFIG = {
  url: 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com',
  db: 'lapadevadmin-lapa-v2-main-7268478',
  username: 'paul@lapa.ch',
  password: 'lapa201180'
};

let sessionId: string | null = null;

async function authenticate(): Promise<number> {
  const response = await fetch(`${ODOO_CONFIG.url}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        db: ODOO_CONFIG.db,
        login: ODOO_CONFIG.username,
        password: ODOO_CONFIG.password
      },
      id: Date.now()
    })
  });

  const cookies = response.headers.get('set-cookie');
  if (cookies) {
    const match = cookies.match(/session_id=([^;]+)/);
    if (match) sessionId = match[1];
  }

  const data = await response.json();
  if (!data.result?.uid) throw new Error('Auth failed');
  return data.result.uid;
}

async function read(model: string, ids: number[], fields: string[], context?: any): Promise<any[]> {
  const response = await fetch(`${ODOO_CONFIG.url}/web/dataset/call_kw/${model}/read`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_id=${sessionId}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model,
        method: 'read',
        args: [ids],
        kwargs: { fields, context: context || {} }
      },
      id: Date.now()
    })
  });

  const data = await response.json();
  if (data.error) {
    console.log(`   ❌ Error: ${data.error.data?.message || data.error.message}`);
    return [];
  }
  return data.result || [];
}

async function verifyArticle(id: number, expectedTitle: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📄 Verifying Article ${id}: ${expectedTitle}`);
  console.log(`${'='.repeat(60)}`);

  // Check Italian (base)
  console.log(`\n🇮🇹 Italian (base - no context):`);
  const itData = await read('blog.post', [id], ['name', 'content']);
  if (itData.length > 0) {
    console.log(`   Title: ${itData[0].name}`);
    console.log(`   Content length: ${itData[0].content?.length || 0} chars`);
    console.log(`   ✅ Has content: ${itData[0].content ? 'YES' : 'NO'}`);
  } else {
    console.log(`   ❌ Could not read Italian content`);
  }

  // Check German
  console.log(`\n🇩🇪 German (translation - context: de_CH):`);
  const deData = await read('blog.post', [id], ['name', 'content'], { lang: 'de_CH' });
  if (deData.length > 0) {
    console.log(`   Title: ${deData[0].name}`);
    console.log(`   Content length: ${deData[0].content?.length || 0} chars`);
    console.log(`   ✅ Has content: ${deData[0].content ? 'YES' : 'NO'}`);
  } else {
    console.log(`   ❌ Could not read German content`);
  }

  // Check French
  console.log(`\n🇫🇷 French (translation - context: fr_CH):`);
  const frData = await read('blog.post', [id], ['name', 'content'], { lang: 'fr_CH' });
  if (frData.length > 0) {
    console.log(`   Title: ${frData[0].name}`);
    console.log(`   Content length: ${frData[0].content?.length || 0} chars`);
    console.log(`   ✅ Has content: ${frData[0].content ? 'YES' : 'NO'}`);
  } else {
    console.log(`   ❌ Could not read French content`);
  }

  // Check English
  console.log(`\n🇺🇸 English (translation - context: en_US):`);
  const enData = await read('blog.post', [id], ['name', 'content'], { lang: 'en_US' });
  if (enData.length > 0) {
    console.log(`   Title: ${enData[0].name}`);
    console.log(`   Content length: ${enData[0].content?.length || 0} chars`);
    console.log(`   ✅ Has content: ${enData[0].content ? 'YES' : 'NO'}`);
  } else {
    console.log(`   ❌ Could not read English content`);
  }

  return true;
}

async function main() {
  console.log('🔍 VERIFYING RESTORATION OF ARTICLES 76-80');
  console.log('='.repeat(60));

  await authenticate();
  console.log('✅ Authenticated\n');

  const articles = [
    { id: 76, title: 'Aprire un Ristorante Italiano' },
    { id: 77, title: 'Mozzarella di Bufala vs Fior di Latte' },
    { id: 78, title: '10 Prodotti Essenziali Pizzeria' },
    { id: 79, title: 'Grossista Prodotti Italiani' },
    { id: 80, title: 'Guanciale vs Pancetta' }
  ];

  for (const article of articles) {
    await verifyArticle(article.id, article.title);
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('✅ VERIFICATION COMPLETE');
  console.log('='.repeat(60));
}

main().catch(console.error);
