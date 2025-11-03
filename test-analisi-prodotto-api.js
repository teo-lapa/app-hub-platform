/**
 * TEST ANALISI PRODOTTO API
 *
 * Testa l'endpoint /api/analisi-prodotto
 *
 * Usage:
 * node test-analisi-prodotto-api.js
 */

const API_URL = 'http://localhost:3000/api/analisi-prodotto';

// Test parameters
const PRODUCT_NAME = 'FIORDILATTE JULIENNE TAGLIO NAPOLI';

// Optional: customize date range
const sixMonthsAgo = new Date();
sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
const DATE_FROM = sixMonthsAgo.toISOString().split('T')[0];
const DATE_TO = new Date().toISOString().split('T')[0];

console.log('\n========================================');
console.log('TEST ANALISI PRODOTTO API');
console.log('========================================\n');
console.log(`Product: ${PRODUCT_NAME}`);
console.log(`Date Range: ${DATE_FROM} to ${DATE_TO}\n`);

async function testAnalisiProdottoAPI() {
  try {
    // Build URL with query parameters
    const url = new URL(API_URL);
    url.searchParams.set('productName', PRODUCT_NAME);
    url.searchParams.set('dateFrom', DATE_FROM);
    url.searchParams.set('dateTo', DATE_TO);

    console.log('Calling API:', url.toString());
    console.log('\nWaiting for response...\n');

    const startTime = Date.now();
    const response = await fetch(url.toString());
    const endTime = Date.now();

    console.log(`Response received in ${endTime - startTime}ms`);
    console.log(`Status: ${response.status} ${response.statusText}\n`);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ ERROR:', errorData);
      return;
    }

    const data = await response.json();

    // Display results
    console.log('========================================');
    console.log('PRODUCT INFO');
    console.log('========================================');
    console.log(`ID: ${data.product.id}`);
    console.log(`Name: ${data.product.name}`);
    console.log(`Code: ${data.product.defaultCode || 'N/A'}`);
    console.log(`Barcode: ${data.product.barcode || 'N/A'}`);
    console.log(`Category: ${data.product.category}`);
    console.log(`\nPRICES:`);
    console.log(`  List Price: CHF ${data.product.listPrice.toFixed(2)}`);
    console.log(`  Standard Price: CHF ${data.product.standardPrice.toFixed(2)}`);
    console.log(`  Theoretical Margin: ${data.product.theoreticalMargin.toFixed(2)}%`);
    console.log(`\nSTOCK:`);
    console.log(`  Available: ${data.product.qtyAvailable} ${data.product.uom}`);
    console.log(`  Virtual: ${data.product.virtualAvailable} ${data.product.uom}`);
    console.log(`  Incoming: ${data.product.incomingQty} ${data.product.uom}`);
    console.log(`  Outgoing: ${data.product.outgoingQty} ${data.product.uom}`);

    console.log('\n========================================');
    console.log('SUPPLIERS');
    console.log('========================================');
    if (data.suppliers.length > 0) {
      data.suppliers.forEach((s, i) => {
        console.log(`\n${i + 1}. ${s.partnerName}`);
        console.log(`   Price: CHF ${s.price.toFixed(2)}`);
        console.log(`   Min Qty: ${s.minQty}`);
        console.log(`   Lead Time: ${s.delay} days`);
        console.log(`   Code: ${s.productCode || 'N/A'}`);
      });
    } else {
      console.log('No suppliers configured');
    }

    console.log('\n========================================');
    console.log('STATISTICS (Period: ${data.period.dateFrom} to ${data.period.dateTo})');
    console.log('========================================');
    console.log(`\nPURCHASES:`);
    console.log(`  Total Purchased: ${data.statistics.totalPurchased.toFixed(2)} ${data.product.uom}`);
    console.log(`  Total Received: ${data.statistics.totalReceived.toFixed(2)} ${data.product.uom}`);
    console.log(`  Total Cost: CHF ${data.statistics.totalPurchaseCost.toFixed(2)}`);
    console.log(`  Average Price: CHF ${data.statistics.avgPurchasePrice.toFixed(2)}`);
    console.log(`\nSALES:`);
    console.log(`  Total Sold: ${data.statistics.totalSold.toFixed(2)} ${data.product.uom}`);
    console.log(`  Total Delivered: ${data.statistics.totalDelivered.toFixed(2)} ${data.product.uom}`);
    console.log(`  Total Revenue: CHF ${data.statistics.totalRevenue.toFixed(2)}`);
    console.log(`  Average Price: CHF ${data.statistics.avgSalePrice.toFixed(2)}`);
    console.log(`\nPERFORMANCE:`);
    console.log(`  Profit: CHF ${data.statistics.profit.toFixed(2)}`);
    console.log(`  Margin: ${data.statistics.marginPercent.toFixed(2)}%`);
    console.log(`  ROI: ${data.statistics.roi.toFixed(2)}%`);
    console.log(`\nROTATION:`);
    console.log(`  Monthly Avg Sales: ${data.statistics.monthlyAvgSales.toFixed(2)} ${data.product.uom}`);
    console.log(`  Weekly Avg Sales: ${data.statistics.weeklyAvgSales.toFixed(2)} ${data.product.uom}`);
    console.log(`  Days of Coverage: ${data.statistics.daysOfCoverage.toFixed(1)} days`);

    console.log('\n========================================');
    console.log('TOP SUPPLIERS');
    console.log('========================================');
    if (data.topSuppliers.length > 0) {
      data.topSuppliers.forEach((s, i) => {
        console.log(`\n${i + 1}. ${s.supplierName}`);
        console.log(`   Orders: ${s.orders}`);
        console.log(`   Quantity: ${s.qty.toFixed(2)} ${data.product.uom}`);
        console.log(`   Cost: CHF ${s.cost.toFixed(2)}`);
        console.log(`   Avg Price: CHF ${s.avgPrice.toFixed(2)}`);
      });
    } else {
      console.log('No suppliers found');
    }

    console.log('\n========================================');
    console.log('TOP 10 CUSTOMERS');
    console.log('========================================');
    if (data.topCustomers.length > 0) {
      data.topCustomers.forEach((c, i) => {
        console.log(`\n${i + 1}. ${c.customerName}`);
        console.log(`   Orders: ${c.orders}`);
        console.log(`   Quantity: ${c.qty.toFixed(2)} ${data.product.uom}`);
        console.log(`   Revenue: CHF ${c.revenue.toFixed(2)}`);
        console.log(`   Avg Price: CHF ${c.avgPrice.toFixed(2)}`);
      });
    } else {
      console.log('No customers found');
    }

    console.log('\n========================================');
    console.log('REORDER SUGGESTION');
    console.log('========================================');
    console.log(`Reorder Point: ${data.reorderSuggestion.reorderPoint.toFixed(0)} ${data.product.uom}`);
    console.log(`Safety Stock: ${data.reorderSuggestion.safetyStock.toFixed(0)} ${data.product.uom}`);
    console.log(`Optimal Order Qty: ${data.reorderSuggestion.optimalOrderQty.toFixed(0)} ${data.product.uom}`);
    console.log(`Current Stock: ${data.reorderSuggestion.currentStock.toFixed(0)} ${data.product.uom}`);
    console.log(`Lead Time: ${data.reorderSuggestion.leadTime} days`);
    console.log(`\nAction Required: ${data.reorderSuggestion.actionRequired ? 'YES' : 'NO'}`);
    console.log(`Message: ${data.reorderSuggestion.actionMessage}`);

    console.log('\n========================================');
    console.log('ORDERS DETAIL');
    console.log('========================================');
    console.log(`Purchase Orders: ${data.purchaseOrders.length}`);
    console.log(`Sale Orders: ${data.saleOrders.length}`);

    // Sample purchase orders (first 5)
    if (data.purchaseOrders.length > 0) {
      console.log('\nSample Purchase Orders (first 5):');
      data.purchaseOrders.slice(0, 5).forEach((po, i) => {
        console.log(`\n  ${i + 1}. ${po.orderName} - ${po.supplierName}`);
        console.log(`     Date: ${po.dateOrder}`);
        console.log(`     Qty: ${po.productQty} | Received: ${po.qtyReceived}`);
        console.log(`     Price: CHF ${po.priceUnit.toFixed(2)} | Total: CHF ${po.priceSubtotal.toFixed(2)}`);
        console.log(`     State: ${po.state}`);
      });
      if (data.purchaseOrders.length > 5) {
        console.log(`\n  ... and ${data.purchaseOrders.length - 5} more`);
      }
    }

    // Sample sale orders (first 5)
    if (data.saleOrders.length > 0) {
      console.log('\nSample Sale Orders (first 5):');
      data.saleOrders.slice(0, 5).forEach((so, i) => {
        console.log(`\n  ${i + 1}. ${so.orderName} - ${so.customerName}`);
        console.log(`     Date: ${so.createDate}`);
        console.log(`     Qty: ${so.productQty} | Delivered: ${so.qtyDelivered}`);
        console.log(`     Price: CHF ${so.priceUnit.toFixed(2)} | Total: CHF ${so.priceSubtotal.toFixed(2)}`);
        console.log(`     State: ${so.state}`);
      });
      if (data.saleOrders.length > 5) {
        console.log(`\n  ... and ${data.saleOrders.length - 5} more`);
      }
    }

    console.log('\n========================================');
    console.log('✅ TEST COMPLETED SUCCESSFULLY');
    console.log('========================================\n');

    // Save to JSON file
    const fs = require('fs');
    const outputFile = 'analisi-prodotto-api-result.json';
    fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));
    console.log(`Full response saved to: ${outputFile}\n`);

  } catch (error) {
    console.error('\n❌ TEST FAILED');
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testAnalisiProdottoAPI();
