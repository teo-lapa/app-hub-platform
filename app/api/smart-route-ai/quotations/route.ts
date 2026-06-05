import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * GET /api/smart-route-ai/quotations
 * Preventivi non confermati (sale.order draft/sent), divisi tra e-commerce
 * (website_id valorizzato) e non. Include le righe per il dettaglio.
 *
 * POST /api/smart-route-ai/quotations  body: { orderId }
 * Convalida il preventivo (action_confirm) -> diventa ordine confermato.
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('odoo_session_id');
    if (!sessionCookie?.value) {
      return NextResponse.json({ success: false, error: 'No Odoo session' }, { status: 401 });
    }

    // Filtro per DATA DI CONSEGNA (commitment_date), agganciata alla data scelta
    // nell'Importa. Esclude automaticamente i preventivi senza data (false/1970).
    const sp = request.nextUrl.searchParams;
    const today = new Date().toISOString().slice(0, 10);
    const from = sp.get('from') || today;
    const to = sp.get('to') || from;

    const rpcClient = createOdooRPCClient(sessionCookie.value);

    const orders = await rpcClient.searchRead(
      'sale.order',
      [
        ['state', 'in', ['draft', 'sent']],
        ['commitment_date', '>=', `${from} 00:00:00`],
        ['commitment_date', '<=', `${to} 23:59:59`],
      ],
      ['id', 'name', 'partner_id', 'date_order', 'commitment_date', 'amount_total', 'state', 'website_id', 'order_line'],
      300,
      'commitment_date asc'
    );

    // Righe in bulk per il dettaglio al clic
    const allLineIds = Array.from(new Set(orders.flatMap((o: any) => o.order_line || [])));
    const linesByOrder = new Map<number, any[]>();
    if (allLineIds.length > 0) {
      const lines = await rpcClient.callKw(
        'sale.order.line',
        'read',
        [allLineIds, ['id', 'order_id', 'name', 'product_uom_qty', 'price_unit', 'price_subtotal']]
      );
      lines.forEach((l: any) => {
        const oid = l.order_id ? l.order_id[0] : 0;
        if (!linesByOrder.has(oid)) linesByOrder.set(oid, []);
        linesByOrder.get(oid)!.push({
          id: l.id,
          name: l.name,
          qty: l.product_uom_qty,
          price: l.price_unit,
          subtotal: l.price_subtotal,
        });
      });
    }

    const map = (o: any) => ({
      id: o.id,
      name: o.name,
      customer: o.partner_id ? o.partner_id[1] : 'N/A',
      date: o.date_order,
      deliveryDate: o.commitment_date || null,
      amount: o.amount_total || 0,
      state: o.state,
      isEcommerce: !!o.website_id,
      lines: linesByOrder.get(o.id) || [],
    });

    const all = orders.map(map);
    return NextResponse.json({
      success: true,
      ecommerce: all.filter((o: any) => o.isEcommerce),
      altri: all.filter((o: any) => !o.isEcommerce),
    });
  } catch (error: any) {
    console.error('[Smart Route AI] Errore preventivi:', error);
    return NextResponse.json({ success: false, error: error.message || 'Errore preventivi' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { orderId } = await request.json();
    if (!orderId) {
      return NextResponse.json({ success: false, error: 'orderId required' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('odoo_session_id');
    if (!sessionCookie?.value) {
      return NextResponse.json({ success: false, error: 'No Odoo session' }, { status: 401 });
    }

    const rpcClient = createOdooRPCClient(sessionCookie.value);
    await rpcClient.callKw('sale.order', 'action_confirm', [[orderId]]);

    return NextResponse.json({ success: true, message: 'Preventivo convalidato' });
  } catch (error: any) {
    console.error('[Smart Route AI] Errore convalida preventivo:', error);
    return NextResponse.json({ success: false, error: error.message || 'Errore convalida' }, { status: 500 });
  }
}
