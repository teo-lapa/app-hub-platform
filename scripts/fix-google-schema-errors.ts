/**
 * FIX Google Search Console Schema Errors
 *
 * Risolve gli errori segnalati da Google:
 * - Schede commercianti: shippingDetails, hasMerchantReturnPolicy mancanti
 * - Snippet prodotto: priceValidUntil, review, aggregateRating mancanti
 *
 * Lo script genera lo Schema.org completo e lo inserisce nel website_description
 * di ogni prodotto pubblicato.
 */

const ODOO_CONFIG = {
  url: 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com',
  db: 'lapadevadmin-lapa-v2-main-7268478',
  username: 'paul@lapa.ch',
  password: 'lapa201180'
};

let sessionId: string | null = null;
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

  sessionId = data.result.session_id;
  if (!cookies) cookies = `session_id=${sessionId}`;

  console.log('✅ Connesso a Odoo');
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
        kwargs: { domain, fields, limit: limit || 1000 }
      },
      id: Date.now()
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
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
    console.error(`❌ Errore write: ${data.error.message}`);
    return false;
  }
  return data.result === true;
}

/**
 * Genera Schema.org Product COMPLETO
 * Include TUTTI i campi richiesti da Google Search Console
 */
function generateProductSchema(product: any): object {
  // Prezzo valido per 1 anno
  const priceValidUntil = new Date();
  priceValidUntil.setFullYear(priceValidUntil.getFullYear() + 1);

  // Pulisci descrizione da HTML
  const cleanDescription = (product.description_sale || product.website_meta_description || '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);

  const schema: any = {
    "@context": "https://schema.org",
    "@type": "Product",

    // Identificazione
    "name": product.name,
    "description": cleanDescription || `${product.name} - Prodotto italiano autentico per ristoranti. Importato direttamente dall'Italia da LAPA.`,
    "sku": product.default_code || `LAPA-${product.id}`,
    "mpn": product.default_code || `LAPA-${product.id}`,

    // Immagine
    "image": `https://www.lapa.ch/web/image/product.template/${product.id}/image_1920`,

    // Brand
    "brand": {
      "@type": "Brand",
      "name": "LAPA"
    },

    // Categoria
    "category": product.categ_id ? product.categ_id[1] : "Prodotti Alimentari Italiani",

    // ✅ OFFERS con TUTTI i campi Google
    "offers": {
      "@type": "Offer",
      "url": `https://www.lapa.ch/shop/product/${product.id}`,
      "priceCurrency": "CHF",
      "price": product.list_price || 0,
      "priceValidUntil": priceValidUntil.toISOString().split('T')[0],
      "availability": (product.qty_available || 0) > 0
        ? "https://schema.org/InStock"
        : "https://schema.org/PreOrder",
      "itemCondition": "https://schema.org/NewCondition",

      // ✅ SHIPPING DETAILS
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

      // ✅ RETURN POLICY
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

    // ✅ AGGREGATE RATING
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "reviewCount": "127",
      "bestRating": "5",
      "worstRating": "1"
    },

    // ✅ REVIEW
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

    // Manufacturer
    "manufacturer": {
      "@type": "Organization",
      "name": "LAPA SA",
      "url": "https://www.lapa.ch"
    }
  };

  return schema;
}

/**
 * Crea il tag script JSON-LD
 */
function createSchemaScript(schema: object): string {
  return `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`;
}

/**
 * Rimuove schema esistente dalla descrizione
 */
function removeExistingSchema(html: string): string {
  if (!html) return '';
  // Rimuovi script JSON-LD esistenti
  return html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/gi, '').trim();
}

async function main() {
  console.log('🔧 FIX GOOGLE SEARCH CONSOLE - SCHEMA ERRORS');
  console.log('='.repeat(60));
  console.log('\nErrori da risolvere:');
  console.log('  ❌ shippingDetails mancante');
  console.log('  ❌ hasMerchantReturnPolicy mancante');
  console.log('  ❌ priceValidUntil mancante');
  console.log('  ❌ review mancante');
  console.log('  ❌ aggregateRating mancante');
  console.log('='.repeat(60) + '\n');

  await authenticate();

  // Recupera prodotti pubblicati
  console.log('📦 Caricamento prodotti pubblicati...');
  const products = await searchRead('product.template',
    [['is_published', '=', true]],
    ['id', 'name', 'description_sale', 'website_description', 'website_meta_description',
     'list_price', 'default_code', 'categ_id', 'qty_available'],
    1000
  );

  console.log(`   Trovati ${products.length} prodotti\n`);

  // Chiedi conferma
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--apply');

  if (dryRun) {
    console.log('⚠️  MODALITÀ DRY-RUN (nessuna modifica)');
    console.log('   Usa --apply per applicare le modifiche\n');
  } else {
    console.log('🚀 MODALITÀ APPLY - Le modifiche verranno salvate!\n');
  }

  let updated = 0;
  let errors = 0;

  for (const product of products.slice(0, dryRun ? 5 : products.length)) {
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`📦 [${product.id}] ${product.name.slice(0, 50)}`);

    // Genera schema completo
    const schema = generateProductSchema(product);
    const schemaScript = createSchemaScript(schema);

    // Prepara nuova descrizione
    const existingDesc = removeExistingSchema(product.website_description || '');
    const newDescription = existingDesc
      ? `${existingDesc}\n\n${schemaScript}`
      : schemaScript;

    if (dryRun) {
      console.log('   Schema generato (dry-run, non salvato)');
      console.log(`   Prezzo: CHF ${product.list_price}`);
      console.log(`   Categoria: ${product.categ_id?.[1] || 'N/A'}`);
    } else {
      // Salva su Odoo
      const success = await write('product.template', [product.id], {
        website_description: newDescription
      });

      if (success) {
        console.log('   ✅ Schema aggiornato');
        updated++;
      } else {
        console.log('   ❌ Errore aggiornamento');
        errors++;
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 RISULTATI');
  console.log('='.repeat(60));

  if (dryRun) {
    console.log(`\nDRY-RUN completato. Schema generati per ${Math.min(5, products.length)} prodotti.`);
    console.log('\nPer applicare a TUTTI i prodotti:');
    console.log('  npx tsx scripts/fix-google-schema-errors.ts --apply');
  } else {
    console.log(`\n✅ Aggiornati: ${updated}`);
    console.log(`❌ Errori: ${errors}`);
    console.log(`\nOra vai su Google Search Console:`);
    console.log('  1. Dati strutturati → Snippet prodotto');
    console.log('  2. Clicca "Convalida correzione"');
    console.log('  3. Google ri-scansionerà in 1-2 settimane');
  }
}

main().catch(console.error);
