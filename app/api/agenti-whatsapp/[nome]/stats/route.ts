import { NextResponse } from 'next/server';
import { getAgent } from '@/lib/agents/whatsapp-agents';
import { proxyGet } from '@/lib/agents/whatsapp-api-proxy';
import { parseLog, stats, healthScore } from '@/lib/agents/log-parser';

export const dynamic = 'force-dynamic';

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
    const [logData, statusData] = await Promise.all([
      proxyGet(nome, 'log', { lines: '1000' }).catch(() => ({ log: '' })),
      proxyGet(nome, 'status').catch(() => ({ online: false })),
    ]);
    const { messages, errors } = parseLog(logData.log || '');
    const s = stats(messages, errors);
    const health = healthScore({
      online: !!statusData.online,
      errors24h: s.errors24h,
      lastMsgMinutesAgo: s.lastMsgMinutesAgo,
    });
    return NextResponse.json({ ...s, health, online: !!statusData.online });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
