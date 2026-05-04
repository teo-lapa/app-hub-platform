import { NextResponse } from 'next/server';
import {
  PERSONALITY_PRESETS,
  getPersonalityForSlug,
  setPersonalityForSlug,
  type PersonalityId,
} from '@/lib/wine/sommelier-personality';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug');
  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
  const current = await getPersonalityForSlug(slug);
  const presets = Object.values(PERSONALITY_PRESETS).map((p) => ({
    id: p.id,
    label: p.label,
    shortDesc: p.shortDesc,
    exampleReply: p.exampleReply,
  }));
  return NextResponse.json({ current, presets });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { slug?: string; personality?: PersonalityId } | null;
  if (!body?.slug || !body?.personality) {
    return NextResponse.json({ error: 'Missing slug or personality' }, { status: 400 });
  }
  if (!(body.personality in PERSONALITY_PRESETS)) {
    return NextResponse.json({ error: 'Invalid personality id' }, { status: 400 });
  }
  await setPersonalityForSlug(body.slug, body.personality);
  return NextResponse.json({ ok: true, current: body.personality });
}
