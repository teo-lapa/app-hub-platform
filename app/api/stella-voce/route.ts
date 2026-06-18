/**
 * STELLA VOCE - API Route
 * Riceve l'audio dal browser, lo trascrive con Whisper, lo manda al cervello
 * vero di Stella (voice-bridge sul PC STELLA) e ritorna la risposta + voce.
 * Accesso riservato ai proprietari (Paul). URL del bridge letto da KV.
 */
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { kv } from '@vercel/kv';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const BRIDGE_TOKEN = process.env.STELLA_VOICE_TOKEN || '';
const ALLOWED = (process.env.STELLA_ALLOWED_EMAILS || 'paul@lapa.ch,laura@lapa.ch')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

async function getBridgeUrl(): Promise<string> {
  try {
    const u = (await kv.get('stella:bridge_url')) as string | null;
    if (u) return u;
  } catch {}
  return process.env.STELLA_BRIDGE_URL || '';
}

async function transcribe(file: File): Promise<string> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const buffer = Buffer.from(await file.arrayBuffer());
  const { toFile } = await import('openai/uploads');
  const audioFile = await toFile(buffer, 'audio.webm', { type: file.type || 'audio/webm' });
  const r = await openai.audio.transcriptions.create({ file: audioFile, model: 'whisper-1', language: 'it' });
  return (r as any).text || (r as unknown as string) || '';
}

export async function POST(request: NextRequest) {
  try {
    // --- Accesso riservato ---
    const token = request.cookies.get('token')?.value;
    const user = token ? verifyToken(token) : null;
    if (!user || !ALLOWED.includes((user.email || '').toLowerCase())) {
      return NextResponse.json({ error: 'Accesso riservato: questa e la Stella privata di Paul.' }, { status: 403 });
    }

    const BRIDGE_URL = await getBridgeUrl();
    if (!BRIDGE_URL || !BRIDGE_TOKEN) {
      return NextResponse.json({ error: 'Stella non e ancora online (tunnel non registrato).' }, { status: 503 });
    }

    const form = await request.formData();
    const inputAudio = form.get('audio') as File | null;
    const inputImage = form.get('image') as File | null;
    const typed = (form.get('text') as string | null)?.trim() || '';
    const reset = form.get('reset') === '1';

    let userText = typed;
    if (!userText && inputAudio) userText = (await transcribe(inputAudio)).trim();

    let imageDataUrl = '';
    if (inputImage) {
      const ibuf = Buffer.from(await inputImage.arrayBuffer());
      imageDataUrl = `data:${inputImage.type || 'image/jpeg'};base64,${ibuf.toString('base64')}`;
    }

    if (!userText && !imageDataUrl && !reset) return NextResponse.json({ error: 'Niente da dire.' }, { status: 400 });

    const r = await fetch(`${BRIDGE_URL.replace(/\/$/, '')}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Token': BRIDGE_TOKEN },
      body: JSON.stringify({ text: userText, reset, image: imageDataUrl || undefined }),
    });

    if (!r.ok) {
      const t = await r.text();
      return NextResponse.json({ transcript: userText, error: `Stella non risponde (${r.status}): ${t.slice(0, 200)}` }, { status: 502 });
    }
    const data = await r.json();
    const reply = data.reply || '';

    // Voce naturale femminile (OpenAI TTS). Doppio fallback: gpt-4o-mini-tts -> tts-1 -> browser.
    let audioOut = '';
    if (reply) {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const attempts: any[] = [
        { model: 'gpt-4o-mini-tts', voice: 'shimmer', input: reply, instructions: 'Sei Stella, assistente personale donna italiana. Voce femminile, calda, sicura e naturale, come una collega di fiducia al telefono. Ritmo scorrevole e gentile, mai robotico.' },
        { model: 'tts-1', voice: 'shimmer', input: reply },
      ];
      for (const a of attempts) {
        try {
          const speech = await openai.audio.speech.create(a);
          const buf = Buffer.from(await speech.arrayBuffer());
          if (buf.length > 0) { audioOut = `data:audio/mp3;base64,${buf.toString('base64')}`; break; }
        } catch {}
      }
    }

    return NextResponse.json({ transcript: userText, reply, audio: audioOut, images: data.images || [], error: data.error || null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Errore interno' }, { status: 500 });
  }
}
