import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export async function POST(request: NextRequest) {
  try {
    const { cookies, uid } = await getOdooSession();
    if (!uid) {
      return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
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
      cookies,
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
