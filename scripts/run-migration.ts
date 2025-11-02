import { config } from 'dotenv';
import { sql } from '@vercel/postgres';

// Load environment variables from .env.local
config({ path: '.env.local' });

async function runMigration() {
  try {
    console.log('🚀 Starting migration: Add packaging fields to cart_items...');

    // Add packaging_qty column
    await sql`
      ALTER TABLE cart_items
      ADD COLUMN IF NOT EXISTS packaging_qty DECIMAL(10,2)
    `;
    console.log('✅ Added packaging_qty column');

    // Add packaging_name column
    await sql`
      ALTER TABLE cart_items
      ADD COLUMN IF NOT EXISTS packaging_name VARCHAR(255)
    `;
    console.log('✅ Added packaging_name column');

    // Add index for better query performance
    await sql`
      CREATE INDEX IF NOT EXISTS idx_cart_items_packaging
      ON cart_items(packaging_qty)
      WHERE packaging_qty IS NOT NULL
    `;
    console.log('✅ Added index on packaging_qty');

    console.log('🎉 Migration completed successfully!');

    // Test query to verify the columns exist
    const result = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'cart_items'
      AND column_name IN ('packaging_qty', 'packaging_name')
    `;

    console.log('\n📋 Verified columns:');
    console.table(result.rows);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
