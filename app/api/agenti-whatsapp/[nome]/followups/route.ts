import { NextResponse } from 'next/server';
import { getAgent } from '@/lib/agents/whatsapp-agents';
import { proxyGet } from '@/lib/agents/whatsapp-api-proxy';

export async function GET(req: Request, { params }: { params: { nome: string } }) {
  const { nome } = params;
  const agent = getAgent(nome);
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  if (agent.apiAvailable === false) return NextResponse.json({ followups: [], apiAvailable: false });

  const url = new URL(req.url);
  const status = url.searchParams.get('status') || '';

  try {
    return NextResponse.json(await proxyGet(nome, 'followups', status ? { status } : {}));
  } catch (err: any) {
    return NextResponse.json({ followups: [], error: err.message });
  }
}
