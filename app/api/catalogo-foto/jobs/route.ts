import { NextRequest, NextResponse } from 'next/server';
import { getOdooXMLRPCClient } from '@/lib/odoo-xmlrpc';

export const dynamic = 'force-dynamic';

const MODEL = 'x_catalog_photo_job';

function mapRecord(r: any) {
  const photoUrls = r.x_photo_urls ? safeJsonParse(r.x_photo_urls, []) : [];
  const resultJson = r.x_result_json ? safeJsonParse(r.x_result_json, null) : null;
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

function safeJsonParse(s: string, fallback: any) {
  try { return JSON.parse(s); } catch { return fallback; }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '20');

    const domain = status ? [['x_status', '=', status]] : [];
    const fields = [
      'id', 'x_operator_name', 'x_odoo_product_id', 'x_odoo_product_name',
      'x_notes', 'x_status', 'x_photo_urls', 'x_photo_count',
      'x_result_json', 'x_error_message', 'x_processed_at',
      'create_date', 'write_date'
    ];

    const client = await getOdooXMLRPCClient();
    const rows = await client.execute_kw(MODEL, 'search_read', [domain, fields], {
      limit,
      order: 'create_date desc'
    });

    const data = (rows || []).map(mapRecord);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { operator_name, notes, photo_urls } = await request.json();

    if (!operator_name || !photo_urls?.length) {
      return NextResponse.json({ success: false, error: 'operator_name e photo_urls richiesti' }, { status: 400 });
    }

    const client = await getOdooXMLRPCClient();
    const id = await client.execute_kw(MODEL, 'create', [{
      x_name: `Job ${new Date().toISOString()}`,
      x_operator_name: operator_name,
      x_notes: notes || false,
      x_photo_urls: JSON.stringify(photo_urls),
      x_photo_count: photo_urls.length,
      x_status: 'pending',
    }]);

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
