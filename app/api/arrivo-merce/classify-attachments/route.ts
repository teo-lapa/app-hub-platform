import { NextResponse } from 'next/server';

const ODOO_URL = process.env.NEXT_PUBLIC_ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24517859.dev.odoo.com';
const ODOO_DB = process.env.NEXT_PUBLIC_ODOO_DB || 'lapadevadmin-lapa-v2-staging-2406-24517859';
const ODOO_USERNAME = process.env.ODOO_USERNAME || 'admin';
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || 'admin';

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

interface OdooSession {
  uid: number;
  session_id: string;
}

async function authenticateOdoo(): Promise<OdooSession> {
  const response = await fetch(`${ODOO_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { db: ODOO_DB, login: ODOO_USERNAME, password: ODOO_PASSWORD },
      id: 1
    })
  });

  const data = await response.json();
  if (!data.result || !data.result.uid) {
    throw new Error('Odoo authentication failed');
  }

  return {
    uid: data.result.uid,
    session_id: data.result.session_id
  };
}

async function searchRead(
  session: OdooSession,
  model: string,
  domain: any[],
  fields: string[]
): Promise<any[]> {
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_id=${session.session_id}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model,
        method: 'search_read',
        args: [],
        kwargs: { domain, fields }
      },
      id: Math.floor(Math.random() * 1000000)
    })
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message || 'Search failed');
  }

  return data.result || [];
}

async function writeOdoo(
  session: OdooSession,
  model: string,
  ids: number[],
  values: any
): Promise<boolean> {
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_id=${session.session_id}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model,
        method: 'write',
        args: [ids, values],
        kwargs: {}
      },
      id: Math.floor(Math.random() * 1000000)
    })
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message || 'Write failed');
  }

  return data.result || false;
}

export async function POST(request: Request) {
  try {
    const { picking_id } = await request.json();

    if (!picking_id) {
      return NextResponse.json(
        { success: false, error: 'Missing picking_id' },
        { status: 400 }
      );
    }

    // 1. Authenticate
    const session = await authenticateOdoo();

    // 2. Get all PDF attachments for this picking
    const attachments = await searchRead(
      session,
      'ir.attachment',
      [
        ['res_model', '=', 'stock.picking'],
        ['res_id', '=', picking_id],
        ['mimetype', '=', 'application/pdf']
      ],
      ['id', 'name', 'datas']
    );

    if (attachments.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nessun allegato PDF trovato',
        classified: []
      });
    }

    console.log(`📄 Trovati ${attachments.length} allegati PDF da classificare`);

    // 3. Classify each PDF
    const results = [];

    for (const attachment of attachments) {
      try {
        // Decode PDF
        const pdfBuffer = Buffer.from(attachment.datas, 'base64');
        const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });

        // Send to Jetson
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
        const classifiedType = ocrResult.classification?.type || 'other';
        const typeName = DOCUMENT_TYPE_NAMES[classifiedType] || 'ALTRO';

        // Generate new name
        const originalName = attachment.name;
        const nameWithoutExt = originalName.replace(/\.pdf$/i, '');
        const newName = `${typeName}_${nameWithoutExt}.pdf`;

        // Rename in Odoo
        await writeOdoo(
          session,
          'ir.attachment',
          [attachment.id],
          { name: newName }
        );

        console.log(`✅ ${originalName} → ${newName}`);

        results.push({
          attachment_id: attachment.id,
          original_name: originalName,
          new_name: newName,
          type: typeName,
          confidence: ocrResult.classification?.confidence || 0,
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
