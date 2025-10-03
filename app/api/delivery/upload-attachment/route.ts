import { NextRequest, NextResponse } from 'next/server';

const ODOO_URL = process.env.ODOO_URL || process.env.NEXT_PUBLIC_ODOO_URL;

async function callOdoo(sessionId: string, model: string, method: string, args: any[], kwargs: any = {}) {
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Openerp-Session-Id': sessionId
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model,
        method,
        args,
        kwargs
      }
    })
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.data?.message || 'Errore Odoo');
  }

  return data.result;
}

export async function POST(request: NextRequest) {
  try {
    const sessionId = request.cookies.get('session_id')?.value;
    if (!sessionId) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    const body = await request.json();
    const { picking_id, context, data, timestamp } = body;

    if (!picking_id || !context || !data) {
      return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 });
    }

    // Determine file extension based on context
    const extension = data.startsWith('data:image/png') ? 'png' : 'jpg';
    const contextLabel = context === 'signature' ? 'Firma Cliente' :
                        context === 'photo' ? 'Foto Consegna' :
                        context === 'payment' ? 'Ricevuta Pagamento' :
                        'Foto Reso';

    const fileName = `${contextLabel}_${picking_id}_${new Date(timestamp).toISOString()}.${extension}`;

    // Create ir.attachment
    const attachmentId = await callOdoo(
      sessionId,
      'ir.attachment',
      'create',
      [{
        name: fileName,
        datas: data,
        res_model: 'stock.picking',
        res_id: picking_id,
        mimetype: `image/${extension}`
      }]
    );

    return NextResponse.json({
      success: true,
      attachment_id: attachmentId
    });
  } catch (error: any) {
    console.error('Error uploading attachment:', error);
    return NextResponse.json(
      { error: error.message || 'Errore upload allegato' },
      { status: 500 }
    );
  }
}
