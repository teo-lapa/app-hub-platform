import { NextRequest, NextResponse } from 'next/server';
import { callKw } from '@/lib/odoo/rpc';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { model, res_id, message } = await request.json();

    if (!model || !res_id || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: model, res_id, message' },
        { status: 400 }
      );
    }

    // Posta messaggio nel Chatter
    await callKw('mail.message', 'create', [{
      model: model,
      res_id: res_id,
      body: message.replace(/\n/g, '<br/>'),
      message_type: 'comment',
      subtype_id: 1 // mt_note (nota interna)
    }]);

    console.log(`✅ Messaggio postato su ${model} ID ${res_id}`);

    return NextResponse.json({
      success: true,
      message: 'Messaggio salvato nel Chatter'
    });

  } catch (error: any) {
    console.error('❌ Errore post messaggio Odoo:', error);
    return NextResponse.json(
      { error: 'Errore salvataggio messaggio', details: error.message },
      { status: 500 }
    );
  }
}
