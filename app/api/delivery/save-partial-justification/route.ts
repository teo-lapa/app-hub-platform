import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Trascrivi audio usando OpenAI Whisper
 */
async function transcribeAudioWithWhisper(audioBuffer: ArrayBuffer, mimeType: string): Promise<string> {
  try {
    console.log(`🎤 [WHISPER] Inizio trascrizione audio`);
    console.log(`🔍 [WHISPER] API Key configured: ${!!process.env.OPENAI_API_KEY}`);

    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    // Create form data for Whisper API
    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: mimeType });
    formData.append('file', blob, 'giustificazione.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'it'); // Italian
    formData.append('prompt', 'Questa è una giustificazione di uno scarico parziale di una consegna. Trascrivi con precisione la motivazione fornita dall\'autista.');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [WHISPER] API error: ${response.status} - ${errorText}`);
      throw new Error(`Whisper API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const transcription = result.text;

    console.log(`✅ [WHISPER] Trascrizione completata (${transcription.length} caratteri)`);
    console.log(`📝 [WHISPER] Testo: ${transcription}`);

    return transcription;
  } catch (error) {
    console.error('❌ [WHISPER] Errore trascrizione:', error);
    throw error;
  }
}

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
    let transcribedText = '';

    if (textNote) {
      messageBody += `📝 **Nota:**\n${textNote}\n\n`;
    }

    // Se c'è un audio, trascrivilo con Whisper e salvalo come allegato
    if (audioFile) {
      const audioBuffer = await audioFile.arrayBuffer();
      const audioBase64 = Buffer.from(audioBuffer).toString('base64');

      // Trascrivi l'audio con OpenAI Whisper
      try {
        transcribedText = await transcribeAudioWithWhisper(audioBuffer, audioFile.type || 'audio/webm');

        if (transcribedText && transcribedText.trim()) {
          messageBody += `🎤 **Motivazione (da audio):**\n${transcribedText.trim()}\n\n`;
        }
      } catch (whisperError: any) {
        console.error('⚠️ [PARTIAL JUSTIFICATION] Whisper fallito, salvo solo audio:', whisperError.message);
        // Continua comunque a salvare l'audio anche se la trascrizione fallisce
        messageBody += `🎤 **Audio registrato** (trascrizione non disponibile)\n\n`;
      }

      // Crea messaggio nel chatter con allegato audio
      await callOdoo(
        cookies,
        'mail.message',
        'create',
        [{
          model: 'stock.picking',
          res_id: parseInt(pickingId as string),
          body: messageBody,
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

      console.log('✅ [PARTIAL JUSTIFICATION] Audio trascritto e salvato come allegato nel chatter');
      if (transcribedText) {
        console.log('📝 [PARTIAL JUSTIFICATION] Trascrizione:', transcribedText);
      }
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
