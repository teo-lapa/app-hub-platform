const https = require('https');

// Check order S34856 state
const url = 'https://staging.hub.lapa.ch/api/controllo-prezzi/aggregate';

https.get(url, {
  headers: { 'Cookie': 'frontend_lang=it_IT' }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);

    console.log('\n=== VERIFICA STATO ORDINI ===\n');
    console.log('Total orders fetched:', json.stats?.total_orders || 0);
    console.log('Total products:', json.stats?.total_products || 0);

    // Find order S34856
    const targetOrders = ['S34856', 'S34855', 'S34854', 'S34853', 'S34852'];

    console.log('\n=== ORDINI RECENTI (ultimi 5) ===\n');

    const ordersFound = new Set();
    for (const product of json.products || []) {
      if (targetOrders.includes(product.orderName) && !ordersFound.has(product.orderName)) {
        ordersFound.add(product.orderName);
        console.log(`Order: ${product.orderName} (ID: ${product.orderId})`);
        console.log(`  Date: ${product.orderDate}`);
        console.log(`  Customer: ${product.customerName}`);
        console.log(`  Sample product: ${product.productName.substring(0, 50)}...`);
        console.log('');

        if (ordersFound.size >= 5) break;
      }
    }

    console.log('\n=== CONCLUSIONE ===');
    console.log('Se vedi ordini con numero S34xxx molto alto (es. S34856),');
    console.log('significa che l\'API sta fetchando ORDINI CONFERMATI recenti.');
    console.log('I preventivi hanno numeri più bassi tipo S00xxx o S01xxx.');
    console.log('\nSe vedi date 2025-11-15 o 2025-11-14, sono ordini confermati di questi giorni.');
  });
}).on('error', err => console.error('Error:', err));
