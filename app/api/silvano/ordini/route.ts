import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin, resolveSalesperson } from '@/lib/silvano/odoo';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const STATE_LABEL: Record<string, string> = {
  draft: 'Bozza', sent: 'Inviato', sale: 'Confermato', done: 'Completato', cancel: 'Annullato',
};

/**
 * GET /api/silvano/ordini?date=YYYY-MM-DD | ?from=&to=
 * Ordini del venditore per data di consegna (commitment_date). Default: domani.
 */
export async function GET(request: NextRequest) {
  try {
    const seller = await resolveSalesperson(request);
    const sp = request.nextUrl.searchParams;

    let from = sp.get('from');
    let to = sp.get('to');
    const date = sp.get('date');
    if (date) { from = date; to = date; }
    if (!from || !to) {
      const t = new Date(); t.setDate(t.getDate() + 1);
      const d = t.toISOString().slice(0, 10);
      from = d; to = d;
    }

    const domain: any[] = [
      ['commitment_date', '>=', `${from} 00:00:00`],
      ['commitment_date', '<=', `${to} 23:59:59`],
      ['state', '!=', 'cancel'],
    ];
    if (seller.userId) domain.push(['user_id', '=', seller.userId]);

    const orders = await callOdooAsAdmin('sale.order', 'search_read', [], {
      domain,
      fields: ['id', 'name', 'partner_id', 'commitment_date', 'date_order', 'amount_total', 'amount_untaxed', 'state'],
      order: 'commitment_date asc, name asc',
      limit: 300,
    });

    const ordini = orders.map((o: any) => ({
      id: o.id,
      name: o.name,
      cliente: o.partner_id ? o.partner_id[1] : '',
      clienteId: o.partner_id ? o.partner_id[0] : null,
      deliveryDate: o.commitment_date || null,
      dateOrder: o.date_order || null,
      total: o.amount_total || 0,
      untaxed: o.amount_untaxed || 0,
      state: o.state,
      stateLabel: STATE_LABEL[o.state] || o.state,
    }));

    const totale = ordini.reduce((s: number, o: any) => s + o.total, 0);
    return NextResponse.json({ success: true, from, to, count: ordini.length, totale, ordini });
  } catch (error: any) {
    console.error('💥 [SILVANO/ordini]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
