const https = require('https');

// Verifica quali campi ha l'ordine S34848 (la mozzarella) per capire se è preventivo o ordine
const body = JSON.stringify({
  jsonrpc: '2.0',
  method: 'call',
  params: {
    service: 'object',
    method: 'execute',
    args: [
      'lapadevadmin-lapa-v2-staging-2406-25408900',
      2,
      'lapa201180',
      'sale.order',
      'search_read',
      [['name', '=', 'S34848']],
      ['id', 'name', 'state', 'date_order', 'commitment_date', 'delivery_status',
       'picking_ids', 'invoice_status', 'amount_total', 'type_name']
    ]
  }
});

const req = https.request({
  hostname: 'lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com',
  port: 443,
  path: '/jsonrpc',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': body.length
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    console.log('\n=== ORDER S34848 (MOZZARELLA) ===\n');
    console.log(JSON.stringify(json.result, null, 2));
  });
});

req.on('error', err => console.error('Error:', err));
req.write(body);
req.end();
