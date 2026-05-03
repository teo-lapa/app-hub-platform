/**
 * POST /api/agents/ingest
 * Endpoint che i bot chiamano per push dati puliti (conversazioni, errori, heartbeat).
 * Header:  x-api-key: process.env.AGENTS_INGEST_KEY
 * Body:
 *   { type: 'conversation', slug, direction, contact?, platform?, text, media?, ts? }
 *   { type: 'error', slug, level, message, stack?, ts? }
 *   { type: 'heartbeat', slug, cpu?, ram?, uptime?, queue? }
 */

import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { WHATSAPP_AGENTS } from '@/lib/agents/whatsapp-agents';

export const dynamic = 'force-dynamic';

const KEY = process.env.AGENTS_INGEST_KEY || 'lapa-ingest-2026';

async function ensureTables() {
  await sql`CREATE TABLE IF NOT EXISTS agent_conversations (
    id BIGSERIAL PRIMARY KEY, slug TEXT NOT NULL, ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    direction TEXT NOT NULL, contact TEXT, platform TEXT, message_text TEXT, media_url TEXT, meta JSONB DEFAULT '{}'::jsonb
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_agconv_slug_ts ON agent_conversations (slug, ts DESC)`;
  await sql`CREATE TABLE IF NOT EXISTS agent_errors (
    id BIGSERIAL PRIMARY KEY, slug TEXT NOT NULL, ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    level TEXT NOT NULL, message TEXT NOT NULL, stack TEXT, context JSONB DEFAULT '{}'::jsonb, resolved BOOLEAN DEFAULT FALSE
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_agerr_slug_ts ON agent_errors (slug, ts DESC)`;
  await sql`CREATE TABLE IF NOT EXISTS agent_heartbeats (
    id BIGSERIAL PRIMARY KEY, slug TEXT NOT NULL, ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cpu_pct NUMERIC, ram_mb NUMERIC, uptime_s BIGINT, queue_size INT, meta JSONB DEFAULT '{}'::jsonb
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_aghb_slug_ts ON agent_heartbeats (slug, ts DESC)`;
}

export async function POST(req: Request) {
  if (req.headers.get('x-api-key') !== KEY) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let payload: any;
  try { payload = await req.json(); } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }
  const { type, slug } = payload || {};
  if (!slug || !WHATSAPP_AGENTS[slug]) return NextResponse.json({ error: 'bad slug' }, { status: 400 });

  await ensureTables();

  try {
    if (type === 'conversation') {
      const { direction, contact, platform, text, media, ts, meta } = payload;
      if (!['in', 'out'].includes(direction)) return NextResponse.json({ error: 'bad direction' }, { status: 400 });
      await sql`
        INSERT INTO agent_conversations (slug, ts, direction, contact, platform, message_text, media_url, meta)
        VALUES (${slug}, ${ts || new Date().toISOString()}, ${direction}, ${contact || null}, ${platform || null}, ${text || null}, ${media || null}, ${JSON.stringify(meta || {})})
      `;
    } else if (type === 'error') {
      const { level, message, stack, ts, context } = payload;
      if (!['warn', 'error', 'fatal'].includes(level)) return NextResponse.json({ error: 'bad level' }, { status: 400 });
      await sql`
        INSERT INTO agent_errors (slug, ts, level, message, stack, context)
        VALUES (${slug}, ${ts || new Date().toISOString()}, ${level}, ${message || ''}, ${stack || null}, ${JSON.stringify(context || {})})
      `;
    } else if (type === 'heartbeat') {
      const { cpu, ram, uptime, queue, meta } = payload;
      await sql`
        INSERT INTO agent_heartbeats (slug, cpu_pct, ram_mb, uptime_s, queue_size, meta)
        VALUES (${slug}, ${cpu ?? null}, ${ram ?? null}, ${uptime ?? null}, ${queue ?? null}, ${JSON.stringify(meta || {})})
      `;
    } else {
      return NextResponse.json({ error: 'bad type' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
