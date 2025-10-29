/**
 * Script di test per verificare sync fornitori da Odoo
 *
 * Usage: node scripts/test-supplier-sync.js
 */

require('dotenv').config({ path: '.env.local' });

const ODOO_URL = process.env.ODOO_URL;
const ODOO_DB = process.env.ODOO_DB;
const ODOO_USERNAME = process.env.ODOO_USERNAME;
const ODOO_PASSWORD = process.env.ODOO_PASSWORD;

async function testSupplierSync() {
  console.log('🔍 Testing Supplier Sync...\n');
  console.log('Config:', {
    ODOO_URL: ODOO_URL ? '✅ Set' : '❌ Missing',
    ODOO_DB: ODOO_DB ? '✅ Set' : '❌ Missing',
    ODOO_USERNAME: ODOO_USERNAME ? '✅ Set' : '❌ Missing',
    ODOO_PASSWORD: ODOO_PASSWORD ? '✅ Set' : '❌ Missing',
  });
  console.log('');

  try {
    // Step 1: Authenticate
    console.log('🔐 Step 1: Authenticating with Odoo...');
    const authResponse = await fetch(`${ODOO_URL}/jsonrpc`, {
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

    const authData = await authResponse.json();

    if (authData.error) {
      console.error('❌ Auth Error:', authData.error);
      return;
    }

    const uid = authData.result;
    console.log('✅ Authenticated! UID:', uid);
    console.log('');

    // Step 2: Fetch suppliers
    console.log('📦 Step 2: Fetching suppliers from Odoo...');
    const suppliersResponse = await fetch(`${ODOO_URL}/jsonrpc`, {
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
            'res.partner',
            'search_read',
            [[['supplier_rank', '>', 0]]],
            {
              fields: ['id', 'name', 'email', 'phone', 'city', 'country_id'],
              limit: 10 // Test con solo 10
            }
          ]
        },
        id: Math.floor(Math.random() * 1000000)
      })
    });

    const suppliersData = await suppliersResponse.json();

    if (suppliersData.error) {
      console.error('❌ Fetch Error:', suppliersData.error);
      return;
    }

    const suppliers = suppliersData.result || [];
    console.log(`✅ Found ${suppliers.length} suppliers`);
    console.log('');

    // Step 3: Show sample
    console.log('📋 Sample suppliers:');
    suppliers.slice(0, 5).forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.name} (ID: ${s.id})`);
      console.log(`     Email: ${s.email || 'N/A'}`);
      console.log(`     Phone: ${s.phone || 'N/A'}`);
      console.log(`     City: ${s.city || 'N/A'}`);
      console.log('');
    });

    console.log('✅ Test completed successfully!');
    console.log('');
    console.log('Summary:');
    console.log(`  - Authentication: ✅ Working`);
    console.log(`  - Supplier Fetch: ✅ Working`);
    console.log(`  - Total Suppliers: ${suppliers.length}`);
    console.log('');
    console.log('Next step: Run the actual sync from the UI');

  } catch (error) {
    console.error('❌ Fatal Error:', error);
    console.error('Stack:', error.stack);
  }
}

testSupplierSync();
