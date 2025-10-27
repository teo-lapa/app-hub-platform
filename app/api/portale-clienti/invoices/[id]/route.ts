import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin } from '@/lib/odoo/admin-session';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * GET /api/portale-clienti/invoices/[id]
 *
 * Recupera i dettagli completi di una fattura specifica
 *
 * Returns: Dati completi della fattura incluse le righe
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const invoiceId = parseInt(params.id);
    console.log(`📄 [INVOICE-DETAIL-API] Inizio recupero fattura ${invoiceId}`);

    // Extract and verify JWT token
    const token = request.cookies.get('token')?.value;

    if (!token) {
      console.error('❌ [INVOICE-DETAIL-API] No JWT token found');
      return NextResponse.json(
        { success: false, error: 'Devi fare login per visualizzare la fattura' },
        { status: 401 }
      );
    }

    // Decode JWT to get customer info
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    let decoded: any;

    try {
      decoded = jwt.verify(token, jwtSecret);
      console.log('✅ [INVOICE-DETAIL-API] JWT decoded:', {
        email: decoded.email,
        userId: decoded.id
      });
    } catch (jwtError: any) {
      console.error('❌ [INVOICE-DETAIL-API] JWT verification failed:', jwtError.message);
      return NextResponse.json(
        { success: false, error: 'Token non valido' },
        { status: 401 }
      );
    }

    // Step 1: Get partner_id using admin session
    const userPartners = await callOdooAsAdmin(
      'res.partner',
      'search_read',
      [],
      {
        domain: [['email', '=', decoded.email]],
        fields: ['id', 'name', 'street', 'city', 'zip', 'country_id', 'vat', 'phone', 'email'],
        limit: 1
      }
    );

    if (!userPartners || userPartners.length === 0) {
      console.error('❌ [INVOICE-DETAIL-API] No partner found for email:', decoded.email);
      return NextResponse.json(
        { success: false, error: 'Cliente non identificato. Rieffettua il login.' },
        { status: 401 }
      );
    }

    const partner = userPartners[0];
    const partnerId = partner.id;
    console.log('✅ [INVOICE-DETAIL-API] Cliente identificato:', partnerId);

    // Step 2: Recupera la fattura verificando che appartenga al cliente
    const invoicesResult = await callOdooAsAdmin(
      'account.move',
      'search_read',
      [],
      {
        domain: [
          ['id', '=', invoiceId],
          ['partner_id', '=', partnerId],
          ['move_type', '=', 'out_invoice'],
        ],
        fields: [
          'id',
          'name',
          'invoice_date',
          'invoice_date_due',
          'amount_total',
          'amount_untaxed',
          'amount_tax',
          'amount_residual',
          'state',
          'payment_state',
          'partner_id',
          'invoice_line_ids',
          'invoice_payment_term_id',
          'currency_id',
          'invoice_origin',
          'narration',
          'payment_reference',
          'fiscal_position_id',
        ],
        limit: 1,
      }
    );

    if (!invoicesResult || invoicesResult.length === 0) {
      console.error('❌ [INVOICE-DETAIL-API] Fattura non trovata o non autorizzata');
      return NextResponse.json(
        { success: false, error: 'Fattura non trovata' },
        { status: 404 }
      );
    }

    const invoice = invoicesResult[0];
    console.log('✅ [INVOICE-DETAIL-API] Fattura trovata:', invoice.name);

    // Step 3: Recupera le righe della fattura
    const lineIds = invoice.invoice_line_ids || [];
    let lines: any[] = [];

    if (lineIds.length > 0) {
      lines = await callOdooAsAdmin(
        'account.move.line',
        'search_read',
        [],
        {
          domain: [['id', 'in', lineIds]],
          fields: [
            'id',
            'name',
            'product_id',
            'quantity',
            'price_unit',
            'price_subtotal',
            'price_total',
            'tax_ids',
            'discount',
          ],
          order: 'sequence, id',
        }
      );
    }

    console.log(`✅ [INVOICE-DETAIL-API] Recuperate ${lines.length} righe fattura`);

    // Step 4: Calcola se la fattura è scaduta
    const today = new Date();
    const dueDate = invoice.invoice_date_due ? new Date(invoice.invoice_date_due) : null;
    const isOverdue = dueDate && dueDate < today && invoice.payment_state !== 'paid';

    // Step 5: Formatta i dati per il frontend
    const enrichedInvoice = {
      id: invoice.id,
      name: invoice.name,
      invoiceDate: invoice.invoice_date,
      invoiceDateDue: invoice.invoice_date_due,
      amountTotal: invoice.amount_total,
      amountUntaxed: invoice.amount_untaxed,
      amountTax: invoice.amount_tax,
      amountResidual: invoice.amount_residual || 0,
      state: invoice.state,
      paymentState: invoice.payment_state,
      paymentStateLabel: getPaymentStateLabel(invoice.payment_state, isOverdue || false),
      isOverdue: isOverdue || false,
      paymentTerm: invoice.invoice_payment_term_id?.[1] || 'N/A',
      currency: invoice.currency_id?.[1] || 'EUR',
      origin: invoice.invoice_origin || null,
      notes: invoice.narration || null,
      paymentReference: invoice.payment_reference || null,
      fiscalPosition: invoice.fiscal_position_id?.[1] || null,

      // Dati cliente
      customer: {
        id: partner.id,
        name: partner.name,
        street: partner.street || '',
        city: partner.city || '',
        zip: partner.zip || '',
        country: partner.country_id?.[1] || '',
        vat: partner.vat || '',
        phone: partner.phone || '',
        email: partner.email || '',
      },

      // Righe fattura
      lines: lines.map((line: any) => ({
        id: line.id,
        description: line.name || 'N/A',
        productName: line.product_id?.[1] || null,
        quantity: line.quantity || 0,
        priceUnit: line.price_unit || 0,
        priceSubtotal: line.price_subtotal || 0,
        priceTotal: line.price_total || 0,
        discount: line.discount || 0,
        taxes: line.tax_ids?.length || 0,
      })),
    };

    return NextResponse.json({
      success: true,
      invoice: enrichedInvoice,
    });

  } catch (error: any) {
    console.error('💥 [INVOICE-DETAIL-API] Errore:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Errore server' },
      { status: 500 }
    );
  }
}

/**
 * Mapping payment_state → label italiana
 */
function getPaymentStateLabel(paymentState: string, isOverdue: boolean): string {
  if (isOverdue) {
    return 'Scaduta';
  }

  const stateMap: Record<string, string> = {
    not_paid: 'Da Pagare',
    in_payment: 'In Pagamento',
    paid: 'Pagata',
    partial: 'Parzialmente Pagata',
    reversed: 'Stornata',
    invoicing_legacy: 'Legacy',
  };

  return stateMap[paymentState] || paymentState.toUpperCase();
}
