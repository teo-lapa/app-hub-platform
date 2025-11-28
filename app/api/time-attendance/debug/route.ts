import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

/**
 * GET /api/time-attendance/debug
 * API di diagnostica per vedere cosa c'è nel database
 *
 * Query params:
 * - company_id: ID dell'azienda (opzionale)
 * - contact_id: ID del contatto (opzionale)
 * - limit: Numero massimo di risultati (default 100)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('company_id');
    const contactId = searchParams.get('contact_id');
    const limit = parseInt(searchParams.get('limit') || '100');

    // 1. Conta totale entries nel database
    const totalCountResult = await sql`
      SELECT COUNT(*) as total FROM ta_time_entries
    `;
    const totalEntries = parseInt(totalCountResult.rows[0]?.total || '0');

    // 2. Lista tutte le company_id distinte
    const companiesResult = await sql`
      SELECT DISTINCT company_id, COUNT(*) as entries_count
      FROM ta_time_entries
      WHERE company_id IS NOT NULL
      GROUP BY company_id
      ORDER BY entries_count DESC
    `;
    const companies = companiesResult.rows;

    // 3. Lista tutti i contact_id distinti
    const contactsResult = await sql`
      SELECT DISTINCT contact_id, company_id, COUNT(*) as entries_count
      FROM ta_time_entries
      GROUP BY contact_id, company_id
      ORDER BY entries_count DESC
      LIMIT ${limit}
    `;
    const contacts = contactsResult.rows;

    // 4. Range di date delle entries
    const dateRangeResult = await sql`
      SELECT
        MIN(timestamp) as earliest_entry,
        MAX(timestamp) as latest_entry
      FROM ta_time_entries
    `;
    const dateRange = dateRangeResult.rows[0];

    // 5. Se company_id specificato, mostra dettagli
    let companyEntries = null;
    if (companyId) {
      const companyEntriesResult = await sql`
        SELECT
          id,
          contact_id,
          company_id,
          entry_type,
          timestamp,
          latitude,
          longitude,
          location_name,
          break_type
        FROM ta_time_entries
        WHERE company_id = ${parseInt(companyId)}
        ORDER BY timestamp DESC
        LIMIT ${limit}
      `;
      companyEntries = companyEntriesResult.rows;
    }

    // 6. Se contact_id specificato, mostra dettagli
    let contactEntries = null;
    if (contactId) {
      const contactEntriesResult = await sql`
        SELECT
          id,
          contact_id,
          company_id,
          entry_type,
          timestamp,
          latitude,
          longitude,
          location_name,
          break_type
        FROM ta_time_entries
        WHERE contact_id = ${parseInt(contactId)}
        ORDER BY timestamp DESC
        LIMIT ${limit}
      `;
      contactEntries = contactEntriesResult.rows;
    }

    // 7. Ultime 20 entries (per vedere cosa è stato registrato recentemente)
    const recentEntriesResult = await sql`
      SELECT
        id,
        contact_id,
        company_id,
        entry_type,
        timestamp,
        location_name,
        created_at
      FROM ta_time_entries
      ORDER BY created_at DESC
      LIMIT 20
    `;
    const recentEntries = recentEntriesResult.rows;

    // 8. Statistiche per entry_type
    const entryTypesResult = await sql`
      SELECT entry_type, COUNT(*) as count
      FROM ta_time_entries
      GROUP BY entry_type
      ORDER BY count DESC
    `;
    const entryTypes = entryTypesResult.rows;

    // 9. Entries di oggi (timezone Rome)
    const todayEntriesResult = await sql`
      SELECT
        id,
        contact_id,
        company_id,
        entry_type,
        timestamp
      FROM ta_time_entries
      WHERE DATE(timestamp AT TIME ZONE 'Europe/Rome') = CURRENT_DATE
      ORDER BY timestamp DESC
    `;
    const todayEntries = todayEntriesResult.rows;

    return NextResponse.json({
      success: true,
      database_summary: {
        total_entries: totalEntries,
        companies_with_entries: companies.length,
        contacts_with_entries: contacts.length,
        date_range: {
          earliest: dateRange?.earliest_entry,
          latest: dateRange?.latest_entry,
        },
        entry_types: entryTypes,
      },
      companies,
      contacts,
      today_entries: {
        count: todayEntries.length,
        entries: todayEntries,
      },
      recent_entries: recentEntries,
      ...(companyEntries && { company_entries: companyEntries }),
      ...(contactEntries && { contact_entries: contactEntries }),
    });

  } catch (error) {
    console.error('Debug API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore nella diagnostica',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
