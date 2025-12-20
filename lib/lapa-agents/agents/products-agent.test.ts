/**
 * PRODUCTS AGENT - Test rapido
 *
 * Quick test per verificare che l'agente funzioni correttamente
 */

import { productsAgent, ProductsAgent } from './products-agent';

// Test di base
async function runQuickTests() {
  console.log('🧪 PRODUCTS AGENT - Quick Tests');
  console.log('=================================\n');

  try {
    // Test 1: Connessione
    console.log('1️⃣ Test connessione Odoo...');
    const isConnected = await productsAgent.testConnection();

    if (!isConnected) {
      console.error('❌ Connessione fallita!');
      console.log('\n⚠️ Verifica:');
      console.log('  - Credenziali Odoo in .env');
      console.log('  - URL Odoo raggiungibile');
      console.log('  - Database Odoo corretto');
      return;
    }

    console.log('✅ Connesso a Odoo!\n');

    // Test 2: Ricerca prodotti
    console.log('2️⃣ Test ricerca prodotti...');
    const searchResult = await productsAgent.searchProducts(
      { active_only: true },
      5
    );

    if (searchResult.success && searchResult.data) {
      console.log(`✅ Trovati ${searchResult.data.length} prodotti`);
      if (searchResult.data.length > 0) {
        const firstProduct = searchResult.data[0];
        console.log(`   Esempio: ${firstProduct.name} (ID: ${firstProduct.id})`);

        // Test 3: Dettagli prodotto
        console.log('\n3️⃣ Test dettagli prodotto...');
        const detailsResult = await productsAgent.getProductDetails(firstProduct.id);

        if (detailsResult.success && detailsResult.data) {
          console.log('✅ Dettagli recuperati');
          console.log(`   Nome: ${detailsResult.data.name}`);
          console.log(`   Prezzo: ${detailsResult.data.list_price} €`);
          console.log(`   Categoria: ${detailsResult.data.categ_id[1]}`);
        } else {
          console.log('⚠️ Dettagli non disponibili:', detailsResult.message);
        }

        // Test 4: Disponibilità
        console.log('\n4️⃣ Test disponibilità...');
        const availResult = await productsAgent.checkAvailability(firstProduct.id);

        if (availResult.success && availResult.data) {
          console.log('✅ Disponibilità verificata');
          console.log(`   Disponibile: ${availResult.data.qty_available} pz`);
          console.log(`   Prevista: ${availResult.data.virtual_available} pz`);

          if (availResult.data.locations && availResult.data.locations.length > 0) {
            console.log(`   Ubicazioni: ${availResult.data.locations.length}`);
          }
        } else {
          console.log('⚠️ Disponibilità non verificabile:', availResult.message);
        }

        // Test 5: Prezzo
        console.log('\n5️⃣ Test calcolo prezzo...');
        const priceResult = await productsAgent.getPrice(firstProduct.id, 'B2C', 1);

        if (priceResult.success && priceResult.data) {
          console.log('✅ Prezzo calcolato');
          console.log(`   Tipo: ${priceResult.data.customerType}`);
          console.log(`   Prezzo: ${priceResult.data.finalPrice.toFixed(2)} ${priceResult.data.currency}`);

          if (priceResult.data.discountPercent) {
            console.log(`   Sconto: -${priceResult.data.discountPercent.toFixed(1)}%`);
          }
        } else {
          console.log('⚠️ Prezzo non calcolabile:', priceResult.message);
        }

        // Test 6: Prodotti simili
        console.log('\n6️⃣ Test prodotti simili...');
        const similarResult = await productsAgent.getSimilarProducts(firstProduct.id, 3);

        if (similarResult.success && similarResult.data) {
          console.log(`✅ Trovati ${similarResult.data.length} prodotti simili`);

          if (similarResult.data.length > 0) {
            console.log('   Esempi:');
            similarResult.data.slice(0, 2).forEach(similar => {
              console.log(`   - ${similar.product.name} (${similar.similarityScore}%)`);
            });
          }
        } else {
          console.log('⚠️ Prodotti simili non trovati:', similarResult.message);
        }

        // Test 7: Promozioni
        console.log('\n7️⃣ Test promozioni...');
        const promosResult = await productsAgent.getPromotions();

        if (promosResult.success && promosResult.data) {
          console.log(`✅ Trovate ${promosResult.data.length} promozioni`);

          if (promosResult.data.length > 0) {
            const firstPromo = promosResult.data[0];
            console.log(`   Esempio: ${firstPromo.name}`);
          }
        } else {
          console.log('⚠️ Nessuna promozione trovata');
        }

        // Test 8: Multi-lingua
        console.log('\n8️⃣ Test multi-lingua...');
        const agentEN = new ProductsAgent('en');
        const searchEN = await agentEN.searchProducts({ active_only: true }, 1);

        console.log(`✅ EN: "${searchEN.message}"`);

        const agentFR = new ProductsAgent('fr');
        const searchFR = await agentFR.searchProducts({ active_only: true }, 1);

        console.log(`✅ FR: "${searchFR.message}"`);

        const agentDE = new ProductsAgent('de');
        const searchDE = await agentDE.searchProducts({ active_only: true }, 1);

        console.log(`✅ DE: "${searchDE.message}"`);
      }
    } else {
      console.log('❌ Ricerca fallita:', searchResult.message);
      console.log('   Errore:', searchResult.error);
    }

    console.log('\n=================================');
    console.log('✅ Tutti i test completati!\n');

  } catch (error) {
    console.error('\n❌ Errore durante i test:', error);
    console.error('\n⚠️ Possibili cause:');
    console.error('  - Odoo non raggiungibile');
    console.error('  - Credenziali errate');
    console.error('  - Permessi insufficienti');
    console.error('  - Modelli Odoo non disponibili\n');
  }
}

// Test specifici
async function testSearchFilters() {
  console.log('\n🔍 Test Filtri Ricerca Avanzata');
  console.log('=================================\n');

  // Test filtro prezzo
  console.log('Filtro prezzo (10-50€)...');
  const priceFilter = await productsAgent.searchProducts({
    min_price: 10,
    max_price: 50,
    active_only: true,
  }, 5);

  console.log(`Risultati: ${priceFilter.data?.length || 0}`);

  // Test filtro categoria
  console.log('\nFiltro categoria...');
  const categoryFilter = await productsAgent.searchProducts({
    category_id: 1,
    active_only: true,
  }, 5);

  console.log(`Risultati: ${categoryFilter.data?.length || 0}`);

  // Test filtro disponibilità
  console.log('\nFiltro solo disponibili...');
  const availFilter = await productsAgent.searchProducts({
    available_only: true,
  }, 5);

  console.log(`Risultati: ${availFilter.data?.length || 0}`);
}

async function testPriceComparison() {
  console.log('\n💰 Test Confronto Prezzi B2B vs B2C');
  console.log('=====================================\n');

  // Trova un prodotto
  const searchResult = await productsAgent.searchProducts({ active_only: true }, 1);

  if (!searchResult.success || !searchResult.data || searchResult.data.length === 0) {
    console.log('Nessun prodotto trovato per test');
    return;
  }

  const productId = searchResult.data[0].id;
  const productName = searchResult.data[0].name;

  console.log(`Prodotto: ${productName}\n`);

  // B2C
  const b2c = await productsAgent.getPrice(productId, 'B2C', 1);
  if (b2c.success && b2c.data) {
    console.log(`B2C (retail):   ${b2c.data.finalPrice.toFixed(2)} €`);
  }

  // B2B piccola quantità
  const b2bSmall = await productsAgent.getPrice(productId, 'B2B', 5);
  if (b2bSmall.success && b2bSmall.data) {
    console.log(`B2B (5 pz):     ${b2bSmall.data.finalPrice.toFixed(2)} €`);
  }

  // B2B media quantità
  const b2bMedium = await productsAgent.getPrice(productId, 'B2B', 20);
  if (b2bMedium.success && b2bMedium.data) {
    console.log(`B2B (20 pz):    ${b2bMedium.data.finalPrice.toFixed(2)} € ${b2bMedium.data.discountPercent ? `(-${b2bMedium.data.discountPercent.toFixed(1)}%)` : ''}`);
  }

  // B2B grande quantità
  const b2bLarge = await productsAgent.getPrice(productId, 'B2B', 100);
  if (b2bLarge.success && b2bLarge.data) {
    console.log(`B2B (100 pz):   ${b2bLarge.data.finalPrice.toFixed(2)} € ${b2bLarge.data.discountPercent ? `(-${b2bLarge.data.discountPercent.toFixed(1)}%)` : ''}`);
  }
}

// Menu principale
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--filters')) {
    await testSearchFilters();
  } else if (args.includes('--prices')) {
    await testPriceComparison();
  } else if (args.includes('--all')) {
    await runQuickTests();
    await testSearchFilters();
    await testPriceComparison();
  } else {
    // Default: quick tests
    await runQuickTests();
  }
}

// Esegui se chiamato direttamente
if (require.main === module) {
  main().catch(console.error);
}

export { runQuickTests, testSearchFilters, testPriceComparison };
