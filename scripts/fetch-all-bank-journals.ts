import { getOdooClient } from '../lib/odoo-client';

async function fetchAllBankJournals() {
  try {
    console.log('🔍 Fetching all bank journals from Odoo...');

    const client = await getOdooClient();

    // Search for ACTIVE bank journals only
    const journals = await client.searchRead(
      'account.journal',
      [['type', '=', 'bank'], ['active', '=', true]],
      [
        'id',
        'name',
        'code',
        'currency_id',
        'bank_account_id',
        'bank_acc_number',
        'active'
      ],
      1000, // limit
      0     // offset
    );

    console.log(`\n✅ Found ${journals.length} bank journals:\n`);

    // Format output for easy copy-paste to bank-journals.ts
    journals.forEach((j: any) => {
      const currency = j.currency_id ? j.currency_id[1] : 'CHF';
      const iban = j.bank_acc_number || '';

      console.log(`  {`);
      console.log(`    iban: '${iban}',`);
      console.log(`    journalId: ${j.id},`);
      console.log(`    journalName: '${j.name}',`);
      console.log(`    journalCode: '${j.code}',`);
      console.log(`    currency: '${currency}',`);
      if (iban) {
        console.log(`    accountNumber: '${iban}',`);
      }
      console.log(`    description: '${j.name}'`);
      console.log(`  },`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fetchAllBankJournals();
