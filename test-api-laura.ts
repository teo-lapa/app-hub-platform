/**
 * Test API call per Laura Teodorescu
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

async function testLauraAPI() {
  console.log('🧪 Testing API for Laura Teodorescu...\n');

  try {
    // Laura ha odoo_partner_id = 2421
    const odooPartnerId = 2421;
    const url = `http://localhost:3000/api/maestro/customers/${odooPartnerId}`;

    console.log(`📞 Calling: ${url}`);

    const response = await fetch(url);

    if (!response.ok) {
      console.error(`❌ API returned status: ${response.status}`);
      const error = await response.text();
      console.error(`Error: ${error}`);
      return;
    }

    const data = await response.json();

    console.log('\n✅ API Response received!\n');
    console.log('='.repeat(60));
    console.log('CUSTOMER DATA');
    console.log('='.repeat(60));
    console.log(`Name: ${data.customer.name}`);
    console.log(`ID: ${data.customer.id}`);
    console.log(`Odoo Partner ID: ${data.customer.odoo_partner_id}`);
    console.log(`\n📊 INTERACTIONS: ${data.interactions?.length || 0}`);

    if (data.interactions && data.interactions.length > 0) {
      console.log('\n='.repeat(60));
      console.log('INTERACTIONS LIST');
      console.log('='.repeat(60));

      data.interactions.forEach((interaction: any, idx: number) => {
        console.log(`\n#${idx + 1} - ID: ${interaction.id}`);
        console.log(`  Type: ${interaction.interaction_type}`);
        console.log(`  Date: ${interaction.interaction_date}`);
        console.log(`  Outcome: ${interaction.outcome}`);
        console.log(`  Salesperson: ${interaction.salesperson_name}`);
        if (interaction.notes) {
          console.log(`  Notes: ${interaction.notes}`);
        }
      });

      console.log('\n='.repeat(60));
    } else {
      console.log('\n⚠️  NO INTERACTIONS FOUND IN API RESPONSE!');
      console.log('This is the bug! The API is not returning interactions.');
    }

    console.log('\n📦 ORDERS: ' + (data.orders?.length || 0));
    console.log('💡 RECOMMENDATIONS: ' + (data.recommendations?.length || 0));

    console.log('\n='.repeat(60));
    console.log('FULL RESPONSE STRUCTURE');
    console.log('='.repeat(60));
    console.log(JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testLauraAPI()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
