import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

/**
 * POST /api/valida-fatture/upload-pdf
 *
 * Carica PDF manualmente e lo aggancia alla fattura bozza
 */
export async function POST(request: NextRequest) {
  try {
    const { invoice_id, pdf_base64, filename } = await request.json();

    if (!invoice_id || !pdf_base64) {
      return NextResponse.json(
        { error: 'invoice_id e pdf_base64 richiesti' },
        { status: 400 }
      );
    }

    console.log(`📤 [UPLOAD-PDF] Uploading PDF for invoice ${invoice_id}`);

    const userCookies = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(userCookies || undefined);

    if (!uid) {
      return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
    }

    // Crea allegato in Odoo
    const attachmentId = await callOdoo(
      cookies,
      'ir.attachment',
      'create',
      [{
        name: filename || `Fattura_${invoice_id}.pdf`,
        datas: pdf_base64,
        res_model: 'account.move',
        res_id: invoice_id,
        mimetype: 'application/pdf'
      }]
    );

    console.log(`✅ [UPLOAD-PDF] PDF uploaded with ID: ${attachmentId}`);

    return NextResponse.json({
      success: true,
      attachment_id: attachmentId
    });

  } catch (error: any) {
    console.error('❌ [UPLOAD-PDF] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Errore upload PDF' },
      { status: 500 }
    );
  }
}
