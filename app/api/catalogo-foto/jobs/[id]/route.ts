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
    const workerKey = request.headers.get('X-Worker-Key');
    const validKey = process.env.CATALOGO_WORKER_KEY || 'catalogo-foto-worker-2026';
    if (workerKey !== validKey) {
      return NextResponse.json({ success: false, error: 'Non autorizzato' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status, odoo_product_id, odoo_product_name, result_json, error_message } = body;

    const processedAt = status === 'completed' ? new Date().toISOString() : null;

    await sql`
      UPDATE catalog_photo_jobs SET
        status = COALESCE(${status || null}, status),
        odoo_product_id = COALESCE(${odoo_product_id || null}, odoo_product_id),
        odoo_product_name = COALESCE(${odoo_product_name || null}, odoo_product_name),
        result_json = COALESCE(${result_json ? JSON.stringify(result_json) : null}::jsonb, result_json),
        error_message = COALESCE(${error_message || null}, error_message),
        processed_at = COALESCE(${processedAt}::timestamp, processed_at),
        updated_at = NOW()
      WHERE id = ${id}
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
