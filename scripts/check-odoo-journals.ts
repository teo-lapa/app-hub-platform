/**
 * Check Odoo Journals - Helper Script
 *
 * Lists all bank journals in Odoo to find correct codes for import
 *
 * EXECUTION:
 * npx tsx scripts/check-odoo-journals.ts
 */

import { OdooBankStatementClient } from '../lib/odoo/bank-statement-client';

const CONFIG = {
  url: 'https://lapadevadmin-lapa-v2-staging-2406-25408900.dev.odoo.com',
  db: 'lapadevadmin-lapa-v2-staging-2406-25408900',
  username: 'paul@lapa.ch',
  password: 'lapa201180'
};

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('ODOO JOURNAL CHECKER');
  console.log('='.repeat(80) + '\n');

  try {
    console.log('Connecting to Odoo...');
    const client = new OdooBankStatementClient(CONFIG);
    await client.connect();
    console.log('✓ Connected\n');

    console.log('Fetching bank journals...\n');
    const journals = await client.getBankJournals();

    console.log(`Found ${journals.length} bank journals:\n`);
    console.log('-'.repeat(80));
    console.log('CODE'.padEnd(15) + 'NAME'.padEnd(40) + 'CURRENCY');
    console.log('-'.repeat(80));

    for (const journal of journals) {
      const currency = journal.currency_id ? journal.currency_id[1] : 'CHF';
      console.log(
        journal.code.padEnd(15) +
        journal.name.padEnd(40) +
        currency
      );
    }

    console.log('-'.repeat(80));
    console.log('');

    // Try to find UBS accounts
    console.log('Looking for UBS accounts specifically...\n');

    const ubsJournals = journals.filter(j =>
      j.name.toLowerCase().includes('ubs') ||
      j.code.toLowerCase().includes('ubs')
    );

    if (ubsJournals.length > 0) {
      console.log('UBS-related journals found:');
      ubsJournals.forEach(j => {
        const currency = j.currency_id ? j.currency_id[1] : 'CHF';
        console.log(`  ${j.code}: ${j.name} (${currency})`);
      });
    } else {
      console.log('⚠ No UBS-specific journals found. You may need to create them.');
      console.log('\nTo create a bank journal in Odoo:');
      console.log('1. Go to Accounting > Configuration > Journals');
      console.log('2. Click Create');
      console.log('3. Set Type = Bank');
      console.log('4. Set Name = "UBS CHF" or "UBS EUR"');
      console.log('5. Set Code = "UBSCH" or "UBEUR"');
      console.log('6. Set Currency if EUR');
    }

    console.log('');

  } catch (error) {
    console.error('\n❌ ERROR:', error);
    if (error instanceof Error) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

main();
