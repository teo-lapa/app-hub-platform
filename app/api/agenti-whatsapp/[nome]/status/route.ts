import { NextResponse } from 'next/server';
import { getAgent } from '@/lib/agents/whatsapp-agents';
import { sshExec } from '@/lib/agents/ssh-exec';

export async function GET(_req: Request, { params }: { params: { nome: string } }) {
  const { nome } = params;
  const agent = getAgent(nome);
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

  try {
    // Ping SSH
    let sshReachable = false;
    try {
      await sshExec(nome, 'echo ok', 5000);
      sshReachable = true;
    } catch { /* unreachable */ }

    if (!sshReachable) {
      return NextResponse.json({
        name: agent.name,
        emoji: agent.emoji,
        online: false,
        sshReachable: false,
        processRunning: false,
        lastLog: null,
        pid: null,
      });
    }

    // Check node process
    let processRunning = false;
    let pid: string | null = null;
    try {
      const psOut = agent.useWSL
        ? await sshExec(nome, "ps aux | grep 'node.*bot' | grep -v grep")
        : await sshExec(nome, 'tasklist /FI "IMAGENAME eq node.exe" /FO CSV');
      processRunning = psOut.length > 0;
      if (agent.useWSL) {
        const match = psOut.match(/\S+\s+(\d+)/);
        pid = match ? match[1] : null;
      }
    } catch { /* no process */ }

    // Last log line
    let lastLog: string | null = null;
    try {
      const logCmd = agent.useWSL
        ? `tail -1 '${agent.paths.log}'`
        : `powershell -Command "Get-Content '${agent.paths.log}' -Tail 1"`;
      lastLog = await sshExec(nome, logCmd, 8000);
    } catch { /* no log */ }

    return NextResponse.json({
      name: agent.name,
      emoji: agent.emoji,
      online: processRunning,
      sshReachable,
      processRunning,
      lastLog,
      pid,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
