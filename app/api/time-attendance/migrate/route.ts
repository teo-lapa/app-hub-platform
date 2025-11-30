import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

/**
 * POST /api/time-attendance/migrate
 * Esegue la migrazione del database per Time & Attendance
 * ATTENZIONE: Da usare solo in fase di setup iniziale
 */
export async function POST(request: NextRequest) {
  // Verifica secret key per sicurezza
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  if (secret !== process.env.MIGRATION_SECRET && secret !== 'lapa2024migrate') {
    return NextResponse.json({
      success: false,
      error: 'Unauthorized - secret key required',
    }, { status: 401 });
  }

  const results: string[] = [];

  try {
    // 1. Tabella time_entries
    results.push('Creating ta_time_entries...');
    await sql`
      CREATE TABLE IF NOT EXISTS ta_time_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        contact_id INTEGER NOT NULL,
        company_id INTEGER,
        entry_type TEXT NOT NULL CHECK (entry_type IN ('clock_in', 'clock_out', 'break_start', 'break_end')),
        timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        latitude DECIMAL(10,8),
        longitude DECIMAL(11,8),
        qr_code_verified BOOLEAN DEFAULT false,
        location_id UUID,
        location_name TEXT,
        note TEXT,
        break_type TEXT CHECK (break_type IS NULL OR break_type IN ('coffee_break', 'lunch_break')),
        break_max_minutes INTEGER,
        contact_name TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    results.push('✓ ta_time_entries created');

    // Aggiungi colonne mancanti se la tabella esisteva già
    results.push('Adding missing columns...');
    try {
      await sql`ALTER TABLE ta_time_entries ADD COLUMN IF NOT EXISTS break_type TEXT CHECK (break_type IS NULL OR break_type IN ('coffee_break', 'lunch_break'))`;
      await sql`ALTER TABLE ta_time_entries ADD COLUMN IF NOT EXISTS break_max_minutes INTEGER`;
      await sql`ALTER TABLE ta_time_entries ADD COLUMN IF NOT EXISTS contact_name TEXT`;
      results.push('✓ Missing columns added');
    } catch (e) {
      results.push('⚠ Some columns may already exist: ' + (e instanceof Error ? e.message : 'Unknown'));
    }

    // Indici
    await sql`CREATE INDEX IF NOT EXISTS idx_ta_time_entries_contact ON ta_time_entries(contact_id, timestamp DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_ta_time_entries_company ON ta_time_entries(company_id, timestamp DESC)`;
    results.push('✓ Indexes created');

    // 2. Tabella locations
    results.push('Creating ta_locations...');
    await sql`
      CREATE TABLE IF NOT EXISTS ta_locations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id INTEGER NOT NULL,
        name VARCHAR(255) NOT NULL,
        address TEXT,
        latitude DECIMAL(10,8) NOT NULL,
        longitude DECIMAL(11,8) NOT NULL,
        radius_meters INTEGER DEFAULT 100,
        qr_secret VARCHAR(64) NOT NULL UNIQUE,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    results.push('✓ ta_locations created');

    await sql`CREATE INDEX IF NOT EXISTS idx_ta_locations_company ON ta_locations(company_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_ta_locations_qr ON ta_locations(qr_secret)`;
    results.push('✓ Location indexes created');

    // 3. Tabella consensi
    results.push('Creating ta_odoo_consents...');
    await sql`
      CREATE TABLE IF NOT EXISTS ta_odoo_consents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        contact_id INTEGER NOT NULL,
        consent_type TEXT NOT NULL CHECK (consent_type IN ('gps_tracking', 'data_processing', 'privacy_policy')),
        is_granted BOOLEAN NOT NULL,
        granted_at TIMESTAMP,
        revoked_at TIMESTAMP,
        consent_version VARCHAR(10) DEFAULT '1.0',
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    results.push('✓ ta_odoo_consents created');

    await sql`CREATE INDEX IF NOT EXISTS idx_ta_odoo_consents_contact ON ta_odoo_consents(contact_id)`;
    results.push('✓ Consent indexes created');

    // Verifica tabelle
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name LIKE 'ta_%'
      ORDER BY table_name
    `;

    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully',
      results,
      tables: tables.rows.map(t => t.table_name),
    });

  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({
      success: false,
      error: 'Migration failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      results,
    }, { status: 500 });
  }
}

/**
 * GET /api/time-attendance/migrate
 * Verifica lo stato delle tabelle
 */
export async function GET() {
  try {
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name LIKE 'ta_%'
      ORDER BY table_name
    `;

    const tableDetails: Record<string, number> = {};

    for (const t of tables.rows) {
      try {
        const count = await sql.query(`SELECT COUNT(*) FROM ${t.table_name}`);
        tableDetails[t.table_name] = parseInt(count.rows[0].count);
      } catch {
        tableDetails[t.table_name] = -1; // Error
      }
    }

    return NextResponse.json({
      success: true,
      tables: tableDetails,
      total_tables: tables.rows.length,
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to check tables',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
