/**
 * Migration Script: Add is_ordered flag to preorder_customer_assignments
 *
 * Aggiunge una colonna per tracciare quali pre-ordini sono stati già processati
 * e convertiti in ordini reali.
 *
 * Run: npx tsx scripts/migrate-add-is-ordered.ts
 */

import { sql } from '@vercel/postgres';

async function migrate() {
  console.log('🚀 Starting migration: Add is_ordered flag...\n');

  try {
    // Step 1: Add is_ordered column
    console.log('📋 Adding is_ordered column...');
    await sql`
      ALTER TABLE preorder_customer_assignments
      ADD COLUMN IF NOT EXISTS is_ordered BOOLEAN DEFAULT FALSE
    `;
    console.log('✅ is_ordered column added\n');

    // Step 2: Add ordered_at column
    console.log('📋 Adding ordered_at column...');
    await sql`
      ALTER TABLE preorder_customer_assignments
      ADD COLUMN IF NOT EXISTS ordered_at TIMESTAMP WITH TIME ZONE
    `;
    console.log('✅ ordered_at column added\n');

    // Step 3: Add sale_order_id column (reference to created sale.order in Odoo)
    console.log('📋 Adding sale_order_id column...');
    await sql`
      ALTER TABLE preorder_customer_assignments
      ADD COLUMN IF NOT EXISTS sale_order_id INTEGER
    `;
    console.log('✅ sale_order_id column added\n');

    // Step 4: Add purchase_order_id column (reference to created purchase.order in Odoo)
    console.log('📋 Adding purchase_order_id column...');
    await sql`
      ALTER TABLE preorder_customer_assignments
      ADD COLUMN IF NOT EXISTS purchase_order_id INTEGER
    `;
    console.log('✅ purchase_order_id column added\n');

    // Step 5: Create index for fast filtering of non-ordered items
    console.log('📊 Creating index on is_ordered...');
    await sql`CREATE INDEX IF NOT EXISTS idx_preorder_is_ordered ON preorder_customer_assignments(is_ordered)`;
    console.log('✅ Index created\n');

    // Step 6: Add comments
    console.log('📝 Adding column comments...');
    await sql`COMMENT ON COLUMN preorder_customer_assignments.is_ordered IS 'TRUE se il pre-ordine è stato convertito in ordine reale'`;
    await sql`COMMENT ON COLUMN preorder_customer_assignments.ordered_at IS 'Data/ora in cui è stato creato l''ordine'`;
    await sql`COMMENT ON COLUMN preorder_customer_assignments.sale_order_id IS 'ID dell''ordine di vendita creato in Odoo'`;
    await sql`COMMENT ON COLUMN preorder_customer_assignments.purchase_order_id IS 'ID dell''ordine di acquisto creato in Odoo'`;
    console.log('✅ Comments added\n');

    // Step 7: Verify
    console.log('🔍 Verifying migration...');
    const columns = await sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'preorder_customer_assignments'
      AND column_name IN ('is_ordered', 'ordered_at', 'sale_order_id', 'purchase_order_id')
    `;

    console.log('Columns added:');
    for (const col of columns.rows) {
      console.log(`  ✓ ${col.column_name} (${col.data_type}) - default: ${col.column_default || 'null'}`);
    }

    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📝 Summary:');
    console.log('  - Added: is_ordered (BOOLEAN, default FALSE)');
    console.log('  - Added: ordered_at (TIMESTAMP WITH TIME ZONE)');
    console.log('  - Added: sale_order_id (INTEGER)');
    console.log('  - Added: purchase_order_id (INTEGER)');
    console.log('  - Index: idx_preorder_is_ordered');

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run migration
migrate()
  .then(() => {
    console.log('\n✨ Done! The is_ordered tracking is now available.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
