/**
 * STELLA VOCE - Registrazione URL tunnel
 * STELLA (PC) chiama qui con il token segreto per comunicare il suo indirizzo
 * tunnel corrente. Lo salviamo su KV cosi la pagina sa sempre dove trovarla,
 * anche dopo riavvii / cambio URL del tunnel.
 */
import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export const dynamic = 'force-dynamic';

const SECRET = process.env.STELLA_VOICE_TOKEN || '';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));
  if (!SECRET || body.secret !== SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!body.url || typeof body.url !== 'string') {
    return NextResponse.json({ error: 'no url' }, { status: 400 });
  }
  try {
    await kv.set('stella:bridge_url', body.url);
    await kv.set('stella:bridge_seen', new Date().toISOString());
  } catch (e: any) {
    return NextResponse.json({ error: 'kv: ' + e?.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function GET() {
  try {
    const url = await kv.get('stella:bridge_url');
    const seen = await kv.get('stella:bridge_seen');
    return NextResponse.json({ url: url || null, seen: seen || null });
  } catch {
    return NextResponse.json({ url: null });
  }
}
