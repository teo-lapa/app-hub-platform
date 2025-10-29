// Test script per creare un prodotto di test
// Run with: node test-create-product.js

require('dotenv').config({ path: '.env.local' });

async function testCreateProduct() {
  try {
    console.log('🧪 Testing Product Creation API\n');

    // Test product data
    const testProduct = {
      nome_completo: "Test Banana 30g",
      descrizione_breve: "Banana di test per verificare la creazione",
      descrizione_dettagliata: "Prodotto di test per verificare il funzionamento dell'API di creazione prodotti con generazione immagine Gemini",
      categoria_odoo_id: 1, // Default category
      prezzo_acquisto: 1.50,
      prezzo_vendita_suggerito: 2.50,
      uom_odoo_id: 1, // Unit
      codice_ean: "1234567890123",
    };

    console.log('📦 Test product:', testProduct.nome_completo);
    console.log('🔑 Testing with staging URL...\n');

    // Use staging URL
    const baseUrl = 'https://app-hub-platform-git-staging-teo-lapas-projects.vercel.app';

    console.log(`📡 Calling: ${baseUrl}/api/product-creator/create-products\n`);

    const response = await fetch(`${baseUrl}/api/product-creator/create-products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        products: [testProduct]
      })
    });

    console.log('📊 Response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ HTTP Error:', errorText);
      return;
    }

    const result = await response.json();

    console.log('\n' + '='.repeat(60));
    console.log('RESPONSE:');
    console.log('='.repeat(60));
    console.log(JSON.stringify(result, null, 2));
    console.log('='.repeat(60));

    if (result.success) {
      console.log('\n✅ SUCCESS!');
      console.log(`Created: ${result.summary.created}/${result.summary.total}`);

      if (result.results && result.results.length > 0) {
        console.log('\nProducts created:');
        result.results.forEach(r => {
          console.log(`- ${r.product} (ID: ${r.odoo_id})`);
          console.log(`  Supplier price: ${r.supplier_price_created ? '✅' : '❌'}`);
          console.log(`  Image generated: ${r.image_generated ? '✅' : '❌'}`);
        });
      }

      if (result.errors && result.errors.length > 0) {
        console.log('\n⚠️  Errors:');
        result.errors.forEach(e => {
          console.log(`- ${e.product}: ${e.error}`);
        });
      }
    } else {
      console.log('\n❌ FAILED!');
      console.log('Error:', result.error);
    }

  } catch (error) {
    console.error('\n❌ EXCEPTION:', error.message);
    console.error('Full error:', error);
  }
}

testCreateProduct();
