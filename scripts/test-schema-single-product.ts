/**
 * TEST Schema.org su UN SINGOLO PRODOTTO
 * Prima testiamo, poi se funziona estendiamo agli altri
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
        kwargs: { fields, limit: limit || 10 }
      },
      id: Date.now()
    })
  });

  const data = await response.json();
  return data.result || [];
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

async function main() {
  console.log('🧪 TEST SCHEMA.ORG SU SINGOLO PRODOTTO');
  console.log('='.repeat(60));

  await authenticate();

  // Cerca un prodotto semplice e popolare per il test
  const products = await searchRead('product.template',
    [['website_published', '=', true], ['name', 'ilike', 'mozzarella']],
    ['id', 'name', 'website_url', 'website_description', 'description_ecommerce',
     'list_price', 'default_code', 'description_sale', 'categ_id'],
    5
  );

  if (products.length === 0) {
    console.log('❌ Nessun prodotto trovato');
    return;
  }

  // Mostra i prodotti trovati
  console.log('\n📦 Prodotti trovati:');
  products.forEach((p, i) => {
    console.log(`   ${i + 1}. ${p.name} (ID: ${p.id})`);
  });

  // Seleziona il primo prodotto per il test
  const testProduct = products[0];
  console.log(`\n🎯 Prodotto selezionato per TEST: ${testProduct.name}`);
  console.log(`   ID: ${testProduct.id}`);
  console.log(`   URL: ${testProduct.website_url}`);
  console.log(`   Prezzo: CHF ${testProduct.list_price}`);

  // Mostra descrizione attuale
  console.log('\n📝 Descrizione eCommerce attuale:');
  console.log('─'.repeat(40));
  console.log(testProduct.description_ecommerce || '(vuota)');
  console.log('─'.repeat(40));

  // Genera Schema.org JSON-LD
  const schemaOrg = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": testProduct.name,
    "description": testProduct.description_sale || `${testProduct.name} - Prodotto italiano di qualità LAPA`,
    "sku": testProduct.default_code || `LAPA-${testProduct.id}`,
    "brand": {
      "@type": "Brand",
      "name": "LAPA"
    },
    "image": `https://www.lapa.ch/web/image/product.template/${testProduct.id}/image_1920`,
    "offers": {
      "@type": "Offer",
      "url": `https://www.lapa.ch${testProduct.website_url}`,
      "priceCurrency": "CHF",
      "price": testProduct.list_price,
      "availability": "https://schema.org/InStock",
      "seller": {
        "@type": "Organization",
        "name": "LAPA SA",
        "url": "https://www.lapa.ch"
      }
    }
  };

  // Categoria se presente
  if (testProduct.categ_id) {
    (schemaOrg as any).category = testProduct.categ_id[1];
  }

  const schemaScript = `<script type="application/ld+json">
${JSON.stringify(schemaOrg, null, 2)}
</script>`;

  console.log('\n📝 Schema.org da aggiungere:');
  console.log('─'.repeat(40));
  console.log(schemaScript);
  console.log('─'.repeat(40));

  // Prepara la nuova descrizione con Schema.org
  const currentDescription = testProduct.description_ecommerce || '';
  const newDescription = currentDescription + '\n\n<!-- Schema.org per SEO -->\n' + schemaScript;

  console.log('\n⚠️  ATTENZIONE: Questo è un TEST su UN SOLO prodotto');
  console.log(`   Prodotto: ${testProduct.name}`);
  console.log(`   ID: ${testProduct.id}`);

  console.log('\n🚀 Aggiornamento in corso...');

  const success = await write('product.template', [testProduct.id], {
    description_ecommerce: newDescription
  });

  if (success) {
    console.log('\n✅ TEST COMPLETATO CON SUCCESSO!');
    console.log(`\n📋 Verifica su: https://www.lapa.ch${testProduct.website_url}`);
    console.log('\n💡 Per verificare Schema.org:');
    console.log('   1. Vai sulla pagina del prodotto');
    console.log('   2. Tasto destro > "Visualizza sorgente pagina"');
    console.log('   3. Cerca "application/ld+json"');
    console.log('\n   Oppure usa: https://search.google.com/test/rich-results');
  } else {
    console.log('\n❌ Errore durante il test');
  }
}

main();
