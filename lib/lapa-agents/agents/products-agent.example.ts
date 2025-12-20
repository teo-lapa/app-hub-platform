/**
 * EXAMPLES - Products Agent
 * Esempi pratici di utilizzo del Products Agent
 */

import { ProductsAgent, productsAgent } from './products-agent';

// ============= ESEMPIO 1: Ricerca Prodotti =============

export async function example1_searchProducts() {
  console.log('\n🔍 ESEMPIO 1: Ricerca Prodotti');
  console.log('===================================\n');

  // Ricerca per nome
  const result1 = await productsAgent.searchProducts({
    query: 'vino',
    active_only: true,
  }, 10);

  console.log('Ricerca "vino":', result1.message);
  if (result1.data) {
    result1.data.slice(0, 3).forEach(product => {
      console.log(`  - ${product.name} (${product.list_price}€)`);
    });
  }

  // Ricerca per categoria
  const result2 = await productsAgent.searchProducts({
    category_id: 1, // ID categoria Bevande
    min_price: 10,
    max_price: 50,
  });

  console.log('\nProdotti categoria Bevande (10-50€):', result2.message);

  // Ricerca solo prodotti disponibili
  const result3 = await productsAgent.searchProducts({
    query: 'champagne',
    available_only: true,
  });

  console.log('\nChampagne disponibili:', result3.message);
}

// ============= ESEMPIO 2: Dettagli Prodotto =============

export async function example2_productDetails() {
  console.log('\n📦 ESEMPIO 2: Dettagli Prodotto');
  console.log('===================================\n');

  const productId = 123; // ID prodotto esempio

  const result = await productsAgent.getProductDetails(productId);

  if (result.success && result.data) {
    const product = result.data;
    console.log('Nome:', product.name);
    console.log('Codice:', product.default_code);
    console.log('Barcode:', product.barcode);
    console.log('Categoria:', product.categ_id[1]);
    console.log('Prezzo listino:', product.list_price, '€');
    console.log('Costo:', product.standard_price, '€');
    console.log('Tipo:', product.type);
    console.log('Unità misura:', product.uom_id[1]);
  } else {
    console.log('Errore:', result.message);
  }
}

// ============= ESEMPIO 3: Verifica Disponibilità =============

export async function example3_checkAvailability() {
  console.log('\n📊 ESEMPIO 3: Verifica Disponibilità');
  console.log('===================================\n');

  const productId = 123;

  const result = await productsAgent.checkAvailability(productId);

  if (result.success && result.data) {
    const avail = result.data;
    console.log('Prodotto:', avail.productName);
    console.log('Disponibile:', avail.qty_available);
    console.log('Virtuale (prevista):', avail.virtual_available);
    console.log('In uscita:', avail.outgoing_qty);
    console.log('In arrivo:', avail.incoming_qty);
    console.log('Libera:', avail.free_qty);

    if (avail.locations && avail.locations.length > 0) {
      console.log('\nUbicazioni:');
      avail.locations.forEach(loc => {
        console.log(`  - ${loc.locationName}: ${loc.quantity} pz`);
      });
    }

    // Determina se ordinabile
    if (avail.qty_available > 0) {
      console.log('\n✅ Prodotto ordinabile subito!');
    } else if (avail.virtual_available > 0) {
      console.log('\n⏳ Prodotto ordinabile con attesa (arrivo previsto)');
    } else {
      console.log('\n❌ Prodotto non disponibile');
    }
  }
}

// ============= ESEMPIO 4: Calcolo Prezzi B2B vs B2C =============

export async function example4_getPrices() {
  console.log('\n💰 ESEMPIO 4: Calcolo Prezzi');
  console.log('===================================\n');

  const productId = 123;

  // Prezzo B2C (cliente retail)
  const priceB2C = await productsAgent.getPrice(productId, 'B2C', 1);

  console.log('PREZZO B2C (Retail):');
  if (priceB2C.success && priceB2C.data) {
    const price = priceB2C.data;
    console.log(`  Prodotto: ${price.productName}`);
    console.log(`  Listino: ${price.pricelistName}`);
    console.log(`  Prezzo base: ${price.basePrice.toFixed(2)} ${price.currency}`);
    if (price.discountPercent) {
      console.log(`  Sconto: -${price.discountPercent.toFixed(1)}%`);
    }
    console.log(`  Prezzo finale: ${price.finalPrice.toFixed(2)} ${price.currency}`);
    console.log(`  IVA: ${price.taxIncluded ? 'Inclusa' : 'Esclusa'}`);
  }

  // Prezzo B2B (cliente business)
  const priceB2B = await productsAgent.getPrice(productId, 'B2B', 10);

  console.log('\nPREZZO B2B (Business, qty 10):');
  if (priceB2B.success && priceB2B.data) {
    const price = priceB2B.data;
    console.log(`  Listino: ${price.pricelistName}`);
    console.log(`  Prezzo base: ${price.basePrice.toFixed(2)} ${price.currency}`);
    if (price.discountPercent) {
      console.log(`  Sconto: -${price.discountPercent.toFixed(1)}%`);
    }
    console.log(`  Prezzo finale: ${price.finalPrice.toFixed(2)} ${price.currency}`);
    console.log(`  Totale 10 pz: ${(price.finalPrice * 10).toFixed(2)} ${price.currency}`);
  }

  // Prezzo B2B con sconto quantità
  const priceB2BLarge = await productsAgent.getPrice(productId, 'B2B', 100);

  console.log('\nPREZZO B2B (Business, qty 100 - sconto volume):');
  if (priceB2BLarge.success && priceB2BLarge.data) {
    const price = priceB2BLarge.data;
    console.log(`  Sconto: -${price.discountPercent?.toFixed(1)}%`);
    console.log(`  Prezzo unitario: ${price.finalPrice.toFixed(2)} ${price.currency}`);
    console.log(`  Totale 100 pz: ${(price.finalPrice * 100).toFixed(2)} ${price.currency}`);
  }
}

// ============= ESEMPIO 5: Prodotti Simili =============

export async function example5_getSimilarProducts() {
  console.log('\n🔗 ESEMPIO 5: Prodotti Simili');
  console.log('===================================\n');

  const productId = 123;

  const result = await productsAgent.getSimilarProducts(productId, 5);

  if (result.success && result.data) {
    console.log(result.message);
    console.log('\nSuggerimenti:');

    result.data.forEach((similar, index) => {
      console.log(`\n${index + 1}. ${similar.product.name}`);
      console.log(`   Similarità: ${similar.similarityScore}%`);
      console.log(`   Motivo: ${similar.reason}`);
      console.log(`   Prezzo: ${similar.product.list_price.toFixed(2)} €`);
    });
  }
}

// ============= ESEMPIO 6: Promozioni Attive =============

export async function example6_getPromotions() {
  console.log('\n🎁 ESEMPIO 6: Promozioni Attive');
  console.log('===================================\n');

  // Tutte le promozioni attive
  const result1 = await productsAgent.getPromotions();

  console.log('Promozioni generali:', result1.message);
  if (result1.data) {
    result1.data.forEach(promo => {
      console.log(`\n- ${promo.name}`);
      console.log(`  Sconto: ${promo.discount_value}${promo.discount_type === 'percentage' ? '%' : '€'}`);
      console.log(`  Valida: ${promo.start_date} → ${promo.end_date}`);
    });
  }

  // Promozioni per prodotto specifico
  const productId = 123;
  const result2 = await productsAgent.getPromotions(productId);

  console.log(`\nPromozioni per prodotto ${productId}:`, result2.message);
}

// ============= ESEMPIO 7: Workflow Completo =============

export async function example7_completeWorkflow() {
  console.log('\n🎯 ESEMPIO 7: Workflow Completo');
  console.log('===================================\n');

  // Step 1: Cliente cerca un prodotto
  console.log('1. Cliente cerca "vino rosso"...');
  const searchResult = await productsAgent.searchProducts({
    query: 'vino rosso',
    available_only: true,
  }, 5);

  if (!searchResult.success || !searchResult.data || searchResult.data.length === 0) {
    console.log('Nessun prodotto trovato!');
    return;
  }

  const selectedProduct = searchResult.data[0];
  console.log(`   ✅ Trovato: ${selectedProduct.name}`);

  // Step 2: Verifica disponibilità
  console.log('\n2. Verifica disponibilità...');
  const availResult = await productsAgent.checkAvailability(selectedProduct.id);

  if (availResult.success && availResult.data) {
    console.log(`   ✅ Disponibili: ${availResult.data.qty_available} pz`);
  }

  // Step 3: Calcola prezzo per cliente B2C
  console.log('\n3. Calcola prezzo per cliente retail...');
  const priceResult = await productsAgent.getPrice(selectedProduct.id, 'B2C', 2);

  if (priceResult.success && priceResult.data) {
    console.log(`   ✅ Prezzo: ${priceResult.data.finalPrice.toFixed(2)} € x 2 = ${(priceResult.data.finalPrice * 2).toFixed(2)} €`);
  }

  // Step 4: Suggerisci prodotti simili per upsell
  console.log('\n4. Suggerimenti "potrebbe interessarti anche"...');
  const similarResult = await productsAgent.getSimilarProducts(selectedProduct.id, 3);

  if (similarResult.success && similarResult.data) {
    similarResult.data.forEach(similar => {
      console.log(`   - ${similar.product.name} (${similar.product.list_price}€)`);
    });
  }

  // Step 5: Verifica promozioni attive
  console.log('\n5. Verifica promozioni...');
  const promoResult = await productsAgent.getPromotions(selectedProduct.id);

  if (promoResult.success && promoResult.data && promoResult.data.length > 0) {
    console.log(`   🎁 Promozione attiva: ${promoResult.data[0].name}`);
  } else {
    console.log('   Nessuna promozione attiva');
  }

  console.log('\n✅ Workflow completato!');
}

// ============= ESEMPIO 8: Multi-lingua =============

export async function example8_multilanguage() {
  console.log('\n🌍 ESEMPIO 8: Supporto Multi-lingua');
  console.log('===================================\n');

  const productId = 123;

  // Italiano
  const agentIT = new ProductsAgent('it');
  const resultIT = await agentIT.checkAvailability(productId);
  console.log('🇮🇹 Italiano:', resultIT.message);

  // Inglese
  const agentEN = new ProductsAgent('en');
  const resultEN = await agentEN.checkAvailability(productId);
  console.log('🇬🇧 English:', resultEN.message);

  // Francese
  const agentFR = new ProductsAgent('fr');
  const resultFR = await agentFR.checkAvailability(productId);
  console.log('🇫🇷 Français:', resultFR.message);

  // Tedesco
  const agentDE = new ProductsAgent('de');
  const resultDE = await agentDE.checkAvailability(productId);
  console.log('🇩🇪 Deutsch:', resultDE.message);
}

// ============= RUN ALL EXAMPLES =============

export async function runAllExamples() {
  // Test connessione
  console.log('🔌 Test connessione Odoo...');
  const isConnected = await productsAgent.testConnection();
  if (!isConnected) {
    console.error('❌ Connessione Odoo fallita! Verifica credenziali.');
    return;
  }
  console.log('✅ Connesso a Odoo!\n');

  // Esegui tutti gli esempi
  await example1_searchProducts();
  await example2_productDetails();
  await example3_checkAvailability();
  await example4_getPrices();
  await example5_getSimilarProducts();
  await example6_getPromotions();
  await example7_completeWorkflow();
  await example8_multilanguage();

  console.log('\n🎉 Tutti gli esempi completati!\n');
}

// Esegui se chiamato direttamente
if (require.main === module) {
  runAllExamples().catch(console.error);
}
