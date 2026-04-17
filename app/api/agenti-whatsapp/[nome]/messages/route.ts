import { NextResponse } from 'next/server';
import { getAgent } from '@/lib/agents/whatsapp-agents';
import { proxyGet } from '@/lib/agents/whatsapp-api-proxy';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { nome: string } }) {
  const { nome } = params;
  const agent = getAgent(nome);
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  if (agent.apiAvailable === false) {
    return NextResponse.json({ messages: [], apiAvailable: false });
  }

  const url = new URL(req.url);
  const chat = url.searchParams.get('chat');
  const limit = url.searchParams.get('limit');
  const queryParams: Record<string, string> = {};
  if (chat) queryParams.chat = chat;
  if (limit) queryParams.limit = limit;

  try {
    return NextResponse.json(await proxyGet(nome, 'messages', Object.keys(queryParams).length ? queryParams : undefined));
  } catch (err: any) {
    return NextResponse.json({ messages: [], error: err.message });
  }
}
