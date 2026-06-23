/**
 * ROMEO LIVE - Dispatch al cervello vero (bridge claude -p su PC ROMEO).
 * Chiamata dal tool `chiedi_a_romeo` del modello Realtime. Riusa lo STESSO bridge /ask
 * di /romeo-voce (nessuna modifica su ROMEO). Niente STT/TTS: la voce la fa il Realtime.
 */
import { NextRequest, NextResponse } from 'next/server';
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

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;
    const user = token ? verifyToken(token) : null;
    if (!user || !ALLOWED.includes((user.email || '').toLowerCase())) {
      return NextResponse.json({ error: 'Accesso riservato.', needLogin: !user }, { status: 403 });
    }

    const BRIDGE_URL = await getBridgeUrl();
    if (!BRIDGE_URL || !BRIDGE_TOKEN) {
      return NextResponse.json({ error: 'Romeo non e online (bridge non registrato).' }, { status: 503 });
    }

    const body = await request.json().catch(() => ({} as any));
    const text = (body.text as string | undefined)?.trim() || '';
    const reset = body.reset === true || body.reset === '1';
    if (!text && !reset) return NextResponse.json({ error: 'Niente da chiedere.' }, { status: 400 });

    const r = await fetch(`${BRIDGE_URL.replace(/\/$/, '')}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Token': BRIDGE_TOKEN },
      body: JSON.stringify({ text, reset }),
    });

    if (!r.ok) {
      const t = await r.text();
      return NextResponse.json({ error: `Romeo non risponde (${r.status}): ${t.slice(0, 160)}` }, { status: 502 });
    }
    const data = await r.json();
    return NextResponse.json({ reply: data.reply || '', images: data.images || [], error: data.error || null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Errore interno' }, { status: 500 });
  }
}
