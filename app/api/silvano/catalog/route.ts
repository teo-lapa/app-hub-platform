import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin, getClientPricelistId, enrichWithMargin } from '@/lib/silvano/odoo';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * GET /api/silvano/catalog?q=&clientId=&onlyAvailable=&limit=
 * Prodotti vendibili con foto, disponibilità, in arrivo, prezzo.
 * Se clientId è presente → prezzo di listino del cliente + costo/floor/quota margine.
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const q = (sp.get('q') || '').trim();
    const clientId = sp.get('clientId') ? Number(sp.get('clientId')) : null;
    const onlyAvailable = sp.get('onlyAvailable') === '1';
    const limit = Math.min(Number(sp.get('limit') || 48), 80);

    const domain: any[] = [['sale_ok', '=', true], ['active', '=', true]];
    if (q) {
      domain.push('|', ['name', 'ilike', q], ['default_code', 'ilike', q]);
    }
    if (onlyAvailable) domain.push(['qty_available', '>', 0]);

    const products = await callOdooAsAdmin('product.product', 'search_read', [], {
      domain,
      fields: [
        'id', 'name', 'default_code', 'list_price', 'standard_price',
        'image_128', 'qty_available', 'incoming_qty', 'uom_id', 'description_sale',
      ],
      limit,
      order: 'name asc',
    });

    let pricelistId: number | null = null;
    if (clientId) pricelistId = await getClientPricelistId(clientId);

    const enriched = clientId
      ? await enrichWithMargin(products, pricelistId, clientId)
      : products.map((p: any) => ({ ...p, base: p.list_price || 0 }));

    const items = enriched.map((p: any) => ({
      id: p.id,
      name: p.name,
      code: p.default_code || '',
      description: p.description_sale || '',
      uom: p.uom_id ? p.uom_id[1] : '',
      image: p.image_128 ? `/api/silvano/product-image/${p.id}?s=1024` : null,
      qtyAvailable: p.qty_available || 0,
      incomingQty: p.incoming_qty || 0,
      listPrice: p.list_price || 0,
      cost: p.standard_price || 0,
      base: p.base || 0,
      floor: p.floor != null ? p.floor : null,
      quota: p.quota != null ? p.quota : null,
      anomaly: p.anomaly || false,
    }));

    return NextResponse.json({ success: true, count: items.length, clientId, pricelistId, items });
  } catch (error: any) {
    console.error('💥 [SILVANO/catalog]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
