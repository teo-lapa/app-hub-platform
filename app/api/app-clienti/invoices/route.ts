import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin } from '@/lib/odoo/admin-session';
import { resolveCustomer } from '@/lib/app-clienti/customer';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const payLabel = (s: string) =>
  ({ not_paid: 'Da pagare', partial: 'Parziale', paid: 'Pagata', in_payment: 'In pagamento', reversed: 'Stornata' } as Record<string, string>)[s] || s;

/** GET /api/app-clienti/invoices — fatture di TUTTO il gruppo aziendale del cliente loggato */
export async function GET(request: NextRequest) {
  try {
    const cust = await resolveCustomer(request);
    if (!cust) return NextResponse.json({ success: false, invoices: [], error: 'Cliente non identificato' }, { status: 200 });

    const rows: any[] = await callOdooAsAdmin('account.move', 'search_read', [], {
      domain: [
        ['partner_id', 'child_of', cust.commercialId],
        ['move_type', '=', 'out_invoice'],
        ['state', 'in', ['posted', 'draft']],
      ],
      fields: ['id', 'name', 'invoice_date', 'invoice_date_due', 'amount_total', 'amount_residual', 'state', 'payment_state', 'currency_id'],
      order: 'invoice_date desc',
      limit: 100,
    });

    const today = new Date().toISOString().slice(0, 10);
    const invoices = (rows || []).map((inv) => ({
      id: inv.id,
      name: inv.name,
      invoiceDate: inv.invoice_date,
      invoiceDateDue: inv.invoice_date_due,
      amountTotal: inv.amount_total,
      amountResidual: inv.amount_residual,
      state: inv.state,
      paymentState: inv.payment_state,
      paymentStateLabel: payLabel(inv.payment_state),
      isOverdue: !!inv.invoice_date_due && inv.invoice_date_due < today && (inv.amount_residual || 0) > 0 && inv.payment_state !== 'paid',
      currency: Array.isArray(inv.currency_id) ? inv.currency_id[1] : 'CHF',
    }));

    return NextResponse.json({ success: true, invoices });
  } catch (error: any) {
    return NextResponse.json({ success: false, invoices: [], error: error?.message || 'errore' }, { status: 200 });
  }
}
