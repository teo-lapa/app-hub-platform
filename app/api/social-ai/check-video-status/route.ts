import { NextRequest, NextResponse } from 'next/server';

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

    // Usa VEO_API_KEY dedicata se disponibile, altrimenti fallback a GEMINI_API_KEY
    const apiKey = process.env.VEO_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      console.error('❌ [VIDEO-POLLING] API key non configurata');
      return NextResponse.json(
        { error: 'API key non configurata' },
        { status: 500 }
      );
    }

    if (process.env.VEO_API_KEY) {
      console.log('✅ [VIDEO-POLLING] Usando VEO_API_KEY dedicata');
    } else {
      console.log('⚠️ [VIDEO-POLLING] Usando GEMINI_API_KEY');
    }

    console.log('🔍 [VIDEO-POLLING] Controllo operazione:', operationId);

    // Polling dell'operazione tramite REST API
    // https://generativelanguage.googleapis.com/v1beta/{name}

    let operation;
    try {
      console.log('🔍 [VIDEO-POLLING] Polling operation via REST API:', operationId);

      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/${operationId}`;

      console.log('🔍 [VIDEO-POLLING] Calling:', apiUrl);

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [VIDEO-POLLING] REST API error:', response.status, errorText);
        throw new Error(`REST API returned ${response.status}: ${errorText}`);
      }

      operation = await response.json();

      console.log('✅ [VIDEO-POLLING] Operation retrieved via REST!');
      console.log('🔍 [VIDEO-POLLING] Operation done:', operation.done);
      console.log('🔍 [VIDEO-POLLING] Operation keys:', Object.keys(operation));
    } catch (opError: any) {
      console.error('❌ [VIDEO-POLLING] Errore REST API polling:', opError.message);
      console.error('❌ [VIDEO-POLLING] Error details:', opError.stack);

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
    console.log('🔍 [VIDEO-POLLING] Operation response keys:', Object.keys(operation.response || {}));
    console.log('🔍 [VIDEO-POLLING] Operation response:', JSON.stringify(operation.response, null, 2));

    const videoFile = operation.response?.generatedVideos?.[0]?.video;

    if (!videoFile) {
      console.error('❌ [VIDEO-POLLING] Video file not found in response');
      console.error('📋 [VIDEO-POLLING] Full operation:', JSON.stringify(operation, null, 2));
      return NextResponse.json(
        { error: 'Nessun video trovato nella risposta' },
        { status: 500 }
      );
    }

    console.log('📹 [VIDEO-POLLING] Video file object:', JSON.stringify(videoFile, null, 2));

    // Scarica il video usando Google AI Files API
    // https://generativelanguage.googleapis.com/v1beta/files/{fileId}
    try {
      // Estrai il fileId dall'URI (formato: "files/{fileId}")
      const fileId = videoFile.name || videoFile.uri;

      if (!fileId) {
        throw new Error('File ID non trovato nel video object');
      }

      console.log('📥 [VIDEO-POLLING] Scaricamento video da fileId:', fileId);

      // Download del file video
      const downloadUrl = `https://generativelanguage.googleapis.com/v1beta/${fileId}`;

      console.log('📥 [VIDEO-POLLING] Download URL:', downloadUrl);

      const downloadResponse = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          'x-goog-api-key': apiKey
        }
      });

      if (!downloadResponse.ok) {
        const errorText = await downloadResponse.text();
        console.error('❌ [VIDEO-POLLING] Download error:', downloadResponse.status, errorText);
        throw new Error(`Download failed: ${downloadResponse.status} - ${errorText}`);
      }

      // Ottieni i dati del video come buffer
      const videoBuffer = await downloadResponse.arrayBuffer();
      const videoBase64 = Buffer.from(videoBuffer).toString('base64');

      console.log('✅ [VIDEO-POLLING] Video scaricato con successo! Size:', videoBuffer.byteLength, 'bytes');

      return NextResponse.json({
        status: 'completed',
        done: true,
        video: {
          data: videoBase64,
          mimeType: 'video/mp4',
          size: videoBuffer.byteLength
        }
      });

    } catch (downloadError: any) {
      console.error('❌ [VIDEO-POLLING] Errore durante il download del video:', downloadError.message);

      // Fallback: restituisci almeno l'URI del file
      return NextResponse.json({
        status: 'completed',
        done: true,
        video: {
          fileUri: videoFile.name || videoFile.uri || '',
          mimeType: 'video/mp4',
          message: 'Video generato ma download fallito. Usa l\'URI per accedere al file.',
          error: downloadError.message
        }
      });
    }

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
