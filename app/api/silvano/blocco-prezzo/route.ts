import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin, resolveSalesperson } from '@/lib/silvano/odoo';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const LAURA_USER_ID = 8;            // Laura Teodorescu
const ACTIVITY_TYPE_BLOCCO = 63;    // "Richiesta blocco prezzo"
const SALE_ORDER_MODEL_ID = 996;    // ir.model di sale.order

/**
 * POST /api/silvano/blocco-prezzo
 * Crea un'attività per Laura: richiesta di blocco prezzo di UN prodotto su un preventivo/ordine.
 * Quando Laura completa l'attività, l'automazione Odoo (218) blocca quel prezzo nel listino del cliente.
 * body: { orderId, productId, productName?, clientName?, price, reason? }
 */
export async function POST(request: NextRequest) {
  try {
    const seller = await resolveSalesperson(request);
    const body = await request.json();
    const { orderId, productId, productName, clientName, price, reason } = body || {};

    if (!orderId || !productId || price == null) {
      return NextResponse.json({ success: false, error: 'orderId, productId e price sono obbligatori' }, { status: 400 });
    }

    const prezzo = Number(price);
    const note = `<p><strong>🔒 Richiesta blocco prezzo</strong></p>`
      + `<ul>`
      + `<li><strong>Venditore:</strong> ${seller.name}</li>`
      + (clientName ? `<li><strong>Cliente:</strong> ${clientName}</li>` : '')
      + `<li><strong>Prodotto:</strong> ${productName || `#${productId}`}</li>`
      + `<li><strong>Prezzo da bloccare:</strong> CHF ${prezzo.toFixed(2)}</li>`
      + `</ul>`
      + (reason ? `<p><strong>Motivo:</strong> ${String(reason).replace(/\n/g, '<br/>')}</p>` : '')
      + `<p><em>Completa questa attività per applicare il blocco prezzo.</em></p>`;

    const activityId = await callOdooAsAdmin('mail.activity', 'create', [{
      res_model_id: SALE_ORDER_MODEL_ID,
      res_id: orderId,
      activity_type_id: ACTIVITY_TYPE_BLOCCO,
      user_id: LAURA_USER_ID,
      summary: `Blocco prezzo: ${productName || `#${productId}`}${clientName ? ` — ${clientName}` : ''}`,
      note,
      date_deadline: new Date().toISOString().slice(0, 10),
      x_lapa_blocco_product_id: productId,
      x_lapa_blocco_price: prezzo,
    }], {});

    return NextResponse.json({ success: true, activityId });
  } catch (error: any) {
    console.error('💥 [SILVANO/blocco-prezzo]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
