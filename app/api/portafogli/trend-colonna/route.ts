import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin } from '@/lib/odoo/admin-session';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/portafogli/trend-colonna
 * body: { ids: number[] }  (commercial_partner_id dei clienti della colonna)
 * Ritorna lo storico 18 mesi AGGREGATO + confronto anno su anno.
 */
export async function POST(request: NextRequest) {
  try {
    const { ids } = await request.json();
    const now = new Date();

    // genera i 18 mesi (da gen anno scorso a mese corrente)
    const months: string[] = [];
    let cur = new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    while (cur <= end) {
      months.push(`${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, '0')}`);
      cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
    }

    let valori = months.map(() => 0);
    if (Array.isArray(ids) && ids.length) {
      const start18 = `${now.getUTCFullYear() - 1}-01-01`;
      const rows = await callOdooAsAdmin('sale.order', 'read_group', [
        [['commercial_partner_id', 'in', ids], ['state', 'in', ['sale', 'done']], ['date_order', '>=', start18]],
        ['amount_untaxed:sum'], ['date_order:month'],
      ], { lazy: false });
      const mp: Record<string, number> = {};
      for (const r of rows) {
        const from: string = r.__range?.['date_order:month']?.from || '';
        const m = from.slice(0, 7);
        if (m) mp[m] = r.amount_untaxed || 0;
      }
      valori = months.map(m => mp[m] || 0);
    }

    // YoY: anno corrente (gen..mese corrente) vs stesso periodo anno scorso
    const annoCur = now.getUTCFullYear();
    const meseCur = now.getUTCMonth();
    let ytdCur = 0, ytdPrev = 0;
    months.forEach((m, i) => {
      const [yy, mm] = m.split('-').map(Number);
      if (yy === annoCur && mm - 1 <= meseCur) ytdCur += valori[i];
      if (yy === annoCur - 1 && mm - 1 <= meseCur) ytdPrev += valori[i];
    });
    const pct = ytdPrev ? Math.round(((ytdCur - ytdPrev) / ytdPrev) * 100) : null;

    return NextResponse.json({ success: true, serie: { months, valori }, yoy: { ytdCur, ytdPrev, pct } });
  } catch (error: any) {
    console.error('💥 [PORTAFOGLI/trend-colonna]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
