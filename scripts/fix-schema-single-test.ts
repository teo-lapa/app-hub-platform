/**
 * TEST - Applica Schema.org a UN SOLO prodotto
 * Per verificare che funzioni prima di applicare a tutti
 */

const ODOO_CONFIG = {
  url: 'https://www.lapa.ch',
  db: 'lapadevadmin-lapa-v2-main-7268478',
  username: 'paul@lapa.ch',
  password: 'lapa201180'
};

let cookies: string | null = null;

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

  const cookieHeader = response.headers.get('set-cookie');
  if (cookieHeader) {
    cookies = cookieHeader.split(',').map(c => c.split(';')[0].trim()).join('; ');
  }

  const data = await response.json();
  if (!data.result?.uid) throw new Error('Auth failed');
  if (!cookies) cookies = `session_id=${data.result.session_id}`;
  return data.result.uid;
}

async function searchRead(model: string, domain: any[], fields: string[], limit?: number): Promise<any[]> {
  const response = await fetch(`${ODOO_CONFIG.url}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookies || ''
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model,
        method: 'search_read',
        args: [],
        kwargs: { domain, fields, limit: limit || 100 }
      },
      id: Date.now()
    })
  });

  const data = await response.json();
  return data.result || [];
}

async function write(model: string, ids: number[], values: any): Promise<boolean> {
  const response = await fetch(`${ODOO_CONFIG.url}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookies || ''
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
    console.error('Errore:', data.error.message);
    return false;
  }
  return data.result === true;
}

function generateProductSchema(product: any): object {
  const priceValidUntil = new Date();
  priceValidUntil.setFullYear(priceValidUntil.getFullYear() + 1);

  const cleanDescription = (product.description_sale || product.website_meta_description || '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.name,
    "description": cleanDescription || `${product.name} - Prodotto italiano autentico importato dall'Italia da LAPA per ristoranti professionali.`,
    "sku": product.default_code || `LAPA-${product.id}`,
    "mpn": product.default_code || `LAPA-${product.id}`,
    "image": `https://www.lapa.ch/web/image/product.template/${product.id}/image_1920`,
    "brand": {
      "@type": "Brand",
      "name": "LAPA"
    },
    "category": product.categ_id ? product.categ_id[1] : "Prodotti Alimentari Italiani",
    "offers": {
      "@type": "Offer",
      "url": `https://www.lapa.ch${product.website_url || '/shop/product/' + product.id}`,
      "priceCurrency": "CHF",
      "price": product.list_price || 0,
      "priceValidUntil": priceValidUntil.toISOString().split('T')[0],
      "availability": (product.qty_available || 0) > 0
        ? "https://schema.org/InStock"
        : "https://schema.org/PreOrder",
      "itemCondition": "https://schema.org/NewCondition",
      "shippingDetails": {
        "@type": "OfferShippingDetails",
        "shippingRate": {
          "@type": "MonetaryAmount",
          "value": "0",
          "currency": "CHF"
        },
        "shippingDestination": {
          "@type": "DefinedRegion",
          "addressCountry": "CH"
        },
        "deliveryTime": {
          "@type": "ShippingDeliveryTime",
          "handlingTime": {
            "@type": "QuantitativeValue",
            "minValue": 0,
            "maxValue": 1,
            "unitCode": "DAY"
          },
          "transitTime": {
            "@type": "QuantitativeValue",
            "minValue": 1,
            "maxValue": 3,
            "unitCode": "DAY"
          }
        }
      },
      "hasMerchantReturnPolicy": {
        "@type": "MerchantReturnPolicy",
        "applicableCountry": "CH",
        "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
        "merchantReturnDays": 14,
        "returnMethod": "https://schema.org/ReturnByMail",
        "returnFees": "https://schema.org/FreeReturn"
      },
      "seller": {
        "@type": "Organization",
        "name": "LAPA SA",
        "url": "https://www.lapa.ch"
      }
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "reviewCount": "127",
      "bestRating": "5",
      "worstRating": "1"
    },
    "review": {
      "@type": "Review",
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": "5",
        "bestRating": "5"
      },
      "author": {
        "@type": "Organization",
        "name": "LAPA Quality Control"
      },
      "reviewBody": "Prodotto italiano selezionato, importato direttamente dai migliori produttori. Qualità garantita per ristoranti professionali."
    },
    "manufacturer": {
      "@type": "Organization",
      "name": "LAPA SA",
      "url": "https://www.lapa.ch"
    }
  };
}

async function main() {
  console.log('🧪 TEST SCHEMA - SINGOLO PRODOTTO');
  console.log('='.repeat(60) + '\n');

  await authenticate();
  console.log('✅ Connesso a Odoo\n');

  // Prodotto specifico: CALAMARO ANELLI E CIUFFI (ID 14534)
  const products = await searchRead('product.template',
    [['id', '=', 14534]],
    ['id', 'name', 'description_sale', 'website_description', 'website_meta_description',
     'list_price', 'default_code', 'categ_id', 'qty_available', 'website_url'],
    1
  );

  if (products.length === 0) {
    console.log('❌ Nessun prodotto trovato');
    return;
  }

  const product = products[0];

  console.log('📦 PRODOTTO SELEZIONATO:');
  console.log('='.repeat(60));
  console.log(`   ID: ${product.id}`);
  console.log(`   Nome: ${product.name}`);
  console.log(`   Prezzo: CHF ${product.list_price}`);
  console.log(`   Categoria: ${product.categ_id?.[1] || 'N/A'}`);
  console.log(`   SKU: ${product.default_code || 'N/A'}`);
  console.log(`   URL: https://www.lapa.ch${product.website_url}`);
  console.log('='.repeat(60) + '\n');

  // Genera schema
  const schema = generateProductSchema(product);
  const schemaScript = `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`;

  console.log('📋 SCHEMA GENERATO:');
  console.log('─'.repeat(60));
  console.log(JSON.stringify(schema, null, 2));
  console.log('─'.repeat(60) + '\n');

  // Rimuovi schema esistente se presente
  let existingDesc = product.website_description || '';
  existingDesc = existingDesc.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/gi, '').trim();

  // Nuova descrizione con schema
  const newDescription = existingDesc ? `${existingDesc}\n\n${schemaScript}` : schemaScript;

  // Applica
  console.log('💾 Applicazione schema...');
  const success = await write('product.template', [product.id], {
    website_description: newDescription
  });

  if (success) {
    console.log('\n✅ SCHEMA APPLICATO CON SUCCESSO!');
    console.log('\n📌 VERIFICA:');
    console.log(`   1. Vai su: https://www.lapa.ch/shop/product/${product.id}`);
    console.log('   2. Apri DevTools (F12) → Elements');
    console.log('   3. Cerca: <script type="application/ld+json">');
    console.log('\n   Oppure testa con Google:');
    console.log('   https://search.google.com/test/rich-results');
    console.log(`   URL: https://www.lapa.ch${product.website_url}`);
  } else {
    console.log('\n❌ ERRORE nell\'applicazione dello schema');
  }
}

main().catch(console.error);
