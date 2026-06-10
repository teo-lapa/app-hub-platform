import { NextRequest, NextResponse } from 'next/server';
import {
  callOdooAsAdmin, resolveSalesperson, getClientPricelistId, getClientPrice, LAPA_COMPANY_ID,
} from '@/lib/silvano/odoo';
import { computeMarginInfo, marginAtPrice } from '@/lib/silvano/margin';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

interface InLine { product_id: number; qty: number; price: number; name?: string }

/**
 * POST /api/silvano/crea-ordine
 * Crea un preventivo (sale.order draft) per il cliente con i prezzi scelti dal venditore.
 * Il floor viene RICALCOLATO server-side: nessun prezzo può scendere sotto il minimo.
 * body: { clientId, deliveryAddressId?, deliveryDate?, note?, lines: [{product_id, qty, price}] }
 */
export async function POST(request: NextRequest) {
  try {
    const seller = await resolveSalesperson(request);
    const body = await request.json();
    const { clientId, contactId, deliveryAddressId, deliveryDate, note } = body || {};
    const lines: InLine[] = body?.lines || [];

    if (!clientId || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ success: false, error: 'clientId e lines sono obbligatori' }, { status: 400 });
    }

    const pricelistId = await getClientPricelistId(clientId);

    // Dati prodotto (costo) per ricalcolo floor
    const productIds = lines.map((l) => l.product_id);
    const products = await callOdooAsAdmin('product.product', 'search_read', [], {
      domain: [['id', 'in', productIds]],
      fields: ['id', 'name', 'standard_price', 'list_price', 'sale_ok', 'active'],
    });
    const pmap = new Map(products.map((p: any) => [p.id, p]));

    // Crea l'ordine
    const orderData: any = {
      partner_id: contactId || clientId,
      partner_shipping_id: deliveryAddressId || clientId,
      date_order: new Date().toISOString().slice(0, 19).replace('T', ' '),
      state: 'draft',
      origin: 'Area Venditore Silvano',
      company_id: LAPA_COMPANY_ID,
    };
    if (pricelistId) orderData.pricelist_id = pricelistId;
    if (seller.userId) orderData.user_id = seller.userId;
    if (deliveryDate) orderData.commitment_date = deliveryDate;

    const orderId = await callOdooAsAdmin('sale.order', 'create', [orderData], {});

    // Righe con floor enforcement
    let totMargine = 0;
    let clampedCount = 0;
    for (const l of lines) {
      const prod: any = pmap.get(l.product_id);
      if (!prod || !prod.active || !prod.sale_ok) continue;

      let base = prod.list_price || 0;
      if (pricelistId) {
        const cp = await getClientPrice(pricelistId, l.product_id, l.qty || 1, clientId);
        if (cp != null) base = cp;
      }
      const info = computeMarginInfo(base, prod.standard_price || 0);
      let price = Number(l.price);
      if (!isFinite(price) || price < info.floor) { price = info.floor; clampedCount++; }

      totMargine += marginAtPrice(price, info.floor) * (l.qty || 1);

      await callOdooAsAdmin('sale.order.line', 'create', [{
        order_id: orderId,
        product_id: l.product_id,
        name: prod.name, // solo nome prodotto, niente descrizione
        product_uom_qty: l.qty || 1,
        price_unit: price,
        company_id: LAPA_COMPANY_ID,
      }], {});
    }

    // Chatter
    try {
      const noteHtml = `<p><strong>🧾 Preventivo creato da Area Venditore</strong></p>`
        + `<ul><li><strong>Venditore:</strong> ${seller.name}</li>`
        + `<li><strong>Righe:</strong> ${lines.length}</li>`
        + `<li><strong>Margine venditore stimato:</strong> CHF ${totMargine.toFixed(2)}</li>`
        + (clampedCount ? `<li><strong>Prezzi riportati al minimo:</strong> ${clampedCount}</li>` : '')
        + `</ul>` + (note ? `<p><em>${String(note).replace(/\n/g, '<br/>')}</em></p>` : '');
      await callOdooAsAdmin('mail.message', 'create', [{
        model: 'sale.order', res_id: orderId, body: noteHtml, message_type: 'comment', subtype_id: 1,
      }], {});
    } catch { /* non critico */ }

    const created = await callOdooAsAdmin('sale.order', 'search_read', [], {
      domain: [['id', '=', orderId]], fields: ['name', 'amount_total'], limit: 1,
    });

    return NextResponse.json({
      success: true,
      orderId,
      orderName: created?.[0]?.name || `SO-${orderId}`,
      total: created?.[0]?.amount_total || 0,
      margineVenditore: totMargine,
    });
  } catch (error: any) {
    console.error('💥 [SILVANO/crea-ordine]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
