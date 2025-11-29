import { NextRequest, NextResponse } from 'next/server';
import { getOdooSessionManager } from '@/lib/odoo/sessionManager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Journal Cash ID
const CASH_JOURNAL_ID = 8;

interface CassaforteItem {
  id: number;
  date: string;
  payment_ref: string;
  partner_id: number | null;
  partner_name: string;
  amount: number;
  employee_name: string;
  is_reconciled: boolean;
  create_date: string;
  type: 'deposit' | 'withdrawal';
  invoice_id: number | null;
  invoice_name: string | null;
}

/**
 * GET /api/super-dashboard/cassaforte
 *
 * Returns cassaforte status with 3 groups:
 * - pending: Cash payments to be deposited (from pending-pickings)
 * - in_safe: Deposited but not yet withdrawn
 * - withdrawn: Money withdrawn from safe
 */
export async function GET(request: NextRequest) {
  try {
    const sessionManager = getOdooSessionManager();

    // 1. Get pending cash payments (from pickings not yet deposited)
    const pendingResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/registro-cassaforte/pending-pickings`,
      { cache: 'no-store' }
    );
    const pendingData = await pendingResponse.json();
    const pendingPayments = pendingData.pickings || [];

    // 2. Get all cassaforte movements from Cash journal
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateFrom = thirtyDaysAgo.toISOString().split('T')[0];

    const statementLines = await sessionManager.callKw(
      'account.bank.statement.line',
      'search_read',
      [[
        ['journal_id', '=', CASH_JOURNAL_ID],
        ['payment_ref', 'ilike', 'cassaforte'],
        ['date', '>=', dateFrom],
      ]],
      {
        fields: ['id', 'date', 'payment_ref', 'partner_id', 'amount', 'is_reconciled', 'create_date'],
        order: 'date desc, id desc',
      }
    );

    // Separate deposits and withdrawals
    const deposits: CassaforteItem[] = [];
    const withdrawals: CassaforteItem[] = [];

    for (const line of statementLines) {
      const paymentRef = line.payment_ref?.toLowerCase() || '';
      const isWithdrawal = paymentRef.includes('prelievo');

      // Extract employee name from payment_ref
      // Format: "Versamento Cassaforte - Employee Name - ..." or "Prelievo Cassaforte - Employee Name"
      let employeeName = 'N/D';
      const refParts = (line.payment_ref || '').split(' - ');
      if (refParts.length >= 2) {
        employeeName = refParts[1];
      }

      // Try to find the associated invoice for deposits
      let invoiceId: number | null = null;
      let invoiceName: string | null = null;

      if (!isWithdrawal && line.partner_id) {
        const partnerId = Array.isArray(line.partner_id) ? line.partner_id[0] : line.partner_id;
        try {
          // Search for invoices from this partner around the same date
          const invoices = await sessionManager.callKw(
            'account.move',
            'search_read',
            [[
              ['partner_id', '=', partnerId],
              ['move_type', 'in', ['out_invoice', 'out_refund']],
              ['invoice_date', '>=', line.date],
              ['invoice_date', '<=', line.date],
              ['state', '=', 'posted'],
            ]],
            { fields: ['id', 'name', 'amount_total'], limit: 1, order: 'id desc' }
          );

          if (invoices.length > 0) {
            invoiceId = invoices[0].id;
            invoiceName = invoices[0].name;
          } else {
            // If no exact date match, try to find most recent invoice for this partner
            const recentInvoices = await sessionManager.callKw(
              'account.move',
              'search_read',
              [[
                ['partner_id', '=', partnerId],
                ['move_type', 'in', ['out_invoice', 'out_refund']],
                ['state', '=', 'posted'],
              ]],
              { fields: ['id', 'name', 'amount_total', 'invoice_date'], limit: 1, order: 'invoice_date desc, id desc' }
            );

            if (recentInvoices.length > 0) {
              invoiceId = recentInvoices[0].id;
              invoiceName = recentInvoices[0].name;
            }
          }
        } catch (invoiceError) {
          console.warn(`⚠️ Errore recupero fattura per statement line ${line.id}:`, invoiceError);
        }
      }

      const item: CassaforteItem = {
        id: line.id,
        date: line.date,
        payment_ref: line.payment_ref || '',
        partner_id: Array.isArray(line.partner_id) ? line.partner_id[0] : line.partner_id,
        partner_name: Array.isArray(line.partner_id) ? line.partner_id[1] : 'N/D',
        amount: Math.abs(line.amount),
        employee_name: employeeName,
        is_reconciled: line.is_reconciled,
        create_date: line.create_date,
        type: isWithdrawal ? 'withdrawal' : 'deposit',
        invoice_id: invoiceId,
        invoice_name: invoiceName,
      };

      if (isWithdrawal) {
        withdrawals.push(item);
      } else {
        deposits.push(item);
      }
    }

    // Calculate totals
    const pendingTotal = pendingPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    const depositsTotal = deposits.reduce((sum, d) => sum + d.amount, 0);
    const withdrawalsTotal = withdrawals.reduce((sum, w) => sum + w.amount, 0);
    const inSafeTotal = depositsTotal - withdrawalsTotal;

    return NextResponse.json({
      success: true,
      data: {
        pending: {
          items: pendingPayments,
          count: pendingPayments.length,
          total: pendingTotal,
        },
        in_safe: {
          items: deposits,
          count: deposits.length,
          total: inSafeTotal > 0 ? inSafeTotal : 0,
          deposits_total: depositsTotal,
        },
        withdrawn: {
          items: withdrawals,
          count: withdrawals.length,
          total: withdrawalsTotal,
        },
      },
      summary: {
        pending_total: pendingTotal,
        in_safe_total: inSafeTotal > 0 ? inSafeTotal : 0,
        withdrawn_total: withdrawalsTotal,
      },
    });

  } catch (error: any) {
    console.error('❌ Errore cassaforte summary:', error);

    return NextResponse.json({
      success: false,
      error: error.message || 'Errore durante il recupero dei dati cassaforte',
    }, { status: 500 });
  }
}
