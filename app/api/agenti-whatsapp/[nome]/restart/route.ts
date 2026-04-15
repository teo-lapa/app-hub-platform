import { NextResponse } from 'next/server';
import { getAgent } from '@/lib/agents/whatsapp-agents';
import { proxyPost } from '@/lib/agents/whatsapp-api-proxy';

export async function POST(_req: Request, { params }: { params: { nome: string } }) {
  const { nome } = params;
  const agent = getAgent(nome);
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

  if (agent.apiAvailable === false) {
    return NextResponse.json({ error: 'Restart non disponibile: agente senza API esposta. Usa SSH.' }, { status: 501 });
  }
  try {
    return NextResponse.json(await proxyPost(nome, 'restart'));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
