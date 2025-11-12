/**
 * Test API: /api/smart-ordering-v2/pre-orders-summary
 *
 * Testa il riepilogo pre-ordini raggruppati per fornitore
 */

const BASE_URL = 'https://lapadevadmin-lapa-v2-staging-2406-24586501.dev.odoo.com';

async function testPreOrdersSummary() {
  console.log('🧪 Test API: Pre-Orders Summary\n');
  console.log('=' .repeat(80));

  try {
    // 1. Login per ottenere session
    console.log('\n1️⃣ Login su Odoo Staging...');
    const loginResponse = await fetch(`${BASE_URL}/web/session/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        params: {
          db: 'lapadevadmin-lapa-v2-staging-2406-24586501',
          login: process.env.ODOO_USERNAME || 'admin',
          password: process.env.ODOO_PASSWORD || 'admin'
        }
      })
    });

    const loginData = await loginResponse.json();

    if (!loginData.result || !loginData.result.uid) {
      throw new Error('Login fallito: ' + JSON.stringify(loginData));
    }

    // Estrai session_id dai cookies
    const cookies = loginResponse.headers.get('set-cookie');
    const sessionMatch = cookies?.match(/session_id=([^;]+)/);
    const sessionId = sessionMatch ? sessionMatch[1] : null;

    if (!sessionId) {
      throw new Error('Session ID non trovato nei cookies');
    }

    console.log('✅ Login effettuato con successo');
    console.log(`   User ID: ${loginData.result.uid}`);
    console.log(`   Session: ${sessionId.substring(0, 20)}...`);

    // 2. Chiama API pre-orders-summary
    console.log('\n2️⃣ Chiamata API: /api/smart-ordering-v2/pre-orders-summary');

    const apiUrl = 'http://localhost:3000/api/smart-ordering-v2/pre-orders-summary';

    const apiResponse = await fetch(apiUrl, {
      headers: {
        'Cookie': `odoo_session_id=${sessionId}`
      }
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      throw new Error(`API error ${apiResponse.status}: ${errorText}`);
    }

    const result = await apiResponse.json();

    if (!result.success) {
      throw new Error('API returned success: false - ' + result.error);
    }

    console.log('✅ API chiamata con successo\n');

    // 3. Analizza risultati
    console.log('=' .repeat(80));
    console.log('📊 RIEPILOGO PRE-ORDINI PER FORNITORE');
    console.log('=' .repeat(80));

    const { preOrderSuppliers, stats } = result;

    // Statistiche globali
    console.log('\n📈 STATISTICHE GLOBALI:');
    console.log(`   Fornitori totali: ${stats.totalSuppliers}`);
    console.log(`   Prodotti totali: ${stats.totalProducts}`);
    console.log(`   Clienti totali: ${stats.totalCustomers}`);
    console.log(`   Assegnazioni totali: ${stats.totalAssignments}`);
    console.log(`   Quantità totale: ${stats.totalQuantity.toFixed(2)}`);
    console.log(`   Valore stimato totale: €${stats.totalEstimatedValue.toFixed(2)}`);

    // Dettaglio fornitori
    console.log('\n' + '=' .repeat(80));
    console.log('📦 DETTAGLIO FORNITORI:');
    console.log('=' .repeat(80));

    preOrderSuppliers.forEach((supplier, index) => {
      console.log(`\n${index + 1}. ${supplier.supplierName} (ID: ${supplier.supplierId})`);
      console.log(`   ${'─'.repeat(70)}`);
      console.log(`   Prodotti: ${supplier.totalProducts}`);
      console.log(`   Clienti unici: ${supplier.totalCustomers}`);
      console.log(`   Quantità totale: ${supplier.totalQuantity.toFixed(2)}`);
      console.log(`   Valore stimato: €${supplier.estimatedValue.toFixed(2)}`);

      // Top 3 prodotti per questo fornitore
      console.log(`\n   📦 Top prodotti:`);
      supplier.products
        .sort((a, b) => b.totalQuantity - a.totalQuantity)
        .slice(0, 3)
        .forEach((product, pIndex) => {
          console.log(`      ${pIndex + 1}. ${product.productName}`);
          console.log(`         - Codice: ${product.productCode || 'N/A'}`);
          console.log(`         - Quantità: ${product.totalQuantity.toFixed(2)} ${product.uom}`);
          console.log(`         - Clienti: ${product.customerCount}`);
          console.log(`         - Valore: €${product.estimatedValue.toFixed(2)}`);

          // Mostra prime 2 assegnazioni
          if (product.assignments.length > 0) {
            console.log(`         - Assegnazioni:`);
            product.assignments.slice(0, 2).forEach(a => {
              console.log(`           • ${a.customerName}: ${a.quantity} ${product.uom}`);
            });
            if (product.assignments.length > 2) {
              console.log(`           ... e altri ${product.assignments.length - 2} clienti`);
            }
          }
        });

      if (supplier.products.length > 3) {
        console.log(`\n   ... e altri ${supplier.products.length - 3} prodotti`);
      }
    });

    // Salva risultato completo in JSON
    const fs = require('fs');
    const outputFile = 'test-pre-orders-summary-result.json';
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
    console.log(`\n\n💾 Risultato completo salvato in: ${outputFile}`);

    console.log('\n' + '=' .repeat(80));
    console.log('✅ TEST COMPLETATO CON SUCCESSO');
    console.log('=' .repeat(80));

  } catch (error) {
    console.error('\n❌ ERRORE:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

// Esegui test
testPreOrdersSummary();
