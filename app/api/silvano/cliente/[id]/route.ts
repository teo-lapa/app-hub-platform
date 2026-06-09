import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin } from '@/lib/silvano/odoo';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/silvano/cliente/[id]
 * Scheda cliente (read-only): anagrafica, sotto-contatti/indirizzi, fatture.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (isNaN(id)) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

    const partners = await callOdooAsAdmin('res.partner', 'search_read', [], {
      domain: [['id', '=', id]],
      fields: [
        'id', 'name', 'email', 'phone', 'mobile', 'vat', 'street', 'street2',
        'city', 'zip', 'comment', 'total_invoiced', 'credit',
        'property_product_pricelist', 'property_payment_term_id', 'user_id',
      ],
      limit: 1,
    });
    if (!partners?.length) return NextResponse.json({ success: false, error: 'Cliente non trovato' }, { status: 404 });
    const p = partners[0];

    // Sotto-contatti / indirizzi di consegna (figli)
    const children = await callOdooAsAdmin('res.partner', 'search_read', [], {
      domain: [['parent_id', '=', id]],
      fields: ['id', 'name', 'type', 'street', 'city', 'zip', 'phone', 'email'],
      order: 'type asc, name asc',
    });

    // Fatture cliente (anche dei figli)
    const invoices = await callOdooAsAdmin('account.move', 'search_read', [], {
      domain: [
        ['partner_id', 'child_of', id],
        ['move_type', '=', 'out_invoice'],
        ['state', '=', 'posted'],
      ],
      fields: ['id', 'name', 'invoice_date', 'invoice_date_due', 'amount_total', 'amount_residual', 'payment_state'],
      order: 'invoice_date desc',
      limit: 24,
    });

    // Ultimi ordini confermati + storico prodotti (per ricorrenza)
    const orders = await callOdooAsAdmin('sale.order', 'search_read', [], {
      domain: [['partner_id', 'child_of', id], ['state', 'in', ['sale', 'done']]],
      fields: ['id', 'name', 'date_order', 'amount_total'],
      order: 'date_order desc',
      limit: 80,
    });

    const ordini = orders.slice(0, 15).map((o: any) => ({
      id: o.id, name: o.name, date: o.date_order || null, total: o.amount_total || 0,
    }));

    const dateById = new Map<number, string>(orders.map((o: any) => [o.id, o.date_order]));
    const orderIds = orders.map((o: any) => o.id);

    const histLines = orderIds.length ? await callOdooAsAdmin('sale.order.line', 'search_read', [], {
      domain: [['order_id', 'in', orderIds], ['display_type', '=', false], ['product_id', '!=', false]],
      fields: ['product_id', 'product_uom_qty', 'order_id'],
    }) : [];

    const byProd = new Map<number, { id: number; name: string; entries: { date: string; qty: number }[] }>();
    for (const l of histLines as any[]) {
      const pid = l.product_id[0];
      const date = dateById.get(l.order_id[0]) || '';
      if (!byProd.has(pid)) byProd.set(pid, { id: pid, name: l.product_id[1], entries: [] });
      byProd.get(pid)!.entries.push({ date, qty: l.product_uom_qty || 0 });
    }

    const DAY = 86400000;
    const now = Date.now();
    const prodotti = Array.from(byProd.values()).map((p) => {
      const dates = Array.from(new Set(p.entries.map((e) => e.date).filter(Boolean)))
        .map((d) => new Date(d.replace(' ', 'T')).getTime())
        .filter((t) => !isNaN(t))
        .sort((a, b) => a - b);
      const timesBought = dates.length;
      const lastTs = dates[dates.length - 1] || 0;
      const lastEntry = p.entries.filter((e) => e.date).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
      const intervals: number[] = [];
      for (let i = 1; i < dates.length; i++) intervals.push((dates[i] - dates[i - 1]) / DAY);
      intervals.sort((a, b) => a - b);
      const cadence = intervals.length ? intervals[Math.floor(intervals.length / 2)] : 0;
      const daysSinceLast = lastTs ? Math.floor((now - lastTs) / DAY) : null;
      const recurring = timesBought >= 2;
      const lapsed = recurring && cadence > 0 && daysSinceLast != null && daysSinceLast > cadence * 1.5;
      const totalQty = p.entries.reduce((s, e) => s + (e.qty || 0), 0);
      return {
        id: p.id, name: p.name, timesBought,
        lastDate: lastEntry?.date || null, lastQty: lastEntry?.qty || 0, totalQty,
        cadenceDays: Math.round(cadence), daysSinceLast, recurring, lapsed,
      };
    }).sort((a, b) => {
      if (a.lapsed !== b.lapsed) return a.lapsed ? -1 : 1;
      if (a.recurring !== b.recurring) return a.recurring ? -1 : 1;
      return (b.lastDate || '').localeCompare(a.lastDate || '');
    }).slice(0, 60);

    return NextResponse.json({
      success: true,
      ordini,
      prodotti,
      cliente: {
        id: p.id,
        name: p.name,
        email: p.email || '',
        phone: p.phone || p.mobile || '',
        vat: p.vat || '',
        address: [p.street, p.street2, [p.zip, p.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
        note: p.comment || '',
        pricelist: p.property_product_pricelist ? p.property_product_pricelist[1] : '',
        paymentTerm: p.property_payment_term_id ? p.property_payment_term_id[1] : '',
        salesperson: p.user_id ? p.user_id[1] : '',
        totalInvoiced: p.total_invoiced || 0,
        credit: p.credit || 0,
      },
      contatti: children.map((c: any) => ({
        id: c.id,
        name: c.name,
        type: c.type || 'other',
        address: [c.street, [c.zip, c.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
        phone: c.phone || '',
        email: c.email || '',
      })),
      fatture: invoices.map((i: any) => ({
        id: i.id,
        name: i.name,
        date: i.invoice_date || null,
        dueDate: i.invoice_date_due || null,
        total: i.amount_total || 0,
        residual: i.amount_residual || 0,
        paymentState: i.payment_state || 'not_paid',
      })),
    });
  } catch (error: any) {
    console.error('💥 [SILVANO/cliente/:id]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
