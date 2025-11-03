/**
 * Test script per l'API Top Products
 *
 * Esegui con: node test-top-products-api.js
 */

const API_BASE_URL = 'http://localhost:3000';

async function testTopProductsAPI() {
  console.log('\n========================================');
  console.log('TEST TOP PRODUCTS API');
  console.log('========================================\n');

  try {
    // Test 1: Richiesta senza parametri (deve fallire)
    console.log('Test 1: Richiesta senza parametri (deve fallire)...');
    const response1 = await fetch(`${API_BASE_URL}/api/analisi-prodotto/top-products`);
    const data1 = await response1.json();
    console.log('Status:', response1.status);
    console.log('Response:', JSON.stringify(data1, null, 2));
    console.log(response1.status === 400 ? '✓ Test 1 PASSED' : '✗ Test 1 FAILED');

    // Test 2: Richiesta con parametri validi (Ottobre 2025)
    console.log('\n\nTest 2: Richiesta con parametri validi (Ottobre 2025)...');
    const dateFrom = '2025-10-01';
    const dateTo = '2025-10-31';
    const response2 = await fetch(
      `${API_BASE_URL}/api/analisi-prodotto/top-products?dateFrom=${dateFrom}&dateTo=${dateTo}`
    );
    const data2 = await response2.json();
    console.log('Status:', response2.status);
    console.log('\nSummary:');
    console.log(JSON.stringify(data2.summary, null, 2));

    if (data2.products && data2.products.length > 0) {
      console.log('\nTop 5 Products:');
      data2.products.slice(0, 5).forEach((product, index) => {
        console.log(`\n${index + 1}. ${product.name}`);
        console.log(`   ID: ${product.id}`);
        console.log(`   UOM: ${product.uom}`);
        console.log(`   Quantità: ${product.totalQty}`);
        console.log(`   Fatturato: ${product.totalRevenue.toFixed(2)} CHF`);
        console.log(`   Ordini: ${product.orders}`);
        console.log(`   Clienti: ${product.customers}`);
        console.log(`   Margine: ${product.marginPercent.toFixed(2)}%`);
        console.log(`   Prezzo Medio: ${product.avgPrice.toFixed(2)} CHF`);
        console.log(`   Costo Medio: ${product.avgCost.toFixed(2)} CHF`);
      });
    }
    console.log(response2.status === 200 ? '\n✓ Test 2 PASSED' : '\n✗ Test 2 FAILED');

    // Test 3: Richiesta con periodo esteso (ultimi 6 mesi)
    console.log('\n\nTest 3: Richiesta con periodo esteso (ultimi 6 mesi)...');
    const today = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const dateFrom3 = sixMonthsAgo.toISOString().split('T')[0];
    const dateTo3 = today.toISOString().split('T')[0];

    console.log(`Periodo: ${dateFrom3} to ${dateTo3}`);
    const response3 = await fetch(
      `${API_BASE_URL}/api/analisi-prodotto/top-products?dateFrom=${dateFrom3}&dateTo=${dateTo3}`
    );
    const data3 = await response3.json();
    console.log('Status:', response3.status);
    console.log('\nSummary:');
    console.log(JSON.stringify(data3.summary, null, 2));
    console.log(response3.status === 200 ? '\n✓ Test 3 PASSED' : '\n✗ Test 3 FAILED');

    // Test 4: Richiesta con periodo senza vendite (deve ritornare array vuoto)
    console.log('\n\nTest 4: Richiesta con periodo senza vendite...');
    const response4 = await fetch(
      `${API_BASE_URL}/api/analisi-prodotto/top-products?dateFrom=2020-01-01&dateTo=2020-01-31`
    );
    const data4 = await response4.json();
    console.log('Status:', response4.status);
    console.log('Response:', JSON.stringify(data4, null, 2));
    console.log(
      response4.status === 200 && data4.products.length === 0
        ? '✓ Test 4 PASSED'
        : '✗ Test 4 FAILED'
    );

    console.log('\n========================================');
    console.log('TUTTI I TEST COMPLETATI');
    console.log('========================================\n');

  } catch (error) {
    console.error('\n========================================');
    console.error('ERRORE NEI TEST');
    console.error('========================================\n');
    console.error(error);
  }
}

// Esegui i test
testTopProductsAPI();
