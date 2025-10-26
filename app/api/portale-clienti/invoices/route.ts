import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin } from '@/lib/odoo/admin-session';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * GET /api/portale-clienti/invoices
 *
 * Recupera la lista delle fatture del cliente loggato da Odoo
 *
 * Query params:
 * - from: data inizio (YYYY-MM-DD)
 * - to: data fine (YYYY-MM-DD)
 * - state: filtro per stato (not_paid, paid, partial, overdue)
 *
 * Returns: Array di fatture con dati completi
 */
export async function GET(request: NextRequest) {
  try {
    console.log('📄 [INVOICES-API] Inizio recupero fatture cliente');

    // Extract and verify JWT token
    const token = request.cookies.get('token')?.value;

    if (!token) {
      console.error('❌ [INVOICES-API] No JWT token found');
      return NextResponse.json(
        { success: false, error: 'Devi fare login per visualizzare le fatture' },
        { status: 401 }
      );
    }

    // Decode JWT to get customer info
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    let decoded: any;

    try {
      decoded = jwt.verify(token, jwtSecret);
      console.log('✅ [INVOICES-API] JWT decoded:', {
        email: decoded.email,
        userId: decoded.id
      });
    } catch (jwtError: any) {
      console.error('❌ [INVOICES-API] JWT verification failed:', jwtError.message);
      return NextResponse.json(
        { success: false, error: 'Token non valido' },
        { status: 401 }
      );
    }

    // Estrai parametri query
    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get('from') || '';
    const toDate = searchParams.get('to') || '';
    const stateFilter = searchParams.get('state') || '';

    console.log('📅 [INVOICES-API] Filtri:', { fromDate, toDate, stateFilter });

    // Step 1: Get partner_id using admin session
    const userPartners = await callOdooAsAdmin(
      'res.partner',
      'search_read',
      [],
      {
        domain: [['email', '=', decoded.email]],
        fields: ['id', 'name'],
        limit: 1
      }
    );

    if (!userPartners || userPartners.length === 0) {
      console.error('❌ [INVOICES-API] No partner found for email:', decoded.email);
      return NextResponse.json(
        { success: false, error: 'Cliente non identificato. Rieffettua il login.' },
        { status: 401 }
      );
    }

    const partnerId = userPartners[0].id;
    console.log('✅ [INVOICES-API] Cliente identificato:', partnerId);

    // Step 2: Costruisci domain per la ricerca fatture
    const domain: any[] = [
      ['partner_id', '=', partnerId],
      ['move_type', '=', 'out_invoice'], // Solo fatture clienti (non fornitori)
      ['state', '=', 'posted'], // Solo fatture confermate
    ];

    // Aggiungi filtro date se presenti
    if (fromDate) {
      domain.push(['invoice_date', '>=', fromDate]);
    }
    if (toDate) {
      domain.push(['invoice_date', '<=', toDate]);
    }

    // Aggiungi filtro stato pagamento se richiesto
    if (stateFilter && stateFilter !== 'all') {
      if (stateFilter === 'overdue') {
        // Fatture scadute: non pagate e data scadenza passata
        const today = new Date().toISOString().split('T')[0];
        domain.push(['payment_state', 'in', ['not_paid', 'partial']]);
        domain.push(['invoice_date_due', '<', today]);
      } else {
        domain.push(['payment_state', '=', stateFilter]);
      }
    }

    console.log('🔍 [INVOICES-API] Domain ricerca:', JSON.stringify(domain));

    // Step 3: Recupera le fatture da Odoo usando admin session
    const invoicesResult = await callOdooAsAdmin(
      'account.move',
      'search_read',
      [],
      {
        domain,
        fields: [
          'id',
          'name',
          'invoice_date',
          'invoice_date_due',
          'amount_total',
          'amount_untaxed',
          'amount_tax',
          'state',
          'payment_state',
          'partner_id',
          'invoice_line_ids',
          'invoice_payment_term_id',
          'currency_id',
          'amount_residual',
        ],
        order: 'invoice_date DESC',
        limit: 100,
      }
    );

    const invoices = invoicesResult || [];
    console.log(`✅ [INVOICES-API] Recuperate ${invoices.length} fatture`);

    // Step 4: Per ogni fattura, arricchisci con info calcolate
    const enrichedInvoices = invoices.map((invoice: any) => {
      // Calcola se la fattura è scaduta
      const today = new Date();
      const dueDate = invoice.invoice_date_due ? new Date(invoice.invoice_date_due) : null;
      const isOverdue = dueDate && dueDate < today && invoice.payment_state !== 'paid';

      return {
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
        linesCount: invoice.invoice_line_ids?.length || 0,
        paymentTerm: invoice.invoice_payment_term_id?.[1] || 'N/A',
        currency: invoice.currency_id?.[1] || 'EUR',
      };
    });

    return NextResponse.json({
      success: true,
      invoices: enrichedInvoices,
      count: enrichedInvoices.length,
    });

  } catch (error: any) {
    console.error('💥 [INVOICES-API] Errore:', error);
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
