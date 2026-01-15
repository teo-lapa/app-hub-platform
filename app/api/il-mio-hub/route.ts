import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const ODOO_URL = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';
const ODOO_DB = process.env.ODOO_DB || 'lapadevadmin-lapa-v2-main-7268478';

// Helper per chiamate Odoo JSON-RPC
async function odooCall(sessionId: string, model: string, method: string, args: any[], kwargs: any = {}) {
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_id=${sessionId}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      id: Date.now(),
      params: {
        model,
        method,
        args,
        kwargs,
      },
    }),
  });

  const data = await response.json();
  if (data.error) {
    console.error(`Odoo error for ${model}.${method}:`, data.error);
    throw new Error(data.error.message || 'Errore Odoo');
  }
  return data.result;
}

// Helper per ottenere l'utente corrente
async function getCurrentUser(sessionId: string) {
  const result = await odooCall(sessionId, 'res.users', 'search_read', [
    [['id', '=', (await getUid(sessionId))]],
    ['id', 'name', 'login', 'email', 'partner_id', 'employee_id', 'employee_ids']
  ], { limit: 1 });
  return result?.[0] || null;
}

// Helper per ottenere l'UID dell'utente corrente
async function getUid(sessionId: string) {
  const response = await fetch(`${ODOO_URL}/web/session/get_session_info`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_id=${sessionId}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      id: Date.now(),
      params: {},
    }),
  });

  const data = await response.json();
  return data.result?.uid;
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('odoo_session_id')?.value;

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        message: 'Sessione Odoo non trovata'
      }, { status: 401 });
    }

    // Ottieni informazioni utente corrente
    const uid = await getUid(sessionId);
    const currentUser = await getCurrentUser(sessionId);

    if (!currentUser) {
      return NextResponse.json({
        success: false,
        message: 'Utente non trovato'
      }, { status: 404 });
    }

    const partnerId = currentUser.partner_id?.[0];
    const employeeId = currentUser.employee_ids?.[0] || currentUser.employee_id?.[0];

    // Date per filtri
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const next7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // 1. NOTIFICHE (mail.message indirizzati all'utente)
    let notifications = [];
    try {
      const messages = await odooCall(sessionId, 'mail.message', 'search_read', [
        [
          ['partner_ids', 'in', [partnerId]],
          ['date', '>=', new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()], // Ultimi 30 giorni
        ],
        ['id', 'subject', 'body', 'date', 'author_id', 'message_type', 'needaction']
      ], { limit: 50, order: 'date desc' });

      notifications = messages.map((msg: any) => ({
        id: msg.id,
        subject: msg.subject || 'Notifica',
        body: msg.body || '',
        date: msg.date,
        author: msg.author_id?.[1] || 'Sistema',
        isRead: !msg.needaction,
        type: msg.message_type === 'notification' ? 'notification' :
              msg.message_type === 'comment' ? 'message' : 'notification'
      }));
    } catch (e) {
      console.error('Errore caricamento notifiche:', e);
    }

    // 2. CALENDARIO (calendar.event dell'utente)
    let events = [];
    try {
      const calendarEvents = await odooCall(sessionId, 'calendar.event', 'search_read', [
        [
          ['partner_ids', 'in', [partnerId]],
          ['start', '>=', todayStr],
          ['start', '<=', next7Days],
        ],
        ['id', 'name', 'start', 'stop', 'location', 'partner_ids', 'attendee_ids']
      ], { limit: 20, order: 'start asc' });

      // Per ogni evento, ottieni lo stato dell'attendee corrente
      for (const event of calendarEvents) {
        let status = 'needsAction';
        if (event.attendee_ids?.length > 0) {
          try {
            const attendees = await odooCall(sessionId, 'calendar.attendee', 'search_read', [
              [
                ['event_id', '=', event.id],
                ['partner_id', '=', partnerId]
              ],
              ['state']
            ], { limit: 1 });
            if (attendees?.[0]) {
              status = attendees[0].state;
            }
          } catch (e) {
            console.error('Errore caricamento attendee:', e);
          }
        }

        events.push({
          id: event.id,
          name: event.name,
          start: event.start,
          stop: event.stop,
          location: event.location || null,
          attendees: event.partner_ids || [],
          status: status
        });
      }
    } catch (e) {
      console.error('Errore caricamento calendario:', e);
    }

    // 3. FERIE (hr.leave dell'utente)
    let leaveRequests = [];
    let remainingLeaves = 0;
    try {
      if (employeeId) {
        // Richieste ferie
        const leaves = await odooCall(sessionId, 'hr.leave', 'search_read', [
          [['employee_id', '=', employeeId]],
          ['id', 'name', 'date_from', 'date_to', 'number_of_days', 'state', 'holiday_status_id']
        ], { limit: 20, order: 'date_from desc' });

        leaveRequests = leaves.map((leave: any) => ({
          id: leave.id,
          name: leave.name,
          dateFrom: leave.date_from,
          dateTo: leave.date_to,
          days: leave.number_of_days,
          state: leave.state,
          type: leave.holiday_status_id?.[1] || 'Ferie'
        }));

        // Saldo ferie rimanenti
        const employee = await odooCall(sessionId, 'hr.employee', 'search_read', [
          [['id', '=', employeeId]],
          ['remaining_leaves']
        ], { limit: 1 });
        remainingLeaves = employee?.[0]?.remaining_leaves || 0;
      }
    } catch (e) {
      console.error('Errore caricamento ferie:', e);
    }

    // 4. ASSENTI OGGI
    let absentToday = [];
    try {
      const todayLeaves = await odooCall(sessionId, 'hr.leave', 'search_read', [
        [
          ['date_from', '<=', todayStr + ' 23:59:59'],
          ['date_to', '>=', todayStr + ' 00:00:00'],
          ['state', '=', 'validate']
        ],
        ['id', 'employee_id', 'holiday_status_id']
      ], { limit: 50 });

      absentToday = todayLeaves.map((leave: any) => ({
        id: leave.id,
        name: leave.employee_id?.[1] || 'Dipendente',
        leaveType: leave.holiday_status_id?.[1] || 'Ferie'
      }));
    } catch (e) {
      console.error('Errore caricamento assenti oggi:', e);
    }

    // 5. ATTIVITA' (mail.activity dell'utente)
    let activities = [];
    try {
      const acts = await odooCall(sessionId, 'mail.activity', 'search_read', [
        [['user_id', '=', uid]],
        ['id', 'summary', 'note', 'date_deadline', 'state', 'activity_type_id']
      ], { limit: 30, order: 'date_deadline asc' });

      activities = acts.map((act: any) => ({
        id: act.id,
        summary: act.summary || act.activity_type_id?.[1] || 'Attività',
        note: act.note || '',
        deadline: act.date_deadline,
        state: act.state, // 'overdue', 'today', 'planned'
        activityType: act.activity_type_id?.[1] || ''
      }));
    } catch (e) {
      console.error('Errore caricamento attività:', e);
    }

    // 6. PROFILO UTENTE
    let profile = null;
    try {
      if (employeeId) {
        const emp = await odooCall(sessionId, 'hr.employee', 'search_read', [
          [['id', '=', employeeId]],
          ['id', 'name', 'work_email', 'department_id', 'job_title', 'work_phone', 'mobile_phone', 'remaining_leaves']
        ], { limit: 1 });

        if (emp?.[0]) {
          profile = {
            id: emp[0].id,
            name: emp[0].name,
            email: emp[0].work_email || currentUser.email,
            department: emp[0].department_id?.[1] || null,
            jobTitle: emp[0].job_title || null,
            phone: emp[0].work_phone || emp[0].mobile_phone || null,
            remainingLeaves: emp[0].remaining_leaves || 0
          };
        }
      }

      // Fallback se non c'è employee
      if (!profile) {
        profile = {
          id: currentUser.id,
          name: currentUser.name,
          email: currentUser.email || currentUser.login,
          department: null,
          jobTitle: null,
          phone: null,
          remainingLeaves: 0
        };
      }
    } catch (e) {
      console.error('Errore caricamento profilo:', e);
    }

    return NextResponse.json({
      success: true,
      notifications,
      events,
      leaveRequests,
      activities,
      profile,
      absentToday,
      meta: {
        timestamp: new Date().toISOString(),
        userId: uid,
        employeeId,
        partnerId
      }
    });

  } catch (error) {
    console.error('Errore API il-mio-hub:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Errore interno del server'
    }, { status: 500 });
  }
}
