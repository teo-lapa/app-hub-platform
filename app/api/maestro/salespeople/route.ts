/**
 * MAESTRO AI - Salespeople API
 *
 * GET /api/maestro/salespeople
 * Ritorna lista venditori con clienti assegnati
 */

import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET() {
  try {
    console.log('📋 [MAESTRO-API] Fetching salespeople list...');

    // Fetch distinct salespeople from customer_avatars
    const result = await sql`
      SELECT DISTINCT
        assigned_salesperson_id,
        assigned_salesperson_name,
        COUNT(*) as customer_count
      FROM customer_avatars
      WHERE assigned_salesperson_id IS NOT NULL
        AND is_active = true
      GROUP BY assigned_salesperson_id, assigned_salesperson_name
      ORDER BY assigned_salesperson_name ASC
    `;

    const salespeople = result.rows.map(row => ({
      id: row.assigned_salesperson_id,
      name: row.assigned_salesperson_name,
      customer_count: parseInt(row.customer_count as string, 10)
    }));

    console.log(`✅ [MAESTRO-API] Found ${salespeople.length} salespeople`);

    return NextResponse.json({
      salespeople,
      total: salespeople.length
    });

  } catch (error: any) {
    console.error('❌ [MAESTRO-API] GET /salespeople error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch salespeople', details: error.message },
      { status: 500 }
    );
  }
}
