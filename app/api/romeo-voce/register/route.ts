/**
 * ROMEO VOCE - Registrazione URL tunnel
 * ROMEO (PC) chiama qui col token segreto per comunicare il suo URL tunnel corrente.
 */
import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export const dynamic = 'force-dynamic';

const SECRET = process.env.ROMEO_VOICE_TOKEN || '';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));
  if (!SECRET || body.secret !== SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!body.url || typeof body.url !== 'string') {
    return NextResponse.json({ error: 'no url' }, { status: 400 });
  }
  try {
    await kv.set('romeo:bridge_url', body.url);
    await kv.set('romeo:bridge_seen', new Date().toISOString());
  } catch (e: any) {
    return NextResponse.json({ error: 'kv: ' + e?.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function GET() {
  try {
    const url = await kv.get('romeo:bridge_url');
    const seen = await kv.get('romeo:bridge_seen');
    return NextResponse.json({ url: url || null, seen: seen || null });
  } catch {
    return NextResponse.json({ url: null });
  }
}
