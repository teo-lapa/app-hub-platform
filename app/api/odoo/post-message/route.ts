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

    // Posta messaggio nel Chatter usando message_post sul record
    const rpcResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/odoo/rpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        method: 'message_post',
        args: [[res_id]],
        kwargs: {
          body: message.replace(/\n/g, '<br/>'),
          message_type: 'comment'
        }
      })
    });

    if (!rpcResponse.ok) {
      const errorText = await rpcResponse.text();
      console.error('❌ RPC Response error:', errorText);
      throw new Error(`Errore chiamata RPC: ${errorText}`);
    }

    const rpcData = await rpcResponse.json();
    if (!rpcData.success) {
      console.error('❌ RPC Data error:', rpcData);
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
