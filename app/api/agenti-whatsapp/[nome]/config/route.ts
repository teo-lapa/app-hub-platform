import { NextResponse } from 'next/server';
import { getAgent } from '@/lib/agents/whatsapp-agents';
import { proxyGet } from '@/lib/agents/whatsapp-api-proxy';

export async function GET(_req: Request, { params }: { params: { nome: string } }) {
  const { nome } = params;
  const agent = getAgent(nome);
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

  try {
    const config = await proxyGet(nome, 'config');
    return NextResponse.json({
      agent: {
        name: agent.name,
        model: agent.model,
        maxTurns: agent.maxTurns,
        whatsapp: agent.whatsapp,
        owner: agent.owner,
        pc: agent.pc,
      },
      ...config,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
