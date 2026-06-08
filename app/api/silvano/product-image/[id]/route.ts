import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession, callOdooAsAdmin } from '@/lib/odoo/admin-session';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const ODOO_URL = process.env.ODOO_URL || process.env.NEXT_PUBLIC_ODOO_URL || '';
const SIZES = ['128', '256', '512', '1024', '1920'];

/**
 * GET /api/silvano/product-image/[id]?s=1024
 * Streama la foto prodotto ad alta risoluzione da Odoo (image_1024 di default),
 * con cache, cosi il browser carica immagini nitide in lazy-load (no base64 in pagina).
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (isNaN(id)) return new NextResponse(null, { status: 400 });
    const s = request.nextUrl.searchParams.get('s') || '1024';
    const field = SIZES.includes(s) ? `image_${s}` : 'image_1024';

    const cache = 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800';

    // 1) prova l'endpoint immagine nativo di Odoo (alta risoluzione, leggero)
    try {
      const { sessionId } = await getAdminSession();
      const url = `${ODOO_URL}/web/image/product.product/${id}/${field}`;
      const res = await fetch(url, { headers: { Cookie: `session_id=${sessionId}` } });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.startsWith('image/')) {
        const buf = await res.arrayBuffer();
        return new NextResponse(buf, { headers: { 'Content-Type': ct, 'Cache-Control': cache } });
      }
    } catch { /* fallback sotto */ }

    // 2) fallback: base64 via sessione admin (image_512)
    const rec = await callOdooAsAdmin('product.product', 'read', [[id], ['image_512']], {});
    const b64 = rec?.[0]?.image_512;
    if (!b64) return new NextResponse(null, { status: 404 });
    return new NextResponse(Buffer.from(b64, 'base64'), {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': cache },
    });
  } catch (error: any) {
    console.error('💥 [SILVANO/product-image]', error?.message);
    return new NextResponse(null, { status: 500 });
  }
}
