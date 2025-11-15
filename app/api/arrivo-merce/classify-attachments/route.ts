import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

const JETSON_OCR_URL = process.env.JETSON_OCR_URL || 'https://pencil-intl-adipex-knowledgestorm.trycloudflare.com';
const JETSON_WEBHOOK_SECRET = process.env.JETSON_WEBHOOK_SECRET || 'jetson-ocr-secret-2025';

const DOCUMENT_TYPE_NAMES: Record<string, string> = {
  invoice: 'FATTURA',
  purchase_order: 'ORDINE',
  delivery_note: 'DDT',
  receipt: 'RICEVUTA',
  quote: 'PREVENTIVO',
  other: 'ALTRO'
};

export async function POST(request: NextRequest) {
  try {
    const { picking_id } = await request.json();

    if (!picking_id) {
      return NextResponse.json(
        { success: false, error: 'Missing picking_id' },
        { status: 400 }
      );
    }

    // Get Odoo session from user cookies
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
    }

    console.log(`📄 [CLASSIFY] Classificazione allegati per picking ${picking_id}`);

    // Get all PDF attachments for this picking
    const attachments = await callOdoo(cookies, 'ir.attachment', 'search_read', [
      [
        ['res_model', '=', 'stock.picking'],
        ['res_id', '=', picking_id],
        ['mimetype', '=', 'application/pdf']
      ],
      ['id', 'name', 'datas']
    ]);

    if (attachments.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nessun allegato PDF trovato',
        classified: []
      });
    }

    console.log(`📄 Trovati ${attachments.length} allegati PDF da classificare`);

    // Classify each PDF
    const results = [];

    for (const attachment of attachments) {
      try {
        // Decode PDF
        const pdfBuffer = Buffer.from(attachment.datas, 'base64');
        const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });

        // Send to Jetson OCR
        const formData = new FormData();
        formData.append('file', pdfBlob, attachment.name);

        const jetsonResponse = await fetch(`${JETSON_OCR_URL}/api/v1/ocr/analyze`, {
          method: 'POST',
          headers: { 'X-Webhook-Secret': JETSON_WEBHOOK_SECRET },
          body: formData
        });

        if (!jetsonResponse.ok) {
          throw new Error(`Jetson OCR failed: ${jetsonResponse.statusText}`);
        }

        const ocrResult = await jetsonResponse.json();

        // Extract type
        const classifiedType = ocrResult.result?.type || 'other';
        const typeName = DOCUMENT_TYPE_NAMES[classifiedType] || 'ALTRO';

        // Generate new name
        const originalName = attachment.name;
        const nameWithoutExt = originalName.replace(/\.pdf$/i, '');
        const newName = `${typeName}_${nameWithoutExt}.pdf`;

        // Rename in Odoo
        await callOdoo(cookies, 'ir.attachment', 'write', [
          [attachment.id],
          { name: newName }
        ]);

        console.log(`✅ ${originalName} → ${newName}`);

        results.push({
          attachment_id: attachment.id,
          original_name: originalName,
          new_name: newName,
          type: typeName,
          confidence: ocrResult.result?.confidence || 0,
          success: true
        });

      } catch (error: any) {
        console.error(`❌ Error classifying ${attachment.name}:`, error);

        results.push({
          attachment_id: attachment.id,
          original_name: attachment.name,
          success: false,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;

    return NextResponse.json({
      success: true,
      message: `${successCount}/${attachments.length} documenti classificati`,
      classified: results
    });

  } catch (error: any) {
    console.error('Error classifying attachments:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to classify attachments'
      },
      { status: 500 }
    );
  }
}
