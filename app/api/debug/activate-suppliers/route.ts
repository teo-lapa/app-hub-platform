/**
 * Debug API: Activate suppliers from list
 *
 * POST body: { "suppliers": ["FORNITORE 1", "FORNITORE 2", ...] }
 * or: { "activate_all": true }
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Option 1: Activate all suppliers with cadences
    if (body.activate_all === true) {
      const result = await sql`
        UPDATE supplier_avatars
        SET is_active = true
        WHERE cadence_value IS NOT NULL
          AND cadence_value > 0
        RETURNING id, odoo_supplier_id, name, cadence_value, next_order_date, days_until_next_order
      `;

      return NextResponse.json({
        success: true,
        message: `Activated ${result.rows.length} suppliers`,
        activated: result.rows
      });
    }

    // Option 2: Activate specific suppliers by name
    if (Array.isArray(body.suppliers) && body.suppliers.length > 0) {
      const supplierNames = body.suppliers;

      const result = await sql`
        UPDATE supplier_avatars
        SET is_active = true
        WHERE name = ANY(${supplierNames})
        RETURNING id, odoo_supplier_id, name, cadence_value, next_order_date, days_until_next_order
      `;

      // Check for suppliers not found
      const activatedNames = result.rows.map(r => r.name);
      const notFound = supplierNames.filter((name: string) => !activatedNames.includes(name));

      return NextResponse.json({
        success: true,
        message: `Activated ${result.rows.length} suppliers`,
        activated: result.rows,
        not_found: notFound.length > 0 ? notFound : undefined
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid request body. Provide either "activate_all": true or "suppliers": ["name1", "name2"]'
    }, { status: 400 });

  } catch (error: any) {
    console.error('❌ Error activating suppliers:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
