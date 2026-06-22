import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin, getClientPrice, LAPA_COMPANY_ID } from '@/lib/silvano/odoo';
import { computeMarginInfo, marginAtPrice } from '@/lib/silvano/margin';

export const dynamic = 'force-dynamic';
export const maxDuration = 90;

// Solo bozze e bozze inviate sono modificabili dal venditore.
const EDITABLE_STATES = ['draft', 'sent'];

/** Contesto ordine: stato, listino, cliente. */
async function orderCtx(id: number) {
  const orders = await callOdooAsAdmin('sale.order', 'search_read', [], {
    domain: [['id', '=', id]],
    fields: ['id', 'state', 'pricelist_id', 'partner_id'],
    limit: 1,
  });
  return orders?.[0] || null;
}

/** Floor + prezzo "clampato" (mai sotto il minimo) per un prodotto su questo ordine. */
async function priceInfo(
  productId: number, qty: number, pricelistId: number | null, partnerId: number | null, wantedPrice: number
) {
  const prods = await callOdooAsAdmin('product.product', 'search_read', [], {
    domain: [['id', '=', productId]],
    fields: ['id', 'name', 'standard_price', 'list_price', 'active', 'sale_ok'],
    limit: 1,
  });
  const prod: any = prods?.[0];
  if (!prod) throw new Error('Prodotto non trovato');

  let base = prod.list_price || 0;
  if (pricelistId) {
    const cp = await getClientPrice(pricelistId, productId, qty || 1, partnerId || 0);
    if (cp != null) base = cp;
  }
  const info = computeMarginInfo(base, prod.standard_price || 0);
  let price = Number(wantedPrice);
  let clamped = false;
  if (!isFinite(price) || price < info.floor) { price = info.floor; clamped = true; }
  return { prod, floor: info.floor, price, clamped };
}

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
        'amount_total', 'amount_untaxed', 'state', 'order_line', 'pricelist_id', 'note', 'picking_ids'],
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
        name: (l.product_id ? l.product_id[1] : (l.name || '').split('\n')[0]),
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

    // Annullabile: preventivo (draft/sent) sempre; ordine confermato solo se
    // NESSUN picking è già stato preparato/consegnato (assigned/done).
    let cancellable = EDITABLE_STATES.includes(o.state);
    if (o.state === 'sale') {
      const pickIds: number[] = o.picking_ids || [];
      if (pickIds.length) {
        const picks = await callOdooAsAdmin('stock.picking', 'search_read', [], {
          domain: [['id', 'in', pickIds]],
          fields: ['state'],
        });
        cancellable = !picks.some((p: any) => p.state === 'assigned' || p.state === 'done');
      } else {
        cancellable = true;
      }
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
        editable: EDITABLE_STATES.includes(o.state),
        cancellable,
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

/**
 * PATCH /api/silvano/ordine/[id]  → modifica una riga { lineId, qty?, price? }
 * Prezzo riportato al minimo se sotto il floor.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    const { lineId, qty, price } = await request.json();
    const order = await orderCtx(id);
    if (!order) return NextResponse.json({ success: false, error: 'Ordine non trovato' }, { status: 404 });
    if (!EDITABLE_STATES.includes(order.state))
      return NextResponse.json({ success: false, error: 'Ordine non più modificabile' }, { status: 400 });

    const lines = await callOdooAsAdmin('sale.order.line', 'search_read', [], {
      domain: [['id', '=', Number(lineId)], ['order_id', '=', id]],
      fields: ['id', 'product_id', 'product_uom_qty', 'price_unit'],
      limit: 1,
    });
    const line: any = lines?.[0];
    if (!line || !line.product_id) return NextResponse.json({ success: false, error: 'Riga non trovata' }, { status: 404 });

    const pid = line.product_id[0];
    const newQty = qty != null ? Number(qty) : line.product_uom_qty;
    const wanted = price != null ? Number(price) : line.price_unit;
    const { price: finalPrice, clamped } = await priceInfo(
      pid, newQty, order.pricelist_id?.[0] || null, order.partner_id?.[0] || null, wanted
    );

    await callOdooAsAdmin('sale.order.line', 'write',
      [[Number(lineId)], { product_uom_qty: newQty, price_unit: finalPrice }], {});

    return NextResponse.json({ success: true, price: finalPrice, clamped });
  } catch (error: any) {
    console.error('💥 [SILVANO/ordine/:id PATCH]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/silvano/ordine/[id]  → rimuove una riga { lineId }
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    const { lineId } = await request.json();
    const order = await orderCtx(id);
    if (!order) return NextResponse.json({ success: false, error: 'Ordine non trovato' }, { status: 404 });
    if (!EDITABLE_STATES.includes(order.state))
      return NextResponse.json({ success: false, error: 'Ordine non più modificabile' }, { status: 400 });

    await callOdooAsAdmin('sale.order.line', 'unlink', [[Number(lineId)]], {});
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('💥 [SILVANO/ordine/:id DELETE]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/silvano/ordine/[id]  → aggiunge una riga { product_id, qty, price }
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    const { product_id, qty, price } = await request.json();
    const order = await orderCtx(id);
    if (!order) return NextResponse.json({ success: false, error: 'Ordine non trovato' }, { status: 404 });
    if (!EDITABLE_STATES.includes(order.state))
      return NextResponse.json({ success: false, error: 'Ordine non più modificabile' }, { status: 400 });

    const { prod, price: finalPrice, clamped } = await priceInfo(
      Number(product_id), Number(qty) || 1, order.pricelist_id?.[0] || null, order.partner_id?.[0] || null, Number(price)
    );
    if (!prod.active || !prod.sale_ok)
      return NextResponse.json({ success: false, error: 'Prodotto non vendibile' }, { status: 400 });

    await callOdooAsAdmin('sale.order.line', 'create', [{
      order_id: id,
      product_id: Number(product_id),
      name: prod.name,
      product_uom_qty: Number(qty) || 1,
      price_unit: finalPrice,
      company_id: LAPA_COMPANY_ID,
    }], {});

    return NextResponse.json({ success: true, clamped });
  } catch (error: any) {
    console.error('💥 [SILVANO/ordine/:id POST]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
