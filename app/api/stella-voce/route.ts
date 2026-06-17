/**
 * STELLA VOCE - API Route
 * Riceve l'audio dal browser, lo trascrive con Whisper, lo manda al cervello
 * vero di Stella (voice-bridge sul PC STELLA) e ritorna la risposta testuale.
 * Il browser poi la legge a voce.
 */
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const BRIDGE_URL = process.env.STELLA_BRIDGE_URL || '';
const BRIDGE_TOKEN = process.env.STELLA_VOICE_TOKEN || '';

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
    if (!BRIDGE_URL || !BRIDGE_TOKEN) {
      return NextResponse.json({ error: 'Stella non e ancora collegata (manca STELLA_BRIDGE_URL).' }, { status: 503 });
    }

    const form = await request.formData();
    const audio = form.get('audio') as File | null;
    const typed = (form.get('text') as string | null)?.trim() || '';
    const reset = form.get('reset') === '1';

    let userText = typed;
    if (!userText && audio) userText = (await transcribe(audio)).trim();
    if (!userText && !reset) return NextResponse.json({ error: 'Niente da dire.' }, { status: 400 });

    const r = await fetch(`${BRIDGE_URL.replace(/\/$/, '')}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Token': BRIDGE_TOKEN },
      body: JSON.stringify({ text: userText, reset }),
    });

    if (!r.ok) {
      const t = await r.text();
      return NextResponse.json({ transcript: userText, error: `Stella non risponde (${r.status}): ${t.slice(0, 200)}` }, { status: 502 });
    }
    const data = await r.json();
    return NextResponse.json({ transcript: userText, reply: data.reply || '', error: data.error || null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Errore interno' }, { status: 500 });
  }
}
