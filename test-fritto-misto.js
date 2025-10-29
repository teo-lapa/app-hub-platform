// Test con FRITTO MISTO - prodotto nuovo
require('dotenv').config({ path: '.env.local' });

async function testFrittoMisto() {
  console.log('🧪 Test NUOVO prodotto: FRITTO MISTO CAMPAN MIGN PREF 30g\n');

  const newProduct = {
    nome_completo: "FRITTO MISTO CAMPAN MIGN PREF 30 g",
    descrizione_breve: "Fritto misto campano in formato mignon, 30g, pre-fritto surgelato",
    descrizione_dettagliata: "Assortimento di specialità campane fritte in formato mignon da 30g. Include arancini, crocché e altre specialità. Pre-fritto e surgelato, pronto da riscaldare.",
    categoria_odoo_id: 1,
    prezzo_acquisto: 23.26,
    prezzo_vendita_suggerito: 32.00,
    uom_odoo_id: 1,
    codice_ean: "F2703SG",
    marca: "San Giorgio",
    peso: 0.03
  };

  const url = 'https://app-hub-platform-7041sy5lw-teo-lapas-projects.vercel.app/api/product-creator/create-products';

  console.log(`📡 URL: ${url}\n`);
  console.log('📦 Product:', newProduct.nome_completo);
  console.log('🏷️  Barcode:', newProduct.codice_ean);
  console.log('💰 Price:', newProduct.prezzo_acquisto, '→', newProduct.prezzo_vendita_suggerito);
  console.log('\n⏳ Creating product + generating image with Gemini...');
  console.log('⏱️  This may take 30-40 seconds for image generation...\n');

  try {
    const startTime = Date.now();

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products: [newProduct] })
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('⏱️  Total time:', elapsed, 'seconds');
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

    if (result.success && result.summary.created > 0) {
      console.log('\n🎉 SUCCESSO!\n');

      if (result.results && result.results.length > 0) {
        const product = result.results[0];
        console.log('✅ Product created in Odoo!');
        console.log('   ID:', product.odoo_id);
        console.log('   Name:', product.product);
        console.log('   Supplier price:', product.supplier_price_created ? '✅ Created' : '❌ Not created');
        console.log('   Image generated:', product.image_generated ? '✅ YES! 🎨' : '❌ NO');

        if (product.image_generated) {
          console.log('\n🎊 PERFETTO! Prodotto creato CON immagine generata da Gemini AI!');
          console.log(`\n👉 Vai su Odoo e controlla il prodotto ID ${product.odoo_id}`);
          console.log('   Dovresti vedere l\'immagine del prodotto!\n');
        } else {
          console.log('\n⚠️  Prodotto creato ma immagine NON generata');
          console.log('   Controlla i log per vedere perché\n');
        }
      }

      if (result.errors && result.errors.length > 0) {
        console.log('\n⚠️  ALCUNI ERRORI:');
        result.errors.forEach(e => console.log(`   - ${e.product}: ${e.error}`));
      }
    } else if (result.errors && result.errors.length > 0) {
      console.log('\n❌ ERRORE nella creazione:\n');
      result.errors.forEach(e => {
        console.log(`Product: ${e.product}`);
        console.log(`Error: ${e.error}\n`);
      });
    } else {
      console.log('\n❌ UNKNOWN ERROR\n');
    }

  } catch (error) {
    console.error('\n❌ EXCEPTION:', error.message);
    console.error('Stack:', error.stack, '\n');
  }
}

testFrittoMisto();
