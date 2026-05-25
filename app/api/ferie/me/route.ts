import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const LEAVE_TYPE_LABELS: Record<number, string> = {
  1: 'Ferie pagate',
  2: 'Malattia',
  4: 'Non retribuite',
};

const STATE_LABELS: Record<string, string> = {
  draft: 'Bozza',
  confirm: 'In attesa di approvazione',
  validate1: 'Approvata 1/2',
  validate: 'Approvata',
  refuse: 'Rifiutata',
};

async function findEmployee(cookies: string | null, uid: number) {
  const employees = await callOdoo(cookies, 'hr.employee', 'search_read', [], {
    domain: [['user_id', '=', uid], ['active', '=', true]],
    fields: ['id', 'name', 'work_email', 'parent_id', 'department_id'],
    order: 'id asc',
    limit: 1,
  });
  return employees && employees.length > 0 ? employees[0] : null;
}

export async function GET(request: NextRequest) {
  try {
    const userCookies = request.headers.get('cookie') || undefined;
    const { cookies, uid } = await getOdooSession(userCookies);
    if (!uid) return NextResponse.json({ error: 'Auth richiesta' }, { status: 401 });

    const employee = await findEmployee(cookies, uid);
    if (!employee) {
      return NextResponse.json({ error: 'Nessun dipendente collegato al tuo utente' }, { status: 404 });
    }

    // Tipi di ferie disponibili
    const types = await callOdoo(cookies, 'hr.leave.type', 'search_read', [], {
      domain: [['active', '=', true]],
      fields: ['id', 'name', 'leave_validation_type'],
    });

    // Le mie richieste ultimi 12 mesi
    const oneYearAgo = new Date();
    oneYearAgo.setMonth(oneYearAgo.getMonth() - 12);
    const fromDate = oneYearAgo.toISOString().split('T')[0];

    const leaves = await callOdoo(cookies, 'hr.leave', 'search_read', [], {
      domain: [
        ['employee_id', '=', employee.id],
        ['create_date', '>=', fromDate],
      ],
      fields: ['id', 'name', 'holiday_status_id', 'request_date_from', 'request_date_to', 'date_from', 'date_to', 'number_of_days', 'state'],
      order: 'request_date_from desc',
    });

    return NextResponse.json({
      employee: { id: employee.id, name: employee.name },
      types: types.map((t: any) => ({ id: t.id, name: t.name })),
      leaves: leaves.map((l: any) => ({
        id: l.id,
        type_id: l.holiday_status_id?.[0],
        type_name: l.holiday_status_id?.[1] || LEAVE_TYPE_LABELS[l.holiday_status_id?.[0]] || '—',
        date_from: l.request_date_from,
        date_to: l.request_date_to,
        days: l.number_of_days,
        state: l.state,
        state_label: STATE_LABELS[l.state] || l.state,
        note: l.name || '',
      })),
    });
  } catch (e: any) {
    console.error('[FERIE/me] error', e);
    return NextResponse.json({ error: e.message || 'Errore' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type_id, date_from, date_to, note } = body;
    if (!type_id || !date_from || !date_to) {
      return NextResponse.json({ error: 'Parametri mancanti (type_id, date_from, date_to)' }, { status: 400 });
    }
    if (date_to < date_from) {
      return NextResponse.json({ error: 'La data fine deve essere uguale o successiva alla data inizio' }, { status: 400 });
    }

    const userCookies = request.headers.get('cookie') || undefined;
    const { cookies, uid } = await getOdooSession(userCookies);
    if (!uid) return NextResponse.json({ error: 'Auth richiesta' }, { status: 401 });

    const employee = await findEmployee(cookies, uid);
    if (!employee) return NextResponse.json({ error: 'Nessun dipendente collegato' }, { status: 404 });

    const leaveId = await callOdoo(cookies, 'hr.leave', 'create', [{
      holiday_status_id: type_id,
      employee_id: employee.id,
      holiday_type: 'employee',
      request_date_from: date_from,
      request_date_to: date_to,
      name: note || '',
    }]);

    return NextResponse.json({ success: true, id: leaveId });
  } catch (e: any) {
    console.error('[FERIE/me POST] error', e);
    const msg = e.message || 'Errore creazione richiesta';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'id mancante' }, { status: 400 });

    const userCookies = request.headers.get('cookie') || undefined;
    const { cookies, uid } = await getOdooSession(userCookies);
    if (!uid) return NextResponse.json({ error: 'Auth richiesta' }, { status: 401 });

    const employee = await findEmployee(cookies, uid);
    if (!employee) return NextResponse.json({ error: 'Nessun dipendente collegato' }, { status: 404 });

    const leaves = await callOdoo(cookies, 'hr.leave', 'search_read', [], {
      domain: [['id', '=', id], ['employee_id', '=', employee.id]],
      fields: ['id', 'state'],
      limit: 1,
    });
    if (!leaves || leaves.length === 0) {
      return NextResponse.json({ error: 'Richiesta non trovata' }, { status: 404 });
    }
    if (!['draft', 'confirm', 'validate1'].includes(leaves[0].state)) {
      return NextResponse.json({ error: 'Impossibile annullare una richiesta già approvata o rifiutata' }, { status: 400 });
    }

    await callOdoo(cookies, 'hr.leave', 'action_refuse', [[id]]);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[FERIE/me DELETE] error', e);
    return NextResponse.json({ error: e.message || 'Errore' }, { status: 500 });
  }
}
