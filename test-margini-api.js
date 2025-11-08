/**
 * TEST SCRIPT - API Margini
 *
 * Testa l'endpoint /api/margini in vari scenari
 *
 * Usage:
 *   node test-margini-api.js
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Colori per output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testEndpoint(testName, url, expectedFields = []) {
  console.log('\n' + '='.repeat(80));
  log('cyan', `TEST: ${testName}`);
  log('blue', `URL: ${url}`);
  console.log('='.repeat(80));

  try {
    const startTime = Date.now();
    const response = await fetch(url);
    const duration = Date.now() - startTime;

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    log('green', `✅ SUCCESS (${duration}ms)`);

    // Verifica campi attesi
    if (expectedFields.length > 0) {
      console.log('\nVerifica campi obbligatori:');
      expectedFields.forEach(field => {
        const exists = field.split('.').reduce((obj, key) => obj?.[key], data) !== undefined;
        const icon = exists ? '✅' : '❌';
        const color = exists ? 'green' : 'red';
        log(color, `  ${icon} ${field}`);
      });
    }

    // Stampa summary
    if (data.summary) {
      console.log('\n📊 SUMMARY:');
      console.log(`   Fatturato:  €${data.summary.totalRevenue?.toFixed(2)}`);
      console.log(`   Costo:      €${data.summary.totalCost?.toFixed(2)}`);
      console.log(`   Margine:    €${data.summary.totalMargin?.toFixed(2)} (${data.summary.marginPercentage?.toFixed(2)}%)`);
      console.log(`   Ordini:     ${data.summary.orderCount}`);
      console.log(`   Prodotti:   ${data.summary.productCount}`);
      console.log(`   Periodo:    ${data.summary.period?.startDate} - ${data.summary.period?.endDate}`);
    }

    // Stampa top products
    if (data.topProducts && data.topProducts.length > 0) {
      console.log('\n🏆 TOP 3 PRODUCTS:');
      data.topProducts.slice(0, 3).forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.name} (${p.defaultCode})`);
        console.log(`      Margine: €${p.totalMargin?.toFixed(2)} (${p.marginPercentage?.toFixed(2)}%)`);
        console.log(`      Venduti: ${p.quantitySold} unità`);
      });
    }

    // Stampa prodotti in perdita
    if (data.lossProducts && data.lossProducts.length > 0) {
      console.log('\n📉 PRODOTTI IN PERDITA:');
      data.lossProducts.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.name} (${p.defaultCode})`);
        console.log(`      Margine: €${p.totalMargin?.toFixed(2)} (${p.marginPercentage?.toFixed(2)}%)`);
      });
    } else if (data.lossProducts) {
      log('green', '\n✅ Nessun prodotto in perdita!');
    }

    // Stampa prodotti regalati
    if (data.giftsGiven) {
      console.log('\n🎁 PRODOTTI REGALATI:');
      console.log(`   Totale costo: €${data.giftsGiven.totalCost?.toFixed(2)}`);
      console.log(`   Numero prodotti: ${data.giftsGiven.productCount}`);

      if (data.giftsGiven.products && data.giftsGiven.products.length > 0) {
        console.log('\n   Top 3 regali:');
        data.giftsGiven.products.slice(0, 3).forEach((g, i) => {
          console.log(`     ${i + 1}. ${g.name} (${g.defaultCode})`);
          console.log(`        Quantità: ${g.quantity}, Costo: €${g.cost?.toFixed(2)}`);
          console.log(`        Ordine: ${g.orderName}, Data: ${g.date}`);
        });
      }

      if (data.giftsGiven.byCustomer && data.giftsGiven.byCustomer.length > 0) {
        console.log('\n   Per cliente (top 3):');
        data.giftsGiven.byCustomer.slice(0, 3).forEach((c, i) => {
          console.log(`     ${i + 1}. ${c.customerName}`);
          console.log(`        Costo totale regali: €${c.totalCost?.toFixed(2)}`);
          console.log(`        Numero prodotti: ${c.products?.length}`);
        });
      }
    }

    // Stampa trends
    if (data.trends && data.trends.length > 0) {
      console.log('\n📈 TRENDS (primi 3 giorni):');
      data.trends.slice(0, 3).forEach(t => {
        console.log(`   ${t.date}: €${t.revenue?.toFixed(2)} revenue, €${t.margin?.toFixed(2)} margin, ${t.orders} ordini`);
      });
    }

    // Stampa grouped data
    if (data.groupedData) {
      console.log(`\n📊 GROUPED BY ${data.groupedData.groupBy.toUpperCase()} (top 5):`);
      data.groupedData.groups.slice(0, 5).forEach((g, i) => {
        console.log(`   ${i + 1}. ${g.name}`);
        console.log(`      Revenue: €${g.revenue?.toFixed(2)}, Margin: €${g.margin?.toFixed(2)} (${g.marginPercentage?.toFixed(2)}%)`);
        console.log(`      Prodotti: ${g.productCount}`);
      });
    }

    return { success: true, data, duration };

  } catch (error) {
    log('red', `❌ FAILED: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('\n');
  log('cyan', '╔═══════════════════════════════════════════════════════════════════════╗');
  log('cyan', '║              TEST SUITE - API MARGINI                                 ║');
  log('cyan', '╚═══════════════════════════════════════════════════════════════════════╝');

  const tests = [
    {
      name: 'Default (mese corrente)',
      url: `${BASE_URL}/api/margini`,
      expectedFields: [
        'summary',
        'summary.totalRevenue',
        'summary.totalCost',
        'summary.totalMargin',
        'summary.marginPercentage',
        'summary.orderCount',
        'summary.productCount',
        'topProducts',
        'lossProducts',
        'giftsGiven',
        'trends'
      ]
    },
    {
      name: 'Ottobre 2025',
      url: `${BASE_URL}/api/margini?startDate=2025-10-01&endDate=2025-10-31`,
      expectedFields: [
        'summary',
        'topProducts',
        'lossProducts',
        'giftsGiven',
        'trends'
      ]
    },
    {
      name: 'Ultimi 7 giorni',
      url: `${BASE_URL}/api/margini?startDate=${getDateDaysAgo(7)}&endDate=${getDateDaysAgo(0)}`,
      expectedFields: [
        'summary',
        'topProducts'
      ]
    },
    {
      name: 'Raggruppamento per categoria',
      url: `${BASE_URL}/api/margini?startDate=2025-10-01&endDate=2025-10-31&groupBy=category`,
      expectedFields: [
        'summary',
        'topProducts',
        'groupedData',
        'groupedData.groupBy',
        'groupedData.groups'
      ]
    },
    {
      name: 'Raggruppamento per prodotto',
      url: `${BASE_URL}/api/margini?startDate=2025-10-01&endDate=2025-10-31&groupBy=product`,
      expectedFields: [
        'summary',
        'topProducts',
        'groupedData'
      ]
    }
  ];

  const results = [];

  for (const test of tests) {
    const result = await testEndpoint(test.name, test.url, test.expectedFields);
    results.push({ name: test.name, ...result });
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s between tests
  }

  // Summary
  console.log('\n\n');
  log('cyan', '╔═══════════════════════════════════════════════════════════════════════╗');
  log('cyan', '║                           TEST SUMMARY                                ║');
  log('cyan', '╚═══════════════════════════════════════════════════════════════════════╝');
  console.log('');

  let successCount = 0;
  let failCount = 0;

  results.forEach(r => {
    if (r.success) {
      successCount++;
      log('green', `✅ ${r.name} (${r.duration}ms)`);
    } else {
      failCount++;
      log('red', `❌ ${r.name}: ${r.error}`);
    }
  });

  console.log('\n' + '='.repeat(80));
  log('cyan', `Total Tests: ${results.length}`);
  log('green', `Passed: ${successCount}`);
  if (failCount > 0) {
    log('red', `Failed: ${failCount}`);
  }
  console.log('='.repeat(80) + '\n');

  process.exit(failCount > 0 ? 1 : 0);
}

function getDateDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

// Run tests
runTests().catch(error => {
  log('red', `Fatal error: ${error.message}`);
  process.exit(1);
});
