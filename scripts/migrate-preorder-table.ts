/**
 * Migration Script: Preorder Customer Assignments Table
 *
 * Crea la tabella preorder_customer_assignments per gestire l'assegnazione
 * di prodotti pre-ordine a clienti specifici.
 *
 * Run: npx tsx scripts/migrate-preorder-table.ts
 */

import { sql } from '@vercel/postgres';
import { readFileSync } from 'fs';
import { join } from 'path';

async function migrate() {
  console.log('🚀 Starting migration: Preorder Customer Assignments Table...\n');

  try {
    // Step 1: Crea tabella preorder_customer_assignments
    console.log('📋 Creating table: preorder_customer_assignments...');
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
    console.log('✅ Table created successfully\n');

    // Step 2: Crea indici per performance
    console.log('📊 Creating indexes...');

    await sql`CREATE INDEX IF NOT EXISTS idx_preorder_product_id ON preorder_customer_assignments(product_id)`;
    console.log('  ✓ Index on product_id');

    await sql`CREATE INDEX IF NOT EXISTS idx_preorder_customer_id ON preorder_customer_assignments(customer_id)`;
    console.log('  ✓ Index on customer_id');

    await sql`CREATE INDEX IF NOT EXISTS idx_preorder_created_at ON preorder_customer_assignments(created_at)`;
    console.log('  ✓ Index on created_at');
    console.log('✅ All indexes created\n');

    // Step 3: Crea trigger per auto-update updated_at
    console.log('⚡ Creating trigger for auto-update...');

    // Prima verifica se la funzione esiste già
    const functionExists = await sql`
      SELECT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'update_preorder_assignments_updated_at'
      )
    `;

    if (!functionExists.rows[0].exists) {
      await sql`
        CREATE OR REPLACE FUNCTION update_preorder_assignments_updated_at()
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

    await sql`DROP TRIGGER IF EXISTS trigger_preorder_assignments_updated_at ON preorder_customer_assignments`;

    await sql`
      CREATE TRIGGER trigger_preorder_assignments_updated_at
      BEFORE UPDATE ON preorder_customer_assignments
      FOR EACH ROW EXECUTE FUNCTION update_preorder_assignments_updated_at()
    `;
    console.log('  ✓ Trigger created');
    console.log('✅ Auto-update trigger ready\n');

    // Step 4: Aggiungi commenti alle tabelle
    console.log('📝 Adding table comments...');
    await sql`COMMENT ON TABLE preorder_customer_assignments IS 'Assegnazioni di prodotti pre-ordine a clienti specifici'`;
    await sql`COMMENT ON COLUMN preorder_customer_assignments.product_id IS 'ID prodotto Odoo'`;
    await sql`COMMENT ON COLUMN preorder_customer_assignments.customer_id IS 'ID cliente Odoo (res.partner)'`;
    await sql`COMMENT ON COLUMN preorder_customer_assignments.quantity IS 'Quantità richiesta dal cliente'`;
    await sql`COMMENT ON COLUMN preorder_customer_assignments.notes IS 'Note opzionali sull''assegnazione'`;
    console.log('✅ Comments added\n');

    // Step 5: Verifica
    console.log('🔍 Verifying migration...');
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'preorder_customer_assignments'
      )
    `;

    if (tableCheck.rows[0].exists) {
      console.log('✅ Table exists');

      // Conta indici
      const indexCount = await sql`
        SELECT count(*) as count
        FROM pg_indexes
        WHERE tablename = 'preorder_customer_assignments'
      `;
      console.log(`✅ ${indexCount.rows[0].count} indexes created`);

      // Conta colonne
      const columnCount = await sql`
        SELECT count(*) as count
        FROM information_schema.columns
        WHERE table_name = 'preorder_customer_assignments'
      `;
      console.log(`✅ ${columnCount.rows[0].count} columns created`);

      // Verifica constraint UNIQUE
      const uniqueConstraints = await sql`
        SELECT count(*) as count
        FROM information_schema.table_constraints
        WHERE table_name = 'preorder_customer_assignments'
        AND constraint_type = 'UNIQUE'
      `;
      console.log(`✅ ${uniqueConstraints.rows[0].count} unique constraint(s) applied`);

      // Verifica CHECK constraint
      const checkConstraints = await sql`
        SELECT count(*) as count
        FROM information_schema.table_constraints
        WHERE table_name = 'preorder_customer_assignments'
        AND constraint_type = 'CHECK'
      `;
      console.log(`✅ ${checkConstraints.rows[0].count} check constraint(s) applied`);

      console.log('\n🎉 Migration completed successfully!');
      console.log('\n📝 Summary:');
      console.log('  - Table: preorder_customer_assignments');
      console.log('  - Columns: id (UUID), product_id, customer_id, quantity, notes, created_at, updated_at');
      console.log('  - Indexes: 3 (product_id, customer_id, created_at)');
      console.log('  - Constraints: UNIQUE (product_id, customer_id), CHECK (quantity >= 0)');
      console.log('  - Trigger: auto-update updated_at on UPDATE');
      console.log('  - Link: product_id → Odoo product, customer_id → Odoo customer');
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
    console.log('\n✨ Done! The preorder_customer_assignments table is ready to use.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
