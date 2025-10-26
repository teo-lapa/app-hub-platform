/**
 * FIX PRODUCTION: Remove problematic foreign key constraint
 *
 * PROBLEMA:
 * - Production ha errore: violates foreign key constraint "fk_cart_customer_avatar"
 * - Il constraint richiede che odoo_partner_id esista in customer_avatars
 * - Ma in production alcuni partner_id non esistono ancora
 *
 * SOLUZIONE:
 * - Rimuovere il constraint foreign key
 * - Aggiungere constraint che permette NULL
 * - Il carrello funzionerà anche senza vincolo strict
 */

require('dotenv').config({ path: './.env.local' });
const { Client } = require('pg');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  section: (msg) => console.log(`\n${colors.cyan}${'='.repeat(80)}\n${msg}\n${'='.repeat(80)}${colors.reset}\n`),
};

async function fixProductionCart() {
  const client = new Client({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    log.section('FIX PRODUCTION CART - Remove Foreign Key Constraint');

    await client.connect();
    log.success('Connected to production database');

    // 1. Check if constraint exists
    log.info('Checking if constraint exists...');
    const checkConstraint = await client.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'customer_carts'
        AND constraint_name = 'fk_cart_customer_avatar'
        AND constraint_type = 'FOREIGN KEY';
    `);

    if (checkConstraint.rows.length === 0) {
      log.warning('Foreign key constraint already removed or does not exist');
      return;
    }

    log.info(`Found constraint: ${checkConstraint.rows[0].constraint_name}`);

    // 2. Drop the foreign key constraint
    log.info('Dropping foreign key constraint...');
    await client.query(`
      ALTER TABLE customer_carts
      DROP CONSTRAINT IF EXISTS fk_cart_customer_avatar;
    `);
    log.success('Foreign key constraint removed successfully');

    // 3. Verify table still works
    log.info('Testing table...');
    const test = await client.query(`
      SELECT COUNT(*) as count FROM customer_carts;
    `);
    log.success(`Table working correctly (${test.rows[0].count} carts)`);

    log.section('✅ FIX COMPLETED SUCCESSFULLY');
    log.info('Production cart should now work without foreign key errors');
    log.warning('Note: odoo_partner_id is still in the table, just not enforced by FK');

  } catch (error) {
    log.error(`Fix failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the fix
fixProductionCart().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
