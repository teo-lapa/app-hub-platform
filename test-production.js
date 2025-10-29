// Test diretto su produzione
require('dotenv').config({ path: '.env.local' });

async function testProduction() {
  console.log('🧪 Test PRODUZIONE - Latest deployment\n');

  const testProduct = {
    nome_completo: "Test Banana API 30g",
    descrizione_breve: "Test prodotto",
    categoria_odoo_id: 1,
    prezzo_acquisto: 1.50,
    prezzo_vendita_suggerito: 2.50,
    uom_odoo_id: 1,
  };

  // NUOVO DEPLOYMENT
  const url = 'https://app-hub-platform-adjllqqmr-teo-lapas-projects.vercel.app/api/product-creator/create-products';

  console.log(`📡 Testing: ${url}\n`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products: [testProduct] })
    });

    console.log('Status:', response.status);

    const result = await response.json();
    console.log('\n' + JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('\n✅ FUNZIONA!\n');
    } else {
      console.log('\n❌ ERRORE:', result.error, '\n');
    }
  } catch (e) {
    console.error('\n❌ EXCEPTION:', e.message, '\n');
  }
}

testProduction();
