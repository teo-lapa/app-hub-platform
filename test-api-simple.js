const fetch = require('node-fetch');

// Test semplice dell'API
fetch('http://localhost:3003/api/inventory/search-furgoni-locations', {
  headers: {
    'Cookie': 'odoo_session_id=test' // userà la sessione dal browser
  }
})
.then(r => r.json())
.then(data => {
  console.log('\n📊 RISULTATI API:\n');
  console.log('Success:', data.success);
  console.log('Locations:', data.locations?.length || 0);

  if (data.locations && data.locations.length > 0) {
    const loc = data.locations[0];
    console.log('\nPrima ubicazione:', loc.name);
    console.log('Prodotti:', loc.products.length);

    if (loc.products.length > 0) {
      const prod = loc.products[0];
      console.log('\nPrimo prodotto:', prod.productName);
      console.log('Lotto:', prod.lotName);
      console.log('Orders:', prod.orders ? prod.orders.length : 0);

      if (prod.orders && prod.orders.length > 0) {
        console.log('\n✅ ORDINI TROVATI:');
        prod.orders.forEach((o, i) => {
          console.log(`\n${i+1}. ${o.orderName}`);
          console.log(`   Cliente: ${o.customerName}`);
          console.log(`   Data: ${o.deliveryDate}`);
          console.log(`   Qty: ${o.quantity}`);
        });
      } else {
        console.log('\n❌ NESSUN ORDINE TROVATO per questo prodotto');
        console.log('Struttura prodotto completa:');
        console.log(JSON.stringify(prod, null, 2));
      }
    }
  }
})
.catch(err => console.error('Errore:', err));
