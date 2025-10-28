import { NextRequest, NextResponse } from 'next/server';

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

    // Posta messaggio nel Chatter tramite RPC
    const rpcResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/odoo/rpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'mail.message',
        method: 'create',
        args: [[{
          model: model,
          res_id: res_id,
          body: message.replace(/\n/g, '<br/>'),
          message_type: 'comment',
          subtype_id: 1
        }]],
        kwargs: {}
      })
    });

    if (!rpcResponse.ok) {
      throw new Error('Errore chiamata RPC');
    }

    const rpcData = await rpcResponse.json();
    if (!rpcData.success) {
      throw new Error(rpcData.error || 'Errore RPC');
    }

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
