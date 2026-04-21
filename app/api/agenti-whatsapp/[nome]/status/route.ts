import { NextResponse } from 'next/server';
import { getAgent } from '@/lib/agents/whatsapp-agents';
import { proxyGet } from '@/lib/agents/whatsapp-api-proxy';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { nome: string } }) {
  const { nome } = params;
  const agent = getAgent(nome);
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

  if (agent.apiAvailable === false) {
    return NextResponse.json({
      online: null, sshReachable: null, processRunning: null, lastLog: null, pid: null,
      name: agent.name, emoji: agent.emoji, apiAvailable: false,
      note: 'Telegram-only — API non esposta',
    });
  }

  try {
    const status = await proxyGet(nome, 'status');
    return NextResponse.json({ ...status, name: agent.name, emoji: agent.emoji, apiAvailable: true });
  } catch (err: any) {
    return NextResponse.json({
      online: false, sshReachable: false, processRunning: false, lastLog: null, pid: null,
      name: agent.name, emoji: agent.emoji, apiAvailable: true, error: err.message,
    });
  }
}
