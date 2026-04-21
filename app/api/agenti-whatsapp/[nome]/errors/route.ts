import { NextResponse } from 'next/server';
import { getAgent } from '@/lib/agents/whatsapp-agents';
import { proxyGet } from '@/lib/agents/whatsapp-api-proxy';
import { parseLog } from '@/lib/agents/log-parser';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { nome: string } }) {
  const { nome } = params;
  const agent = getAgent(nome);
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  if (agent.apiAvailable === false) return NextResponse.json({ errors: [], total: 0, apiAvailable: false });
  const lines = new URL(req.url).searchParams.get('lines') || '1000';
  try {
    const data = await proxyGet(nome, 'log', { lines });
    const { errors } = parseLog(data.log || '');
    return NextResponse.json({ errors: errors.slice(-200).reverse(), total: errors.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, errors: [] }, { status: 500 });
  }
}
