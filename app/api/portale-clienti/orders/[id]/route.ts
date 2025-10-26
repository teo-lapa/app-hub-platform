import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin } from '@/lib/odoo/admin-session';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * GET /api/portale-clienti/orders/[id]
 *
 * Recupera i dettagli completi di un singolo ordine
 *
 * Returns: Dettaglio ordine con prodotti, fatture, consegne, documenti
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = parseInt(params.id, 10);

    if (isNaN(orderId)) {
      return NextResponse.json(
        { success: false, error: 'ID ordine non valido' },
        { status: 400 }
      );
    }

    console.log(`🛒 [ORDER-DETAIL-API] Recupero dettagli ordine ${orderId}`);

    // Extract and verify JWT token
    const token = request.cookies.get('token')?.value;

    if (!token) {
      console.error('❌ [ORDER-DETAIL-API] No JWT token found');
      return NextResponse.json(
        { success: false, error: 'Devi fare login per visualizzare questo ordine' },
        { status: 401 }
      );
    }

    // Decode JWT to get customer info
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    let decoded: any;

    try {
      decoded = jwt.verify(token, jwtSecret);
      console.log('✅ [ORDER-DETAIL-API] JWT decoded:', {
        email: decoded.email,
        userId: decoded.id
      });
    } catch (jwtError: any) {
      console.error('❌ [ORDER-DETAIL-API] JWT verification failed:', jwtError.message);
      return NextResponse.json(
        { success: false, error: 'Token non valido' },
        { status: 401 }
      );
    }

    // Step 1: Recupera l'ordine principale usando admin session
    const orderResult = await callOdooAsAdmin(
      'sale.order',
      'search_read',
      [],
      {
        domain: [['id', '=', orderId]],
        fields: [
          'id',
          'name',
          'date_order',
          'amount_total',
          'amount_untaxed',
          'amount_tax',
          'state',
          'order_line',
          'invoice_status',
          'delivery_status',
          'partner_id',
          'partner_shipping_id',
          'user_id',
          'commitment_date',
          'create_date',
          'write_date',
          'note',
          'invoice_ids',
          'picking_ids',
          'client_order_ref',
        ],
      },
    );

    if (!orderResult || orderResult.length === 0) {
      console.error('❌ [ORDER-DETAIL-API] Ordine non trovato');
      return NextResponse.json(
        { success: false, error: 'Ordine non trovato' },
        { status: 404 }
      );
    }

    const order = orderResult[0];
    console.log('✅ [ORDER-DETAIL-API] Ordine recuperato:', order.name);

    // Step 2: Recupera le righe ordine (prodotti)
    let orderLines: any[] = [];
    if (order.order_line && order.order_line.length > 0) {
      const linesResult = await callOdooAsAdmin(
        'sale.order.line',
        'search_read',
        [],
        {
          domain: [['id', 'in', order.order_line]],
          fields: [
            'id',
            'product_id',
            'name',
            'product_uom_qty',
            'qty_delivered',
            'qty_invoiced',
            'price_unit',
            'price_subtotal',
            'price_tax',
            'price_total',
            'discount',
            'product_uom',
          ],
        },
      );

      if (linesResult) {
        orderLines = linesResult;
      }
    }

    console.log(`✅ [ORDER-DETAIL-API] Recuperate ${orderLines.length} righe ordine`);

    // Step 3: Recupera fatture collegate
    let invoices: any[] = [];
    if (order.invoice_ids && order.invoice_ids.length > 0) {
      const invoicesResult = await callOdooAsAdmin(
        'account.move',
        'search_read',
        [],
        {
          domain: [['id', 'in', order.invoice_ids]],
          fields: [
            'id',
            'name',
            'invoice_date',
            'amount_total',
            'state',
            'payment_state',
          ],
        },
      );

      if (invoicesResult) {
        invoices = invoicesResult;
      }
    }

    console.log(`✅ [ORDER-DETAIL-API] Recuperate ${invoices.length} fatture`);

    // Step 4: Recupera consegne/picking collegate
    let pickings: any[] = [];
    if (order.picking_ids && order.picking_ids.length > 0) {
      const pickingsResult = await callOdooAsAdmin(
        'stock.picking',
        'search_read',
        [],
        {
          domain: [['id', 'in', order.picking_ids]],
          fields: [
            'id',
            'name',
            'scheduled_date',
            'date_done',
            'state',
            'location_dest_id',
            'carrier_tracking_ref',
          ],
        },
      );

      if (pickingsResult) {
        pickings = pickingsResult;
      }
    }

    console.log(`✅ [ORDER-DETAIL-API] Recuperate ${pickings.length} consegne`);

    // Step 5: Costruisci timeline eventi
    const timeline = buildOrderTimeline(order, pickings, invoices);

    // Step 6: Assembla risposta completa
    const orderDetail = {
      id: order.id,
      name: order.name,
      clientReference: order.client_order_ref || null,

      // Date
      dateOrder: order.date_order,
      dateCreated: order.create_date,
      dateUpdated: order.write_date,
      commitmentDate: order.commitment_date || null,

      // Stato
      state: order.state,
      stateLabel: getStateLabel(order.state),
      invoiceStatus: order.invoice_status,
      deliveryStatus: order.delivery_status,

      // Importi
      amountTotal: order.amount_total,
      amountUntaxed: order.amount_untaxed,
      amountTax: order.amount_tax,

      // Cliente e venditore
      customer: order.partner_id?.[1] || 'N/A',
      customerId: order.partner_id?.[0] || null,
      shippingAddress: order.partner_shipping_id?.[1] || null,
      salesperson: order.user_id?.[1] || 'N/A',

      // Note
      note: order.note || null,

      // Prodotti ordinati
      products: orderLines.map((line: any) => ({
        id: line.id,
        productId: line.product_id?.[0] || null,
        productName: line.product_id?.[1] || line.name,
        description: line.name,
        quantity: line.product_uom_qty,
        quantityDelivered: line.qty_delivered || 0,
        quantityInvoiced: line.qty_invoiced || 0,
        unitPrice: line.price_unit,
        discount: line.discount || 0,
        subtotal: line.price_subtotal,
        tax: line.price_tax,
        total: line.price_total,
        uom: line.product_uom?.[1] || 'Unità',
      })),

      // Fatture
      invoices: invoices.map((inv: any) => ({
        id: inv.id,
        name: inv.name,
        date: inv.invoice_date,
        amount: inv.amount_total,
        state: inv.state,
        stateLabel: getInvoiceStateLabel(inv.state),
        paymentState: inv.payment_state,
        paymentStateLabel: getPaymentStateLabel(inv.payment_state),
      })),

      // Consegne
      deliveries: pickings.map((pick: any) => ({
        id: pick.id,
        name: pick.name,
        scheduledDate: pick.scheduled_date,
        doneDate: pick.date_done || null,
        state: pick.state,
        stateLabel: getPickingStateLabel(pick.state),
        destination: pick.location_dest_id?.[1] || 'N/A',
        trackingRef: pick.carrier_tracking_ref || null,
      })),

      // Timeline eventi
      timeline,
    };

    return NextResponse.json({
      success: true,
      order: orderDetail,
    });

  } catch (error: any) {
    console.error('💥 [ORDER-DETAIL-API] Errore:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Errore server' },
      { status: 500 }
    );
  }
}

/**
 * Costruisce la timeline degli eventi dell'ordine
 */
function buildOrderTimeline(order: any, pickings: any[], invoices: any[]): any[] {
  const events: any[] = [];

  // Evento: Ordine creato
  events.push({
    type: 'created',
    label: 'Ordine Creato',
    date: order.create_date,
    description: `Ordine ${order.name} creato`,
    icon: 'document',
  });

  // Evento: Ordine confermato
  if (order.state === 'sale' || order.state === 'done') {
    events.push({
      type: 'confirmed',
      label: 'Ordine Confermato',
      date: order.date_order,
      description: 'Ordine confermato e in lavorazione',
      icon: 'check-circle',
    });
  }

  // Eventi: Consegne
  pickings.forEach((picking: any) => {
    if (picking.state === 'done' && picking.date_done) {
      events.push({
        type: 'delivered',
        label: 'Consegna Completata',
        date: picking.date_done,
        description: `Consegna ${picking.name} completata`,
        icon: 'truck',
        trackingRef: picking.carrier_tracking_ref || null,
      });
    } else if (picking.state === 'assigned') {
      events.push({
        type: 'ready_to_ship',
        label: 'Pronto per la Spedizione',
        date: picking.scheduled_date,
        description: `Consegna ${picking.name} pianificata`,
        icon: 'clock',
      });
    }
  });

  // Eventi: Fatture
  invoices.forEach((invoice: any) => {
    if (invoice.state === 'posted') {
      events.push({
        type: 'invoiced',
        label: 'Fattura Emessa',
        date: invoice.invoice_date,
        description: `Fattura ${invoice.name} emessa`,
        icon: 'receipt',
        invoiceId: invoice.id,
      });

      if (invoice.payment_state === 'paid') {
        events.push({
          type: 'paid',
          label: 'Pagamento Ricevuto',
          date: invoice.invoice_date, // Idealmente dovremmo avere payment_date
          description: `Fattura ${invoice.name} pagata`,
          icon: 'currency-euro',
        });
      }
    }
  });

  // Ordina eventi per data (più recenti prima)
  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return events;
}

/**
 * Mapping stati
 */
function getStateLabel(state: string): string {
  const map: Record<string, string> = {
    draft: 'Bozza',
    sent: 'Inviato',
    sale: 'Confermato',
    done: 'Completato',
    cancel: 'Annullato',
  };
  return map[state] || state.toUpperCase();
}

function getInvoiceStateLabel(state: string): string {
  const map: Record<string, string> = {
    draft: 'Bozza',
    posted: 'Confermata',
    cancel: 'Annullata',
  };
  return map[state] || state.toUpperCase();
}

function getPaymentStateLabel(state: string): string {
  const map: Record<string, string> = {
    not_paid: 'Non Pagata',
    in_payment: 'In Pagamento',
    paid: 'Pagata',
    partial: 'Parzialmente Pagata',
    reversed: 'Stornata',
  };
  return map[state] || state.toUpperCase();
}

function getPickingStateLabel(state: string): string {
  const map: Record<string, string> = {
    draft: 'Bozza',
    waiting: 'In Attesa',
    confirmed: 'Confermata',
    assigned: 'Pronta',
    done: 'Completata',
    cancel: 'Annullata',
  };
  return map[state] || state.toUpperCase();
}
