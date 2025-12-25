import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Valid OpenAI TTS voices
const VALID_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'] as const;
type Voice = typeof VALID_VOICES[number];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { script, voice = 'alloy' } = body;

    if (!script || typeof script !== 'string' || script.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Script mancante o non valido' },
        { status: 400 }
      );
    }

    // Validate voice
    if (!VALID_VOICES.includes(voice as Voice)) {
      return NextResponse.json(
        {
          success: false,
          error: `Voce non valida. Voci disponibili: ${VALID_VOICES.join(', ')}`
        },
        { status: 400 }
      );
    }

    // Validate script length (OpenAI TTS has a 4096 character limit)
    if (script.length > 4096) {
      return NextResponse.json(
        { success: false, error: 'Script troppo lungo. Massimo 4096 caratteri' },
        { status: 400 }
      );
    }

    console.log(`🎤 Generating speech with OpenAI TTS (voice: ${voice}, length: ${script.length} chars)`);

    // Generate speech using OpenAI TTS
    const mp3Response = await openai.audio.speech.create({
      model: 'tts-1-hd',
      voice: voice as Voice,
      input: script,
      response_format: 'mp3',
      speed: 1.0,
    });

    // Convert response to buffer
    const buffer = Buffer.from(await mp3Response.arrayBuffer());

    // Convert to base64
    const base64Audio = buffer.toString('base64');

    console.log(`✅ Speech generated successfully (size: ${buffer.length} bytes)`);

    return NextResponse.json({
      success: true,
      audio: `data:audio/mpeg;base64,${base64Audio}`,
      audioBase64: base64Audio,
      size: buffer.length,
      voice: voice,
      scriptLength: script.length
    });

  } catch (error: any) {
    console.error('❌ Error generating speech:', error);

    // Handle specific OpenAI errors
    if (error?.status === 401) {
      return NextResponse.json(
        { success: false, error: 'API Key OpenAI non valida' },
        { status: 500 }
      );
    }

    if (error?.status === 429) {
      return NextResponse.json(
        { success: false, error: 'Limite di rate OpenAI raggiunto. Riprova tra poco' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore durante la generazione del parlato'
      },
      { status: 500 }
    );
  }
}
