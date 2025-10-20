import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

/**
 * GET /api/valida-fatture/list-draft-invoices?company_id=1
 *
 * Recupera tutte le fatture fornitori in bozza con info sugli allegati
 * Opzionale: filtra per azienda con query param company_id
 */

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('📋 [LIST-DRAFT-INVOICES] Starting...');

    const userCookies = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(userCookies || undefined);

    if (!uid) {
      return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
    }

    // Leggi filtro azienda dalla query string
    const searchParams = request.nextUrl.searchParams;
    const companyId = searchParams.get('company_id');

    // Costruisci domain per la ricerca
    const domain: any[] = [
      ['move_type', '=', 'in_invoice'], // Fatture fornitori
      ['state', '=', 'draft'] // Solo bozze
    ];

    // Aggiungi filtro azienda se specificato
    if (companyId) {
      domain.push(['company_id', '=', parseInt(companyId)]);
      console.log(`🏢 [LIST-DRAFT-INVOICES] Filtering by company_id: ${companyId}`);
    }

    // Cerca fatture fornitori in bozza
    const invoices = await callOdoo(
      cookies,
      'account.move',
      'search_read',
      [domain],
      {
        fields: [
          'id',
          'name',
          'partner_id',
          'company_id',
          'invoice_date',
          'amount_untaxed',
          'amount_tax',
          'amount_total',
          'currency_id',
          'state',
          'move_type',
          'ref',
          'invoice_origin',
          'create_date',
          'write_date'
        ],
        order: 'write_date desc', // Più recenti prima
        limit: 100
      }
    );

    console.log(`✅ [LIST-DRAFT-INVOICES] Found ${invoices.length} draft invoices`);

    // Per ogni fattura, controlla se ha allegati PDF
    const invoicesWithAttachments = await Promise.all(
      invoices.map(async (invoice: any) => {
        try {
          // Cerca allegati PDF per questa fattura
          const attachments = await callOdoo(
            cookies,
            'ir.attachment',
            'search_read',
            [
              [
                ['res_model', '=', 'account.move'],
                ['res_id', '=', invoice.id],
                ['mimetype', 'in', ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']]
              ]
            ],
            {
              fields: ['id', 'name', 'mimetype', 'file_size', 'create_date'],
              order: 'create_date desc'
            }
          );

          return {
            ...invoice,
            has_attachment: attachments.length > 0,
            attachment_ids: attachments.map((a: any) => a.id),
            attachments: attachments
          };
        } catch (error) {
          console.error(`⚠️ [LIST-DRAFT-INVOICES] Error checking attachments for invoice ${invoice.id}:`, error);
          return {
            ...invoice,
            has_attachment: false,
            attachment_ids: [],
            attachments: []
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      invoices: invoicesWithAttachments
    });

  } catch (error: any) {
    console.error('❌ [LIST-DRAFT-INVOICES] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Errore recupero fatture' },
      { status: 500 }
    );
  }
}
