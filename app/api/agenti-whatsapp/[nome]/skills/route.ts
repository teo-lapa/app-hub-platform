import { NextResponse } from 'next/server';
import { getAgent } from '@/lib/agents/whatsapp-agents';
import { sshListDir, sshReadFile } from '@/lib/agents/ssh-exec';

export async function GET(req: Request, { params }: { params: { nome: string } }) {
  const { nome } = params;
  const agent = getAgent(nome);
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

  const url = new URL(req.url);
  const skillName = url.searchParams.get('skill');

  try {
    if (skillName) {
      // Read single skill content
      const skillPath = agent.useWSL
        ? `${agent.paths.skills}/${skillName}`
        : `${agent.paths.skills}\\${skillName}`;
      const content = await sshReadFile(nome, skillPath);
      return NextResponse.json({ skill: skillName, content });
    }

    // List all skills
    const files = await sshListDir(nome, agent.paths.skills);
    const skills = files.filter(f => f.endsWith('.md'));
    return NextResponse.json({ skills });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
