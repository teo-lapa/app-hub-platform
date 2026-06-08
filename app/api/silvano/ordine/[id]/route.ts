import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin, getClientPrice } from '@/lib/silvano/odoo';
import { computeMarginInfo, marginAtPrice } from '@/lib/silvano/margin';

export const dynamic = 'force-dynamic';
export const maxDuration = 90;

/**
 * GET /api/silvano/ordine/[id]
 * Dettaglio ordine con righe (ordinato/consegnato/prezzo/totale) e MARGINE del venditore per riga.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (isNaN(id)) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

    const orders = await callOdooAsAdmin('sale.order', 'search_read', [], {
      domain: [['id', '=', id]],
      fields: ['id', 'name', 'partner_id', 'partner_shipping_id', 'commitment_date', 'date_order',
        'amount_total', 'amount_untaxed', 'state', 'order_line', 'pricelist_id', 'note'],
      limit: 1,
    });
    if (!orders?.length) return NextResponse.json({ success: false, error: 'Ordine non trovato' }, { status: 404 });
    const o = orders[0];
    const pricelistId = o.pricelist_id ? o.pricelist_id[0] : null;
    const partnerId = o.partner_id ? o.partner_id[0] : null;

    const lines = await callOdooAsAdmin('sale.order.line', 'search_read', [], {
      domain: [['order_id', '=', id], ['display_type', '=', false]],
      fields: ['id', 'product_id', 'name', 'product_uom_qty', 'qty_delivered',
        'price_unit', 'price_subtotal', 'price_total', 'discount'],
    });

    const productIds = lines.filter((l: any) => l.product_id).map((l: any) => l.product_id[0]);
    const products = productIds.length
      ? await callOdooAsAdmin('product.product', 'search_read', [], {
          domain: [['id', 'in', productIds]],
          fields: ['id', 'standard_price', 'list_price', 'default_code'],
        })
      : [];
    const pmap = new Map(products.map((p: any) => [p.id, p]));

    const baseCache = new Map<number, number>();
    let totMargine = 0;

    const enriched = [];
    for (const l of lines) {
      const pid = l.product_id ? l.product_id[0] : null;
      const prod: any = pid ? pmap.get(pid) : null;
      const cost = prod?.standard_price || 0;

      let base = prod?.list_price || l.price_unit || 0;
      if (pid && pricelistId) {
        if (baseCache.has(pid)) base = baseCache.get(pid)!;
        else {
          const cp = await getClientPrice(pricelistId, pid, l.product_uom_qty || 1, partnerId);
          if (cp != null) base = cp;
          baseCache.set(pid, base);
        }
      }
      const info = computeMarginInfo(base, cost);
      const margineUnit = marginAtPrice(l.price_unit || 0, info.floor);
      const margineRiga = margineUnit * (l.product_uom_qty || 0);
      totMargine += margineRiga;

      enriched.push({
        id: l.id,
        productId: pid,
        code: prod?.default_code || '',
        name: l.name || (l.product_id ? l.product_id[1] : ''),
        qtyOrdered: l.product_uom_qty || 0,
        qtyDelivered: l.qty_delivered || 0,
        priceUnit: l.price_unit || 0,
        discount: l.discount || 0,
        subtotal: l.price_subtotal || 0,
        total: l.price_total || 0,
        cost,
        floor: info.floor,
        listino: info.base,
        margineUnit,
        margineRiga,
      });
    }

    const STATE_LABEL: Record<string, string> = {
      draft: 'Bozza', sent: 'Inviato', sale: 'Confermato', done: 'Completato', cancel: 'Annullato',
    };

    return NextResponse.json({
      success: true,
      ordine: {
        id: o.id,
        name: o.name,
        cliente: o.partner_id ? o.partner_id[1] : '',
        clienteId: partnerId,
        deliveryAddress: o.partner_shipping_id ? o.partner_shipping_id[1] : '',
        deliveryDate: o.commitment_date || null,
        dateOrder: o.date_order || null,
        total: o.amount_total || 0,
        untaxed: o.amount_untaxed || 0,
        state: o.state,
        stateLabel: STATE_LABEL[o.state] || o.state,
        note: o.note || '',
        margineVenditore: totMargine,
        righe: enriched,
      },
    });
  } catch (error: any) {
    console.error('💥 [SILVANO/ordine/:id]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
