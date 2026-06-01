import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';
import { checkPickingOwnership, assertBase64Size, stripBase64Prefix } from '@/lib/delivery-auth';

export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);
    if (!uid) {
      return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
    }

    const body = await request.json();
    const { picking_id, note_type, note, photo } = body;

    if (!picking_id || !note || !note.trim()) {
      return NextResponse.json({ error: 'Dati nota non validi' }, { status: 400 });
    }

    const ownership = await checkPickingOwnership(cookies, cookieHeader, uid, picking_id);
    if (!ownership.ok) {
      return NextResponse.json({ error: ownership.error }, { status: ownership.status });
    }
    assertBase64Size(photo);

    const tipoLabel = note_type === 'extra' ? 'Prodotto extra da fatturare' : 'Generica';

    // Upload foto opzionale come allegato
    let attachmentId = null;
    if (photo) {
      const photoBase64 = stripBase64Prefix(photo);
      attachmentId = await callOdoo(cookies, 'ir.attachment', 'create', [{
        name: `Nota_Autista_${picking_id}_${Date.now()}.jpg`,
        datas: photoBase64,
        res_model: 'stock.picking',
        res_id: picking_id,
        mimetype: 'image/jpeg',
        description: 'Foto nota autista'
      }]);
    }

    // Marker COSTANTE: la skill feedback-scarichi filtra su "NOTA AUTISTA"
    const messageHtml = `<strong>📝 NOTA AUTISTA</strong><br/>
<strong>Tipo:</strong> ${tipoLabel}<br/>
<strong>Nota:</strong> ${note}<br/>
${attachmentId ? '<strong>📸 Foto allegata</strong><br/>' : ''}
<strong>Data:</strong> ${new Date().toLocaleString('it-IT')}<br/>`;

    const messageId = await callOdoo(cookies, 'mail.message', 'create', [{
      body: messageHtml,
      model: 'stock.picking',
      res_id: picking_id,
      message_type: 'comment',
      subtype_id: 1,
      attachment_ids: attachmentId ? [[6, false, [attachmentId]]] : false
    }]);

    return NextResponse.json({
      success: true,
      message_id: messageId,
      attachment_id: attachmentId,
      message: 'Nota registrata nel documento'
    });
  } catch (error: any) {
    console.error('❌ [NOTE] Errore:', error);
    return NextResponse.json(
      { error: error.message || 'Errore salvataggio nota' },
      { status: 500 }
    );
  }
}
