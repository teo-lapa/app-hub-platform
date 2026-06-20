import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin } from '@/lib/odoo/admin-session';
import { resolveCustomer } from '@/lib/app-clienti/customer';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const stateLabel = (s: string) =>
  ({ draft: 'Bozza', sent: 'Inviato', sale: 'Confermato', done: 'Completato', cancel: 'Annullato' } as Record<string, string>)[s] || s;

/** GET /api/app-clienti/orders — ordini di TUTTO il gruppo aziendale del cliente loggato */
export async function GET(request: NextRequest) {
  try {
    const cust = await resolveCustomer(request);
    if (!cust) return NextResponse.json({ success: false, orders: [], error: 'Cliente non identificato' }, { status: 200 });

    const rows: any[] = await callOdooAsAdmin('sale.order', 'search_read', [], {
      domain: [
        ['partner_id', 'child_of', cust.commercialId],
        ['state', 'in', ['draft', 'sent', 'sale', 'done']],
      ],
      fields: ['id', 'name', 'date_order', 'amount_total', 'state', 'order_line', 'invoice_status', 'delivery_status', 'picking_ids'],
      order: 'date_order desc',
      limit: 100,
    });

    const orders = (rows || []).map((o) => ({
      id: o.id,
      name: o.name,
      date: o.date_order,
      total: o.amount_total,
      state: o.state,
      stateLabel: stateLabel(o.state),
      productsCount: Array.isArray(o.order_line) ? o.order_line.length : 0,
      invoiceStatus: o.invoice_status,
      deliveryStatus: o.delivery_status,
      pickingIds: Array.isArray(o.picking_ids) ? o.picking_ids : [],
    }));

    return NextResponse.json({ success: true, orders });
  } catch (error: any) {
    return NextResponse.json({ success: false, orders: [], error: error?.message || 'errore' }, { status: 200 });
  }
}
