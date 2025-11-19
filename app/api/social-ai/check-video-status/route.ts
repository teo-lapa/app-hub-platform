import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

const isDev = process.env.NODE_ENV === 'development';

/**
 * POST /api/social-ai/check-video-status
 *
 * Controlla lo stato della generazione video Veo 3.1 usando REST API diretta
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

    // Usa la stessa API key di generate-marketing per evitare errori 403 Permission Denied
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      console.error('[VIDEO-POLLING] API key non configurata');
      return NextResponse.json(
        { error: 'API key non configurata' },
        { status: 500 }
      );
    }

    // Polling dell'operazione tramite REST API
    let operation;
    try {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/${operationId}`;

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[VIDEO-POLLING] REST API error:', response.status, errorText);
        throw new Error(`REST API returned ${response.status}: ${errorText}`);
      }

      operation = await response.json();

    } catch (opError: any) {
      console.error('[VIDEO-POLLING] Errore REST API polling:', opError.message);

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

    // Video completato - estrai usando la struttura REST API corretta
    // La struttura è: operation.response.generateVideoResponse.generatedSamples[0].video
    const videoFile = operation.response?.generateVideoResponse?.generatedSamples?.[0]?.video;

    if (!videoFile) {
      console.error('[VIDEO-POLLING] Video file not found in response');
      if (isDev) {
        console.error('[VIDEO-POLLING] Full operation:', JSON.stringify(operation, null, 2));
      }
      return NextResponse.json(
        { error: 'Nessun video trovato nella risposta' },
        { status: 500 }
      );
    }

    // Scarica il video
    try {
      const videoUri = videoFile.uri || videoFile.name;

      if (!videoUri) {
        throw new Error('URI del video non trovato nel video object');
      }

      const downloadUrl = videoUri.startsWith('http')
        ? videoUri
        : `https://generativelanguage.googleapis.com/v1beta/${videoUri}`;

      const downloadResponse = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          'x-goog-api-key': apiKey
        }
      });

      if (!downloadResponse.ok) {
        const errorText = await downloadResponse.text();
        console.error('[VIDEO-POLLING] Download error:', downloadResponse.status, errorText);
        throw new Error(`Download failed: ${downloadResponse.status} - ${errorText}`);
      }

      const videoBuffer = await downloadResponse.arrayBuffer();
      const videoBase64 = Buffer.from(videoBuffer).toString('base64');
      const dataUrl = `data:video/mp4;base64,${videoBase64}`;

      if (isDev) {
        console.log('[VIDEO-POLLING] Video downloaded successfully. Size:', videoBuffer.byteLength, 'bytes');
      }

      return NextResponse.json({
        status: 'completed',
        done: true,
        video: {
          data: videoBase64,
          dataUrl: dataUrl,
          mimeType: 'video/mp4',
          size: videoBuffer.byteLength
        }
      });

    } catch (downloadError: any) {
      console.error('[VIDEO-POLLING] Errore durante il download del video:', downloadError.message);

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
