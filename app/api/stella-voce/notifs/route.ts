/**
 * Badge/pannello notifiche per Stella/Romeo: le "cose da fare" (sola lettura, auth proprietari).
 */
import { NextRequest, NextResponse } from 'next/server';
import { callOdoo } from '@/lib/odoo/odoo-helper';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ALLOWED = (process.env.STELLA_ALLOWED_EMAILS || 'paul@lapa.ch,laura@lapa.ch')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

const fdate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

async function count(model: string, domain: any[]): Promise<number> {
  try {
    const n = await callOdoo(model, 'search_count', [domain]);
    return typeof n === 'number' ? n : 0;
  } catch {
    return 0;
  }
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const user = token ? verifyToken(token) : null;
  if (!user || !ALLOWED.includes((user.email || '').toLowerCase())) {
    return NextResponse.json({ count: 0, items: [], authed: false });
  }

  const now = new Date();
  const today = fdate(now);
  const start = `${today} 00:00:00`;
  const end = `${fdate(new Date(now.getTime() + 86400000))} 00:00:00`;

  const [ordini, consegne, scadute] = await Promise.all([
    count('sale.order', [['state', 'in', ['draft', 'sent']], ['date_order', '>=', start], ['date_order', '<', end]]),
    count('stock.picking', [['picking_type_code', '=', 'outgoing'], ['scheduled_date', '>=', start], ['scheduled_date', '<', end], ['state', 'in', ['assigned', 'confirmed', 'waiting']]]),
    count('account.move', [['move_type', '=', 'out_invoice'], ['state', '=', 'posted'], ['payment_state', 'in', ['not_paid', 'partial']], ['invoice_date_due', '<', today]]),
  ]);

  const items = [
    { key: 'ordini', icon: '📦', label: 'Ordini da confermare oggi', n: ordini, ask: 'Elencami in breve gli ordini da confermare di oggi.' },
    { key: 'consegne', icon: '🚚', label: 'Consegne in programma oggi', n: consegne, ask: 'Quali consegne abbiamo oggi? Riassumi i giri.' },
    { key: 'scadute', icon: '💰', label: 'Fatture clienti scadute', n: scadute, ask: 'Quali sono i 10 clienti con il maggior scaduto e da quanto?' },
  ].filter(it => it.n > 0);

  // il pallino conta solo le cose "da fare oggi" (ordini + consegne), non lo scaduto storico
  const count = ordini + consegne;
  return NextResponse.json({ count, items });
}
