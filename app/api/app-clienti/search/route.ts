import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin } from '@/lib/odoo/admin-session';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * GET /api/app-clienti/search?q=...&limit=...
 *
 * Ricerca prodotti ISTANTANEA stile lapa.ch: query Odoo secca, campi minimi,
 * immagine via URL (niente base64 = niente lentezza). Solo prodotti vendibili.
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') || '').trim();
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '24', 10) || 24, 80);

    // Dominio Odoo (notazione polacca): attivo + vendibile [+ match testo]
    let domain: any[] = [['active', '=', true], ['sale_ok', '=', true]];
    if (q) {
      domain = [
        '&', '&',
        ['active', '=', true],
        ['sale_ok', '=', true],
        '|', '|',
        ['name', 'ilike', q],
        ['default_code', 'ilike', q],
        ['barcode', 'ilike', q],
      ];
    }

    const rows: any[] = await callOdooAsAdmin('product.product', 'search_read', [], {
      domain,
      fields: ['id', 'name', 'default_code', 'list_price', 'uom_id', 'qty_available'],
      limit,
      order: 'name asc',
    });

    const products = (rows || []).map((p) => ({
      id: p.id,
      name: p.name || '',
      code: p.default_code || '',
      price: p.list_price ?? null,
      unit: Array.isArray(p.uom_id) ? p.uom_id[1] : '',
      available: (p.qty_available ?? 0) > 0,
      // Immagine via URL pubblico del sito (lazy-load nel browser → ricerca istantanea)
      image: `https://lapa.ch/web/image/product.product/${p.id}/image_128`,
    }));

    return NextResponse.json({ products });
  } catch (error: any) {
    return NextResponse.json({ products: [], error: error?.message || 'search failed' }, { status: 200 });
  }
}
