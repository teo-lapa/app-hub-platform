import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
    }

    const formData = await request.formData();
    const pickingId = formData.get('picking_id');
    const driverName = formData.get('driver_name');
    const textNote = formData.get('text_note');
    const audioFile = formData.get('audio_note') as File | null;

    if (!pickingId) {
      return NextResponse.json({ error: 'picking_id mancante' }, { status: 400 });
    }

    console.log('💬 [PARTIAL JUSTIFICATION] Salvataggio giustificazione scarico parziale');
    console.log('  - Picking ID:', pickingId);
    console.log('  - Autista:', driverName);
    console.log('  - Nota testo:', textNote ? 'SI' : 'NO');
    console.log('  - Audio:', audioFile ? 'SI' : 'NO');

    let messageBody = `⚠️ **SCARICO PARZIALE** - Giustificazione autista ${driverName}\n\n`;

    if (textNote) {
      messageBody += `📝 **Nota:**\n${textNote}\n\n`;
    }

    // Se c'è un audio, salvalo come allegato
    if (audioFile) {
      const audioBuffer = await audioFile.arrayBuffer();
      const audioBase64 = Buffer.from(audioBuffer).toString('base64');

      // Crea messaggio nel chatter con allegato audio
      await callOdoo(
        cookies,
        'mail.message',
        'create',
        [{
          model: 'stock.picking',
          res_id: parseInt(pickingId as string),
          body: messageBody + '🎤 **Audio registrato** (vedi allegato)',
          message_type: 'comment',
          subtype_id: 1, // Note
          attachment_ids: [[0, 0, {
            name: `giustificazione_${driverName}_${Date.now()}.webm`,
            datas: audioBase64,
            res_model: 'stock.picking',
            res_id: parseInt(pickingId as string),
            mimetype: 'audio/webm'
          }]]
        }]
      );

      console.log('✅ [PARTIAL JUSTIFICATION] Audio salvato come allegato nel chatter');
    } else {
      // Solo nota testo, crea messaggio semplice
      await callOdoo(
        cookies,
        'mail.message',
        'create',
        [{
          model: 'stock.picking',
          res_id: parseInt(pickingId as string),
          body: messageBody,
          message_type: 'comment',
          subtype_id: 1 // Note
        }]
      );

      console.log('✅ [PARTIAL JUSTIFICATION] Nota testo salvata nel chatter');
    }

    return NextResponse.json({
      success: true,
      message: 'Giustificazione salvata nel chatter'
    });

  } catch (error: any) {
    console.error('❌ [PARTIAL JUSTIFICATION] Errore:', error);
    return NextResponse.json(
      { error: error.message || 'Errore salvataggio giustificazione' },
      { status: 500 }
    );
  }
}
