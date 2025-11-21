/**
 * Test Lead Time Integration
 *
 * Verifica che i lead time vengano letti correttamente da Odoo product.supplierinfo
 * e confronta con i valori nel database supplier_avatars
 */

import { sql } from '@vercel/postgres';

const ODOO_URL = process.env.ODOO_URL;
const ODOO_DB = process.env.ODOO_DB;
const ODOO_USERNAME = process.env.ODOO_ADMIN_EMAIL;
const ODOO_PASSWORD = process.env.ODOO_ADMIN_PASSWORD;

interface SupplierLeadTimeData {
  supplierId: number;
  supplierName: string;
  odooAvgDelay: number;
  odooMinDelay: number;
  odooMaxDelay: number;
  productCount: number;
  dbLeadTime: number | null;
}

/**
 * Authenticate with Odoo
 */
async function authenticateOdoo(): Promise<number> {
  const response = await fetch(`${ODOO_URL}/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        service: 'common',
        method: 'authenticate',
        args: [ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD, {}]
      },
      id: Math.floor(Math.random() * 1000000)
    })
  });

  const data = await response.json();
  if (!data.result) throw new Error('Autenticazione fallita');
  return data.result;
}

/**
 * Get supplier lead time from Odoo
 */
async function getSupplierLeadTimeFromOdoo(
  uid: number,
  supplierId: number,
  supplierName: string
): Promise<SupplierLeadTimeData | null> {
  try {
    // Query product.supplierinfo for this supplier
    const response = await fetch(`${ODOO_URL}/jsonrpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          service: 'object',
          method: 'execute_kw',
          args: [
            ODOO_DB,
            uid,
            ODOO_PASSWORD,
            'product.supplierinfo',
            'search_read',
            [[['partner_id', '=', supplierId]]],
            {
              fields: ['partner_id', 'product_tmpl_id', 'delay', 'price'],
              limit: 1000
            }
          ]
        },
        id: Math.floor(Math.random() * 1000000)
      })
    });

    const data = await response.json();
    if (!data.result || data.result.length === 0) return null;

    const supplierInfos = data.result;

    // Calculate statistics
    const delays = supplierInfos
      .map((info: any) => info.delay || 0)
      .filter((d: number) => d > 0);

    if (delays.length === 0) return null;

    const avgDelay = Math.round(delays.reduce((sum: number, d: number) => sum + d, 0) / delays.length);
    const minDelay = Math.min(...delays);
    const maxDelay = Math.max(...delays);

    return {
      supplierId,
      supplierName,
      odooAvgDelay: avgDelay,
      odooMinDelay: minDelay,
      odooMaxDelay: maxDelay,
      productCount: delays.length,
      dbLeadTime: null // Will be filled later
    };

  } catch (error) {
    console.error(`Error fetching lead time for ${supplierName}:`, error);
    return null;
  }
}

/**
 * Main test function
 */
async function testLeadTimeIntegration() {
  console.log('🚚 Test Lead Time Integration\n');
  console.log('='.repeat(80));

  try {
    // 1. Authenticate with Odoo
    console.log('\n1️⃣ Authenticating with Odoo...');
    const uid = await authenticateOdoo();
    console.log(`✅ Authenticated with UID: ${uid}`);

    // 2. Get top 10 active suppliers from database
    console.log('\n2️⃣ Loading active suppliers from database...');
    const dbSuppliers = await sql`
      SELECT odoo_supplier_id, name, average_lead_time_days, cadence_value
      FROM supplier_avatars
      WHERE is_active = true
      ORDER BY cadence_value ASC
      LIMIT 10
    `;

    console.log(`✅ Found ${dbSuppliers.rows.length} active suppliers in DB`);

    // 3. For each supplier, get lead time from Odoo and compare
    console.log('\n3️⃣ Comparing Odoo lead times with DB values...\n');

    const results: SupplierLeadTimeData[] = [];

    for (const supplier of dbSuppliers.rows) {
      const odooData = await getSupplierLeadTimeFromOdoo(
        uid,
        supplier.odoo_supplier_id,
        supplier.name
      );

      if (odooData) {
        odooData.dbLeadTime = supplier.average_lead_time_days;
        results.push(odooData);
      }
    }

    // 4. Print comparison table
    console.log('📊 Lead Time Comparison:');
    console.log('-'.repeat(120));
    console.log(
      'Supplier'.padEnd(35) +
      '| Products'.padEnd(12) +
      '| Odoo Avg'.padEnd(12) +
      '| Odoo Min'.padEnd(12) +
      '| Odoo Max'.padEnd(12) +
      '| DB Value'.padEnd(12) +
      '| Match?'
    );
    console.log('-'.repeat(120));

    let matchCount = 0;
    let mismatchCount = 0;

    for (const result of results) {
      const match = result.odooAvgDelay === result.dbLeadTime;
      const matchSymbol = match ? '✅' : '❌';

      if (match) matchCount++;
      else mismatchCount++;

      const name = result.supplierName.substring(0, 33).padEnd(35);
      const products = String(result.productCount).padEnd(12);
      const odooAvg = `${result.odooAvgDelay}d`.padEnd(12);
      const odooMin = `${result.odooMinDelay}d`.padEnd(12);
      const odooMax = `${result.odooMaxDelay}d`.padEnd(12);
      const dbVal = result.dbLeadTime ? `${result.dbLeadTime}d`.padEnd(12) : 'null'.padEnd(12);

      console.log(`${name}| ${products}| ${odooAvg}| ${odooMin}| ${odooMax}| ${dbVal}| ${matchSymbol}`);
    }

    console.log('-'.repeat(120));
    console.log(`\n📈 Summary:`);
    console.log(`   - Matched: ${matchCount}`);
    console.log(`   - Mismatched: ${mismatchCount}`);
    console.log(`   - Total tested: ${results.length}`);

    // 5. Show examples with extreme lead times
    console.log('\n5️⃣ Suppliers with unusual lead times:\n');

    const shortLeadTime = results.filter(r => r.odooAvgDelay <= 2);
    const longLeadTime = results.filter(r => r.odooAvgDelay >= 10);

    if (shortLeadTime.length > 0) {
      console.log('⚡ SHORT lead time (≤2 days):');
      shortLeadTime.forEach(r => {
        console.log(`   - ${r.supplierName}: ${r.odooAvgDelay} days (${r.productCount} products)`);
      });
    }

    if (longLeadTime.length > 0) {
      console.log('\n🐌 LONG lead time (≥10 days):');
      longLeadTime.forEach(r => {
        console.log(`   - ${r.supplierName}: ${r.odooAvgDelay} days (${r.productCount} products)`);
      });
    }

    // 6. Test dynamic coverage days calculation
    console.log('\n6️⃣ Testing dynamic coverage days calculation:\n');

    const exampleSupplier = results[0];
    if (exampleSupplier) {
      const leadTime = exampleSupplier.odooAvgDelay;

      console.log(`Example supplier: ${exampleSupplier.supplierName} (lead time: ${leadTime}d)`);
      console.log(`Dynamic coverage days:`);
      console.log(`   - CRITICAL:  ${leadTime + 2}d (lead time + 2 buffer)`);
      console.log(`   - HIGH:      ${leadTime + 4}d (lead time + 4 buffer)`);
      console.log(`   - MEDIUM:    ${leadTime + 7}d (lead time + 7 buffer)`);
      console.log(`   - LOW:       ${leadTime + 10}d (lead time + 10 buffer)`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Test completed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  }
}

// Run test
testLeadTimeIntegration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
