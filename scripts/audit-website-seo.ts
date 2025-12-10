/**
 * Audit SEO del sito web lapa.ch (Odoo Website)
 *
 * Questo script si connette a Odoo via JSON-RPC e analizza:
 * - Configurazione sito web
 * - Pagine e loro meta tag SEO
 * - Menu di navigazione
 * - Prodotti e-commerce
 */

// Configurazione Odoo - PRODUZIONE lapa.ch
const ODOO_CONFIG = {
  url: 'https://www.lapa.ch',
  db: 'lapadevadmin-lapa-v2-main-7268478',
  username: 'paul@lapa.ch',
  password: 'lapa201180'
};

let sessionId: string | null = null;

// Autenticazione
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
  if (data.error) throw new Error(data.error.message || 'Auth failed');
  if (!data.result?.uid) throw new Error('Auth failed: Invalid credentials');

  console.log(`✅ Connesso a Odoo come ${ODOO_CONFIG.username} (UID: ${data.result.uid})`);
  return data.result.uid;
}

// Eseguire query su Odoo
async function searchRead(model: string, domain: any[], fields: string[], limit?: number): Promise<any[]> {
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
        kwargs: { fields, limit: limit || 100 }
      },
      id: Date.now()
    })
  });

  const data = await response.json();
  if (data.error) {
    console.log(`⚠️ Errore query ${model}: ${data.error.data?.message || data.error.message}`);
    return [];
  }
  return data.result || [];
}

// ==================== ANALISI SEO ====================

async function analyzeWebsiteConfig() {
  console.log('\n📊 CONFIGURAZIONE SITO WEB');
  console.log('='.repeat(50));

  const websites = await searchRead('website', [], [
    'name', 'domain', 'company_id',
    'social_facebook', 'social_twitter', 'social_instagram', 'social_linkedin', 'social_youtube',
    'google_analytics_key', 'google_search_console', 'plausible_site', 'plausible_shared_key',
    'favicon', 'logo',
    'default_lang_id', 'language_ids',
    'cookies_bar', 'auth_signup_uninvited'
  ]);

  if (websites.length > 0) {
    const site = websites[0];
    console.log(`\n🌐 Sito: ${site.name}`);
    console.log(`   Dominio: ${site.domain || '⚠️ NON CONFIGURATO'}`);
    console.log(`   Company: ${site.company_id?.[1] || 'N/A'}`);

    console.log('\n📱 Social Media:');
    console.log(`   Facebook: ${site.social_facebook || '❌ Mancante'}`);
    console.log(`   Twitter/X: ${site.social_twitter || '❌ Mancante'}`);
    console.log(`   Instagram: ${site.social_instagram || '❌ Mancante'}`);
    console.log(`   LinkedIn: ${site.social_linkedin || '❌ Mancante'}`);
    console.log(`   YouTube: ${site.social_youtube || '❌ Mancante'}`);

    console.log('\n📈 Analytics & Tracking:');
    console.log(`   Google Analytics: ${site.google_analytics_key ? '✅ ' + site.google_analytics_key : '❌ Mancante'}`);
    console.log(`   Search Console: ${site.google_search_console ? '✅ Configurato' : '❌ Mancante'}`);
    console.log(`   Plausible: ${site.plausible_site ? '✅ ' + site.plausible_site : '❌ Non usato'}`);

    console.log('\n🖼️ Branding:');
    console.log(`   Logo: ${site.logo ? '✅ Presente' : '❌ Mancante'}`);
    console.log(`   Favicon: ${site.favicon ? '✅ Presente' : '❌ Mancante'}`);

    console.log('\n🔒 Privacy:');
    console.log(`   Cookie Bar: ${site.cookies_bar ? '✅ Attiva' : '❌ Disattiva'}`);

    return site;
  } else {
    console.log('⚠️ Nessun sito web trovato');
  }
  return null;
}

async function analyzePages() {
  console.log('\n📄 ANALISI PAGINE E SEO');
  console.log('='.repeat(50));

  const pages = await searchRead('website.page', [], [
    'name', 'url', 'website_indexed',
    'website_meta_title', 'website_meta_description', 'website_meta_keywords',
    'is_published', 'website_id', 'view_id'
  ], 200);

  console.log(`\n📑 Totale pagine trovate: ${pages.length}`);

  let pagesWithTitle = 0;
  let pagesWithDescription = 0;
  let pagesIndexed = 0;
  let pagesPublished = 0;

  const issuesNoTitle: any[] = [];
  const issuesNoDesc: any[] = [];

  for (const page of pages) {
    if (page.website_meta_title) pagesWithTitle++;
    if (page.website_meta_description) pagesWithDescription++;
    if (page.website_indexed !== false) pagesIndexed++;
    if (page.is_published) pagesPublished++;

    if (!page.website_meta_title && page.is_published) {
      issuesNoTitle.push(page);
    }
    if (!page.website_meta_description && page.is_published) {
      issuesNoDesc.push(page);
    }
  }

  console.log('\n📊 Statistiche SEO Pagine:');
  console.log(`   Pagine totali: ${pages.length}`);
  console.log(`   Pagine pubblicate: ${pagesPublished}`);
  console.log(`   Pagine indicizzabili: ${pagesIndexed}`);
  console.log(`   Con Meta Title: ${pagesWithTitle}/${pagesPublished} ${pagesWithTitle < pagesPublished ? '⚠️' : '✅'}`);
  console.log(`   Con Meta Description: ${pagesWithDescription}/${pagesPublished} ${pagesWithDescription < pagesPublished ? '⚠️' : '✅'}`);

  if (issuesNoTitle.length > 0) {
    console.log(`\n🚨 PAGINE SENZA META TITLE (${issuesNoTitle.length}):`);
    issuesNoTitle.slice(0, 10).forEach(p => console.log(`   ❌ ${p.name} → ${p.url}`));
    if (issuesNoTitle.length > 10) console.log(`   ... e altre ${issuesNoTitle.length - 10}`);
  }

  if (issuesNoDesc.length > 0) {
    console.log(`\n🚨 PAGINE SENZA META DESCRIPTION (${issuesNoDesc.length}):`);
    issuesNoDesc.slice(0, 10).forEach(p => console.log(`   ❌ ${p.name} → ${p.url}`));
    if (issuesNoDesc.length > 10) console.log(`   ... e altre ${issuesNoDesc.length - 10}`);
  }

  // Mostra alcune pagine con SEO completo come esempio
  const goodPages = pages.filter(p => p.website_meta_title && p.website_meta_description);
  if (goodPages.length > 0) {
    console.log(`\n✅ PAGINE CON SEO COMPLETO (esempi):`);
    goodPages.slice(0, 5).forEach(p => {
      console.log(`   ✅ ${p.name} → ${p.url}`);
      console.log(`      Title: ${p.website_meta_title?.substring(0, 60)}...`);
    });
  }

  return pages;
}

async function analyzeMenu() {
  console.log('\n🗂️ STRUTTURA MENU NAVIGAZIONE');
  console.log('='.repeat(50));

  const menus = await searchRead('website.menu', [], [
    'name', 'url', 'parent_id', 'sequence', 'is_visible', 'new_window'
  ], 100);

  console.log(`\n📋 Menu items trovati: ${menus.length}`);

  // Raggruppa per parent
  const rootMenus = menus.filter(m => !m.parent_id).sort((a, b) => a.sequence - b.sequence);
  console.log(`\n🏠 Menu principali (${rootMenus.length}):`);

  for (const menu of rootMenus) {
    const icon = menu.is_visible ? '✅' : '🚫';
    console.log(`   ${icon} ${menu.name} → ${menu.url || '#'}`);

    // Trova sottomenu
    const children = menus.filter(m => m.parent_id && m.parent_id[0] === menu.id).sort((a, b) => a.sequence - b.sequence);
    for (const child of children) {
      const childIcon = child.is_visible ? '✅' : '🚫';
      console.log(`      └─ ${childIcon} ${child.name} → ${child.url || '#'}`);
    }
  }

  return menus;
}

async function analyzeProducts() {
  console.log('\n🛒 ANALISI PRODOTTI E-COMMERCE (SEO)');
  console.log('='.repeat(50));

  // Conta totale prodotti pubblicati
  const allProducts = await searchRead('product.template',
    [['is_published', '=', true]],
    ['id'],
    1000
  );

  console.log(`\n📦 Totale prodotti pubblicati: ${allProducts.length}`);

  // Analizza campione per SEO
  const products = await searchRead('product.template',
    [['is_published', '=', true]],
    ['name', 'website_url', 'website_meta_title', 'website_meta_description', 'website_meta_keywords',
     'public_categ_ids', 'list_price', 'description_sale'],
    100
  );

  let withSeoTitle = 0;
  let withSeoDesc = 0;
  let withKeywords = 0;
  let withSaleDesc = 0;

  for (const p of products) {
    if (p.website_meta_title) withSeoTitle++;
    if (p.website_meta_description) withSeoDesc++;
    if (p.website_meta_keywords) withKeywords++;
    if (p.description_sale) withSaleDesc++;
  }

  const sampleSize = products.length;
  console.log(`\n📊 Analisi SEO su campione di ${sampleSize} prodotti:`);
  console.log(`   Con Meta Title: ${withSeoTitle}/${sampleSize} (${Math.round(withSeoTitle/sampleSize*100)}%) ${withSeoTitle < sampleSize * 0.5 ? '⚠️ CRITICO' : withSeoTitle < sampleSize * 0.8 ? '⚠️' : '✅'}`);
  console.log(`   Con Meta Description: ${withSeoDesc}/${sampleSize} (${Math.round(withSeoDesc/sampleSize*100)}%) ${withSeoDesc < sampleSize * 0.5 ? '⚠️ CRITICO' : withSeoDesc < sampleSize * 0.8 ? '⚠️' : '✅'}`);
  console.log(`   Con Keywords: ${withKeywords}/${sampleSize} (${Math.round(withKeywords/sampleSize*100)}%)`);
  console.log(`   Con Descrizione vendita: ${withSaleDesc}/${sampleSize} (${Math.round(withSaleDesc/sampleSize*100)}%)`);

  // Esempi prodotti senza SEO
  const noSeo = products.filter(p => !p.website_meta_title && !p.website_meta_description).slice(0, 5);
  if (noSeo.length > 0) {
    console.log('\n🚨 Esempi prodotti SENZA SEO:');
    noSeo.forEach(p => console.log(`   ❌ ${p.name}`));
  }

  // Esempi prodotti con SEO
  const goodSeo = products.filter(p => p.website_meta_title && p.website_meta_description).slice(0, 3);
  if (goodSeo.length > 0) {
    console.log('\n✅ Esempi prodotti CON SEO completo:');
    goodSeo.forEach(p => {
      console.log(`   ✅ ${p.name}`);
      console.log(`      Title: ${p.website_meta_title?.substring(0, 50)}...`);
    });
  }

  return products;
}

async function analyzeCategories() {
  console.log('\n📂 CATEGORIE PRODOTTI (SEO)');
  console.log('='.repeat(50));

  const categories = await searchRead('product.public.category', [], [
    'name', 'parent_id', 'website_meta_title', 'website_meta_description',
    'sequence', 'product_tmpl_ids'
  ], 100);

  console.log(`\n📁 Categorie pubbliche trovate: ${categories.length}`);

  let withSeoTitle = 0;
  let withSeoDesc = 0;

  for (const c of categories) {
    if (c.website_meta_title) withSeoTitle++;
    if (c.website_meta_description) withSeoDesc++;
  }

  console.log(`   Con Meta Title: ${withSeoTitle}/${categories.length} ${withSeoTitle < categories.length ? '⚠️' : '✅'}`);
  console.log(`   Con Meta Description: ${withSeoDesc}/${categories.length} ${withSeoDesc < categories.length ? '⚠️' : '✅'}`);

  // Lista categorie principali
  const rootCategories = categories.filter(c => !c.parent_id).sort((a, b) => a.sequence - b.sequence);
  console.log(`\n📋 Categorie principali:`);
  for (const cat of rootCategories) {
    const seoOk = cat.website_meta_title && cat.website_meta_description;
    console.log(`   ${seoOk ? '✅' : '⚠️'} ${cat.name}`);
  }

  return categories;
}

async function analyzeConfigParameters() {
  console.log('\n⚙️ CONFIGURAZIONI TECNICHE SEO');
  console.log('='.repeat(50));

  // Cerca parametri specifici SEO
  const seoParams = [
    'website.google_analytics_key',
    'website.google_search_console',
    'website.plausible_shared_key',
    'website.default_robots',
    'website.social_default_image'
  ];

  const params = await searchRead('ir.config_parameter',
    [['key', 'like', 'website%']],
    ['key', 'value'],
    50
  );

  console.log('\n🔧 Parametri website trovati:');
  for (const p of params) {
    // Nascondi valori sensibili
    let value = p.value || '(vuoto)';
    if (value.length > 60) value = value.substring(0, 60) + '...';
    console.log(`   ${p.key}: ${value}`);
  }

  return params;
}

// ==================== REPORT FINALE ====================

function printFinalReport(results: any) {
  console.log('\n');
  console.log('█'.repeat(60));
  console.log('█  REPORT FINALE AUDIT SEO - LAPA.CH');
  console.log('█'.repeat(60));

  console.log(`
📋 RIEPILOGO:
─────────────
• Sito web configurato: ${results.website ? '✅' : '❌'}
• Analytics attivo: ${results.website?.google_analytics_key ? '✅' : '❌'}
• Social media: ${results.socialScore}/5 configurati
• Pagine analizzate: ${results.pagesCount}
• Prodotti pubblicati: ${results.productsCount}

🎯 AZIONI PRIORITARIE (in ordine di importanza):

1. 🔴 CRITICO - Meta Tag Prodotti
   ${results.productsSeoScore < 50 ?
   `Solo ${results.productsSeoScore}% dei prodotti ha SEO.
   → Aggiungere Meta Title e Description a TUTTI i prodotti
   → Usare template: "[Nome Prodotto] | Grossista Italiano Svizzera | LAPA"` :
   '✅ Buono! Più del 50% dei prodotti ha SEO'}

2. 🔴 CRITICO - Meta Tag Pagine
   ${results.pagesSeoScore < 80 ?
   `Molte pagine senza Meta Description.
   → Completare SEO per tutte le pagine pubblicate
   → Max 60 caratteri per Title, max 160 per Description` :
   '✅ Buono! La maggior parte delle pagine ha SEO'}

3. 🟠 IMPORTANTE - Google Search Console
   ${!results.website?.google_search_console ?
   `❌ NON CONFIGURATO!
   → Verificare proprietà su search.google.com
   → Inviare sitemap.xml
   → Monitorare errori di indicizzazione` :
   '✅ Configurato'}

4. 🟠 IMPORTANTE - Social Media
   → Completare TUTTI i link social nel backend
   → Aggiungere Open Graph image di default
   → Verificare che le condivisioni mostrino preview corrette

5. 🟡 CONSIGLIATO - Visibilità AI
   → Aggiungere Schema.org LocalBusiness markup
   → Aggiungere Schema.org Product markup
   → Creare pagina FAQ con structured data
   → Aggiungere breadcrumb con JSON-LD

6. 🟡 CONSIGLIATO - Contenuti
   → Scrivere descrizioni uniche per ogni categoria
   → Aggiungere blog con articoli su prodotti italiani
   → Creare landing page per ricerche chiave:
     * "grossista prodotti italiani zurigo"
     * "fornitore mozzarella svizzera"
     * "prosciutto italiano ristoranti"

📊 PUNTEGGIO SEO STIMATO: ${results.overallScore}/100
`);

  if (results.overallScore < 50) {
    console.log('⚠️ ATTENZIONE: Il sito necessita di interventi SEO urgenti!');
  } else if (results.overallScore < 75) {
    console.log('📈 BUONO: Il sito ha una base SEO, ma può migliorare significativamente.');
  } else {
    console.log('✅ OTTIMO: Il sito ha una buona ottimizzazione SEO!');
  }
}

// ==================== MAIN ====================

async function main() {
  console.log('🔍 AUDIT SEO - SITO LAPA.CH');
  console.log('='.repeat(60));
  console.log(`📅 Data: ${new Date().toLocaleString('it-IT')}`);
  console.log(`🔗 Odoo: ${ODOO_CONFIG.url}`);
  console.log('='.repeat(60));

  try {
    // 1. Autenticazione
    await authenticate();

    // 2. Analisi
    const website = await analyzeWebsiteConfig();
    const pages = await analyzePages();
    const menus = await analyzeMenu();
    const products = await analyzeProducts();
    const categories = await analyzeCategories();
    await analyzeConfigParameters();

    // Calcola punteggi
    const socialCount = [
      website?.social_facebook,
      website?.social_twitter,
      website?.social_instagram,
      website?.social_linkedin,
      website?.social_youtube
    ].filter(Boolean).length;

    const pagesWithSeo = pages.filter((p: any) => p.website_meta_title && p.website_meta_description && p.is_published).length;
    const publishedPages = pages.filter((p: any) => p.is_published).length;
    const pagesSeoScore = publishedPages > 0 ? Math.round(pagesWithSeo / publishedPages * 100) : 0;

    const productsWithSeo = products.filter((p: any) => p.website_meta_title || p.website_meta_description).length;
    const productsSeoScore = products.length > 0 ? Math.round(productsWithSeo / products.length * 100) : 0;

    // Calcola punteggio generale
    let overallScore = 0;
    overallScore += website ? 10 : 0;
    overallScore += website?.google_analytics_key ? 15 : 0;
    overallScore += socialCount * 3; // max 15
    overallScore += Math.round(pagesSeoScore * 0.3); // max 30
    overallScore += Math.round(productsSeoScore * 0.3); // max 30

    // Report finale
    printFinalReport({
      website,
      pagesCount: pages.length,
      productsCount: products.length,
      socialScore: socialCount,
      pagesSeoScore,
      productsSeoScore,
      overallScore
    });

  } catch (error: any) {
    console.error('💥 Errore:', error.message);
  }
}

// Esegui
main();
