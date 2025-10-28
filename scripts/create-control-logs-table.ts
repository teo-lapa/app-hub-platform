import { sql } from '@vercel/postgres';

async function createControlLogsTable() {
  try {
    console.log('🚀 Creazione tabella control_logs...\n');

    // Crea la tabella
    await sql`
      CREATE TABLE IF NOT EXISTS control_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

        -- Riferimenti Odoo
        batch_id INTEGER NOT NULL,
        batch_name TEXT NOT NULL,
        zone_id TEXT NOT NULL,
        zone_name TEXT NOT NULL,

        -- Prodotto
        product_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        qty_requested DECIMAL(10, 2) NOT NULL,
        qty_picked DECIMAL(10, 2) NOT NULL,

        -- Stato controllo
        status TEXT NOT NULL CHECK (status IN ('ok', 'error_qty', 'missing', 'damaged', 'lot_error', 'location_error', 'note')),
        note TEXT,

        -- Chi ha controllato
        controlled_by_user_id INTEGER NOT NULL,
        controlled_by_name TEXT NOT NULL,
        controlled_at TIMESTAMP DEFAULT NOW(),

        -- Metadata batch
        driver_name TEXT,
        vehicle_name TEXT,

        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✅ Tabella control_logs creata');

    // Crea indici
    console.log('\n📊 Creazione indici...');

    await sql`CREATE INDEX IF NOT EXISTS idx_control_logs_batch ON control_logs(batch_id)`;
    console.log('✅ Indice batch_id');

    await sql`CREATE INDEX IF NOT EXISTS idx_control_logs_zone ON control_logs(zone_id)`;
    console.log('✅ Indice zone_id');

    await sql`CREATE INDEX IF NOT EXISTS idx_control_logs_product ON control_logs(product_id)`;
    console.log('✅ Indice product_id');

    await sql`CREATE INDEX IF NOT EXISTS idx_control_logs_status ON control_logs(status)`;
    console.log('✅ Indice status');

    await sql`CREATE INDEX IF NOT EXISTS idx_control_logs_user ON control_logs(controlled_by_user_id)`;
    console.log('✅ Indice user_id');

    await sql`CREATE INDEX IF NOT EXISTS idx_control_logs_date ON control_logs(controlled_at DESC)`;
    console.log('✅ Indice data');

    await sql`CREATE INDEX IF NOT EXISTS idx_control_logs_batch_zone ON control_logs(batch_id, zone_id)`;
    console.log('✅ Indice batch+zone');

    // Crea view control_summary
    console.log('\n📋 Creazione view control_summary...');
    await sql`
      CREATE OR REPLACE VIEW control_summary AS
      SELECT
        batch_id,
        batch_name,
        zone_id,
        zone_name,
        controlled_by_name,
        DATE(controlled_at) as control_date,
        COUNT(*) as total_products,
        COUNT(*) FILTER (WHERE status = 'ok') as ok_count,
        COUNT(*) FILTER (WHERE status LIKE 'error%' OR status = 'damaged') as error_count,
        COUNT(*) FILTER (WHERE status = 'missing') as missing_count,
        COUNT(*) FILTER (WHERE status = 'note') as note_count,
        MIN(controlled_at) as first_control,
        MAX(controlled_at) as last_control
      FROM control_logs
      GROUP BY batch_id, batch_name, zone_id, zone_name, controlled_by_name, DATE(controlled_at)
      ORDER BY controlled_at DESC
    `;
    console.log('✅ View control_summary creata');

    // Crea view control_errors
    console.log('\n⚠️ Creazione view control_errors...');
    await sql`
      CREATE OR REPLACE VIEW control_errors AS
      SELECT
        cl.*,
        CASE
          WHEN status = 'error_qty' THEN '⚠️ Errore Quantità'
          WHEN status = 'missing' THEN '❌ Mancante'
          WHEN status = 'damaged' THEN '🔧 Danneggiato'
          WHEN status = 'lot_error' THEN '📅 Lotto Errato'
          WHEN status = 'location_error' THEN '📍 Ubicazione Errata'
          ELSE '📝 Nota'
        END as status_label
      FROM control_logs cl
      WHERE status != 'ok'
      ORDER BY controlled_at DESC
    `;
    console.log('✅ View control_errors creata');

    // Verifica
    console.log('\n🔍 Verifica tabella...');
    const result = await sql`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'control_logs'
      ORDER BY ordinal_position
    `;

    console.log(`\n✅ Tabella control_logs ha ${result.rowCount} colonne:`);
    result.rows.forEach((row: any) => {
      console.log(`   - ${row.column_name} (${row.data_type})`);
    });

    console.log('\n🎉 Setup completato con successo!');

  } catch (error: any) {
    console.error('❌ Errore durante la creazione:', error);
    throw error;
  }
}

// Esegui
createControlLogsTable()
  .then(() => {
    console.log('\n✅ Script terminato');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script fallito:', error);
    process.exit(1);
  });
