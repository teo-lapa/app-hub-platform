import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Conta tutte le entries
    const totalCount = await sql`SELECT COUNT(*) as count FROM ta_time_entries`;

    // 2. Raggruppa per company
    const byCompany = await sql`
      SELECT company_id, COUNT(*) as count
      FROM ta_time_entries
      GROUP BY company_id
      ORDER BY company_id
    `;

    // 3. Ultime 50 entries
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
      LIMIT 50
    `;

    // 4. Entries nel range 26-27 Nov
    const inRange = await sql`
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

    // 5. Ultime entry prima del 26 Nov per ogni contatto
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

    return NextResponse.json({
      success: true,
      debug: {
        total_entries: totalCount.rows[0].count,
        by_company: byCompany.rows,
        recent_50: recent.rows,
        in_range_26_27_nov: {
          count: inRange.rows.length,
          entries: inRange.rows,
        },
        before_26_nov: {
          count: beforeRange.rows.length,
          entries: beforeRange.rows,
        },
      },
    });
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
