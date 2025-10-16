import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

/**
 * POST /api/valida-fatture/get-invoice-detail
 *
 * Recupera dettaglio completo fattura con righe e allegati PDF in base64
 */
export async function POST(request: NextRequest) {
  try {
    const { invoice_id } = await request.json();

    if (!invoice_id) {
      return NextResponse.json({ error: 'invoice_id mancante' }, { status: 400 });
    }

    console.log(`📄 [GET-INVOICE-DETAIL] Loading invoice ${invoice_id}...`);

    const userCookies = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(userCookies || undefined);

    if (!uid) {
      return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
    }

    // 1. Recupera dati base fattura
    const invoices = await callOdoo(
      cookies,
      'account.move',
      'read',
      [[invoice_id]],
      {
        fields: [
          'id',
          'name',
          'partner_id',
          'invoice_date',
          'amount_untaxed',
          'amount_tax',
          'amount_total',
          'currency_id',
          'state',
          'move_type',
          'ref',
          'invoice_origin',
          'invoice_line_ids'
        ]
      }
    );

    if (!invoices || invoices.length === 0) {
      return NextResponse.json({ error: 'Fattura non trovata' }, { status: 404 });
    }

    const invoice = invoices[0];
    console.log(`✅ [GET-INVOICE-DETAIL] Invoice loaded, ${invoice.invoice_line_ids.length} lines`);

    // 2. Recupera righe fattura
    const lines = await callOdoo(
      cookies,
      'account.move.line',
      'read',
      [invoice.invoice_line_ids],
      {
        fields: [
          'id',
          'product_id',
          'name',
          'quantity',
          'price_unit',
          'price_subtotal',
          'price_total',
          'tax_ids',
          'discount',
          'product_uom_id'
        ]
      }
    );

    console.log(`✅ [GET-INVOICE-DETAIL] Loaded ${lines.length} invoice lines`);

    // 3. Recupera allegati con contenuto base64
    const attachments = await callOdoo(
      cookies,
      'ir.attachment',
      'search_read',
      [
        [
          ['res_model', '=', 'account.move'],
          ['res_id', '=', invoice_id],
          ['mimetype', 'in', ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp']]
        ]
      ],
      {
        fields: ['id', 'name', 'datas', 'mimetype', 'file_size', 'create_date'],
        order: 'create_date desc'
      }
    );

    console.log(`✅ [GET-INVOICE-DETAIL] Found ${attachments.length} attachments`);

    // Costruisci risposta completa
    const invoiceDetail = {
      ...invoice,
      invoice_line_ids: lines,
      attachments: attachments
    };

    return NextResponse.json({
      success: true,
      invoice: invoiceDetail
    });

  } catch (error: any) {
    console.error('❌ [GET-INVOICE-DETAIL] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Errore recupero dettaglio fattura' },
      { status: 500 }
    );
  }
}
