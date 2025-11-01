/**
 * Migration Script: Product Reservations Table
 *
 * Crea la tabella product_reservations per gestire le prenotazioni
 * di prodotti non disponibili con supporto testo/audio/foto.
 *
 * Agganciata all'avatar cliente esistente tramite customer_id (Odoo).
 *
 * Run: npx tsx scripts/migrate-product-reservations.ts
 */

import { sql } from '@vercel/postgres';

async function migrate() {
  console.log('🚀 Starting migration: Product Reservations Table...\n');

  try {
    // Step 1: Crea tabella product_reservations
    console.log('📋 Creating table: product_reservations...');
    await sql`
      CREATE TABLE IF NOT EXISTS product_reservations (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL, -- ID prodotto Odoo
        customer_id INTEGER NOT NULL, -- ID cliente Odoo (avatar esistente)
        order_id INTEGER, -- ID ordine (può essere NULL se non ancora associato)
        text_note TEXT, -- Nota testuale
        audio_url TEXT, -- URL audio Vercel Blob
        image_url TEXT, -- URL immagine Vercel Blob
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✅ Table created successfully\n');

    // Step 2: Crea indici per performance
    console.log('📊 Creating indexes...');

    await sql`CREATE INDEX IF NOT EXISTS idx_reservations_customer ON product_reservations(customer_id)`;
    console.log('  ✓ Index on customer_id');

    await sql`CREATE INDEX IF NOT EXISTS idx_reservations_product ON product_reservations(product_id)`;
    console.log('  ✓ Index on product_id');

    await sql`CREATE INDEX IF NOT EXISTS idx_reservations_order ON product_reservations(order_id)`;
    console.log('  ✓ Index on order_id');

    await sql`CREATE INDEX IF NOT EXISTS idx_reservations_status ON product_reservations(status)`;
    console.log('  ✓ Index on status');

    await sql`CREATE INDEX IF NOT EXISTS idx_reservations_created ON product_reservations(created_at DESC)`;
    console.log('  ✓ Index on created_at');
    console.log('✅ All indexes created\n');

    // Step 3: Crea trigger per auto-update updated_at
    console.log('⚡ Creating trigger for auto-update...');

    // Prima verifica se la funzione esiste già
    const functionExists = await sql`
      SELECT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
      )
    `;

    if (!functionExists.rows[0].exists) {
      await sql`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
           NEW.updated_at = NOW();
           RETURN NEW;
        END;
        $$ language 'plpgsql'
      `;
      console.log('  ✓ Function created');
    } else {
      console.log('  ✓ Function already exists');
    }

    await sql`DROP TRIGGER IF EXISTS update_product_reservations_updated_at ON product_reservations`;

    await sql`
      CREATE TRIGGER update_product_reservations_updated_at
      BEFORE UPDATE ON product_reservations
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    `;
    console.log('  ✓ Trigger created');
    console.log('✅ Auto-update trigger ready\n');

    // Step 4: Verifica
    console.log('🔍 Verifying migration...');
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'product_reservations'
      )
    `;

    if (tableCheck.rows[0].exists) {
      console.log('✅ Table exists');

      // Conta indici
      const indexCount = await sql`
        SELECT count(*) as count
        FROM pg_indexes
        WHERE tablename = 'product_reservations'
      `;
      console.log(`✅ ${indexCount.rows[0].count} indexes created`);

      // Conta colonne
      const columnCount = await sql`
        SELECT count(*) as count
        FROM information_schema.columns
        WHERE table_name = 'product_reservations'
      `;
      console.log(`✅ ${columnCount.rows[0].count} columns created`);

      console.log('\n🎉 Migration completed successfully!');
      console.log('\n📝 Summary:');
      console.log('  - Table: product_reservations');
      console.log('  - Columns: id, product_id, customer_id, order_id, text_note, audio_url, image_url, status, created_at, updated_at');
      console.log('  - Indexes: 5 (customer, product, order, status, created_at)');
      console.log('  - Trigger: auto-update updated_at on UPDATE');
      console.log('  - Link: customer_id → Avatar cliente Odoo esistente');
    } else {
      console.error('❌ Table verification failed');
      process.exit(1);
    }

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run migration
migrate()
  .then(() => {
    console.log('\n✨ Done! The product_reservations table is ready to use.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
