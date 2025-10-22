import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Count total
    const total = await sql`SELECT COUNT(*) as count FROM customer_avatars WHERE is_active = true`;

    // Count by salesperson
    const bySalesperson = await sql`
      SELECT
        assigned_salesperson_id,
        assigned_salesperson_name,
        COUNT(*) as count
      FROM customer_avatars
      WHERE is_active = true
      GROUP BY assigned_salesperson_id, assigned_salesperson_name
      ORDER BY count DESC
    `;

    // Last sync
    const lastSync = await sql`
      SELECT MAX(last_sync_odoo) as last_sync, MAX(updated_at) as last_update
      FROM customer_avatars
    `;

    return NextResponse.json({
      success: true,
      data: {
        total_active: total.rows[0].count,
        by_salesperson: bySalesperson.rows,
        last_sync: lastSync.rows[0].last_sync,
        last_update: lastSync.rows[0].last_update
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
