import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * POST /api/social-ai/check-video-status
 *
 * Controlla lo stato della generazione video Veo 3.1
 *
 * Body:
 * - operationId: string - ID dell'operazione video
 */

export async function POST(request: NextRequest) {
  try {
    const { operationId } = await request.json();

    if (!operationId) {
      return NextResponse.json(
        { error: 'operationId è obbligatorio' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      console.error('❌ [VIDEO-POLLING] API key non configurata');
      return NextResponse.json(
        { error: 'API key non configurata' },
        { status: 500 }
      );
    }

    console.log('🔍 [VIDEO-POLLING] Controllo operazione:', operationId);

    const ai = new GoogleGenAI({ apiKey });

    // Recupera lo stato dell'operazione
    let operation;
    try {
      operation = await ai.operations.getVideosOperation({
        operation: operationId
      });
    } catch (opError: any) {
      console.error('❌ [VIDEO-POLLING] Errore getVideosOperation:', opError.message);

      // Se l'operazione non esiste o c'è un errore, restituisci un messaggio chiaro
      return NextResponse.json(
        {
          error: 'Errore nel recupero dello stato del video',
          details: opError.message,
          suggestion: 'Il video potrebbe non essere stato avviato correttamente o l\'API Veo non è disponibile'
        },
        { status: 500 }
      );
    }

    if (!operation.done) {
      console.log('⏳ [VIDEO-POLLING] Video ancora in generazione...');
      return NextResponse.json({
        status: 'generating',
        done: false,
        progress: operation.metadata?.progress || 0
      });
    }

    // Video completato!
    console.log('✅ [VIDEO-POLLING] Video completato!');

    const videoFile = operation.response?.generatedVideos?.[0]?.video;

    if (!videoFile) {
      return NextResponse.json(
        { error: 'Nessun video trovato nella risposta' },
        { status: 500 }
      );
    }

    // Ottieni l'URI del file video (il video è già disponibile come URI/URL)
    // Nota: Veo restituisce un file reference, non i dati raw
    // Per ora restituiamo l'ID del file - il client dovrà gestire diversamente
    // oppure usiamo un approccio alternativo

    console.log('📹 [VIDEO-POLLING] Video file:', videoFile);

    // Restituisci l'URL del video invece del base64 (più efficiente)
    return NextResponse.json({
      status: 'completed',
      done: true,
      video: {
        fileUri: videoFile.uri || '',
        mimeType: 'video/mp4',
        message: 'Video generato! Download disponibile tramite URI.'
      }
    });

  } catch (error: any) {
    console.error('❌ [VIDEO-POLLING] Errore:', error);

    return NextResponse.json(
      {
        error: 'Errore durante il controllo dello stato del video',
        details: error.message
      },
      { status: 500 }
    );
  }
}
