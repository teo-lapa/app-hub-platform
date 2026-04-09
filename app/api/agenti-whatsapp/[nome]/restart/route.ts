import { NextResponse } from 'next/server';
import { getAgent } from '@/lib/agents/whatsapp-agents';
import { sshExec } from '@/lib/agents/ssh-exec';

export async function POST(_req: Request, { params }: { params: { nome: string } }) {
  const { nome } = params;
  const agent = getAgent(nome);
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

  try {
    // Kill the node bot process — the loop script will restart it automatically
    if (agent.useWSL) {
      await sshExec(nome, "pkill -f 'node.*bot'", 8000);
    } else {
      await sshExec(nome, 'taskkill /F /IM node.exe', 8000);
    }
    return NextResponse.json({ success: true, message: `${agent.name} restart triggered` });
  } catch (err: any) {
    // pkill returns error if no process found — that's ok
    if (err.message.includes('no process') || err.message.includes('not found')) {
      return NextResponse.json({ success: true, message: `${agent.name} was not running, loop will start it` });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
