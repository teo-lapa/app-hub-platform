import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin } from '@/lib/silvano/odoo';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * GET /api/silvano/ultimo-acquisto?clientId=&productId=
 * Data dell'ultima volta che il cliente ha ORDINATO quel prodotto (non consegnato).
 * Si basa sugli ordini confermati (sale/done), data ordine.
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const clientId = Number(sp.get('clientId'));
    const productId = Number(sp.get('productId'));
    if (!clientId || !productId) {
      return NextResponse.json({ success: false, error: 'clientId e productId obbligatori' }, { status: 400 });
    }

    const orders = await callOdooAsAdmin('sale.order', 'search_read', [], {
      domain: [
        ['partner_id', 'child_of', clientId],
        ['order_line.product_id', '=', productId],
        ['state', 'in', ['sale', 'done']],
      ],
      fields: ['date_order'],
      order: 'date_order desc',
      limit: 1,
    });

    return NextResponse.json({ success: true, lastDate: orders?.[0]?.date_order || null });
  } catch (error: any) {
    console.error('💥 [SILVANO/ultimo-acquisto]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
