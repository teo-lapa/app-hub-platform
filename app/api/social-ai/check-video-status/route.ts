import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const runtime = 'nodejs';
export const maxDuration = 30;

const isDev = process.env.NODE_ENV === 'development';

/**
 * POST /api/social-ai/check-video-status
 *
 * Controlla lo stato della generazione video Veo 3.1 usando il nuovo SDK @google/genai
 * Documentazione: https://ai.google.dev/gemini-api/docs/video
 *
 * Body:
 * - operationId: string - ID dell'operazione video (formato: "models/veo-3.1-generate-preview/operations/...")
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

    // Verifica API key
    const apiKey = process.env.VEO_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      console.error('[VIDEO-POLLING] API key non configurata');
      return NextResponse.json(
        { error: 'API key non configurata' },
        { status: 500 }
      );
    }

    // Inizializza client Gemini (NUOVO SDK)
    const ai = new GoogleGenAI({ apiKey });

    // Polling dell'operazione usando il NUOVO SDK
    let operation;
    try {
      // Usa ai.operations.getVideosOperation() come da documentazione ufficiale
      operation = await ai.operations.getVideosOperation({
        operation: { name: operationId }
      });

      if (isDev) {
        console.log('[VIDEO-POLLING] Operation status:', operation.done ? 'completed' : 'generating');
      }

    } catch (opError: any) {
      console.error('[VIDEO-POLLING] Errore SDK polling:', opError.message);
      if (isDev) {
        console.error('[VIDEO-POLLING] Stack:', opError.stack);
      }

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
      return NextResponse.json({
        status: 'generating',
        done: false,
        progress: operation.metadata?.progress || 0
      });
    }

    // Video completato - estrai usando la struttura del NUOVO SDK
    // Secondo la documentazione: operation.response.generatedVideos[0].video
    const generatedVideos = (operation as any).response?.generatedVideos;

    if (!generatedVideos || generatedVideos.length === 0) {
      console.error('[VIDEO-POLLING] Video file not found in response');
      if (isDev) {
        console.error('[VIDEO-POLLING] Full operation response:', JSON.stringify((operation as any).response, null, 2));
      }
      return NextResponse.json(
        { error: 'Nessun video trovato nella risposta' },
        { status: 500 }
      );
    }

    const videoFile = generatedVideos[0].video;

    if (!videoFile) {
      console.error('[VIDEO-POLLING] Video object is null');
      return NextResponse.json(
        { error: 'Video object non valido' },
        { status: 500 }
      );
    }

    // Scarica il video usando ai.files.download()
    try {
      if (isDev) {
        console.log('[VIDEO-POLLING] Video file info:', videoFile);
      }

      // Il video file dovrebbe avere un URI o name per il download
      const fileUri = videoFile.uri || videoFile.name;

      if (!fileUri) {
        throw new Error('URI del video non trovato nel video object');
      }

      // Usa ai.files.download() per scaricare il video (metodo del nuovo SDK)
      const videoData = await ai.files.download({
        file: { uri: fileUri }
      });

      if (!videoData) {
        throw new Error('Download del video fallito - nessun dato restituito');
      }

      // Converti in base64 per il frontend
      const videoBase64 = Buffer.from(videoData).toString('base64');
      const dataUrl = `data:video/mp4;base64,${videoBase64}`;

      if (isDev) {
        console.log('[VIDEO-POLLING] ✓ Video downloaded successfully. Size:', videoData.byteLength, 'bytes');
      }

      return NextResponse.json({
        status: 'completed',
        done: true,
        video: {
          data: videoBase64,
          dataUrl: dataUrl,
          mimeType: 'video/mp4',
          size: videoData.byteLength
        }
      });

    } catch (downloadError: any) {
      console.error('[VIDEO-POLLING] Errore durante il download del video:', downloadError.message);
      if (isDev) {
        console.error('[VIDEO-POLLING] Stack:', downloadError.stack);
      }

      // Fallback: restituisci almeno l'URI del file
      return NextResponse.json({
        status: 'completed',
        done: true,
        video: {
          fileUri: videoFile.uri || videoFile.name || '',
          mimeType: 'video/mp4',
          message: 'Video generato ma download fallito. Usa l\'URI per accedere al file.',
          error: downloadError.message
        }
      });
    }

  } catch (error: any) {
    console.error('[VIDEO-POLLING] Errore:', error);

    return NextResponse.json(
      {
        error: 'Errore durante il controllo dello stato del video',
        details: error.message
      },
      { status: 500 }
    );
  }
}
