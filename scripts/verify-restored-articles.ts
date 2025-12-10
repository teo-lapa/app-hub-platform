/**
 * Verify that articles 81-85 were restored correctly
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

async function read(model: string, ids: number[], fields: string[], context: any = {}): Promise<any> {
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
        args: [ids, fields],
        kwargs: { context }
      },
      id: Date.now()
    })
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.data?.message || data.error.message);
  }
  return data.result;
}

async function verifyArticle(id: number, slug: string) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📝 Article ${id}: ${slug}`);
  console.log(`${'='.repeat(70)}`);

  // Check base content (no context)
  console.log('\n🔍 Checking BASE content (no context)...');
  const baseContent = await read('blog.post', [id], ['name', 'content'], {});
  console.log(`   Title: ${baseContent[0].name}`);
  console.log(`   Content length: ${baseContent[0].content?.length || 0} chars`);

  if (baseContent[0].content && baseContent[0].content.length > 100) {
    console.log('   ✅ BASE content exists');
  } else {
    console.log('   ❌ BASE content is missing or too short');
  }

  // Check German translation
  console.log('\n🔍 Checking German translation (de_CH)...');
  const germanContent = await read('blog.post', [id], ['name', 'content'], { lang: 'de_CH' });
  console.log(`   Title: ${germanContent[0].name}`);
  console.log(`   Content length: ${germanContent[0].content?.length || 0} chars`);

  if (germanContent[0].name?.includes('[DE]')) {
    console.log('   ✅ German translation exists');
  } else {
    console.log('   ⚠️  German translation may be missing');
  }

  // Check French translation
  console.log('\n🔍 Checking French translation (fr_CH)...');
  const frenchContent = await read('blog.post', [id], ['name', 'content'], { lang: 'fr_CH' });
  console.log(`   Title: ${frenchContent[0].name}`);
  console.log(`   Content length: ${frenchContent[0].content?.length || 0} chars`);

  if (frenchContent[0].name?.includes('[FR]')) {
    console.log('   ✅ French translation exists');
  } else {
    console.log('   ⚠️  French translation may be missing');
  }

  // Check English translation
  console.log('\n🔍 Checking English translation (en_US)...');
  const englishContent = await read('blog.post', [id], ['name', 'content'], { lang: 'en_US' });
  console.log(`   Title: ${englishContent[0].name}`);
  console.log(`   Content length: ${englishContent[0].content?.length || 0} chars`);

  if (englishContent[0].name?.includes('[EN]')) {
    console.log('   ✅ English translation exists');
  } else {
    console.log('   ⚠️  English translation may be missing');
  }
}

async function main() {
  console.log('🔍 VERIFYING RESTORED ARTICLES 81-85');
  console.log('='.repeat(70));

  await authenticate();

  const articles = [
    { id: 81, slug: 'conservare-prodotti-freschi' },
    { id: 82, slug: 'olio-extravergine-guida' },
    { id: 83, slug: 'pasta-fresca-vs-secca' },
    { id: 84, slug: 'formaggi-dop-ristorante' },
    { id: 85, slug: 'pomodori-pizza-san-marzano' }
  ];

  for (const article of articles) {
    await verifyArticle(article.id, article.slug);
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ VERIFICATION COMPLETE');
  console.log('='.repeat(70));
}

main();
