import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * TEMPORARY API ENDPOINT
 *
 * Questo endpoint serve SOLO per creare la tabella supplier_avatars
 * una volta creata, questo file può essere cancellato.
 *
 * Usage: GET /api/setup-supplier-db
 */
export async function GET() {
  try {
    console.log('🚀 [SETUP-SUPPLIER-DB] Starting database setup...');

    // Create supplier_avatars table
    await sql`
      CREATE TABLE IF NOT EXISTS supplier_avatars (
        -- Primary Key
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

        -- Odoo Integration
        odoo_supplier_id INTEGER UNIQUE NOT NULL,

        -- Dati Anagrafici
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(50),
        city VARCHAR(100),
        country VARCHAR(100),

        -- Metriche Transazionali
        first_order_date TIMESTAMP,
        last_order_date TIMESTAMP,
        total_orders INTEGER DEFAULT 0,
        total_spent NUMERIC(12, 2) DEFAULT 0.00,
        avg_order_value NUMERIC(12, 2) DEFAULT 0.00,

        -- Lead Time
        average_lead_time_days INTEGER DEFAULT 3,
        min_lead_time_days INTEGER,
        max_lead_time_days INTEGER,

        -- Cadence Settings
        cadence_type VARCHAR(20) DEFAULT 'fixed_days' CHECK (
          cadence_type IN ('fixed_days', 'weekly', 'biweekly', 'monthly', 'custom')
        ),
        cadence_value INTEGER NOT NULL DEFAULT 7,

        -- Next Order Calculation
        next_order_date DATE,
        days_until_next_order INTEGER,
        last_cadence_order_date DATE,

        -- Prodotti e Categorie (JSONB)
        top_products JSONB DEFAULT '[]'::jsonb,
        product_categories JSONB DEFAULT '{}'::jsonb,

        -- Supplier Scores (0-100)
        reliability_score INTEGER DEFAULT 80 CHECK (reliability_score >= 0 AND reliability_score <= 100),
        quality_score INTEGER DEFAULT 80 CHECK (quality_score >= 0 AND quality_score <= 100),
        price_competitiveness_score INTEGER DEFAULT 70 CHECK (price_competitiveness_score >= 0 AND price_competitiveness_score <= 100),
        delivery_performance_score INTEGER DEFAULT 80 CHECK (delivery_performance_score >= 0 AND delivery_performance_score <= 100),

        -- Critical Products Count
        critical_products_count INTEGER DEFAULT 0,
        high_urgency_products_count INTEGER DEFAULT 0,
        medium_urgency_products_count INTEGER DEFAULT 0,

        -- Assignment
        assigned_buyer_id INTEGER,
        assigned_buyer_name VARCHAR(255),

        -- Status & Metadata
        is_active BOOLEAN DEFAULT true,
        is_preferred BOOLEAN DEFAULT false,
        notes TEXT,

        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        last_sync_odoo TIMESTAMP
      )
    `;
    console.log('✅ Table supplier_avatars created');

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_supplier_avatars_next_order ON supplier_avatars(next_order_date ASC) WHERE is_active = true`;
    await sql`CREATE INDEX IF NOT EXISTS idx_supplier_avatars_days_until ON supplier_avatars(days_until_next_order ASC) WHERE is_active = true AND days_until_next_order IS NOT NULL`;
    await sql`CREATE INDEX IF NOT EXISTS idx_supplier_avatars_buyer ON supplier_avatars(assigned_buyer_id) WHERE is_active = true`;
    await sql`CREATE INDEX IF NOT EXISTS idx_supplier_avatars_odoo ON supplier_avatars(odoo_supplier_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_supplier_avatars_reliability ON supplier_avatars(reliability_score DESC) WHERE is_active = true`;
    await sql`CREATE INDEX IF NOT EXISTS idx_supplier_avatars_active ON supplier_avatars(is_active, next_order_date)`;
    console.log('✅ Indexes created');

    // Create auto-update trigger function
    await sql`
      CREATE OR REPLACE FUNCTION update_supplier_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `;
    console.log('✅ Function update_supplier_updated_at created');

    // Create trigger for updated_at
    await sql`
      DROP TRIGGER IF EXISTS trigger_supplier_avatars_updated_at ON supplier_avatars
    `;
    await sql`
      CREATE TRIGGER trigger_supplier_avatars_updated_at
        BEFORE UPDATE ON supplier_avatars
        FOR EACH ROW
        EXECUTE FUNCTION update_supplier_updated_at()
    `;
    console.log('✅ Trigger for updated_at created');

    // Create auto-calculate next order date function
    await sql`
      CREATE OR REPLACE FUNCTION calculate_next_order_date()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Calculate next order date based on last_cadence_order_date + cadence_value
        IF NEW.last_cadence_order_date IS NOT NULL AND NEW.cadence_value IS NOT NULL THEN
          NEW.next_order_date := NEW.last_cadence_order_date + (NEW.cadence_value || ' days')::INTERVAL;
        ELSIF NEW.last_order_date IS NOT NULL AND NEW.cadence_value IS NOT NULL THEN
          -- Fallback to last_order_date if last_cadence_order_date not set
          NEW.next_order_date := NEW.last_order_date + (NEW.cadence_value || ' days')::INTERVAL;
        END IF;

        -- Calculate days until next order
        IF NEW.next_order_date IS NOT NULL THEN
          NEW.days_until_next_order := (NEW.next_order_date - CURRENT_DATE);
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `;
    console.log('✅ Function calculate_next_order_date created');

    // Create trigger for next order calculation
    await sql`
      DROP TRIGGER IF EXISTS trigger_calculate_next_order ON supplier_avatars
    `;
    await sql`
      CREATE TRIGGER trigger_calculate_next_order
        BEFORE INSERT OR UPDATE OF cadence_value, last_cadence_order_date, last_order_date
        ON supplier_avatars
        FOR EACH ROW
        EXECUTE FUNCTION calculate_next_order_date()
    `;
    console.log('✅ Trigger for next order calculation created');

    // Create views
    await sql`
      CREATE OR REPLACE VIEW v_urgent_orders_today AS
      SELECT
        id,
        odoo_supplier_id,
        name,
        cadence_type,
        cadence_value,
        next_order_date,
        days_until_next_order,
        critical_products_count,
        average_lead_time_days,
        assigned_buyer_id,
        assigned_buyer_name
      FROM supplier_avatars
      WHERE is_active = true
        AND days_until_next_order = 0
      ORDER BY critical_products_count DESC, name ASC
    `;
    console.log('✅ View v_urgent_orders_today created');

    await sql`
      CREATE OR REPLACE VIEW v_orders_tomorrow AS
      SELECT
        id,
        odoo_supplier_id,
        name,
        cadence_type,
        cadence_value,
        next_order_date,
        days_until_next_order,
        critical_products_count,
        average_lead_time_days,
        assigned_buyer_id,
        assigned_buyer_name
      FROM supplier_avatars
      WHERE is_active = true
        AND days_until_next_order = 1
      ORDER BY critical_products_count DESC, name ASC
    `;
    console.log('✅ View v_orders_tomorrow created');

    await sql`
      CREATE OR REPLACE VIEW v_upcoming_orders AS
      SELECT
        id,
        odoo_supplier_id,
        name,
        cadence_type,
        cadence_value,
        next_order_date,
        days_until_next_order,
        critical_products_count,
        average_lead_time_days,
        assigned_buyer_id,
        assigned_buyer_name
      FROM supplier_avatars
      WHERE is_active = true
        AND days_until_next_order BETWEEN 0 AND 7
      ORDER BY days_until_next_order ASC, critical_products_count DESC
    `;
    console.log('✅ View v_upcoming_orders created');

    // Verify setup
    const tableCheck = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'supplier_avatars'
    `;

    const indexCheck = await sql`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'supplier_avatars'
    `;

    console.log('✅ [SETUP-SUPPLIER-DB] Database setup completed successfully!');

    return NextResponse.json({
      success: true,
      message: 'Database setup completed successfully',
      details: {
        table_created: tableCheck.rows.length > 0,
        indexes_created: indexCheck.rows.length,
        indexes: indexCheck.rows.map(r => r.indexname),
        views_created: ['v_urgent_orders_today', 'v_orders_tomorrow', 'v_upcoming_orders'],
        triggers_created: ['trigger_supplier_avatars_updated_at', 'trigger_calculate_next_order']
      }
    });

  } catch (error: any) {
    console.error('❌ [SETUP-SUPPLIER-DB] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        details: error.toString()
      },
      { status: 500 }
    );
  }
}
