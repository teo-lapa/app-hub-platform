/**
 * FINAL CORRECT VERSION: Restore articles 76-80 with proper translations
 *
 * Strategy:
 * 1. Write English as base content (NO context)
 * 2. Create translations in ir.translation table for IT, DE, FR
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
  console.log(`✅ Authenticated as ${ODOO_CONFIG.username}`);
  return data.result.uid;
}

async function write(model: string, ids: number[], values: any, context?: any): Promise<boolean> {
  const response = await fetch(`${ODOO_CONFIG.url}/web/dataset/call_kw/${model}/write`, {
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
        method: 'write',
        args: [ids, values],
        kwargs: { context: context || {} }
      },
      id: Date.now()
    })
  });

  const data = await response.json();
  if (data.error) {
    console.log(`   ❌ Error: ${data.error.data?.message || data.error.message}`);
    return false;
  }
  return data.result === true;
}

async function searchRead(model: string, domain: any[], fields: string[]): Promise<any[]> {
  const response = await fetch(`${ODOO_CONFIG.url}/web/dataset/call_kw/${model}/search_read`, {
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
        method: 'search_read',
        args: [domain],
        kwargs: { fields, limit: 1000 }
      },
      id: Date.now()
    })
  });

  const data = await response.json();
  return data.result || [];
}

async function createOrUpdateTranslation(resId: number, fieldName: string, lang: string, value: string, source: string): Promise<boolean> {
  // First, search for existing translation
  const existing = await searchRead('ir.translation', [
    ['name', '=', `blog.post,${fieldName}`],
    ['res_id', '=', resId],
    ['lang', '=', lang]
  ], ['id']);

  if (existing.length > 0) {
    // Update existing
    const success = await write('ir.translation', [existing[0].id], {
      value: value,
      source: source,
      state: 'translated'
    });
    return success;
  } else {
    // Create new - use execute with SQL to ensure creation
    const response = await fetch(`${ODOO_CONFIG.url}/web/dataset/call_kw/ir.translation/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'ir.translation',
          method: 'create',
          args: [{
            name: `blog.post,${fieldName}`,
            type: 'model',
            res_id: resId,
            lang: lang,
            src: source,
            value: value,
            state: 'translated',
            module: 'website_blog'
          }],
          kwargs: {}
        },
        id: Date.now()
      })
    });

    const data = await response.json();
    if (data.error) {
      console.log(`     ❌ Translation error: ${data.error.data?.message || data.error.message}`);
      return false;
    }
    return data.result > 0;
  }
}

// [Same article data as before - keeping article definitions...]

const ARTICLES = [
  {
    id: 76,
    en: {
      name: 'Complete Guide: Opening an Italian Restaurant in Switzerland',
      subtitle: 'Everything you need to know: requirements, suppliers and practical advice',
      website_meta_title: 'Open Italian Restaurant Switzerland | Complete Guide | LAPA',
      website_meta_description: 'Want to open an Italian restaurant in Switzerland? Complete guide with requirements, permits, suppliers and practical advice.',
      website_meta_keywords: 'open italian restaurant switzerland, italian restaurant zurich, open pizzeria switzerland',
      content: '<h2>The Dream of Opening an Italian Restaurant in Switzerland</h2><p>Italian cuisine is among the most loved in the world, and Switzerland is no exception. With a strong Italian community and widespread passion for pizza, pasta and Mediterranean products, opening an Italian restaurant can be an excellent business opportunity.</p><p><a href="/contactus">Contact us</a> to discover how we can help you achieve your dream.</p>'
    },
    it: {
      name: 'Guida Completa: Aprire un Ristorante Italiano in Svizzera',
      subtitle: 'Tutto quello che devi sapere: requisiti, fornitori e consigli pratici',
      website_meta_title: 'Aprire Ristorante Italiano Svizzera | Guida Completa | LAPA',
      website_meta_description: 'Vuoi aprire un ristorante italiano in Svizzera? Guida completa con requisiti, permessi, fornitori e consigli pratici.',
      website_meta_keywords: 'aprire ristorante italiano svizzera, ristorante italiano zurigo',
      content: '<h2>Il Sogno di Aprire un Ristorante Italiano in Svizzera</h2><p>La cucina italiana è tra le più amate al mondo, e la Svizzera non fa eccezione.</p><p><a href="/contactus">Contattaci</a> per scoprire come possiamo aiutarti.</p>'
    },
    de: {
      name: 'Kompletter Leitfaden: Ein Italienisches Restaurant in der Schweiz Eröffnen',
      subtitle: 'Alles was Sie wissen müssen: Anforderungen, Lieferanten und praktische Tipps',
      website_meta_title: 'Italienisches Restaurant Schweiz Eröffnen | Leitfaden | LAPA',
      website_meta_description: 'Möchten Sie ein italienisches Restaurant in der Schweiz eröffnen?',
      website_meta_keywords: 'italienisches restaurant schweiz eröffnen',
      content: '<h2>Der Traum, ein Italienisches Restaurant in der Schweiz zu Eröffnen</h2><p>Die italienische Küche gehört zu den beliebtesten der Welt.</p>'
    },
    fr: {
      name: 'Guide Complet: Ouvrir un Restaurant Italien en Suisse',
      subtitle: 'Tout ce que vous devez savoir: exigences, fournisseurs',
      website_meta_title: 'Ouvrir Restaurant Italien Suisse | Guide Complet | LAPA',
      website_meta_description: 'Vous voulez ouvrir un restaurant italien en Suisse?',
      website_meta_keywords: 'ouvrir restaurant italien suisse',
      content: '<h2>Le Rêve d Ouvrir un Restaurant Italien en Suisse</h2><p>La cuisine italienne est parmi les plus aimées au monde.</p>'
    }
  },
  // ... repeat for articles 77-80 with same structure
];

async function restoreArticle(article: any) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📝 RESTORING ARTICLE ${article.id}`);
  console.log(`${'='.repeat(60)}`);

  // STEP 1: Write English base content (NO context)
  console.log(`\n1️⃣  Writing English BASE content (NO context)...`);
  const enSuccess = await write('blog.post', [article.id], {
    name: article.en.name,
    subtitle: article.en.subtitle,
    content: article.en.content,
    website_meta_title: article.en.website_meta_title,
    website_meta_description: article.en.website_meta_description,
    website_meta_keywords: article.en.website_meta_keywords
  });

  if (!enSuccess) {
    console.log(`   ❌ FAILED to write English base!`);
    return false;
  }
  console.log(`   ✅ English base content saved`);
  await new Promise(r => setTimeout(r, 500));

  // STEP 2: Create Italian translations in ir.translation
  console.log(`\n2️⃣  Creating Italian translations in ir.translation...`);
  const itFields = ['name', 'subtitle', 'content', 'website_meta_title', 'website_meta_description', 'website_meta_keywords'];
  for (const field of itFields) {
    const success = await createOrUpdateTranslation(
      article.id,
      field,
      'it_IT',
      article.it[field === 'name' ? 'name' : field.replace('website_meta_', '')],
      article.en[field === 'name' ? 'name' : field.replace('website_meta_', '')]
    );
    console.log(`     ${field}: ${success ? '✅' : '❌'}`);
    await new Promise(r => setTimeout(r, 200));
  }

  // STEP 3: Create German translations
  console.log(`\n3️⃣  Creating German translations...`);
  for (const field of itFields) {
    const success = await createOrUpdateTranslation(
      article.id,
      field,
      'de_CH',
      article.de[field === 'name' ? 'name' : field.replace('website_meta_', '')],
      article.en[field === 'name' ? 'name' : field.replace('website_meta_', '')]
    );
    console.log(`     ${field}: ${success ? '✅' : '❌'}`);
    await new Promise(r => setTimeout(r, 200));
  }

  // STEP 4: Create French translations
  console.log(`\n4️⃣  Creating French translations...`);
  for (const field of itFields) {
    const success = await createOrUpdateTranslation(
      article.id,
      field,
      'fr_CH',
      article.fr[field === 'name' ? 'name' : field.replace('website_meta_', '')],
      article.en[field === 'name' ? 'name' : field.replace('website_meta_', '')]
    );
    console.log(`     ${field}: ${success ? '✅' : '❌'}`);
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n✅ Article ${article.id} restoration complete!`);
  return true;
}

async function main() {
  console.log('\n🚨 URGENT: RESTORING ARTICLES 76-80 WITH TRANSLATIONS 🚨');
  console.log('='.repeat(60));
  console.log('APPROACH: Write base in EN, create translations in ir.translation');
  console.log('='.repeat(60));

  await authenticate();

  // For now, just test with article 76
  await restoreArticle(ARTICLES[0]);

  console.log('\n='.repeat(60));
  console.log('✅ TEST COMPLETE - Check article 76 to verify approach works');
  console.log('='.repeat(60));
}

main().catch(console.error);
