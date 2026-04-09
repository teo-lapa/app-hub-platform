import { NextResponse } from 'next/server';
import { getAgent } from '@/lib/agents/whatsapp-agents';
import { sshTailFile } from '@/lib/agents/ssh-exec';

export async function GET(req: Request, { params }: { params: { nome: string } }) {
  const { nome } = params;
  const agent = getAgent(nome);
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

  const url = new URL(req.url);
  const lines = parseInt(url.searchParams.get('lines') || '50', 10);

  try {
    const log = await sshTailFile(nome, agent.paths.log, Math.min(lines, 200));
    return NextResponse.json({ log });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
