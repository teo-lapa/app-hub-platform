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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '20');

    const domain = status ? [['x_status', '=', status]] : [];

    const client = await getOdooClient();
    const rows = await client.searchReadKw(MODEL, domain, FIELDS, {
      limit,
      order: 'create_date desc'
    });

    const data = (rows || []).map(mapRecord);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('catalogo-foto jobs GET error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { operator_name, notes, photo_urls } = await request.json();

    if (!operator_name || !photo_urls?.length) {
      return NextResponse.json({ success: false, error: 'operator_name e photo_urls richiesti' }, { status: 400 });
    }

    const client = await getOdooClient();
    const ids = await client.create(MODEL, [{
      x_name: `Job ${new Date().toISOString()}`,
      x_operator_name: operator_name,
      x_notes: notes || false,
      x_photo_urls: JSON.stringify(photo_urls),
      x_photo_count: photo_urls.length,
      x_status: 'pending',
    }]);

    const id = Array.isArray(ids) ? ids[0] : ids;
    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    console.error('catalogo-foto jobs POST error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
