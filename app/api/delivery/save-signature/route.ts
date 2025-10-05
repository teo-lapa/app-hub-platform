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
    const { picking_id, signature, notes } = body;

    if (!picking_id || !signature) {
      return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 });
    }

    console.log('🖊️ Salvataggio IMMEDIATO firma per picking:', picking_id);

    // 1. Salva firma nel campo signature del picking
    await callOdoo(cookies, 'stock.picking', 'write', [[picking_id], {
      signature: signature
    }]);

    console.log('✅ Firma salvata nel campo signature');

    // 2. Aggiungi messaggio nel chatter
    let messageHtml = '<strong>✍️ FIRMA CLIENTE ACQUISITA</strong><br/>';
    if (notes && notes.trim()) {
      messageHtml += '<strong>Note:</strong> ' + notes + '<br/>';
    }
    messageHtml += '<strong>Data:</strong> ' + new Date().toLocaleString('it-IT') + '<br/>';
    messageHtml += '<em>Firma salvata e pronta per la chiusura consegna</em>';

    await callOdoo(cookies, 'mail.message', 'create', [{
      body: messageHtml,
      model: 'stock.picking',
      res_id: picking_id,
      message_type: 'comment',
      subtype_id: 1
    }]);

    console.log('✅ Messaggio chatter creato');

    return NextResponse.json({
      success: true,
      message: 'Firma salvata immediatamente'
    });

  } catch (error: any) {
    console.error('❌ Errore salvataggio firma:', error);
    return NextResponse.json(
      { error: error.message || 'Errore salvataggio firma' },
      { status: 500 }
    );
  }
}
