/**
 * STELLA LIVE - Token effimero per OpenAI Realtime (WebRTC)
 * Conia un client secret usa-e-getta (ek_...) lato server: la API key vera
 * non lascia mai Vercel. Accesso riservato ai proprietari (paul/laura).
 * API GA verificata sull'account: POST /v1/realtime/client_secrets, model gpt-realtime.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = (process.env.STELLA_ALLOWED_EMAILS || 'paul@lapa.ch,laura@lapa.ch')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const MODEL = process.env.STELLA_LIVE_MODEL || 'gpt-realtime-mini';
const VOICE = process.env.STELLA_LIVE_VOICE || 'marin';

function auth(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const user = token ? verifyToken(token) : null;
  return { user, ok: !!user && ALLOWED.includes((user.email || '').toLowerCase()) };
}

export async function GET(request: NextRequest) {
  const { user, ok } = auth(request);
  return NextResponse.json({ authed: ok, email: user?.email || null });
}

export async function POST(request: NextRequest) {
  const { ok } = auth(request);
  if (!ok) return NextResponse.json({ error: 'Accesso riservato: questa e la Stella privata di Paul.', needLogin: true }, { status: 403 });

  // la key su Vercel ha un newline in coda -> trim obbligatorio
  const apiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY non configurata.' }, { status: 500 });

  try {
    const r = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session: { type: 'realtime', model: MODEL, audio: { output: { voice: VOICE } } },
        expires_after: { anchor: 'created_at', seconds: 600 },
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      return NextResponse.json({ error: data?.error?.message || `OpenAI ${r.status}` }, { status: 502 });
    }
    return NextResponse.json({ value: data.value, expires_at: data.expires_at, model: MODEL });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Errore interno' }, { status: 500 });
  }
}
