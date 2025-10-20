import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
    }

    const body = await request.json();
    const { picking_id } = body;

    if (!picking_id) {
      return NextResponse.json({ error: 'picking_id mancante' }, { status: 400 });
    }

    console.log('💰 [GET_INVOICE] Recupero fattura per picking:', picking_id);

    // Carica il picking per ottenere il sale_id
    const pickings = await callOdoo(
      cookies,
      'stock.picking',
      'read',
      [[picking_id]],
      { fields: ['sale_id', 'origin'] }
    );

    if (pickings.length === 0) {
      return NextResponse.json({ error: 'Consegna non trovata' }, { status: 404 });
    }

    const picking = pickings[0];
    const saleId = picking.sale_id?.[0];

    if (!saleId) {
      console.log('⚠️ [GET_INVOICE] Nessun ordine di vendita collegato, uso calcolo fallback');

      // Calcola totale dai prodotti della consegna
      const moveLines = await callOdoo(
        cookies,
        'stock.move.line',
        'search_read',
        [],
        {
          domain: [['picking_id', '=', picking_id]],
          fields: ['product_id', 'quantity', 'qty_done']
        }
      );

      const productIds = moveLines.map((ml: any) => ml.product_id[0]);
      const products = await callOdoo(
        cookies,
        'product.product',
        'read',
        [productIds],
        { fields: ['list_price'] }
      );

      const productPriceMap = new Map(products.map((p: any) => [p.id, p.list_price]));

      let estimatedTotal = 0;
      moveLines.forEach((ml: any) => {
        const qty = Number(ml.qty_done || ml.quantity || 0);
        const price = Number(productPriceMap.get(ml.product_id[0]) || 0);
        estimatedTotal += qty * price;
      });

      return NextResponse.json({
        amount_total: estimatedTotal,
        payment_status: 'to_pay',
        is_estimate: true,
        message: 'Importo stimato (nessuna fattura collegata)'
      });
    }

    // Carica l'ordine di vendita per ottenere l'importo
    const saleOrders = await callOdoo(
      cookies,
      'sale.order',
      'read',
      [[saleId]],
      { fields: ['amount_total', 'invoice_status', 'invoice_ids'] }
    );

    if (saleOrders.length === 0) {
      return NextResponse.json({ error: 'Ordine di vendita non trovato' }, { status: 404 });
    }

    const saleOrder = saleOrders[0];
    const amountTotal = saleOrder.amount_total || 0;
    const invoiceIds = saleOrder.invoice_ids || [];

    // Se ci sono fatture, verifica lo stato di pagamento
    let paymentStatus = 'to_pay';
    if (invoiceIds.length > 0) {
      const invoices = await callOdoo(
        cookies,
        'account.move',
        'read',
        [invoiceIds],
        { fields: ['payment_state'] }
      );

      // Controlla se almeno una fattura è pagata
      const isPaid = invoices.some((inv: any) => inv.payment_state === 'paid');
      const isPartial = invoices.some((inv: any) => inv.payment_state === 'partial');

      if (isPaid) {
        paymentStatus = 'paid';
      } else if (isPartial) {
        paymentStatus = 'partial';
      }
    }

    console.log('✅ [GET_INVOICE] Importo trovato:', amountTotal, 'Stato:', paymentStatus);

    return NextResponse.json({
      amount_total: amountTotal,
      payment_status: paymentStatus,
      sale_id: saleId,
      is_estimate: false
    });

  } catch (error: any) {
    console.error('❌ [GET_INVOICE] Errore:', error);
    return NextResponse.json(
      { error: error.message || 'Errore recupero fattura' },
      { status: 500 }
    );
  }
}
