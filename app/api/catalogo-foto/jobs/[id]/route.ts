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
    const { status, odoo_product_id, odoo_product_name, result_json, error_message } = body;

    const processedAt = status === 'completed' ? new Date().toISOString() : null;

    const updates: string[] = ['updated_at = NOW()'];
    const values: any[] = [];
    let idx = 1;

    if (status !== undefined) { updates.push(`status = $${idx++}`); values.push(status); }
    if (odoo_product_id !== undefined) { updates.push(`odoo_product_id = $${idx++}`); values.push(odoo_product_id); }
    if (odoo_product_name !== undefined) { updates.push(`odoo_product_name = $${idx++}`); values.push(odoo_product_name); }
    if (result_json !== undefined) { updates.push(`result_json = $${idx++}::jsonb`); values.push(JSON.stringify(result_json)); }
    if (error_message !== undefined) { updates.push(`error_message = $${idx++}`); values.push(error_message); }
    if (processedAt) { updates.push(`processed_at = $${idx++}::timestamp`); values.push(processedAt); }

    await sql.query(`UPDATE catalog_photo_jobs SET ${updates.join(', ')} WHERE id = $${idx}`, [...values, id]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
