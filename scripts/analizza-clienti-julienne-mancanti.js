/**
 * Analisi Clienti Mancanti - Fiordilatte Julienne
 * Usa XML-RPC nativo per connessione a Odoo con parser migliorato
 */

const ODOO_URL = 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = 'lapadevadmin-lapa-v2-main-7268478';
const ODOO_USERNAME = 'apphubplatform@lapa.ch';
const ODOO_PASSWORD = 'apphubplatform2025';

// Improved XML-RPC client
async function xmlrpcCall(endpoint, method, params) {
  const xmlBody = `<?xml version="1.0"?>
<methodCall>
  <methodName>${method}</methodName>
  <params>
${params.map(p => `    <param><value>${serializeValue(p)}</value></param>`).join('\n')}
  </params>
</methodCall>`;

  const response = await fetch(`${ODOO_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml' },
    body: xmlBody
  });

  const text = await response.text();
  return parseXmlRpcResponse(text);
}

function serializeValue(value) {
  if (value === null || value === undefined) {
    return '<boolean>0</boolean>';
  }
  if (typeof value === 'boolean') {
    return `<boolean>${value ? 1 : 0}</boolean>`;
  }
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return `<int>${value}</int>`;
    }
    return `<double>${value}</double>`;
  }
  if (typeof value === 'string') {
    return `<string>${escapeXml(value)}</string>`;
  }
  if (Array.isArray(value)) {
    return `<array><data>${value.map(v => `<value>${serializeValue(v)}</value>`).join('')}</data></array>`;
  }
  if (typeof value === 'object') {
    const members = Object.entries(value).map(([k, v]) =>
      `<member><name>${escapeXml(k)}</name><value>${serializeValue(v)}</value></member>`
    ).join('');
    return `<struct>${members}</struct>`;
  }
  return `<string>${String(value)}</string>`;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function parseXmlRpcResponse(xml) {
  // Check for fault
  if (xml.includes('<fault>')) {
    const faultMatch = xml.match(/<string>([^<]*)<\/string>/);
    throw new Error(faultMatch ? faultMatch[1] : 'XML-RPC Fault');
  }

  // Extract the params section
  const paramsMatch = xml.match(/<params>\s*([\s\S]*?)\s*<\/params>/);
  if (!paramsMatch) {
    console.log('No params found in:', xml.substring(0, 500));
    return null;
  }

  // Extract the first param value
  const paramMatch = paramsMatch[1].match(/<param>\s*<value>([\s\S]*?)<\/value>\s*<\/param>/);
  if (!paramMatch) {
    console.log('No param value found');
    return null;
  }

  return parseValueImproved(paramMatch[1]);
}

function parseValueImproved(xml) {
  xml = xml.trim();

  // Integer
  if (xml.match(/^<(?:int|i4)>/)) {
    const match = xml.match(/<(?:int|i4)>(-?\d+)<\/(?:int|i4)>/);
    return match ? parseInt(match[1], 10) : 0;
  }

  // Double
  if (xml.startsWith('<double>')) {
    const match = xml.match(/<double>(-?[\d.]+)<\/double>/);
    return match ? parseFloat(match[1]) : 0;
  }

  // Boolean
  if (xml.startsWith('<boolean>')) {
    const match = xml.match(/<boolean>([01])<\/boolean>/);
    return match ? match[1] === '1' : false;
  }

  // Nil/None
  if (xml.includes('<nil') || xml.includes('<nil/>')) {
    return null;
  }

  // String
  if (xml.startsWith('<string>')) {
    const match = xml.match(/<string>([\s\S]*?)<\/string>/);
    return match ? unescapeXml(match[1]) : '';
  }

  // Array - more careful parsing
  if (xml.startsWith('<array>')) {
    const values = [];
    // Extract data content
    const dataMatch = xml.match(/<array>\s*<data>([\s\S]*)<\/data>\s*<\/array>/);
    if (!dataMatch) return [];

    const dataContent = dataMatch[1];
    // Parse each value element at top level of data
    let depth = 0;
    let currentValue = '';
    let inValue = false;
    let i = 0;

    while (i < dataContent.length) {
      if (dataContent.substring(i, i + 7) === '<value>') {
        if (depth === 0) {
          inValue = true;
          currentValue = '';
        } else {
          currentValue += '<value>';
        }
        depth++;
        i += 7;
      } else if (dataContent.substring(i, i + 8) === '</value>') {
        depth--;
        if (depth === 0 && inValue) {
          values.push(parseValueImproved(currentValue.trim()));
          inValue = false;
          currentValue = '';
        } else {
          currentValue += '</value>';
        }
        i += 8;
      } else {
        if (inValue) currentValue += dataContent[i];
        i++;
      }
    }

    return values;
  }

  // Struct - more careful parsing
  if (xml.startsWith('<struct>')) {
    const obj = {};
    const structContent = xml.match(/<struct>([\s\S]*)<\/struct>/);
    if (!structContent) return {};

    // Find all members
    const memberRegex = /<member>\s*<name>([^<]+)<\/name>\s*<value>([\s\S]*?)<\/value>\s*<\/member>/g;
    let content = structContent[1];

    // Simple approach: find members one by one
    let memberMatch;
    let lastIndex = 0;

    while (true) {
      const nameStart = content.indexOf('<member>', lastIndex);
      if (nameStart === -1) break;

      const nameTagStart = content.indexOf('<name>', nameStart);
      const nameTagEnd = content.indexOf('</name>', nameTagStart);
      const name = content.substring(nameTagStart + 6, nameTagEnd);

      const valueTagStart = content.indexOf('<value>', nameTagEnd);
      // Find matching </value> considering nesting
      let valueDepth = 1;
      let valueEnd = valueTagStart + 7;
      while (valueDepth > 0 && valueEnd < content.length) {
        if (content.substring(valueEnd, valueEnd + 7) === '<value>') {
          valueDepth++;
          valueEnd += 7;
        } else if (content.substring(valueEnd, valueEnd + 8) === '</value>') {
          valueDepth--;
          if (valueDepth > 0) valueEnd += 8;
        } else {
          valueEnd++;
        }
      }

      const valueContent = content.substring(valueTagStart + 7, valueEnd);
      obj[name] = parseValueImproved(valueContent.trim());

      lastIndex = valueEnd + 8; // past </value>
    }

    return obj;
  }

  // Raw string (no type tags - default is string)
  if (!xml.includes('<')) {
    return xml;
  }

  // Unknown - return as string
  return xml;
}

function unescapeXml(str) {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

// Calcola settimana ISO
function getISOWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getWeekDateRange(year, weekNumber) {
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const firstThursday = new Date(jan4);
  firstThursday.setDate(jan4.getDate() - dayOfWeek + 4);
  const firstMonday = new Date(firstThursday);
  firstMonday.setDate(firstThursday.getDate() - 3);
  const weekStart = new Date(firstMonday);
  weekStart.setDate(firstMonday.getDate() + (weekNumber - 1) * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  return {
    start: weekStart.toISOString().split('T')[0],
    end: weekEnd.toISOString().split('T')[0]
  };
}

async function main() {
  console.log('='.repeat(80));
  console.log('ANALISI CLIENTI MANCANTI - FIORDILATTE JULIENNE');
  console.log('='.repeat(80));
  console.log();

  // 1. Autenticazione XML-RPC
  console.log('Connessione a Odoo via XML-RPC...');
  const uid = await xmlrpcCall('/xmlrpc/2/common', 'authenticate', [
    ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {}
  ]);

  if (!uid) {
    throw new Error('Autenticazione fallita');
  }
  console.log('Autenticazione OK - UID:', uid);

  // Helper per chiamate execute_kw
  async function execute(model, method, args, kwargs = {}) {
    return await xmlrpcCall('/xmlrpc/2/object', 'execute_kw', [
      ODOO_DB, uid, ODOO_PASSWORD, model, method, args, kwargs
    ]);
  }

  // 2. Cerca prodotti Fiordilatte Julienne
  console.log('\n1. RICERCA PRODOTTI FIORDILATTE JULIENNE...\n');

  const products = await execute(
    'product.product',
    'search_read',
    [[['name', 'ilike', 'FIORDILATTE JULIENNE']]],
    { fields: ['id', 'name', 'default_code', 'list_price'], limit: 100 }
  );

  if (!products || !Array.isArray(products)) {
    console.log('Risultato inatteso:', products);
    console.log('Provo ricerca diversa...');

    // Proviamo con solo "JULIENNE"
    const julienne = await execute(
      'product.product',
      'search_read',
      [[['name', 'ilike', 'JULIENNE']]],
      { fields: ['id', 'name'], limit: 50 }
    );
    console.log('Prodotti JULIENNE:', julienne);
    return;
  }

  console.log(`Trovati ${products.length} prodotti:\n`);
  products.forEach(p => {
    console.log(`  ID ${p.id}: ${p.name}`);
  });

  if (products.length === 0) {
    console.log('\nNessun prodotto trovato con FIORDILATTE JULIENNE.');
    // Proviamo ricerca piu ampia
    const allMozz = await execute(
      'product.product',
      'search_read',
      [[['name', 'ilike', 'MOZZARELLA']]],
      { fields: ['id', 'name'], limit: 20 }
    );
    console.log('\nProdotti MOZZARELLA:', allMozz?.length || 0);
    if (allMozz && allMozz.length > 0) {
      allMozz.forEach(p => console.log(`  ${p.id}: ${p.name}`));
    }
    return;
  }

  // Filtra i prodotti target (vaschette 2.5kg)
  const targetProducts = products.filter(p =>
    p.name && (p.name.includes('2.5KG') || p.name.includes('2,5KG') || p.name.includes('VASC'))
  );

  const productIds = targetProducts.length > 0
    ? targetProducts.map(p => p.id)
    : products.map(p => p.id);

  console.log(`\nProdotti target: ${productIds.length} (IDs: ${productIds.join(', ')})`);

  // 3. Definisci periodo - 2024 (dato che i dati sono relativi a sett 44-48 del 2024)
  const year = 2024;

  const weeks = {};
  for (let w = 44; w <= 48; w++) {
    weeks[w] = getWeekDateRange(year, w);
  }

  console.log('\n2. PERIODI DI ANALISI (anno ' + year + '):');
  Object.entries(weeks).forEach(([w, range]) => {
    console.log(`   Settimana ${w}: ${range.start} - ${range.end}`);
  });

  const startDate = weeks[44].start;
  const endDate = weeks[48].end;

  // 4. Cerca linee ordine
  console.log('\n3. RICERCA ORDINI DI VENDITA...\n');

  // Cerchiamo le linee ordine per i prodotti target
  const orderLines = await execute(
    'sale.order.line',
    'search_read',
    [[
      ['product_id', 'in', productIds],
      ['state', 'in', ['sale', 'done']]
    ]],
    {
      fields: ['id', 'product_id', 'product_uom_qty', 'price_subtotal', 'order_id'],
      limit: 5000
    }
  );

  console.log(`Linee ordine totali per prodotti Julienne: ${orderLines?.length || 0}`);

  if (!orderLines || orderLines.length === 0) {
    console.log('\nNessuna linea ordine trovata. Verifico ordini esistenti...');

    // Verifichiamo quanti ordini ci sono in generale
    const testOrders = await execute(
      'sale.order',
      'search_read',
      [[['state', 'in', ['sale', 'done']]]],
      { fields: ['id', 'name', 'date_order'], limit: 10, order: 'date_order desc' }
    );
    console.log('\nUltimi ordini:');
    if (testOrders) {
      testOrders.forEach(o => console.log(`  ${o.name}: ${o.date_order}`));
    }
    return;
  }

  // 5. Recupera info ordini
  const orderIds = [...new Set(orderLines.map(l => l.order_id[0]))];
  console.log(`Ordini unici: ${orderIds.length}`);

  const orders = await execute(
    'sale.order',
    'search_read',
    [[['id', 'in', orderIds]]],
    { fields: ['id', 'name', 'date_order', 'partner_id', 'state'], limit: 5000 }
  );

  const ordersMap = new Map(orders.map(o => [o.id, o]));

  // 6. Analizza per cliente e settimana
  console.log('\n4. ANALISI PER CLIENTE E SETTIMANA...\n');

  // Struttura: { partnerId: { name, weeks: { weekNum: { qty, revenue } } } }
  const clientData = {};
  let ordersInPeriod = 0;

  for (const line of orderLines) {
    const order = ordersMap.get(line.order_id[0]);
    if (!order || !order.date_order) continue;

    const orderDate = new Date(order.date_order);
    const weekNum = getISOWeek(orderDate);

    // Filtra solo settimane 44-48
    if (weekNum < 44 || weekNum > 48) continue;

    ordersInPeriod++;
    const partnerId = order.partner_id[0];
    const partnerName = order.partner_id[1];

    if (!clientData[partnerId]) {
      clientData[partnerId] = { name: partnerName, weeks: {} };
    }

    if (!clientData[partnerId].weeks[weekNum]) {
      clientData[partnerId].weeks[weekNum] = { qty: 0, revenue: 0 };
    }

    clientData[partnerId].weeks[weekNum].qty += line.product_uom_qty || 0;
    clientData[partnerId].weeks[weekNum].revenue += line.price_subtotal || 0;
  }

  console.log(`Ordini nel periodo settimane 44-48: ${ordersInPeriod}`);
  console.log(`Clienti unici: ${Object.keys(clientData).length}`);

  // 7. Mostra dettaglio vendite per settimana PRIMA
  console.log('\n5. DETTAGLIO VENDITE PER SETTIMANA:\n');

  const weeklyTotals = {};
  for (const line of orderLines) {
    const order = ordersMap.get(line.order_id[0]);
    if (!order || !order.date_order) continue;

    const weekNum = getISOWeek(new Date(order.date_order));
    if (weekNum < 44 || weekNum > 48) continue;

    if (!weeklyTotals[weekNum]) {
      weeklyTotals[weekNum] = { qty: 0, revenue: 0, customers: new Set() };
    }
    weeklyTotals[weekNum].qty += line.product_uom_qty || 0;
    weeklyTotals[weekNum].revenue += line.price_subtotal || 0;
    weeklyTotals[weekNum].customers.add(order.partner_id[0]);
  }

  console.log('Settimana | Quantita (kg) | Fatturato CHF | N. Clienti');
  console.log('-'.repeat(55));

  for (let w = 44; w <= 48; w++) {
    const data = weeklyTotals[w] || { qty: 0, revenue: 0, customers: new Set() };
    console.log(
      `W${w}`.padEnd(10) + '| ' +
      `${data.qty.toFixed(1)}`.padEnd(14) + '| ' +
      `${data.revenue.toFixed(2)}`.padEnd(14) + '| ' +
      data.customers.size
    );
  }

  // 8. Identifica clienti mancanti
  console.log('\n\n6. CLIENTI MANCANTI (comprato W44-46, NON W47-48):\n');
  console.log('-'.repeat(100));
  console.log(
    'Cliente'.padEnd(40) +
    'Ultima Sett.'.padEnd(12) +
    'Media Qty/Sett'.padEnd(15) +
    'Media CHF/Sett'.padEnd(15) +
    'Fatturato Perso'
  );
  console.log('-'.repeat(100));

  const clientiMancanti = [];

  for (const [partnerId, data] of Object.entries(clientData)) {
    const weekNumbers = Object.keys(data.weeks).map(Number);

    const hasEarlyWeeks = weekNumbers.some(w => w >= 44 && w <= 46);
    const hasRecentWeeks = weekNumbers.some(w => w >= 47 && w <= 48);

    if (hasEarlyWeeks && !hasRecentWeeks) {
      const earlyWeeks = weekNumbers.filter(w => w >= 44 && w <= 46);
      const lastWeek = Math.max(...earlyWeeks);

      let totalQty = 0;
      let totalRevenue = 0;

      earlyWeeks.forEach(w => {
        totalQty += data.weeks[w].qty;
        totalRevenue += data.weeks[w].revenue;
      });

      const avgQty = totalQty / earlyWeeks.length;
      const avgRevenue = totalRevenue / earlyWeeks.length;
      const fatturatoPerso = avgRevenue * 2;

      clientiMancanti.push({
        id: partnerId,
        name: data.name,
        lastWeek,
        avgQty,
        avgRevenue,
        fatturatoPerso,
        weeks: data.weeks
      });
    }
  }

  clientiMancanti.sort((a, b) => b.fatturatoPerso - a.fatturatoPerso);

  let totalFatturatoPerso = 0;

  if (clientiMancanti.length === 0) {
    console.log('Nessun cliente mancante trovato nel periodo analizzato.');
  } else {
    clientiMancanti.forEach(c => {
      const name = c.name || 'N/A';
      console.log(
        name.substring(0, 38).padEnd(40) +
        `W${c.lastWeek}`.padEnd(12) +
        `${c.avgQty.toFixed(1)} kg`.padEnd(15) +
        `CHF ${c.avgRevenue.toFixed(2)}`.padEnd(15) +
        `CHF ${c.fatturatoPerso.toFixed(2)}`
      );
      totalFatturatoPerso += c.fatturatoPerso;
    });
  }

  console.log('-'.repeat(100));
  console.log(`\nTOTALE CLIENTI MANCANTI: ${clientiMancanti.length}`);
  console.log(`FATTURATO PERSO STIMATO: CHF ${totalFatturatoPerso.toFixed(2)}`);

  // 9. Riepilogo
  console.log('\n\n' + '='.repeat(80));
  console.log('RIEPILOGO FINALE');
  console.log('='.repeat(80));

  console.log(`\nProdotti analizzati: ${productIds.length}`);
  console.log(`Clienti totali nel periodo: ${Object.keys(clientData).length}`);
  console.log(`Clienti mancanti (W47-48): ${clientiMancanti.length}`);
  console.log(`Fatturato perso stimato (2 sett.): CHF ${totalFatturatoPerso.toFixed(2)}`);

  if (clientiMancanti.length > 0) {
    console.log('\n\nTOP 10 CLIENTI DA RICONTATTARE:');
    console.log('-'.repeat(60));
    clientiMancanti.slice(0, 10).forEach((c, i) => {
      console.log(`${i+1}. ${c.name}`);
      console.log(`   Ultima settimana: W${c.lastWeek}`);
      console.log(`   Media: ${c.avgQty.toFixed(1)} kg/sett | CHF ${c.avgRevenue.toFixed(2)}/sett`);
      console.log(`   Dettaglio settimane:`, JSON.stringify(c.weeks));
    });
  }

  // 10. Mostra tutti i clienti raggruppati per comportamento
  console.log('\n\n7. TUTTI I CLIENTI - COMPORTAMENTO ACQUISTO:');
  console.log('-'.repeat(80));

  const clientiAttivi = [];
  const clientiSoloRecenti = [];

  for (const [partnerId, data] of Object.entries(clientData)) {
    const weekNumbers = Object.keys(data.weeks).map(Number);
    const hasEarlyWeeks = weekNumbers.some(w => w >= 44 && w <= 46);
    const hasRecentWeeks = weekNumbers.some(w => w >= 47 && w <= 48);

    if (hasEarlyWeeks && hasRecentWeeks) {
      clientiAttivi.push({ id: partnerId, ...data, weekNumbers });
    } else if (!hasEarlyWeeks && hasRecentWeeks) {
      clientiSoloRecenti.push({ id: partnerId, ...data, weekNumbers });
    }
  }

  console.log(`\nClienti ATTIVI (comprato sia prima che dopo): ${clientiAttivi.length}`);
  clientiAttivi.slice(0, 5).forEach(c => {
    console.log(`  - ${c.name}: settimane ${c.weekNumbers.sort((a,b)=>a-b).join(', ')}`);
  });

  console.log(`\nClienti NUOVI (solo W47-48): ${clientiSoloRecenti.length}`);
  clientiSoloRecenti.slice(0, 5).forEach(c => {
    console.log(`  - ${c.name}: settimane ${c.weekNumbers.sort((a,b)=>a-b).join(', ')}`);
  });
}

main().catch(err => {
  console.error('ERRORE:', err);
  process.exit(1);
});
