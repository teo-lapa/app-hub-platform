/**
 * Script di migrazione database per Time & Attendance
 * Esegue la creazione delle tabelle necessarie su Vercel Postgres
 *
 * Uso: node scripts/migrate-time-attendance.js
 */

const { sql } = require('@vercel/postgres');

async function migrate() {
  console.log('🚀 Avvio migrazione Time & Attendance...\n');

  try {
    // 1. Tabella principale timbrature
    console.log('📦 Creando tabella ta_time_entries...');
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
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_ta_time_entries_contact ON ta_time_entries(contact_id, timestamp DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_ta_time_entries_company ON ta_time_entries(company_id, timestamp DESC)`;
    console.log('✅ ta_time_entries creata\n');

    // 2. Tabella locations per geofencing
    console.log('📦 Creando tabella ta_locations...');
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

    await sql`CREATE INDEX IF NOT EXISTS idx_ta_locations_company ON ta_locations(company_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_ta_locations_qr ON ta_locations(qr_secret)`;
    console.log('✅ ta_locations creata\n');

    // 3. Tabella consensi GDPR
    console.log('📦 Creando tabella ta_odoo_consents...');
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

    await sql`CREATE INDEX IF NOT EXISTS idx_ta_odoo_consents_contact ON ta_odoo_consents(contact_id)`;
    console.log('✅ ta_odoo_consents creata\n');

    // 4. Aggiungi foreign key per location_id
    console.log('📦 Aggiungendo foreign key location_id...');
    try {
      await sql`ALTER TABLE ta_time_entries ADD CONSTRAINT fk_location FOREIGN KEY (location_id) REFERENCES ta_locations(id)`;
      console.log('✅ Foreign key aggiunta\n');
    } catch (e) {
      // Già esiste
      console.log('ℹ️ Foreign key già esistente\n');
    }

    console.log('🎉 Migrazione completata con successo!\n');

    // Verifica
    console.log('📊 Verifica tabelle create:');
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name LIKE 'ta_%'
    `;
    tables.rows.forEach(t => console.log(`   - ${t.table_name}`));

  } catch (error) {
    console.error('❌ Errore migrazione:', error);
    process.exit(1);
  }
}

migrate();
