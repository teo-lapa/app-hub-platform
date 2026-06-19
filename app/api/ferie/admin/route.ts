import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { computeBalance, sumPaidLeaveDays, PAID_LEAVE_TYPE_ID } from '@/lib/ferie/balance';

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

    // Saldo ferie per ogni dipendente coinvolto nelle richieste mostrate
    const empIds = Array.from(new Set(leaves.map((l: any) => l.employee_id?.[0]).filter(Boolean)));
    const balances: Record<number, any> = {};
    if (empIds.length > 0) {
      const year = new Date().getFullYear();
      const emps = await callOdoo(cookies, 'hr.employee', 'search_read', [], {
        domain: [['id', 'in', empIds]],
        fields: ['id', 'contract_date_start', 'x_ferie_start_date'],
      });
      const yearLeaves = await callOdoo(cookies, 'hr.leave', 'search_read', [], {
        domain: [
          ['employee_id', 'in', empIds],
          ['holiday_status_id', '=', PAID_LEAVE_TYPE_ID],
          ['request_date_from', '>=', `${year}-01-01`],
          ['request_date_from', '<=', `${year}-12-31`],
        ],
        fields: ['employee_id', 'holiday_status_id', 'number_of_days', 'state', 'request_date_from'],
      });
      for (const e of emps) {
        const mine = yearLeaves.filter((l: any) => l.employee_id?.[0] === e.id);
        const taken = sumPaidLeaveDays(mine, ['validate'], year);
        const pending = sumPaidLeaveDays(mine, ['confirm', 'validate1'], year);
        balances[e.id] = computeBalance({ anchorDate: e.x_ferie_start_date || e.contract_date_start || null, takenDays: taken, pendingDays: pending });
      }
    }

    // Sovrapposizioni con le ferie di altri dipendenti (per vedere a colpo d'occhio i giorni che si intercalano)
    const overlapsByLeave: Record<number, Array<{ employee_name: string; from: string; to: string; state: string }>> = {};
    const dated = leaves.filter((l: any) => l.request_date_from && l.request_date_to);
    if (dated.length > 0) {
      const minFrom = dated.reduce((m: string, l: any) => (l.request_date_from < m ? l.request_date_from : m), dated[0].request_date_from);
      const maxTo = dated.reduce((m: string, l: any) => (l.request_date_to > m ? l.request_date_to : m), dated[0].request_date_to);
      const context = await callOdoo(cookies, 'hr.leave', 'search_read', [], {
        domain: [
          ['state', 'in', ['confirm', 'validate1', 'validate']],
          ['request_date_from', '<=', maxTo],
          ['request_date_to', '>=', minFrom],
        ],
        fields: ['id', 'employee_id', 'request_date_from', 'request_date_to', 'state'],
      });
      for (const l of dated) {
        const empId = l.employee_id?.[0];
        const ovs = [];
        for (const c of context) {
          if (c.id === l.id || c.employee_id?.[0] === empId) continue;
          const start = l.request_date_from > c.request_date_from ? l.request_date_from : c.request_date_from;
          const end = l.request_date_to < c.request_date_to ? l.request_date_to : c.request_date_to;
          if (start <= end) {
            ovs.push({ employee_name: c.employee_id?.[1] || '—', from: start, to: end, state: c.state });
          }
        }
        if (ovs.length) overlapsByLeave[l.id] = ovs;
      }
    }

    return NextResponse.json({
      balances,
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
        overlaps: overlapsByLeave[l.id] || [],
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
        await callOdoo(cookies, 'hr.leave', 'action_approve', [[id]]);
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
