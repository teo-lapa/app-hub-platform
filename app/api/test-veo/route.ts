import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * TEST ENDPOINT - Verifica funzionamento Veo API
 */
export async function GET(request: NextRequest) {
  try {
    // Usa VEO_API_KEY dedicata se disponibile
    const apiKey = process.env.VEO_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        error: 'API key non configurata',
        env: {
          VEO_API_KEY: !!process.env.VEO_API_KEY,
          GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
          GOOGLE_GEMINI_API_KEY: !!process.env.GOOGLE_GEMINI_API_KEY
        }
      }, { status: 500 });
    }

    console.log('🧪 [TEST-VEO] Inizializzazione client...');
    if (process.env.VEO_API_KEY) {
      console.log('✅ [TEST-VEO] Usando VEO_API_KEY dedicata');
    } else {
      console.log('⚠️ [TEST-VEO] Usando GEMINI_API_KEY fallback');
    }

    const ai = new GoogleGenerativeAI({ apiKey });

    console.log('🧪 [TEST-VEO] Test 1: Verifica client creato');
    console.log('🧪 [TEST-VEO] Client type:', typeof ai);
    console.log('🧪 [TEST-VEO] Client.models:', typeof ai.models);

    const prompt = 'A simple test video showing a rotating product on a white background';

    console.log('🧪 [TEST-VEO] Test 2: Tentativo generateVideos...');
    console.log('🧪 [TEST-VEO] Prompt:', prompt);

    let operation;
    try {
      console.log('🧪 [TEST-VEO] Chiamata generateVideos...');

      operation = await ai.models.generateVideos({
        model: 'veo-3.1-generate-preview',
        prompt: prompt,
        config: {
          aspectRatio: '16:9',
          durationSeconds: 4,
          resolution: '720p'
        }
      });

      console.log('✅ [TEST-VEO] generateVideos completato!');
      console.log('🧪 [TEST-VEO] Operation name:', operation?.name);
      console.log('🧪 [TEST-VEO] Operation done:', operation?.done);
      console.log('🧪 [TEST-VEO] Operation keys:', Object.keys(operation || {}));

      if (!operation || !operation.name) {
        return NextResponse.json({
          error: 'Operation returned but has no name',
          operation: operation
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Veo API funziona!',
        operation: {
          name: operation.name,
          done: operation.done,
          hasResponse: !!operation.response,
          metadata: operation.metadata
        }
      });

    } catch (veoError: any) {
      console.error('❌ [TEST-VEO] Errore generateVideos:', veoError);
      console.error('❌ [TEST-VEO] Error message:', veoError.message);
      console.error('❌ [TEST-VEO] Error stack:', veoError.stack);
      console.error('❌ [TEST-VEO] Error code:', veoError.code);
      console.error('❌ [TEST-VEO] Error status:', veoError.status);

      return NextResponse.json({
        error: 'Errore durante la chiamata Veo API',
        details: {
          message: veoError.message,
          code: veoError.code,
          status: veoError.status,
          type: typeof veoError,
          keys: Object.keys(veoError)
        }
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('❌ [TEST-VEO] Errore generale:', error);

    return NextResponse.json({
      error: 'Errore generale nel test',
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
