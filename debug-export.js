// Debug script per verificare cosa c'è nel database
const { sql } = require('@vercel/postgres');

async function debug() {
  try {
    console.log('=== VERIFYING DATABASE ENTRIES ===\n');

    // 1. Verifica quante entries ci sono in totale
    const total = await sql`SELECT COUNT(*) as count FROM ta_time_entries`;
    console.log('Total entries in database:', total.rows[0].count);

    // 2. Verifica entries per company_id
    const companies = await sql`
      SELECT company_id, COUNT(*) as count
      FROM ta_time_entries
      GROUP BY company_id
      ORDER BY company_id
    `;
    console.log('\nEntries by company_id:');
    companies.rows.forEach(row => {
      console.log(`  Company ${row.company_id}: ${row.count} entries`);
    });

    // 3. Verifica le ultime 20 entries
    const recent = await sql`
      SELECT
        id,
        contact_id,
        company_id,
        entry_type,
        timestamp,
        contact_name
      FROM ta_time_entries
      ORDER BY timestamp DESC
      LIMIT 20
    `;

    console.log('\n=== LAST 20 ENTRIES ===');
    recent.rows.forEach(row => {
      console.log(`${row.timestamp} | Company: ${row.company_id} | Contact: ${row.contact_id} (${row.contact_name}) | Type: ${row.entry_type}`);
    });

    // 4. Verifica entries nel range 26-27 Nov 2025
    const rangeEntries = await sql`
      SELECT
        contact_id,
        company_id,
        entry_type,
        timestamp,
        contact_name
      FROM ta_time_entries
      WHERE timestamp >= '2025-11-26T00:00:00Z'
        AND timestamp <= '2025-11-27T23:59:59Z'
      ORDER BY timestamp ASC
    `;

    console.log(`\n=== ENTRIES IN RANGE 26-27 NOV 2025 ===`);
    console.log(`Found ${rangeEntries.rows.length} entries`);
    rangeEntries.rows.forEach(row => {
      console.log(`${row.timestamp} | Company: ${row.company_id} | Contact: ${row.contact_id} (${row.contact_name}) | Type: ${row.entry_type}`);
    });

    // 5. Verifica entries PRIMA del 26 Nov che potrebbero essere clock_in ancora aperti
    const beforeRange = await sql`
      SELECT DISTINCT ON (contact_id)
        contact_id,
        company_id,
        entry_type,
        timestamp,
        contact_name
      FROM ta_time_entries
      WHERE timestamp < '2025-11-26T00:00:00Z'
      ORDER BY contact_id, timestamp DESC
    `;

    console.log(`\n=== LAST ENTRY BEFORE 26 NOV FOR EACH CONTACT ===`);
    console.log(`Found ${beforeRange.rows.length} contacts with previous entries`);
    beforeRange.rows.forEach(row => {
      console.log(`Contact ${row.contact_id} (${row.contact_name}): ${row.entry_type} at ${row.timestamp}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

debug();
