import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60 seconds for transcription

// Lazy initialization
function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY.trim(),
  });
}

/**
 * POST /api/inventario-vocale/transcribe
 *
 * Transcribe audio recording using OpenAI Whisper
 *
 * Request: multipart/form-data
 * - audio: File (webm/mp3/wav blob)
 * - location: string (optional)
 *
 * Response:
 * {
 *   success: true,
 *   transcription: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;
    const location = formData.get('location') as string | null;

    if (!audioFile) {
      return NextResponse.json({
        success: false,
        error: 'Nessun file audio fornito'
      }, { status: 400 });
    }

    // Validate file type
    const fileType = audioFile.type || 'audio/webm';
    if (!fileType.startsWith('audio/')) {
      return NextResponse.json({
        success: false,
        error: 'Il file deve essere un audio'
      }, { status: 400 });
    }

    // Check file size (max 25MB for Whisper)
    const maxSize = 25 * 1024 * 1024;
    if (audioFile.size > maxSize) {
      return NextResponse.json({
        success: false,
        error: `File troppo grande (${(audioFile.size / 1024 / 1024).toFixed(2)} MB). Massimo: 25 MB`
      }, { status: 400 });
    }

    console.log('[VOICE-INVENTORY] Transcribing audio:', {
      name: audioFile.name,
      size: audioFile.size,
      type: fileType,
      location
    });

    // Send to OpenAI Whisper
    const openai = getOpenAIClient();

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'it', // Italian
      response_format: 'json',
      prompt: 'Trascrizione di inventario magazzino alimentare. Prodotti food e non-food con quantità. Esempi: cartoni, kg, pezzi, confezioni, scatole.'
    });

    const transcriptionText = transcription.text;

    console.log('[VOICE-INVENTORY] Transcription completed:', transcriptionText);

    if (!transcriptionText || transcriptionText.trim() === '') {
      return NextResponse.json({
        success: false,
        error: 'Trascrizione vuota - nessun audio riconosciuto'
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      transcription: transcriptionText.trim()
    });

  } catch (error) {
    console.error('[VOICE-INVENTORY] Transcription error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Errore durante la trascrizione';

    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}
