// Run migration to create product_favorites table
const { sql } = require('@vercel/postgres');

async function runMigration() {
  console.log('🚀 Running migration: create product_favorites table...');

  try {
    // Create the table
    await sql`
      CREATE TABLE IF NOT EXISTS product_favorites (
        id SERIAL PRIMARY KEY,
        customer_email VARCHAR(255) NOT NULL,
        product_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(customer_email, product_id)
      )
    `;
    console.log('✅ Table created successfully');

    // Create indexes
    await sql`
      CREATE INDEX IF NOT EXISTS idx_product_favorites_customer ON product_favorites(customer_email)
    `;
    console.log('✅ Index idx_product_favorites_customer created');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_product_favorites_product ON product_favorites(product_id)
    `;
    console.log('✅ Index idx_product_favorites_product created');

    console.log('🎉 Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
