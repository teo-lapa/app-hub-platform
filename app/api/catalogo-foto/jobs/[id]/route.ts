import { NextRequest, NextResponse } from 'next/server';
import { getOdooClient } from '@/lib/odoo-client';

export const dynamic = 'force-dynamic';

const MODEL = 'x_catalog_photo_job';
const FIELDS = [
  'id', 'x_operator_name', 'x_odoo_product_id', 'x_odoo_product_name',
  'x_notes', 'x_status', 'x_photo_urls', 'x_photo_count',
  'x_result_json', 'x_error_message', 'x_processed_at',
  'create_date', 'write_date'
];

function safeJsonParse(s: any, fallback: any) {
  if (!s || typeof s !== 'string') return fallback;
  try { return JSON.parse(s); } catch { return fallback; }
}

function mapRecord(r: any) {
  const photoUrls = safeJsonParse(r.x_photo_urls, []);
  const resultJson = safeJsonParse(r.x_result_json, null);
  const odooProductId = Array.isArray(r.x_odoo_product_id) ? r.x_odoo_product_id[0] : (r.x_odoo_product_id || null);
  return {
    id: r.id,
    operator_name: r.x_operator_name || null,
    odoo_product_id: odooProductId,
    odoo_product_name: r.x_odoo_product_name || null,
    notes: r.x_notes || null,
    status: r.x_status || 'pending',
    photo_urls: photoUrls,
    photo_count: r.x_photo_count || 0,
    result_json: resultJson,
    error_message: r.x_error_message || null,
    processed_at: r.x_processed_at || null,
    created_at: r.create_date || null,
    updated_at: r.write_date || null,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const recordId = parseInt(id);
    if (isNaN(recordId)) {
      return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });
    }

    const client = await getOdooClient();
    const rows = await client.read(MODEL, [recordId], FIELDS);

    if (!rows || rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Job non trovato' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: mapRecord(rows[0]) });
  } catch (error: any) {
    console.error('catalogo-foto jobs/[id] GET error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const recordId = parseInt(id);
    if (isNaN(recordId)) {
      return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });
    }

    const body = await request.json();
    const values: any = {};

    if (body.status) values.x_status = body.status;
    if (body.notes !== undefined) values.x_notes = body.notes || false;
    if (body.odoo_product_id) values.x_odoo_product_id = body.odoo_product_id;
    if (body.odoo_product_name) values.x_odoo_product_name = body.odoo_product_name;
    if (body.result_json) values.x_result_json = JSON.stringify(body.result_json);
    if (body.error_message) values.x_error_message = body.error_message;
    if (body.status === 'completed') values.x_processed_at = new Date().toISOString().replace('T', ' ').split('.')[0];

    if (Object.keys(values).length > 0) {
      const client = await getOdooClient();
      await client.write(MODEL, [recordId], values);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('catalogo-foto jobs/[id] PATCH error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
