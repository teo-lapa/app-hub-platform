/**
 * Script per aggiungere Schema.org (JSON-LD) ai prodotti in Odoo
 * Questo migliora i rich snippets su Google (prezzi, disponibilità, recensioni)
 */

const ODOO_CONFIG = {
  url: 'https://www.lapa.ch',
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
  console.log(`✅ Connesso come ${ODOO_CONFIG.username}`);
  return data.result.uid;
}

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
        kwargs: { fields, limit: limit || 1000 }
      },
      id: Date.now()
    })
  });

  const data = await response.json();
  return data.result || [];
}

async function fieldsGet(model: string): Promise<any> {
  const response = await fetch(`${ODOO_CONFIG.url}/web/dataset/call_kw/${model}/fields_get`, {
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
        method: 'fields_get',
        args: [],
        kwargs: { attributes: ['string', 'type', 'help'] }
      },
      id: Date.now()
    })
  });

  const data = await response.json();
  return data.result || {};
}

async function write(model: string, ids: number[], values: any): Promise<boolean> {
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
        kwargs: {}
      },
      id: Date.now()
    })
  });

  const data = await response.json();
  if (data.error) {
    console.log(`❌ Errore: ${data.error.data?.message || data.error.message}`);
    return false;
  }
  return data.result === true;
}

// Genera Schema.org JSON-LD per un prodotto
function generateProductSchema(product: any): string {
  const schema: any = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.name,
    "description": product.description_sale || product.website_meta_description || `${product.name} - Prodotto italiano di qualità LAPA`,
    "brand": {
      "@type": "Brand",
      "name": "LAPA"
    },
    "manufacturer": {
      "@type": "Organization",
      "name": "LAPA SA",
      "url": "https://www.lapa.ch"
    },
    "offers": {
      "@type": "Offer",
      "url": `https://www.lapa.ch${product.website_url || '/shop'}`,
      "priceCurrency": "CHF",
      "price": product.list_price || 0,
      "availability": product.qty_available > 0
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      "seller": {
        "@type": "Organization",
        "name": "LAPA SA"
      }
    }
  };

  // Aggiungi immagine se presente
  if (product.image_1920 || product.image_url) {
    schema.image = product.image_url || `https://www.lapa.ch/web/image/product.template/${product.id}/image_1920`;
  }

  // Aggiungi SKU se presente
  if (product.default_code) {
    schema.sku = product.default_code;
  }

  // Aggiungi categoria
  if (product.categ_id) {
    schema.category = product.categ_id[1];
  }

  return JSON.stringify(schema, null, 2);
}

async function main() {
  console.log('🔧 SCHEMA.ORG PER PRODOTTI LAPA');
  console.log('='.repeat(60));

  await authenticate();

  // 1. Verifica quali campi sono disponibili per website_description
  console.log('\n🔍 Verifico campi disponibili per Schema.org...');

  const productFields = await fieldsGet('product.template');

  // Cerca campi utili per Schema.org
  const schemaFields = Object.keys(productFields).filter(f =>
    f.includes('website') || f.includes('description') || f.includes('seo') || f.includes('json')
  );

  console.log('\n📋 Campi website/SEO disponibili:');
  for (const field of schemaFields) {
    console.log(`   - ${field}: ${productFields[field].string} (${productFields[field].type})`);
  }

  // 2. Verifica se esiste website.page per i prodotti
  console.log('\n🔍 Verifico struttura website.page...');

  const pageFields = await fieldsGet('website.page');
  const pageSchemaFields = Object.keys(pageFields).filter(f =>
    f.includes('json') || f.includes('script') || f.includes('head') || f.includes('meta')
  );

  console.log('\n📋 Campi website.page per script/head:');
  for (const field of pageSchemaFields) {
    console.log(`   - ${field}: ${pageFields[field].string} (${pageFields[field].type})`);
  }

  // 3. Verifica ir.ui.view per template prodotto
  console.log('\n🔍 Cerco template prodotto per Schema.org...');

  const views = await searchRead('ir.ui.view',
    [['name', 'ilike', 'product']],
    ['id', 'name', 'key', 'type'],
    20
  );

  console.log('\n📋 Template prodotto trovati:');
  for (const view of views.slice(0, 10)) {
    console.log(`   - ${view.name} (${view.key || 'no key'})`);
  }

  // 4. Provo ad aggiungere Schema.org tramite website_description
  console.log('\n🔍 Verifico se website_description supporta HTML/Script...');

  // Leggi un prodotto di esempio
  const products = await searchRead('product.template',
    [['website_published', '=', true]],
    ['id', 'name', 'website_url', 'website_description', 'list_price', 'default_code',
     'description_sale', 'categ_id', 'qty_available'],
    3
  );

  if (products.length > 0) {
    console.log('\n📦 Esempio prodotto:');
    const p = products[0];
    console.log(`   Nome: ${p.name}`);
    console.log(`   URL: ${p.website_url}`);
    console.log(`   Prezzo: CHF ${p.list_price}`);
    console.log(`   Descrizione web: ${(p.website_description || '').substring(0, 100)}...`);

    console.log('\n📝 Schema.org generato:');
    console.log(generateProductSchema(p));
  }

  // 5. Verifica come Odoo gestisce i rich snippets
  console.log('\n' + '='.repeat(60));
  console.log('📊 ANALISI COMPLETATA');
  console.log('='.repeat(60));

  console.log(`
In Odoo, Schema.org per i prodotti può essere implementato in 3 modi:

1. **MODULO ODOO SEO** (Consigliato)
   Installa il modulo "website_sale_product_detail_page" o simili
   che aggiungono automaticamente JSON-LD ai prodotti.

2. **TEMPLATE QWEB PERSONALIZZATO**
   Modifica il template "website_sale.product" per includere
   <script type="application/ld+json"> nel <head>.

3. **CAMPO website_description**
   Aggiungi lo script JSON-LD nella descrizione prodotto.
   (Non raccomandato - mescola contenuto e markup)

💡 SOLUZIONE MIGLIORE per Odoo:
   Vai in Odoo > Impostazioni > Sito Web > SEO
   Cerca "Structured Data" o "Rich Snippets"
   Odoo 16+ ha supporto nativo per Schema.org
`);

  // 6. Verifica se esiste già configurazione Schema.org
  console.log('\n🔍 Verifico configurazione Schema.org esistente in Odoo...');

  const websiteConfig = await searchRead('website', [],
    ['id', 'name', 'social_facebook', 'social_instagram', 'company_id']
  );

  if (websiteConfig.length > 0) {
    const companyId = websiteConfig[0].company_id?.[0];
    if (companyId) {
      const company = await searchRead('res.company',
        [['id', '=', companyId]],
        ['name', 'street', 'city', 'zip', 'phone', 'email', 'website', 'vat']
      );

      if (company.length > 0) {
        const c = company[0];
        console.log('\n🏢 Dati Azienda (per LocalBusiness Schema):');
        console.log(`   Nome: ${c.name}`);
        console.log(`   Indirizzo: ${c.street}, ${c.zip} ${c.city}`);
        console.log(`   Telefono: ${c.phone}`);
        console.log(`   Email: ${c.email}`);
        console.log(`   Sito: ${c.website}`);
        console.log(`   P.IVA: ${c.vat}`);

        // Genera LocalBusiness Schema
        const localBusinessSchema = {
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          "name": c.name,
          "address": {
            "@type": "PostalAddress",
            "streetAddress": c.street,
            "postalCode": c.zip,
            "addressLocality": c.city,
            "addressCountry": "CH"
          },
          "telephone": c.phone,
          "email": c.email,
          "url": c.website || "https://www.lapa.ch"
        };

        console.log('\n📝 LocalBusiness Schema.org:');
        console.log(JSON.stringify(localBusinessSchema, null, 2));
      }
    }
  }
}

main();
