const https = require('https');

// Call aggregate API to get all products
https.get('https://staging.hub.lapa.ch/api/controllo-prezzi/aggregate', {
  headers: { 'Cookie': 'frontend_lang=it_IT' }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);

    const sottoPc = json.products.filter(p => p.category === 'sotto_pc' && !p.isLocked);

    console.log('\n=== PRODOTTI SOTTO PC (aggregate) ===');
    console.log('Total sotto PC:', sottoPc.length);

    if (sottoPc.length > 0) {
      const p = sottoPc[0];
      console.log('\nProduct ID:', p.productId);
      console.log('Order ID:', p.orderId);
      console.log('Order Name:', p.orderName);
      console.log('Product Name:', p.productName.substring(0, 50));
      console.log('Price:', p.currentPriceUnit);
      console.log('Cost:', p.costPrice);
      console.log('Critical:', p.criticalPoint);
      console.log('isLocked:', p.isLocked);

      // Now fetch the review status for this product
      const baseUrl = 'https://staging.hub.lapa.ch';
      const productsUrl = `${baseUrl}/api/controllo-prezzi/products?category=below_critical&days=0`;

      console.log('\n=== CALLING PRODUCTS API (days=0) ===');
      https.get(productsUrl, {
        headers: { 'Cookie': 'frontend_lang=it_IT' }
      }, (res2) => {
        let data2 = '';
        res2.on('data', chunk => data2 += chunk);
        res2.on('end', () => {
          const json2 = JSON.parse(data2);
          console.log('Products API success:', json2.success);
          console.log('Products count:', json2.products?.length || 0);

          if (json2.products && json2.products.length > 0) {
            const p2 = json2.products[0];
            console.log('\n=== FIRST PRODUCT FROM API ===');
            console.log('Product ID:', p2.id);
            console.log('Order ID:', p2.orderId);
            console.log('Name:', p2.name.substring(0, 50));
            console.log('Price:', p2.soldPrice);
            console.log('isLocked:', p2.isLocked);
            console.log('status:', p2.status);
          } else {
            console.log('\n❌ NO PRODUCTS RETURNED - Checking why...');
            console.log('Expected product ID:', p.productId);
            console.log('Expected order ID:', p.orderId);
            console.log('Expected isLocked:', p.isLocked);
            console.log('\nPossible reasons:');
            console.log('1. Product status = "reviewed"');
            console.log('2. Product isLocked = true');
            console.log('3. Bug in API filter logic');
          }
        });
      }).on('error', err => console.error('Error calling products API:', err));
    }
  });
}).on('error', err => console.error('Error:', err));
