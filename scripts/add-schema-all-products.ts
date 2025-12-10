/**
 * Aggiunge Schema.org JSON-LD a TUTTI i prodotti pubblicati
 * Processamento a batch per evitare timeout
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
  console.log(`✅ Connesso come ${ODOO_CONFIG.username}`);
  return data.result.uid;
}

async function searchRead(model: string, domain: any[], fields: string[], limit?: number, offset?: number): Promise<any[]> {
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
        kwargs: { fields, limit: limit || 100, offset: offset || 0 }
      },
      id: Date.now()
    })
  });

  const data = await response.json();
  return data.result || [];
}

async function searchCount(model: string, domain: any[]): Promise<number> {
  const response = await fetch(`${ODOO_CONFIG.url}/web/dataset/call_kw/${model}/search_count`, {
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
        method: 'search_count',
        args: [domain],
        kwargs: {}
      },
      id: Date.now()
    })
  });

  const data = await response.json();
  return data.result || 0;
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
    return false;
  }
  return data.result === true;
}

// Genera Schema.org JSON-LD per un prodotto
function generateSchemaScript(product: any): string {
  const schemaOrg = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.name,
    "description": product.description_sale || `${product.name} - Prodotto italiano di qualità LAPA`,
    "sku": product.default_code || `LAPA-${product.id}`,
    "brand": {
      "@type": "Brand",
      "name": "LAPA"
    },
    "image": `https://www.lapa.ch/web/image/product.template/${product.id}/image_1920`,
    "offers": {
      "@type": "Offer",
      "url": `https://www.lapa.ch${product.website_url || '/shop'}`,
      "priceCurrency": "CHF",
      "price": product.list_price || 0,
      "availability": "https://schema.org/InStock",
      "seller": {
        "@type": "Organization",
        "name": "LAPA SA",
        "url": "https://www.lapa.ch"
      }
    }
  };

  // Aggiungi categoria se presente
  if (product.categ_id) {
    (schemaOrg as any).category = product.categ_id[1];
  }

  return `<!-- Schema.org per SEO -->
<script data-cfasync="false" src="/cdn-cgi/scripts/5c5dd728/cloudflare-static/email-decode.min.js"></script><script type="application/ld+json">
${JSON.stringify(schemaOrg)}
</script>`;
}

async function main() {
  console.log('🚀 SCHEMA.ORG PER TUTTI I PRODOTTI');
  console.log('='.repeat(60));

  await authenticate();

  // Conta prodotti da processare (escludi quello già fatto nel test)
  const domain = [
    ['website_published', '=', true],
    ['id', '!=', 12977] // Escludi il prodotto test già fatto
  ];

  const totalCount = await searchCount('product.template', domain);
  console.log(`\n📊 Prodotti da aggiornare: ${totalCount}`);

  const BATCH_SIZE = 100;
  let processed = 0;
  let updated = 0;
  let errors = 0;
  let skipped = 0;

  const startTime = Date.now();

  for (let offset = 0; offset < totalCount; offset += BATCH_SIZE) {
    // Leggi batch di prodotti
    const products = await searchRead('product.template', domain,
      ['id', 'name', 'website_url', 'description_ecommerce', 'description_sale',
       'list_price', 'default_code', 'categ_id'],
      BATCH_SIZE, offset
    );

    for (const product of products) {
      processed++;

      // Salta se già ha Schema.org
      if (product.description_ecommerce && product.description_ecommerce.includes('application/ld+json')) {
        skipped++;
        continue;
      }

      // Genera Schema.org
      const schemaScript = generateSchemaScript(product);

      // Aggiungi alla descrizione esistente
      const currentDesc = product.description_ecommerce || '';
      const newDesc = currentDesc + '\n\n' + schemaScript;

      // Aggiorna prodotto
      const success = await write('product.template', [product.id], {
        description_ecommerce: newDesc
      });

      if (success) {
        updated++;
      } else {
        errors++;
      }

      // Progress ogni 100 prodotti
      if (processed % 100 === 0) {
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = processed / elapsed;
        const remaining = (totalCount - processed) / rate;
        console.log(`📈 ${processed}/${totalCount} (${updated} aggiornati, ${skipped} già OK, ${errors} errori) - ${Math.round(remaining)}s rimanenti`);
      }
    }
  }

  const totalTime = Math.round((Date.now() - startTime) / 1000);

  console.log('\n' + '='.repeat(60));
  console.log('✅ COMPLETATO!');
  console.log('='.repeat(60));
  console.log(`📊 Totale processati: ${processed}`);
  console.log(`✅ Aggiornati: ${updated}`);
  console.log(`⏭️  Già con Schema.org: ${skipped}`);
  console.log(`❌ Errori: ${errors}`);
  console.log(`⏱️  Tempo totale: ${totalTime} secondi`);
  console.log('\n💡 Google vedrà lo Schema.org quando riscansiona le pagine.');
  console.log('   Puoi forzare la scansione in Google Search Console.');
}

main();
