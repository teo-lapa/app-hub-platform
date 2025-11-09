// Script to find Laura Teodorescu's user ID in Odoo
import { getOdooSession, callOdoo } from '../lib/odoo-auth';

async function findLauraUser() {
  try {
    console.log('🔍 Searching for Laura Teodorescu in Odoo...\n');

    const { cookies } = await getOdooSession();

    // Search for users with name containing "Laura" or "Teodorescu"
    const users = await callOdoo(
      cookies,
      'res.users',
      'search_read',
      [],
      {
        domain: [
          '|',
          ['name', 'ilike', 'laura'],
          ['name', 'ilike', 'teodorescu']
        ],
        fields: ['id', 'name', 'login', 'email', 'active', 'company_id']
      }
    );

    console.log(`✅ Found ${users.length} user(s):\n`);

    users.forEach((user: any) => {
      console.log(`  ID: ${user.id}`);
      console.log(`  Name: ${user.name}`);
      console.log(`  Login: ${user.login}`);
      console.log(`  Email: ${user.email || 'N/A'}`);
      console.log(`  Active: ${user.active}`);
      console.log(`  Company: ${user.company_id ? user.company_id[1] : 'N/A'}`);
      console.log('---');
    });

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

findLauraUser();
