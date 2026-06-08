import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin } from '@/lib/silvano/odoo';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/silvano/cliente/[id]
 * Scheda cliente (read-only): anagrafica, sotto-contatti/indirizzi, fatture.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (isNaN(id)) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });

    const partners = await callOdooAsAdmin('res.partner', 'search_read', [], {
      domain: [['id', '=', id]],
      fields: [
        'id', 'name', 'email', 'phone', 'mobile', 'vat', 'street', 'street2',
        'city', 'zip', 'comment', 'total_invoiced', 'credit',
        'property_product_pricelist', 'property_payment_term_id', 'user_id',
      ],
      limit: 1,
    });
    if (!partners?.length) return NextResponse.json({ success: false, error: 'Cliente non trovato' }, { status: 404 });
    const p = partners[0];

    // Sotto-contatti / indirizzi di consegna (figli)
    const children = await callOdooAsAdmin('res.partner', 'search_read', [], {
      domain: [['parent_id', '=', id]],
      fields: ['id', 'name', 'type', 'street', 'city', 'zip', 'phone', 'email'],
      order: 'type asc, name asc',
    });

    // Fatture cliente (anche dei figli)
    const invoices = await callOdooAsAdmin('account.move', 'search_read', [], {
      domain: [
        ['partner_id', 'child_of', id],
        ['move_type', '=', 'out_invoice'],
        ['state', '=', 'posted'],
      ],
      fields: ['id', 'name', 'invoice_date', 'invoice_date_due', 'amount_total', 'amount_residual', 'payment_state'],
      order: 'invoice_date desc',
      limit: 24,
    });

    return NextResponse.json({
      success: true,
      cliente: {
        id: p.id,
        name: p.name,
        email: p.email || '',
        phone: p.phone || p.mobile || '',
        vat: p.vat || '',
        address: [p.street, p.street2, [p.zip, p.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
        note: p.comment || '',
        pricelist: p.property_product_pricelist ? p.property_product_pricelist[1] : '',
        paymentTerm: p.property_payment_term_id ? p.property_payment_term_id[1] : '',
        salesperson: p.user_id ? p.user_id[1] : '',
        totalInvoiced: p.total_invoiced || 0,
        credit: p.credit || 0,
      },
      contatti: children.map((c: any) => ({
        id: c.id,
        name: c.name,
        type: c.type || 'other',
        address: [c.street, [c.zip, c.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
        phone: c.phone || '',
        email: c.email || '',
      })),
      fatture: invoices.map((i: any) => ({
        id: i.id,
        name: i.name,
        date: i.invoice_date || null,
        dueDate: i.invoice_date_due || null,
        total: i.amount_total || 0,
        residual: i.amount_residual || 0,
        paymentState: i.payment_state || 'not_paid',
      })),
    });
  } catch (error: any) {
    console.error('💥 [SILVANO/cliente/:id]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
