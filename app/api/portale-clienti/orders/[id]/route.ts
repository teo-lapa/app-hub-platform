import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const ODOO_URL = process.env.NEXT_PUBLIC_ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24517859.dev.odoo.com';

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

    // Ottieni session_id dell'utente loggato
    const cookieStore = cookies();
    const sessionId = cookieStore.get('odoo_session_id')?.value;

    if (!sessionId) {
      console.error('❌ [ORDER-DETAIL-API] Utente non loggato');
      return NextResponse.json(
        { success: false, error: 'Devi fare login per visualizzare questo ordine' },
        { status: 401 }
      );
    }

    // Step 1: Recupera l'ordine principale
    const orderResult = await callOdoo(
      sessionId,
      'sale.order',
      'read',
      [[orderId]],
      {
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
      }
    );

    if (!orderResult.success || !orderResult.result || orderResult.result.length === 0) {
      console.error('❌ [ORDER-DETAIL-API] Ordine non trovato');
      return NextResponse.json(
        { success: false, error: 'Ordine non trovato' },
        { status: 404 }
      );
    }

    const order = orderResult.result[0];
    console.log('✅ [ORDER-DETAIL-API] Ordine recuperato:', order.name);

    // Step 2: Recupera le righe ordine (prodotti)
    let orderLines: any[] = [];
    if (order.order_line && order.order_line.length > 0) {
      const linesResult = await callOdoo(
        sessionId,
        'sale.order.line',
        'read',
        [order.order_line],
        {
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
        }
      );

      if (linesResult.success && linesResult.result) {
        orderLines = linesResult.result;
      }
    }

    console.log(`✅ [ORDER-DETAIL-API] Recuperate ${orderLines.length} righe ordine`);

    // Step 3: Recupera fatture collegate
    let invoices: any[] = [];
    if (order.invoice_ids && order.invoice_ids.length > 0) {
      const invoicesResult = await callOdoo(
        sessionId,
        'account.move',
        'read',
        [order.invoice_ids],
        {
          fields: [
            'id',
            'name',
            'invoice_date',
            'amount_total',
            'state',
            'payment_state',
          ],
        }
      );

      if (invoicesResult.success && invoicesResult.result) {
        invoices = invoicesResult.result;
      }
    }

    console.log(`✅ [ORDER-DETAIL-API] Recuperate ${invoices.length} fatture`);

    // Step 4: Recupera consegne/picking collegate
    let pickings: any[] = [];
    if (order.picking_ids && order.picking_ids.length > 0) {
      const pickingsResult = await callOdoo(
        sessionId,
        'stock.picking',
        'read',
        [order.picking_ids],
        {
          fields: [
            'id',
            'name',
            'scheduled_date',
            'date_done',
            'state',
            'location_dest_id',
            'carrier_tracking_ref',
          ],
        }
      );

      if (pickingsResult.success && pickingsResult.result) {
        pickings = pickingsResult.result;
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
 * Helper function per chiamate RPC a Odoo
 */
async function callOdoo(
  sessionId: string,
  model: string,
  method: string,
  args: any[],
  kwargs: any
): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    const response = await fetch(`${ODOO_URL}/web/dataset/call_kw/${model}/${method}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model,
          method,
          args,
          kwargs: kwargs || {},
        },
        id: Date.now(),
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Errore HTTP ${response.status}`,
      };
    }

    const data = await response.json();

    if (data.error) {
      return {
        success: false,
        error: data.error.data?.message || data.error.message || 'Errore chiamata Odoo',
      };
    }

    return {
      success: true,
      result: data.result,
    };

  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
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
