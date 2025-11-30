// find-dormant-customers.js
// Trova clienti dormienti: hanno ordinato negli ultimi 3 mesi ma NON nell'ultimo mese

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Configurazione Odoo
const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_LOGIN = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

let sessionId = null;
let uid = null;

async function authenticate() {
  console.log('🔐 Autenticazione con Odoo...');

  const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      params: {
        db: ODOO_DB,
        login: ODOO_LOGIN,
        password: ODOO_PASSWORD
      }
    })
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`Auth error: ${data.error.data?.message || data.error.message}`);
  }

  if (!data.result?.uid) {
    throw new Error('No UID in response');
  }

  const setCookie = response.headers.get('set-cookie');
  const sessionMatch = setCookie?.match(/session_id=([^;]+)/);

  if (!sessionMatch) {
    throw new Error('No session_id in response');
  }

  sessionId = sessionMatch[1];
  uid = data.result.uid;
  console.log(`✅ Autenticato! UID: ${uid}\n`);
}

async function searchRead(model, domain, fields, limit = 0, order = '') {
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_id=${sessionId}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model,
        method: 'search_read',
        args: [domain],
        kwargs: { fields, limit, order }
      }
    })
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(`RPC error: ${data.error.data?.message || data.error.message}`);
  }
  return data.result;
}

async function main() {
  try {
    await authenticate();

    // Date
    const today = new Date();
    const oneMonthAgo = new Date(today);
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const threeMonthsAgo = new Date(today);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const todayStr = today.toISOString().split('T')[0];
    const oneMonthAgoStr = oneMonthAgo.toISOString().split('T')[0];
    const threeMonthsAgoStr = threeMonthsAgo.toISOString().split('T')[0];

    console.log(`📅 Oggi: ${todayStr}`);
    console.log(`📅 1 mese fa: ${oneMonthAgoStr}`);
    console.log(`📅 3 mesi fa: ${threeMonthsAgoStr}\n`);

    // 1. Carica clienti con coordinate
    console.log('📍 Caricamento clienti con coordinate...');
    const customers = await searchRead(
      'res.partner',
      [
        ['is_company', '=', true],
        ['partner_latitude', '!=', false],
        ['partner_latitude', '!=', 0],
        ['partner_longitude', '!=', false],
        ['partner_longitude', '!=', 0]
      ],
      ['id', 'name', 'display_name', 'email', 'phone', 'create_date'],
      0,
      'name asc'
    );
    console.log(`✅ Trovati ${customers.length} clienti con coordinate\n`);

    const customerIds = customers.map(c => c.id);
    const customerMap = {};
    customers.forEach(c => { customerMap[c.id] = c; });

    // 2. Ordini ultimi 3 MESI
    console.log('📊 Caricamento ordini ultimi 3 MESI...');
    const orders3Months = await searchRead(
      'sale.order',
      [
        ['partner_id', 'in', customerIds],
        ['state', 'in', ['sale', 'done']],
        ['date_order', '>=', threeMonthsAgoStr]
      ],
      ['partner_id', 'amount_total', 'date_order'],
      0,
      'date_order desc'
    );
    console.log(`✅ Trovati ${orders3Months.length} ordini negli ultimi 3 mesi\n`);

    // 3. Ordini ULTIMO MESE
    console.log('📊 Caricamento ordini ULTIMO MESE...');
    const orders1Month = await searchRead(
      'sale.order',
      [
        ['partner_id', 'in', customerIds],
        ['state', 'in', ['sale', 'done']],
        ['date_order', '>=', oneMonthAgoStr]
      ],
      ['partner_id', 'amount_total', 'date_order'],
      0,
      'date_order desc'
    );
    console.log(`✅ Trovati ${orders1Month.length} ordini nell'ultimo mese\n`);

    // 4. Raggruppa per cliente
    const clients3Months = new Map(); // ID -> { orders, total, lastDate }
    const clients1Month = new Set(); // ID di chi ha ordinato ultimo mese

    for (const order of orders3Months) {
      const partnerId = order.partner_id[0];
      if (!clients3Months.has(partnerId)) {
        clients3Months.set(partnerId, {
          orders: 0,
          total: 0,
          lastDate: null,
          orderDates: []
        });
      }
      const client = clients3Months.get(partnerId);
      client.orders += 1;
      client.total += order.amount_total || 0;
      const orderDate = order.date_order?.split(' ')[0];
      client.orderDates.push(orderDate);
      if (!client.lastDate || orderDate > client.lastDate) {
        client.lastDate = orderDate;
      }
    }

    for (const order of orders1Month) {
      clients1Month.add(order.partner_id[0]);
    }

    console.log('═'.repeat(80));
    console.log(`📈 CLIENTI ATTIVI ULTIMI 3 MESI: ${clients3Months.size}`);
    console.log(`📈 CLIENTI ATTIVI ULTIMO MESE: ${clients1Month.size}`);
    console.log(`🔴 CLIENTI DORMIENTI (3m ma non 1m): ${clients3Months.size - clients1Month.size}`);
    console.log('═'.repeat(80));
    console.log('');

    // 5. Trova clienti dormienti
    const dormantCustomers = [];

    for (const [partnerId, data] of clients3Months.entries()) {
      if (!clients1Month.has(partnerId)) {
        // Questo cliente ha ordinato negli ultimi 3 mesi ma NON nell'ultimo mese
        const customer = customerMap[partnerId];
        if (customer) {
          dormantCustomers.push({
            id: partnerId,
            name: customer.display_name || customer.name,
            email: customer.email || '-',
            phone: customer.phone || '-',
            createDate: customer.create_date?.split(' ')[0] || '-',
            lastOrderDate: data.lastDate,
            orderCount3m: data.orders,
            invoiced3m: data.total,
            daysSinceLastOrder: Math.floor((today - new Date(data.lastDate)) / (1000 * 60 * 60 * 24))
          });
        }
      }
    }

    // Ordina per fatturato decrescente
    dormantCustomers.sort((a, b) => b.invoiced3m - a.invoiced3m);

    // 6. Stampa risultati
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════════════════════════════════════════╗');
    console.log('║  🔴 CLIENTI DORMIENTI - Hanno ordinato 1-3 mesi fa, ma NON nell\'ultimo mese                   ║');
    console.log('║  Questi clienti sono a RISCHIO PERDITA - contattarli prioritariamente!                        ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════════════════════════╝');
    console.log('');

    if (dormantCustomers.length === 0) {
      console.log('✅ Nessun cliente dormiente! Tutti i clienti degli ultimi 3 mesi hanno ordinato anche nell\'ultimo mese.');
    } else {
      console.log(`Trovati ${dormantCustomers.length} clienti dormienti:\n`);

      // Header
      console.log(
        '#'.padStart(3) + ' | ' +
        'CLIENTE'.padEnd(45) + ' | ' +
        'ULTIMO ORDINE'.padEnd(14) + ' | ' +
        'GIORNI'.padEnd(7) + ' | ' +
        'ORD.'.padEnd(5) + ' | ' +
        'FATTURATO 3M'.padEnd(14) + ' | ' +
        'TELEFONO'.padEnd(20) + ' | ' +
        'CLIENTE DAL'
      );
      console.log('-'.repeat(150));

      let totalFatturato = 0;
      let i = 1;

      for (const c of dormantCustomers) {
        totalFatturato += c.invoiced3m;
        console.log(
          String(i).padStart(3) + ' | ' +
          c.name.substring(0, 45).padEnd(45) + ' | ' +
          c.lastOrderDate.padEnd(14) + ' | ' +
          String(c.daysSinceLastOrder).padEnd(7) + ' | ' +
          String(c.orderCount3m).padEnd(5) + ' | ' +
          `CHF ${c.invoiced3m.toFixed(0).padStart(10)}` + ' | ' +
          (c.phone || '-').substring(0, 20).padEnd(20) + ' | ' +
          c.createDate
        );
        i++;
      }

      console.log('-'.repeat(150));
      console.log(`\n📊 TOTALE FATTURATO A RISCHIO: CHF ${totalFatturato.toFixed(2)}`);
      console.log(`📊 FATTURATO MEDIO PER CLIENTE: CHF ${(totalFatturato / dormantCustomers.length).toFixed(2)}`);
    }

    // Salva JSON
    const fs = require('fs');
    fs.writeFileSync('dormant-customers.json', JSON.stringify(dormantCustomers, null, 2));
    console.log('\n💾 Dati salvati in: dormant-customers.json\n');

  } catch (error) {
    console.error('❌ ERRORE:', error.message);
    process.exit(1);
  }
}

main();
