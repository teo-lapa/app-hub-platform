import { NextResponse } from 'next/server';
import { getAgent } from '@/lib/agents/whatsapp-agents';
import { proxyGet } from '@/lib/agents/whatsapp-api-proxy';
import { parseLog, threadByContact } from '@/lib/agents/log-parser';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { nome: string } }) {
  const { nome } = params;
  const agent = getAgent(nome);
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  if (agent.apiAvailable === false) return NextResponse.json({ threads: [], total: 0, apiAvailable: false });
  const lines = new URL(req.url).searchParams.get('lines') || '500';
  try {
    const data = await proxyGet(nome, 'log', { lines });
    const { messages } = parseLog(data.log || '');
    const threads = threadByContact(messages);
    return NextResponse.json({ threads, total: messages.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, threads: [] }, { status: 500 });
  }
}
