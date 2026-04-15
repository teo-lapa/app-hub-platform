/**
 * Cron: ogni 5 min controlla stato agenti.
 * Se un agente passa offline → Telegram a Paul (bot Claude Paul).
 * Se un agente ha accumulato errori nelle ultime 24h oltre soglia → alert.
 * Stato precedente salvato in tabella agent_alert_state.
 */

import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { WHATSAPP_AGENTS } from '@/lib/agents/whatsapp-agents';
import { proxyGet } from '@/lib/agents/whatsapp-api-proxy';
import { parseLog } from '@/lib/agents/log-parser';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PAUL_CHAT_ID = process.env.TELEGRAM_PAUL_CHAT_ID || '8530759441';
const BOT_TOKEN = process.env.TELEGRAM_ALERT_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '';
const ERROR_THRESHOLD = 5;

async function sendTelegram(text: string) {
  if (!BOT_TOKEN) { console.warn('No TELEGRAM_ALERT_BOT_TOKEN'); return; }
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: PAUL_CHAT_ID, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  }).catch(e => console.error('tg send', e));
}

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS agent_alert_state (
      slug TEXT PRIMARY KEY,
      online BOOLEAN,
      errors24h INT,
      last_alert_ts TIMESTAMPTZ,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  await ensureTable();

  const prev = await sql<{ slug: string; online: boolean; errors24h: number }>`
    SELECT slug, online, errors24h FROM agent_alert_state
  `;
  const prevMap = new Map(prev.rows.map(r => [r.slug, r]));

  const notifications: string[] = [];
  const now = Date.now();

  for (const [slug, agent] of Object.entries(WHATSAPP_AGENTS)) {
    try {
      const [statusD, logD] = await Promise.all([
        proxyGet(slug, 'status').catch(() => ({ online: false })),
        proxyGet(slug, 'log', { lines: '1000' }).catch(() => ({ log: '' })),
      ]);
      const online = !!statusD.online;
      const { errors } = parseLog(logD.log || '');
      const errors24h = errors.filter(e => now - new Date(e.ts).getTime() < 86400000).length;
      const prevState = prevMap.get(slug);

      // offline transition
      if (prevState && prevState.online && !online) {
        notifications.push(`${agent.emoji} <b>${agent.name} OFFLINE</b>\nPC ${agent.pc.ip} — restart necessario`);
      }
      if (prevState && !prevState.online && online) {
        notifications.push(`${agent.emoji} <b>${agent.name} tornato online ✓</b>`);
      }

      // errori in aumento oltre soglia
      if (errors24h >= ERROR_THRESHOLD && (!prevState || errors24h >= (prevState.errors24h || 0) + 3)) {
        const last = errors[errors.length - 1]?.message?.slice(0, 200) || '';
        notifications.push(`${agent.emoji} <b>${agent.name} — ${errors24h} errori 24h</b>\n<code>${last}</code>`);
      }

      await sql`
        INSERT INTO agent_alert_state (slug, online, errors24h, updated_at)
        VALUES (${slug}, ${online}, ${errors24h}, NOW())
        ON CONFLICT (slug) DO UPDATE SET
          online = EXCLUDED.online,
          errors24h = EXCLUDED.errors24h,
          updated_at = NOW()
      `;
    } catch (e: any) {
      console.error('healthcheck', slug, e.message);
    }
  }

  if (notifications.length) {
    const body = `🚨 <b>Agenti LAPA — alert</b>\n\n${notifications.join('\n\n')}\n\nhttps://hub.lapa.ch/agenti-whatsapp`;
    await sendTelegram(body);
  }

  return NextResponse.json({ ok: true, notifications: notifications.length, checked: Object.keys(WHATSAPP_AGENTS).length });
}
