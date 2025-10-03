import { NextRequest, NextResponse } from 'next/server';

const ODOO_URL = process.env.ODOO_URL || process.env.NEXT_PUBLIC_ODOO_URL;

async function callOdoo(sessionId: string, model: string, method: string, args: any[], kwargs: any = {}) {
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Openerp-Session-Id': sessionId
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model,
        method,
        args,
        kwargs
      }
    })
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.data?.message || 'Errore Odoo');
  }

  return data.result;
}

export async function POST(request: NextRequest) {
  try {
    const sessionId = request.cookies.get('session_id')?.value;
    if (!sessionId) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    const body = await request.json();
    const { picking_id, sale_id, amount, payment_method, note } = body;

    if (!picking_id || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Dati pagamento non validi' }, { status: 400 });
    }

    // Get sale order to find invoice
    let invoiceId = null;
    if (sale_id) {
      const saleOrders = await callOdoo(
        sessionId,
        'sale.order',
        'read',
        [[sale_id]],
        { fields: ['invoice_ids'] }
      );

      if (saleOrders[0] && saleOrders[0].invoice_ids && saleOrders[0].invoice_ids.length > 0) {
        invoiceId = saleOrders[0].invoice_ids[0];
      }
    }

    if (!invoiceId) {
      return NextResponse.json({ error: 'Fattura non trovata' }, { status: 404 });
    }

    // Get invoice details
    const invoices = await callOdoo(
      sessionId,
      'account.move',
      'read',
      [[invoiceId]],
      { fields: ['partner_id', 'amount_residual', 'payment_state'] }
    );

    const invoice = invoices[0];

    if (invoice.payment_state === 'paid') {
      return NextResponse.json({ error: 'Fattura già pagata' }, { status: 400 });
    }

    // Get payment method ID
    let paymentMethodId = 1; // Default
    const paymentMethods = await callOdoo(
      sessionId,
      'account.payment.method',
      'search_read',
      [[]],
      { fields: ['id', 'code'], limit: 10 }
    );

    const methodMap: Record<string, string> = {
      'cash': 'manual',
      'card': 'electronic',
      'bank_transfer': 'manual'
    };

    const foundMethod = paymentMethods.find((m: any) => m.code === methodMap[payment_method]);
    if (foundMethod) {
      paymentMethodId = foundMethod.id;
    }

    // Get default journal for payments
    const journals = await callOdoo(
      sessionId,
      'account.journal',
      'search_read',
      [[['type', '=', 'cash']]],
      { fields: ['id'], limit: 1 }
    );

    const journalId = journals[0]?.id || 1;

    // Create payment
    const paymentData = {
      payment_type: 'inbound',
      partner_type: 'customer',
      partner_id: invoice.partner_id[0],
      amount: amount,
      payment_method_id: paymentMethodId,
      journal_id: journalId,
      ref: `Pagamento delivery ${picking_id}${note ? ` - ${note}` : ''}`
    };

    const paymentId = await callOdoo(
      sessionId,
      'account.payment',
      'create',
      [paymentData]
    );

    // Post the payment
    await callOdoo(
      sessionId,
      'account.payment',
      'action_post',
      [[paymentId]]
    );

    // Reconcile with invoice if possible
    try {
      // Get payment move lines
      const payments = await callOdoo(
        sessionId,
        'account.payment',
        'read',
        [[paymentId]],
        { fields: ['move_id'] }
      );

      if (payments[0] && payments[0].move_id) {
        const paymentMoveId = payments[0].move_id[0];

        // Reconcile logic would go here
        // This is simplified - actual reconciliation in Odoo is more complex
      }
    } catch (err) {
      console.error('Reconciliation error:', err);
      // Payment is still created, just not reconciled
    }

    return NextResponse.json({
      success: true,
      payment_id: paymentId,
      message: 'Pagamento registrato con successo'
    });
  } catch (error: any) {
    console.error('Error processing payment:', error);
    return NextResponse.json(
      { error: error.message || 'Errore registrazione pagamento' },
      { status: 500 }
    );
  }
}
