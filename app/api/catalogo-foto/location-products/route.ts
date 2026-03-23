import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getOdooSessionId } from '@/lib/odoo/odoo-helper';
import { injectLangContext } from '@/lib/odoo/user-lang';

export async function POST(request: NextRequest) {
  try {
    const sessionId = await getOdooSessionId();
    if (!sessionId) {
      return NextResponse.json({ success: false, error: 'Sessione non valida' }, { status: 401 });
    }

    const { locationCode } = await request.json();
    if (!locationCode) {
      return NextResponse.json({ success: false, error: 'locationCode richiesto' }, { status: 400 });
    }

    const odooUrl = process.env.ODOO_URL || process.env.NEXT_PUBLIC_ODOO_URL;

    // 1. Find location by barcode or name
    const locResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `session_id=${sessionId}` },
      body: JSON.stringify({
        jsonrpc: '2.0', method: 'call',
        params: {
          model: 'stock.location', method: 'search_read',
          args: [['|', ['barcode', '=', locationCode], ['name', 'ilike', locationCode]]],
          kwargs: injectLangContext({ fields: ['id', 'name', 'complete_name', 'barcode'], limit: 1 })
        }, id: 1
      })
    });
    const locData = await locResponse.json();
    const locations = locData.result || [];

    if (locations.length === 0) {
      return NextResponse.json({ success: false, error: 'Ubicazione non trovata' }, { status: 404 });
    }
    const location = locations[0];

    // 2. Get stock.quant at this location
    const quantsResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `session_id=${sessionId}` },
      body: JSON.stringify({
        jsonrpc: '2.0', method: 'call',
        params: {
          model: 'stock.quant', method: 'search_read',
          args: [[['location_id', '=', location.id], ['quantity', '>', 0]]],
          kwargs: injectLangContext({ fields: ['product_id', 'quantity'] })
        }, id: 2
      })
    });
    const quants = (await quantsResponse.json()).result || [];

    if (quants.length === 0) {
      return NextResponse.json({ success: true, location, products: [] });
    }

    // 3. Get unique product details
    const productIds = Array.from(new Set(quants.map((q: any) => q.product_id[0]))) as number[];

    const prodsResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `session_id=${sessionId}` },
      body: JSON.stringify({
        jsonrpc: '2.0', method: 'call',
        params: {
          model: 'product.product', method: 'search_read',
          args: [[['id', 'in', productIds]]],
          kwargs: injectLangContext({ fields: ['id', 'name', 'default_code', 'barcode', 'image_128', 'description_sale'] })
        }, id: 3
      })
    });
    const products = (await prodsResponse.json()).result || [];

    // 4. Check which products have been cataloged
    const jobsResult = await sql`
      SELECT DISTINCT odoo_product_id FROM catalog_photo_jobs
      WHERE status = 'completed' AND odoo_product_id IS NOT NULL
    `;
    const catalogedIds = new Set(jobsResult.rows.map(r => r.odoo_product_id));

    // 5. Build result - aggregate quantities per product
    const productMap = new Map<number, any>();
    for (const q of quants) {
      const pid = q.product_id[0];
      if (productMap.has(pid)) {
        productMap.get(pid).quantity += q.quantity;
      } else {
        const prod = products.find((p: any) => p.id === pid);
        productMap.set(pid, {
          id: pid,
          name: prod?.name || q.product_id[1],
          code: prod?.default_code || '',
          barcode: prod?.barcode || '',
          image: prod?.image_128 ? `data:image/png;base64,${prod.image_128}` : null,
          quantity: q.quantity,
          catalogato: catalogedIds.has(pid) || !!(prod?.description_sale),
        });
      }
    }

    const result = Array.from(productMap.values()).sort((a, b) => {
      if (a.catalogato !== b.catalogato) return a.catalogato ? 1 : -1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ success: true, location, products: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
