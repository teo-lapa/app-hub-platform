/**
 * INVOICES API ROUTE
 *
 * GET /api/portale-clienti/invoices
 *
 * Fetches customer invoices from Odoo with filtering
 *
 * Query params:
 * - from: Date filter (YYYY-MM-DD)
 * - to: Date filter (YYYY-MM-DD)
 * - state: Invoice state filter (all, draft, posted, cancel)
 * - paymentState: Payment state filter (all, not_paid, in_payment, paid, partial)
 *
 * Returns: Array of invoices with computed fields (isOverdue, daysOverdue)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';
import type { OdooInvoice, Invoice, InvoiceStats } from '@/types/invoice';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Get filters from query params
    const fromDate = searchParams.get('from');
    const toDate = searchParams.get('to');
    const stateFilter = searchParams.get('state') || 'all';
    const paymentStateFilter = searchParams.get('paymentState') || 'all';

    // Default: last 24 months if no dates provided
    const defaultFrom = new Date();
    defaultFrom.setMonth(defaultFrom.getMonth() - 24);
    const from = fromDate || defaultFrom.toISOString().split('T')[0];

    console.log('📄 [INVOICES] Fetching invoices...', {
      from,
      to: toDate,
      state: stateFilter,
      paymentState: paymentStateFilter,
    });

    // Get Odoo session from cookies
    const cookieHeader = request.headers.get('cookie') || '';
    const { cookies } = await getOdooSession(cookieHeader);

    // Get customer ID from session
    // In a real app, you'd get this from authenticated user session
    // For now, we'll fetch from the session info
    let customerId: number;

    try {
      // Get session info to find partner_id
      const sessionInfo = await callOdoo(cookies, 'res.users', 'read', [[1]], {
        fields: ['partner_id'],
      });

      if (!sessionInfo || !sessionInfo[0]?.partner_id) {
        throw new Error('Customer ID not found in session');
      }

      customerId = sessionInfo[0].partner_id[0];
      console.log('👤 [INVOICES] Customer ID:', customerId);
    } catch (error) {
      console.error('❌ [INVOICES] Error getting customer ID:', error);
      return NextResponse.json(
        { error: 'Failed to get customer information' },
        { status: 500 }
      );
    }

    // Build domain for Odoo query
    const domain: any[] = [
      ['partner_id', '=', customerId],
      ['move_type', '=', 'out_invoice'], // Only customer invoices
      ['invoice_date', '>=', from],
    ];

    // Add date range filter
    if (toDate) {
      domain.push(['invoice_date', '<=', toDate]);
    }

    // Add state filter
    if (stateFilter !== 'all') {
      domain.push(['state', '=', stateFilter]);
    }

    // Add payment state filter
    if (paymentStateFilter !== 'all') {
      domain.push(['payment_state', '=', paymentStateFilter]);
    }

    // Fetch invoices from Odoo
    const odooInvoices: OdooInvoice[] = await callOdoo(
      cookies,
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
          'amount_residual',
          'state',
          'payment_state',
          'partner_id',
          'currency_id',
          'invoice_origin',
          'ref',
        ],
        order: 'invoice_date DESC',
        limit: 1000, // Reasonable limit
      }
    );

    console.log(`✅ [INVOICES] Found ${odooInvoices.length} invoices`);

    // Transform Odoo data to frontend format
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const invoices: Invoice[] = odooInvoices.map((inv) => {
      const dueDate = new Date(inv.invoice_date_due);
      const isOverdue =
        dueDate < today && inv.payment_state !== 'paid' && inv.state === 'posted';
      const daysOverdue = isOverdue
        ? Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
        : undefined;

      return {
        id: inv.id,
        name: inv.name,
        invoiceDate: inv.invoice_date,
        dueDate: inv.invoice_date_due,
        amount: inv.amount_total,
        amountResidual: inv.amount_residual,
        state: inv.state,
        paymentState: inv.payment_state,
        partnerId: inv.partner_id[0],
        partnerName: inv.partner_id[1],
        currencySymbol: inv.currency_id[1] === 'EUR' ? '€' : inv.currency_id[1],
        origin: inv.invoice_origin,
        reference: inv.ref,
        isOverdue,
        daysOverdue,
      };
    });

    // Calculate stats
    const stats: InvoiceStats = {
      totalAmount: invoices
        .filter((inv) => inv.paymentState !== 'paid')
        .reduce((sum, inv) => sum + inv.amountResidual, 0),
      totalOverdue: invoices
        .filter((inv) => inv.isOverdue)
        .reduce((sum, inv) => sum + inv.amountResidual, 0),
      overdueCount: invoices.filter((inv) => inv.isOverdue).length,
      paidCount: invoices.filter((inv) => inv.paymentState === 'paid').length,
      unpaidCount: invoices.filter(
        (inv) => inv.paymentState !== 'paid' && inv.state === 'posted'
      ).length,
    };

    return NextResponse.json({
      invoices,
      stats,
      total: invoices.length,
    });
  } catch (error: any) {
    console.error('❌ [INVOICES] Error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to fetch invoices',
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}
