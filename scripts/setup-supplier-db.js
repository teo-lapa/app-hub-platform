/**
 * Setup Supplier Avatars Database
 *
 * Script per creare la tabella supplier_avatars nel database Vercel Postgres
 * Esegui con: node scripts/setup-supplier-db.js
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

async function setupDatabase() {
  console.log('🚀 Starting database setup...\n');

  const sql = neon(process.env.DATABASE_URL);

  try {
    // 1. Create table
    console.log('📊 Creating supplier_avatars table...');
    await sql`
      CREATE TABLE IF NOT EXISTS supplier_avatars (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        odoo_supplier_id INTEGER UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(50),
        city VARCHAR(100),
        country VARCHAR(100),
        first_order_date TIMESTAMP,
        last_order_date TIMESTAMP,
        total_orders INTEGER DEFAULT 0,
        total_spent NUMERIC(12, 2) DEFAULT 0.00,
        avg_order_value NUMERIC(12, 2) DEFAULT 0.00,
        average_lead_time_days INTEGER DEFAULT 3,
        min_lead_time_days INTEGER,
        max_lead_time_days INTEGER,
        cadence_type VARCHAR(20) DEFAULT 'fixed_days' CHECK (
          cadence_type IN ('fixed_days', 'weekly', 'biweekly', 'monthly', 'custom')
        ),
        cadence_value INTEGER NOT NULL DEFAULT 7,
        next_order_date DATE,
        days_until_next_order INTEGER,
        last_cadence_order_date DATE,
        top_products JSONB DEFAULT '[]'::jsonb,
        product_categories JSONB DEFAULT '{}'::jsonb,
        reliability_score INTEGER DEFAULT 80 CHECK (reliability_score >= 0 AND reliability_score <= 100),
        quality_score INTEGER DEFAULT 80 CHECK (quality_score >= 0 AND quality_score <= 100),
        price_competitiveness_score INTEGER DEFAULT 70 CHECK (price_competitiveness_score >= 0 AND price_competitiveness_score <= 100),
        delivery_performance_score INTEGER DEFAULT 80 CHECK (delivery_performance_score >= 0 AND delivery_performance_score <= 100),
        critical_products_count INTEGER DEFAULT 0,
        high_urgency_products_count INTEGER DEFAULT 0,
        medium_urgency_products_count INTEGER DEFAULT 0,
        assigned_buyer_id INTEGER,
        assigned_buyer_name VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        is_preferred BOOLEAN DEFAULT false,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        last_sync_odoo TIMESTAMP
      )
    `;
    console.log('✅ Table created\n');

    // 2. Create indexes
    console.log('🔍 Creating indexes...');
    await sql`CREATE INDEX IF NOT EXISTS idx_supplier_avatars_next_order ON supplier_avatars(next_order_date ASC) WHERE is_active = true`;
    await sql`CREATE INDEX IF NOT EXISTS idx_supplier_avatars_days_until ON supplier_avatars(days_until_next_order ASC) WHERE is_active = true AND days_until_next_order IS NOT NULL`;
    await sql`CREATE INDEX IF NOT EXISTS idx_supplier_avatars_buyer ON supplier_avatars(assigned_buyer_id) WHERE is_active = true`;
    await sql`CREATE INDEX IF NOT EXISTS idx_supplier_avatars_odoo ON supplier_avatars(odoo_supplier_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_supplier_avatars_reliability ON supplier_avatars(reliability_score DESC) WHERE is_active = true`;
    await sql`CREATE INDEX IF NOT EXISTS idx_supplier_avatars_active ON supplier_avatars(is_active, next_order_date)`;
    console.log('✅ Indexes created\n');

    // 3. Create functions
    console.log('⚙️  Creating functions...');

    await sql`
      CREATE OR REPLACE FUNCTION update_supplier_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `;

    await sql`
      CREATE OR REPLACE FUNCTION calculate_next_order_date()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.last_cadence_order_date IS NOT NULL AND NEW.cadence_value IS NOT NULL THEN
          NEW.next_order_date := NEW.last_cadence_order_date + (NEW.cadence_value || ' days')::INTERVAL;
        ELSIF NEW.last_order_date IS NOT NULL AND NEW.cadence_value IS NOT NULL THEN
          NEW.next_order_date := NEW.last_order_date + (NEW.cadence_value || ' days')::INTERVAL;
        END IF;

        IF NEW.next_order_date IS NOT NULL THEN
          NEW.days_until_next_order := (NEW.next_order_date - CURRENT_DATE);
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `;
    console.log('✅ Functions created\n');

    // 4. Create triggers
    console.log('🔔 Creating triggers...');

    await sql`DROP TRIGGER IF EXISTS trigger_supplier_avatars_updated_at ON supplier_avatars`;
    await sql`
      CREATE TRIGGER trigger_supplier_avatars_updated_at
        BEFORE UPDATE ON supplier_avatars
        FOR EACH ROW
        EXECUTE FUNCTION update_supplier_updated_at()
    `;

    await sql`DROP TRIGGER IF EXISTS trigger_calculate_next_order ON supplier_avatars`;
    await sql`
      CREATE TRIGGER trigger_calculate_next_order
        BEFORE INSERT OR UPDATE OF cadence_value, last_cadence_order_date, last_order_date
        ON supplier_avatars
        FOR EACH ROW
        EXECUTE FUNCTION calculate_next_order_date()
    `;
    console.log('✅ Triggers created\n');

    // 5. Create views
    console.log('👁️  Creating views...');

    await sql`
      CREATE OR REPLACE VIEW v_urgent_orders_today AS
      SELECT
        id, odoo_supplier_id, name, cadence_type, cadence_value,
        next_order_date, days_until_next_order, critical_products_count,
        average_lead_time_days, assigned_buyer_id, assigned_buyer_name
      FROM supplier_avatars
      WHERE is_active = true AND days_until_next_order = 0
      ORDER BY critical_products_count DESC, name ASC
    `;

    await sql`
      CREATE OR REPLACE VIEW v_orders_tomorrow AS
      SELECT
        id, odoo_supplier_id, name, cadence_type, cadence_value,
        next_order_date, days_until_next_order, critical_products_count,
        average_lead_time_days, assigned_buyer_id, assigned_buyer_name
      FROM supplier_avatars
      WHERE is_active = true AND days_until_next_order = 1
      ORDER BY critical_products_count DESC, name ASC
    `;

    await sql`
      CREATE OR REPLACE VIEW v_upcoming_orders AS
      SELECT
        id, odoo_supplier_id, name, cadence_type, cadence_value,
        next_order_date, days_until_next_order, critical_products_count,
        average_lead_time_days, assigned_buyer_id, assigned_buyer_name
      FROM supplier_avatars
      WHERE is_active = true AND days_until_next_order BETWEEN 0 AND 7
      ORDER BY days_until_next_order ASC, critical_products_count DESC
    `;
    console.log('✅ Views created\n');

    // 6. Verify
    console.log('🔎 Verifying setup...');
    const tableCheck = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'supplier_avatars'
    `;

    const indexCheck = await sql`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'supplier_avatars'
    `;

    console.log('✅ Verification complete\n');
    console.log('📋 Summary:');
    console.log(`   - Table: ${tableCheck.length > 0 ? '✅ Created' : '❌ Not found'}`);
    console.log(`   - Indexes: ${indexCheck.length} created`);
    console.log(`   - Triggers: 2 created`);
    console.log(`   - Views: 3 created`);
    console.log(`   - Functions: 2 created`);

    console.log('\n✨ Database setup completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Error during setup:', error.message);
    console.error('\n Full error:', error);
    process.exit(1);
  }
}

setupDatabase();
