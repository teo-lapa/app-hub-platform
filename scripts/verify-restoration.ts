/**
 * Verify blog article restoration
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
  console.log(`✅ Connected as ${ODOO_CONFIG.username}`);
  return data.result.uid;
}

async function readWithLang(model: string, ids: number[], fields: string[], lang: string): Promise<any> {
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
        kwargs: {
          context: { lang }
        }
      },
      id: Date.now()
    })
  });

  const data = await response.json();
  if (data.error) {
    console.log(`❌ Error: ${data.error.data?.message || data.error.message}`);
    return null;
  }
  return data.result;
}

async function main() {
  console.log('🔍 VERIFICATION OF RESTORED ARTICLES');
  console.log('='.repeat(80));

  await authenticate();

  const articleIds = [86, 87, 88, 89];
  const fields = ['id', 'name', 'subtitle', 'website_meta_title', 'website_meta_description'];
  const languages = [
    { code: 'it_IT', name: 'Italian' },
    { code: 'de_DE', name: 'German' },
    { code: 'fr_FR', name: 'French' },
    { code: 'en_US', name: 'English' }
  ];

  for (const articleId of articleIds) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📄 ARTICLE ${articleId}`);
    console.log('='.repeat(80));

    for (const lang of languages) {
      const result = await readWithLang('blog.post', [articleId], fields, lang.code);

      if (result && result.length > 0) {
        const article = result[0];
        console.log(`\n✅ ${lang.name} (${lang.code}):`);
        console.log(`   Title: ${article.name.substring(0, 60)}...`);
        console.log(`   Subtitle: ${article.subtitle ? article.subtitle.substring(0, 50) : 'N/A'}...`);
        console.log(`   Meta Title: ${article.website_meta_title || 'N/A'}`);
        console.log(`   Meta Desc: ${article.website_meta_description ? article.website_meta_description.substring(0, 50) : 'N/A'}...`);
      } else {
        console.log(`\n❌ ${lang.name} (${lang.code}): Failed to read`);
      }

      await new Promise(r => setTimeout(r, 200));
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ VERIFICATION COMPLETE');
  console.log('='.repeat(80));
}

main().catch(err => {
  console.error('❌ FATAL ERROR:', err);
  process.exit(1);
});
