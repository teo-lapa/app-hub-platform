import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const from = sp.get('from');
    const to = sp.get('to');
    if (!from || !to) {
      return NextResponse.json({ error: 'from e to richiesti (YYYY-MM-DD)' }, { status: 400 });
    }

    const userCookies = request.headers.get('cookie') || undefined;
    const { cookies, uid } = await getOdooSession(userCookies);
    if (!uid) return NextResponse.json({ error: 'Auth richiesta' }, { status: 401 });

    const leaves = await callOdoo(cookies, 'hr.leave', 'search_read', [], {
      domain: [
        ['state', 'in', ['confirm', 'validate1', 'validate']],
        ['date_from', '<=', `${to} 23:59:59`],
        ['date_to', '>=', `${from} 00:00:00`],
      ],
      fields: ['id', 'employee_id', 'holiday_status_id', 'date_from', 'date_to', 'request_date_from', 'request_date_to', 'state', 'number_of_days'],
    });

    return NextResponse.json({
      leaves: leaves.map((l: any) => ({
        id: l.id,
        employee_id: l.employee_id?.[0],
        employee_name: l.employee_id?.[1] || '',
        type_name: l.holiday_status_id?.[1] || '',
        date_from: l.request_date_from || (l.date_from ? l.date_from.split(' ')[0] : null),
        date_to: l.request_date_to || (l.date_to ? l.date_to.split(' ')[0] : null),
        state: l.state,
        days: l.number_of_days,
      })),
    });
  } catch (e: any) {
    console.error('[FERIE/calendario] error', e);
    return NextResponse.json({ error: e.message || 'Errore' }, { status: 500 });
  }
}
