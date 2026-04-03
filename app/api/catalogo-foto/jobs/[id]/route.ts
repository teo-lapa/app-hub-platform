import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await sql`
      SELECT * FROM catalog_photo_jobs WHERE id = ${id}
    `;

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Job non trovato' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Always update status if provided
    if (body.status) {
      await sql`UPDATE catalog_photo_jobs SET status = ${body.status}, updated_at = NOW() WHERE id = ${id}`;
    }

    // Update notes if provided (for review instructions)
    if (body.notes !== undefined) {
      await sql`UPDATE catalog_photo_jobs SET notes = ${body.notes}, updated_at = NOW() WHERE id = ${id}`;
    }

    // Update result fields if provided
    if (body.result_json || body.odoo_product_id || body.odoo_product_name || body.error_message) {
      const resultJsonStr = body.result_json ? JSON.stringify(body.result_json) : null;
      const processedAt = body.status === 'completed' ? new Date().toISOString() : null;
      await sql`
        UPDATE catalog_photo_jobs SET
          odoo_product_id = COALESCE(${body.odoo_product_id || null}, odoo_product_id),
          odoo_product_name = COALESCE(${body.odoo_product_name || null}, odoo_product_name),
          result_json = COALESCE(${resultJsonStr}::jsonb, result_json),
          error_message = COALESCE(${body.error_message || null}, error_message),
          processed_at = COALESCE(${processedAt}::timestamp, processed_at),
          updated_at = NOW()
        WHERE id = ${id}
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
