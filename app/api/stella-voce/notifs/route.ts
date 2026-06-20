/**
 * Badge notifiche per Stella/Romeo: conta le "cose da fare" (ordini da confermare oggi).
 * Solo lettura, auth proprietari.
 */
import { NextRequest, NextResponse } from 'next/server';
import { callOdoo } from '@/lib/odoo/odoo-helper';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ALLOWED = (process.env.STELLA_ALLOWED_EMAILS || 'paul@lapa.ch,laura@lapa.ch')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

function todayRange(): [string, string] {
  const now = new Date();
  const f = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const start = `${f(now)} 00:00:00`;
  const end = `${f(new Date(now.getTime() + 86400000))} 00:00:00`;
  return [start, end];
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const user = token ? verifyToken(token) : null;
  if (!user || !ALLOWED.includes((user.email || '').toLowerCase())) {
    return NextResponse.json({ count: 0, items: [], authed: false });
  }
  try {
    const [s, e] = todayRange();
    const domain = [['state', 'in', ['draft', 'sent']], ['date_order', '>=', s], ['date_order', '<', e]];
    const n = await callOdoo('sale.order', 'search_count', [domain]);
    const count = typeof n === 'number' ? n : 0;
    return NextResponse.json({ count, items: [{ label: 'Ordini da confermare oggi', n: count }] });
  } catch (err: any) {
    return NextResponse.json({ count: 0, items: [], error: err?.message });
  }
}
