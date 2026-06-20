/**
 * ROMEO VOCE - API Route
 * Voce -> Whisper -> cervello vero di Romeo (voice-bridge su PC ROMEO) -> risposta + voce.
 * Accesso riservato a Laura (e Paul). URL del bridge letto da KV.
 */
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { kv } from '@vercel/kv';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const BRIDGE_TOKEN = process.env.ROMEO_VOICE_TOKEN || '';
const ALLOWED = (process.env.ROMEO_ALLOWED_EMAILS || 'laura@lapa.ch,paul@lapa.ch')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

async function getBridgeUrl(): Promise<string> {
  try {
    const u = (await kv.get('romeo:bridge_url')) as string | null;
    if (u) return u;
  } catch {}
  return process.env.ROMEO_BRIDGE_URL || '';
}

async function transcribe(file: File): Promise<string> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const buffer = Buffer.from(await file.arrayBuffer());
  const { toFile } = await import('openai/uploads');
  const audioFile = await toFile(buffer, 'audio.webm', { type: file.type || 'audio/webm' });
  const r = await openai.audio.transcriptions.create({ file: audioFile, model: 'whisper-1', language: 'it' });
  return (r as any).text || (r as unknown as string) || '';
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const user = token ? verifyToken(token) : null;
  const authed = !!user && ALLOWED.includes((user.email || '').toLowerCase());
  return NextResponse.json({ authed, email: user?.email || null });
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;
    const user = token ? verifyToken(token) : null;
    if (!user || !ALLOWED.includes((user.email || '').toLowerCase())) {
      return NextResponse.json({ error: 'Accesso riservato: questo e Romeo, assistente di Laura.', needLogin: !user }, { status: 403 });
    }

    const BRIDGE_URL = await getBridgeUrl();
    if (!BRIDGE_URL || !BRIDGE_TOKEN) {
      return NextResponse.json({ error: 'Romeo non e ancora online (tunnel non registrato).' }, { status: 503 });
    }

    const form = await request.formData();
    const inputAudio = form.get('audio') as File | null;
    const inputImage = form.get('image') as File | null;
    const typed = (form.get('text') as string | null)?.trim() || '';
    const reset = form.get('reset') === '1';
    const mute = form.get('mute') === '1';

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
      return NextResponse.json({ transcript: userText, error: `Romeo non risponde (${r.status}): ${t.slice(0, 200)}` }, { status: 502 });
    }
    const data = await r.json();
    const reply = data.reply || '';

    // Voce naturale maschile (OpenAI TTS). Saltata se mute (chat scritta = solo testo).
    let audioOut = '';
    if (reply && !mute) {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const attempts: any[] = [
        { model: 'gpt-4o-mini-tts', voice: 'onyx', input: reply, instructions: 'Sei Romeo, assistente amministrativo uomo italiano di Laura. Voce maschile, calma, sicura e cordiale, naturale come un collega di fiducia al telefono. Ritmo scorrevole, mai robotico.' },
        { model: 'tts-1', voice: 'onyx', input: reply },
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
