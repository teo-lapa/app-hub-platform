import { NextResponse } from 'next/server';
import { getAgent } from '@/lib/agents/whatsapp-agents';
import { sshReadFile } from '@/lib/agents/ssh-exec';

export async function GET(_req: Request, { params }: { params: { nome: string } }) {
  const { nome } = params;
  const agent = getAgent(nome);
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

  const results: Record<string, string | null> = { claude: null, soul: null };

  for (const key of ['claude', 'soul'] as const) {
    try {
      results[key] = await sshReadFile(nome, agent.paths[key]);
    } catch { /* file not found */ }
  }

  return NextResponse.json({
    agent: {
      name: agent.name,
      model: agent.model,
      maxTurns: agent.maxTurns,
      whatsapp: agent.whatsapp,
      owner: agent.owner,
      pc: agent.pc,
    },
    claude: results.claude,
    soul: results.soul,
  });
}
