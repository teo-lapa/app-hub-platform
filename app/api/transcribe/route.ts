import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'Nessun file audio fornito' },
        { status: 400 }
      );
    }

    // Verifica che sia un file audio
    if (!audioFile.type.startsWith('audio/')) {
      return NextResponse.json(
        { error: 'Il file deve essere un audio' },
        { status: 400 }
      );
    }

    console.log('[TRANSCRIBE] Processing audio file:', {
      name: audioFile.name,
      size: audioFile.size,
      type: audioFile.type,
    });

    // Trascrivi con Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'it', // Italiano
      response_format: 'json',
    });

    console.log('[TRANSCRIBE] Transcription completed:', transcription.text);

    return NextResponse.json({
      success: true,
      text: transcription.text,
    });
  } catch (error) {
    console.error('[TRANSCRIBE] Error:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Errore durante la trascrizione';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
