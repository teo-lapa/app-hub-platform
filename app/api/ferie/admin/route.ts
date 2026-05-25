import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';
import { getUserFromRequest } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const ADMIN_EMAILS = ['paul@lapa.ch', 'laura@lapa.ch'];

const STATE_LABELS: Record<string, string> = {
  draft: 'Bozza',
  confirm: 'In attesa',
  validate1: 'Approvata 1/2',
  validate: 'Approvata',
  refuse: 'Rifiutata',
};

async function checkAdmin(request: NextRequest): Promise<boolean> {
  const user = await getUserFromRequest(request);
  if (!user) return false;
  if (user.role === 'admin') return true;
  return ADMIN_EMAILS.includes(user.email?.toLowerCase() || '');
}

export async function GET(request: NextRequest) {
  try {
    if (!(await checkAdmin(request))) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }
    const userCookies = request.headers.get('cookie') || undefined;
    const { cookies, uid } = await getOdooSession(userCookies);
    if (!uid) return NextResponse.json({ error: 'Auth richiesta' }, { status: 401 });

    const filter = request.nextUrl.searchParams.get('filter') || 'pending'; // pending | all

    const domain: any[] = [];
    if (filter === 'pending') {
      domain.push(['state', 'in', ['confirm', 'validate1']]);
    } else {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      domain.push(['create_date', '>=', sixMonthsAgo.toISOString().split('T')[0]]);
    }

    const leaves = await callOdoo(cookies, 'hr.leave', 'search_read', [], {
      domain,
      fields: ['id', 'name', 'employee_id', 'holiday_status_id', 'request_date_from', 'request_date_to', 'number_of_days', 'state', 'create_date'],
      order: 'create_date desc',
      limit: 200,
    });

    return NextResponse.json({
      leaves: leaves.map((l: any) => ({
        id: l.id,
        employee_id: l.employee_id?.[0],
        employee_name: l.employee_id?.[1] || '—',
        type_id: l.holiday_status_id?.[0],
        type_name: l.holiday_status_id?.[1] || '—',
        date_from: l.request_date_from,
        date_to: l.request_date_to,
        days: l.number_of_days,
        state: l.state,
        state_label: STATE_LABELS[l.state] || l.state,
        note: l.name || '',
        created: l.create_date,
      })),
    });
  } catch (e: any) {
    console.error('[FERIE/admin GET]', e);
    return NextResponse.json({ error: e.message || 'Errore' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await checkAdmin(request))) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }
    const body = await request.json();
    const { id, action, date_from, date_to, refuse_reason } = body;
    if (!id || !action) {
      return NextResponse.json({ error: 'id e action richiesti' }, { status: 400 });
    }

    const userCookies = request.headers.get('cookie') || undefined;
    const { cookies, uid } = await getOdooSession(userCookies);
    if (!uid) return NextResponse.json({ error: 'Auth richiesta' }, { status: 401 });

    if (action === 'approve') {
      // Doppia approvazione automatica se serve
      const before = await callOdoo(cookies, 'hr.leave', 'search_read', [], {
        domain: [['id', '=', id]],
        fields: ['state'],
        limit: 1,
      });
      const startState = before?.[0]?.state;

      if (startState === 'confirm') {
        await callOdoo(cookies, 'hr.leave', 'action_approve', [[id]]);
      }

      const after = await callOdoo(cookies, 'hr.leave', 'search_read', [], {
        domain: [['id', '=', id]],
        fields: ['state'],
        limit: 1,
      });
      if (after?.[0]?.state === 'validate1') {
        await callOdoo(cookies, 'hr.leave', 'action_validate', [[id]]);
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'refuse') {
      if (refuse_reason) {
        await callOdoo(cookies, 'hr.leave', 'write', [[id], { name: refuse_reason }]);
      }
      await callOdoo(cookies, 'hr.leave', 'action_refuse', [[id]]);
      return NextResponse.json({ success: true });
    }

    if (action === 'modify') {
      if (!date_from || !date_to) {
        return NextResponse.json({ error: 'date_from e date_to richiesti' }, { status: 400 });
      }
      await callOdoo(cookies, 'hr.leave', 'write', [[id], {
        request_date_from: date_from,
        request_date_to: date_to,
      }]);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'action non valida' }, { status: 400 });
  } catch (e: any) {
    console.error('[FERIE/admin POST]', e);
    return NextResponse.json({ error: e.message || 'Errore' }, { status: 500 });
  }
}
