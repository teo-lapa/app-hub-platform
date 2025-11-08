/**
 * Debug API: Check cadences status
 */

import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET() {
  try {
    // Check all suppliers with cadences
    const result = await sql`
      SELECT
        id,
        odoo_supplier_id,
        name,
        is_active,
        cadence_value,
        cadence_type,
        next_order_date,
        days_until_next_order,
        last_cadence_order_date
      FROM supplier_avatars
      WHERE days_until_next_order IS NOT NULL
      ORDER BY days_until_next_order ASC
      LIMIT 20
    `;

    // Count by status
    const statsResult = await sql`
      SELECT
        is_active,
        COUNT(*) as count,
        COUNT(CASE WHEN days_until_next_order = 0 THEN 1 END) as today,
        COUNT(CASE WHEN days_until_next_order = 1 THEN 1 END) as tomorrow,
        COUNT(CASE WHEN days_until_next_order <= 7 AND days_until_next_order > 1 THEN 1 END) as this_week
      FROM supplier_avatars
      GROUP BY is_active
    `;

    return NextResponse.json({
      success: true,
      suppliers: result.rows,
      stats: statsResult.rows,
      count: result.rows.length
    });

  } catch (error: any) {
    console.error('❌ Error checking cadences:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
