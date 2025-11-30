const https = require('https');

https.get('https://staging.hub.lapa.ch/api/controllo-prezzi/aggregate', {
  headers: { 'Cookie': 'frontend_lang=it_IT' }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);

    console.log('\n=== ANALISI SOTTO PUNTO CRITICO ===\n');
    console.log('Total products:', json.stats.total_products);
    console.log('Sotto PC (totale):', json.stats.sotto_pc);

    const sottoPcProducts = json.products.filter(p => p.category === 'sotto_pc');
    const sottoPcNotLocked = sottoPcProducts.filter(p => !p.isLocked);
    const sottoPcLocked = sottoPcProducts.filter(p => p.isLocked);

    console.log('Sotto PC NON locked:', sottoPcNotLocked.length);
    console.log('Sotto PC locked:', sottoPcLocked.length);

    if (sottoPcNotLocked.length > 0) {
      console.log('\n=== PRODOTTI SOTTO PC (NON LOCKED) ===\n');
      sottoPcNotLocked.forEach(p => {
        const margin = ((p.currentPriceUnit - p.costPrice) / p.currentPriceUnit * 100).toFixed(1);
        console.log(`${p.productName}`);
        console.log(`  Order: ${p.orderName} | Customer: ${p.customerName}`);
        console.log(`  Price: ${p.currentPriceUnit} | Cost: ${p.costPrice} | Critical: ${p.criticalPoint.toFixed(2)}`);
        console.log(`  Margin: ${margin}% | Locked: ${p.isLocked}`);
        console.log('');
      });
    }

    if (sottoPcLocked.length > 0) {
      console.log('\n=== PRODOTTI SOTTO PC (LOCKED - da escludere) ===\n');
      sottoPcLocked.forEach(p => {
        console.log(`${p.productName} - Order: ${p.orderName}`);
      });
    }
  });
}).on('error', err => console.error('Error:', err));
