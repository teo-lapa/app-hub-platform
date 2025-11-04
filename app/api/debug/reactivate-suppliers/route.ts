/**
 * Debug API: Reactivate all suppliers with cadences
 *
 * This endpoint reactivates all suppliers that have valid cadences configured.
 * Use with caution - this will reactivate ALL suppliers in the database.
 */

import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function POST() {
  try {
    // Reactivate all suppliers with valid cadences
    const result = await sql`
      UPDATE supplier_avatars
      SET is_active = true
      WHERE cadence_value IS NOT NULL
        AND cadence_value > 0
      RETURNING id, odoo_supplier_id, name, cadence_value, next_order_date, days_until_next_order
    `;

    // Get updated stats
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
      message: `Reactivated ${result.rows.length} suppliers`,
      reactivated_suppliers: result.rows,
      stats: statsResult.rows
    });

  } catch (error: any) {
    console.error('❌ Error reactivating suppliers:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
