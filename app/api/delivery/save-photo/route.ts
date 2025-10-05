import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export async function POST(request: NextRequest) {
  try {
    const userCookies = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(userCookies || undefined);

    if (!uid) {
      return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
    }

    const body = await request.json();
    const { picking_id, photo, notes } = body;

    if (!picking_id || !photo) {
      return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 });
    }

    console.log('📸 Salvataggio IMMEDIATO foto per picking:', picking_id);

    // Carica foto come ir.attachment
    const attachmentId = await callOdoo(cookies, 'ir.attachment', 'create', [{
      name: `Foto_Consegna_${picking_id}_${Date.now()}.jpg`,
      datas: photo,
      res_model: 'stock.picking',
      res_id: picking_id,
      mimetype: 'image/jpeg',
      description: 'Foto consegna - Cliente assente'
    }]);

    console.log('✅ Foto caricata come allegato ID:', attachmentId);

    // Aggiungi messaggio nel chatter
    let messageHtml = '<strong>📸 FOTO CONSEGNA ACQUISITA</strong><br/>';
    if (notes && notes.trim()) {
      messageHtml += '<strong>Note:</strong> ' + notes + '<br/>';
    }
    messageHtml += '<strong>Data:</strong> ' + new Date().toLocaleString('it-IT') + '<br/>';
    messageHtml += '<em>Cliente assente - Foto salvata e pronta per la chiusura consegna</em>';

    await callOdoo(cookies, 'mail.message', 'create', [{
      body: messageHtml,
      model: 'stock.picking',
      res_id: picking_id,
      message_type: 'comment',
      subtype_id: 1,
      attachment_ids: [[6, false, [attachmentId]]]
    }]);

    console.log('✅ Messaggio chatter creato con foto allegata');

    return NextResponse.json({
      success: true,
      attachment_id: attachmentId,
      message: 'Foto salvata immediatamente'
    });

  } catch (error: any) {
    console.error('❌ Errore salvataggio foto:', error);
    return NextResponse.json(
      { error: error.message || 'Errore salvataggio foto' },
      { status: 500 }
    );
  }
}
