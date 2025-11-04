import { sql } from '@vercel/postgres';

async function runMigration() {
  try {
    console.log('📌 Creating preorder_customer_assignments table...');

    // Create table directly
    await sql`
      CREATE TABLE IF NOT EXISTS preorder_customer_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id INTEGER NOT NULL,
        customer_id INTEGER NOT NULL,
        quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT positive_quantity CHECK (quantity >= 0),
        CONSTRAINT unique_product_customer UNIQUE (product_id, customer_id)
      )
    `;

    console.log('✅ Table created');

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_preorder_product_id ON preorder_customer_assignments(product_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_preorder_customer_id ON preorder_customer_assignments(customer_id)`;

    console.log('✅ Indexes created');
    console.log('✅ Migration completed successfully!');

    // Verify table exists
    const result = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'preorder_customer_assignments'
    `;

    if (result.rows.length > 0) {
      console.log('✅ Table preorder_customer_assignments created successfully!');
    } else {
      console.log('❌ Table creation failed');
    }

  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
}

runMigration();
