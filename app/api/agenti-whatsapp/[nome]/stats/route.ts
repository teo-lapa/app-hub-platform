import { NextResponse } from 'next/server';
import { getAgent } from '@/lib/agents/whatsapp-agents';
import { proxyGet } from '@/lib/agents/whatsapp-api-proxy';
import { sshTailFile } from '@/lib/agents/ssh-exec';
import { parseLog, stats, healthScore } from '@/lib/agents/log-parser';

export const dynamic = 'force-dynamic';

const LOG_CACHE = new Map<string, { ts: number; log: string }>();
const CACHE_TTL_MS = 30_000;
const TAIL_LINES = 2000;

async function fetchLog(nome: string, logPath: string): Promise<string> {
  const cached = LOG_CACHE.get(nome);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.log;

  // Preferenza: SSH diretto al file reale. Fallback: tunnel CloudFlare.
  const disableSsh = process.env.DISABLE_SSH_LOGS === '1';
  if (!disableSsh) {
    try {
      const log = await sshTailFile(nome, logPath, TAIL_LINES);
      LOG_CACHE.set(nome, { ts: Date.now(), log });
      return log;
    } catch {
      // SSH non disponibile (es. Vercel runtime) → fallback tunnel
    }
  }

  try {
    const data = await proxyGet(nome, 'log', { lines: String(TAIL_LINES) });
    const log = (data.log as string) || '';
    LOG_CACHE.set(nome, { ts: Date.now(), log });
    return log;
  } catch {
    return '';
  }
}

export async function GET(_req: Request, { params }: { params: { nome: string } }) {
  const { nome } = params;
  const agent = getAgent(nome);
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  if (agent.apiAvailable === false) {
    return NextResponse.json({
      total24h: 0, in24h: 0, out24h: 0, last1h: 0, errors24h: 0,
      lastMsgTs: null, lastMsgMinutesAgo: null, buckets: [], health: 0, online: null, apiAvailable: false,
    });
  }
  try {
    const [logText, statusData] = await Promise.all([
      fetchLog(nome, agent.paths.log),
      proxyGet(nome, 'status').catch(() => ({ online: false })),
    ]);
    const { messages, errors } = parseLog(logText);
    const s = stats(messages, errors);
    const health = healthScore({
      online: !!statusData.online,
      errors24h: s.errors24h,
      lastMsgMinutesAgo: s.lastMsgMinutesAgo,
    });
    return NextResponse.json({ ...s, health, online: !!statusData.online });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
