import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

/**
 * API: Save note to customer chatter in Odoo
 *
 * Creates a mail.message on the res.partner record using message_post
 */
export async function POST(request: NextRequest) {
  try {
    // Get user session
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      return NextResponse.json({
        success: false,
        error: 'Non autenticato - Sessione Odoo non valida'
      }, { status: 401 });
    }

    const body = await request.json();
    const { customerId, note, noteType } = body;

    if (!customerId || !note) {
      return NextResponse.json({
        success: false,
        error: 'customerId e note sono richiesti'
      }, { status: 400 });
    }

    // Format note with Sales Alert header
    const formattedNote = `
<div style="background: linear-gradient(135deg, #ef4444, #f97316); padding: 12px; border-radius: 8px; margin-bottom: 8px;">
  <strong style="color: white;">🚨 Sales Alert - ${noteType || 'Nota'}</strong>
</div>
<div style="padding: 12px; background: #fef2f2; border-radius: 8px; border-left: 4px solid #ef4444;">
  ${note.replace(/\n/g, '<br/>')}
</div>
<div style="margin-top: 8px; font-size: 12px; color: #666;">
  Inviato da Sales Alert il ${new Date().toLocaleDateString('it-IT')} alle ${new Date().toLocaleTimeString('it-IT')}
</div>
`;

    // Use message_post to create message in chatter (like catalogo-venditori)
    const messageId = await callOdoo(
      cookies,
      'res.partner',
      'message_post',
      [customerId],
      {
        body: formattedNote,
        message_type: 'comment',
        subtype_xmlid: 'mail.mt_note'
      }
    );

    return NextResponse.json({
      success: true,
      messageId,
      message: 'Nota salvata nel chatter del cliente'
    });

  } catch (error: any) {
    console.error('Error saving note to chatter:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * GET: Fetch recent notes from customer chatter
 */
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.cookies.get('odoo_session_id')?.value;
    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Non autenticato - Odoo session non trovata'
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    if (!customerId) {
      return NextResponse.json({
        success: false,
        error: 'customerId è richiesto'
      }, { status: 400 });
    }

    const rpc = createOdooRPCClient(sessionId);

    // Fetch recent messages from chatter
    const messages = await rpc.searchRead(
      'mail.message',
      [
        ['model', '=', 'res.partner'],
        ['res_id', '=', parseInt(customerId)],
        ['message_type', 'in', ['comment', 'notification']]
      ],
      ['id', 'body', 'date', 'author_id', 'message_type'],
      20 // Last 20 messages
    );

    return NextResponse.json({
      success: true,
      messages: messages.map((m: any) => ({
        id: m.id,
        body: m.body,
        date: m.date,
        author: m.author_id ? m.author_id[1] : 'Sistema',
        type: m.message_type
      }))
    });

  } catch (error: any) {
    console.error('Error fetching notes from chatter:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
