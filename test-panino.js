// Test con prodotto REALE dalla fattura
require('dotenv').config({ path: '.env.local' });

async function testRealProduct() {
  console.log('🧪 Test con prodotto REALE: Mini Panino Napoletano\n');

  const realProduct = {
    nome_completo: "MINI PANINO NAPOLETANO 30 g PF",
    descrizione_breve: "Mini panino napoletano ripieno, 30g, pre-tagliato",
    descrizione_dettagliata: "Panino napoletano in formato mini da 30g, già pre-tagliato per un consumo pratico. Perfetto per aperitivi e snack veloci.",
    categoria_odoo_id: 1,
    prezzo_acquisto: 36.55,
    prezzo_vendita_suggerito: 45.00,
    uom_odoo_id: 1,
    codice_ean: "P1704SG",
    marca: "San Giorgio"
  };

  // ULTIMO DEPLOYMENT
  const url = 'https://app-hub-platform-7041sy5lw-teo-lapas-projects.vercel.app/api/product-creator/create-products';

  console.log(`📡 Testing: ${url}\n`);
  console.log('📦 Product:', realProduct.nome_completo);
  console.log('💰 Price:', realProduct.prezzo_acquisto, '→', realProduct.prezzo_vendita_suggerito);
  console.log('\n⏳ Creating product with image generation...\n');

  try {
    const startTime = Date.now();

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products: [realProduct] })
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('⏱️  Response time:', elapsed, 'seconds');
    console.log('📊 Status:', response.status, response.statusText);

    if (!response.ok) {
      const error = await response.text();
      console.error('\n❌ HTTP ERROR:', error);
      return;
    }

    const result = await response.json();

    console.log('\n' + '='.repeat(70));
    console.log('RESULT:');
    console.log('='.repeat(70));
    console.log(JSON.stringify(result, null, 2));
    console.log('='.repeat(70));

    if (result.success) {
      console.log('\n✅ PRODOTTO CREATO!\n');

      if (result.results && result.results.length > 0) {
        const product = result.results[0];
        console.log('📦 Product ID:', product.odoo_id);
        console.log('👤 Supplier price:', product.supplier_price_created ? '✅' : '❌');
        console.log('🎨 Image generated:', product.image_generated ? '✅ YES!' : '❌ NO!');

        if (product.image_generated) {
          console.log('\n🎉 SUCCESSO COMPLETO! Prodotto creato CON immagine!\n');
          console.log(`Vai su Odoo e controlla il prodotto ID ${product.odoo_id}`);
        } else {
          console.log('\n⚠️  Prodotto creato MA immagine NON generata!');
          console.log('Controlla i log di Vercel per vedere l\'errore.\n');
        }
      }

      if (result.errors && result.errors.length > 0) {
        console.log('\n⚠️  ERRORS:');
        result.errors.forEach(e => console.log(`- ${e.product}: ${e.error}`));
      }
    } else {
      console.log('\n❌ FAILED:', result.error, '\n');
    }

  } catch (error) {
    console.error('\n❌ EXCEPTION:', error.message, '\n');
  }
}

testRealProduct();
