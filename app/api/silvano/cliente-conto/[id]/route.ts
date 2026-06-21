import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin } from '@/lib/silvano/odoo';
import { SHARE } from '@/lib/silvano/config';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/silvano/cliente-conto/[id]?from=&to=
 * Scheda "conto" del singolo cliente: guadagno per mese (dagli ordini),
 * fatture con residuo (da incassare) e riscuotibile/in attesa per il venditore.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const clientId = Number(params.id);
    if (isNaN(clientId)) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

    const sp = request.nextUrl.searchParams;
    const now = new Date();
    const from = sp.get('from') || new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
    const to = sp.get('to') || now.toISOString().slice(0, 10);

    // === Ordini del cliente: fatturato + guadagno per mese ===
    const orders = await callOdooAsAdmin('sale.order', 'search_read', [], {
      domain: [
        ['commercial_partner_id', '=', clientId],
        ['state', 'in', ['sale', 'done']],
        ['date_order', '>=', `${from} 00:00:00`],
        ['date_order', '<=', `${to} 23:59:59`],
      ],
      fields: ['id', 'order_line', 'date_order', 'amount_untaxed'],
      limit: 2000,
    });
    const orderMonth = new Map<number, string>(orders.map((o: any): [number, string] => [o.id, (o.date_order || '').slice(0, 7)]));
    const perMese = new Map<string, { fatturato: number; guadagno: number }>();
    for (const o of orders) {
      const ym = (o.date_order || '').slice(0, 7);
      if (!ym) continue;
      const cur = perMese.get(ym) || { fatturato: 0, guadagno: 0 };
      cur.fatturato += o.amount_untaxed || 0;
      perMese.set(ym, cur);
    }
    const orderLineIds: number[] = orders.flatMap((o: any) => o.order_line || []);
    if (orderLineIds.length) {
      const lines = await callOdooAsAdmin('sale.order.line', 'search_read', [], {
        domain: [['id', 'in', orderLineIds], ['display_type', '=', false], ['product_id', '!=', false]],
        fields: ['product_id', 'product_uom_qty', 'price_unit', 'order_id'],
        limit: 20000,
      });
      const prodIds = Array.from(new Set(lines.map((l: any) => l.product_id[0])));
      const products = await callOdooAsAdmin('product.product', 'search_read', [], {
        domain: [['id', 'in', prodIds]], fields: ['id', 'standard_price'],
      });
      const costMap = new Map<number, number>(products.map((p: any): [number, number] => [p.id, p.standard_price || 0]));
      for (const l of lines) {
        const cost = costMap.get(l.product_id[0]) || 0;
        const g = SHARE * Math.max(0, Number(l.price_unit) - cost) * Number(l.product_uom_qty);
        const ym = orderMonth.get(l.order_id[0]);
        if (ym) { const cur = perMese.get(ym) || { fatturato: 0, guadagno: 0 }; cur.guadagno += g; perMese.set(ym, cur); }
      }
    }
    const mesi = Array.from(perMese.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([ym, v]) => ({ ym, fatturato: v.fatturato, guadagno: v.guadagno }));

    // === Fatture del cliente: lista + riscuotibile/attesa ===
    const invoices = await callOdooAsAdmin('account.move', 'search_read', [], {
      domain: [
        ['commercial_partner_id', '=', clientId],
        ['move_type', '=', 'out_invoice'],
        ['state', '=', 'posted'],
        ['invoice_date', '>=', from],
        ['invoice_date', '<=', to],
      ],
      fields: ['id', 'name', 'invoice_date', 'amount_total', 'amount_residual', 'payment_state', 'invoice_line_ids'],
      limit: 2000,
    });
    const invLineIds: number[] = invoices.flatMap((m: any) => m.invoice_line_ids || []);
    const margineFatt = new Map<number, number>();
    if (invLineIds.length) {
      const invLines = await callOdooAsAdmin('account.move.line', 'search_read', [], {
        domain: [['id', 'in', invLineIds], ['display_type', '=', 'product'], ['product_id', '!=', false]],
        fields: ['product_id', 'quantity', 'price_unit', 'move_id'],
        limit: 20000,
      });
      const ipIds = Array.from(new Set(invLines.map((l: any) => l.product_id[0])));
      const iprods = await callOdooAsAdmin('product.product', 'search_read', [], {
        domain: [['id', 'in', ipIds]], fields: ['id', 'standard_price'],
      });
      const icost = new Map<number, number>(iprods.map((p: any): [number, number] => [p.id, p.standard_price || 0]));
      for (const l of invLines) {
        const c = icost.get(l.product_id[0]) || 0;
        const m = SHARE * Math.max(0, Number(l.price_unit) - c) * Number(l.quantity);
        const mid: number = l.move_id[0];
        margineFatt.set(mid, (margineFatt.get(mid) || 0) + m);
      }
    }
    let riscuotibile = 0, attesa = 0, daIncassare = 0;
    const fatture = invoices.map((inv: any) => {
      const m = margineFatt.get(inv.id) || 0;
      const tot = Number(inv.amount_total) || 0;
      const res = Number(inv.amount_residual) || 0;
      const frac = tot > 0 ? Math.min(1, Math.max(0, (tot - res) / tot)) : 1;
      riscuotibile += m * frac; attesa += m * (1 - frac); daIncassare += res;
      return { id: inv.id, name: inv.name, date: inv.invoice_date || null, total: tot, residual: res, paymentState: inv.payment_state || '' };
    }).sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''));

    const fatturato = orders.reduce((s: number, o: any) => s + (o.amount_untaxed || 0), 0);
    const guadagno = mesi.reduce((s: number, m: any) => s + m.guadagno, 0);
    const partner = await callOdooAsAdmin('res.partner', 'search_read', [], {
      domain: [['id', '=', clientId]], fields: ['id', 'name'], limit: 1,
    });

    return NextResponse.json({
      success: true,
      cliente: partner[0] || { id: clientId, name: '' },
      mesi,
      fatture,
      totali: { fatturato, guadagno, riscuotibile, attesa, daIncassare },
    });
  } catch (error: any) {
    console.error('💥 [SILVANO/cliente-conto]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
