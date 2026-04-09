const TUNNEL_URL = process.env.WHATSAPP_API_URL || 'https://chem-satisfy-influences-passes.trycloudflare.com';
const API_KEY = process.env.WHATSAPP_API_KEY || 'lapa-wa-agents-2026';

export async function proxyGet(agentName: string, action: string, params?: Record<string, string>): Promise<any> {
  const searchParams = params ? '?' + new URLSearchParams(params).toString() : '';
  const res = await fetch(`${TUNNEL_URL}/agent/${agentName}/${action}${searchParams}`, {
    headers: { 'x-api-key': API_KEY },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function proxyPost(agentName: string, action: string): Promise<any> {
  const res = await fetch(`${TUNNEL_URL}/agent/${agentName}/${action}`, {
    method: 'POST',
    headers: { 'x-api-key': API_KEY },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
