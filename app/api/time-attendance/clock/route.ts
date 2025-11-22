import { NextRequest, NextResponse } from 'next/server';
import {
  createTimeEntry,
  getEmployeeLastEntry,
  getTodayEntries,
  getEmployee,
} from '@/lib/time-attendance/db';
import { TAApiResponse, TimeEntry, CreateTimeEntryInput } from '@/lib/time-attendance/types';

/**
 * POST /api/time-attendance/clock
 * Registra una timbratura (clock-in, clock-out, break)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      employee_id,
      org_id,
      entry_type,
      latitude,
      longitude,
      accuracy_meters,
      is_within_geofence,
      clock_method,
      note,
    } = body;

    // Validazione
    if (!employee_id || !org_id || !entry_type) {
      return NextResponse.json<TAApiResponse<null>>({
        success: false,
        error: 'employee_id, org_id e entry_type sono obbligatori',
      }, { status: 400 });
    }

    if (!['clock_in', 'clock_out', 'break_start', 'break_end'].includes(entry_type)) {
      return NextResponse.json<TAApiResponse<null>>({
        success: false,
        error: 'entry_type non valido. Usa: clock_in, clock_out, break_start, break_end',
      }, { status: 400 });
    }

    // Verifica dipendente esiste
    const employee = await getEmployee(employee_id);
    if (!employee || employee.org_id !== org_id) {
      return NextResponse.json<TAApiResponse<null>>({
        success: false,
        error: 'Dipendente non trovato',
      }, { status: 404 });
    }

    // Verifica stato attuale per evitare doppie timbrature
    const lastEntry = await getEmployeeLastEntry(employee_id);

    // Logica di validazione timbrature
    if (entry_type === 'clock_in' && lastEntry?.entry_type === 'clock_in') {
      return NextResponse.json<TAApiResponse<null>>({
        success: false,
        error: 'Sei gia timbrato in entrata. Timbra prima l\'uscita.',
      }, { status: 400 });
    }

    if (entry_type === 'clock_out' && (!lastEntry || lastEntry.entry_type === 'clock_out')) {
      return NextResponse.json<TAApiResponse<null>>({
        success: false,
        error: 'Non risulti timbrato in entrata. Timbra prima l\'ingresso.',
      }, { status: 400 });
    }

    // Crea timbratura
    const input: CreateTimeEntryInput = {
      org_id,
      employee_id,
      entry_type,
      latitude,
      longitude,
      accuracy_meters,
      is_within_geofence,
      clock_method: clock_method || 'manual',
      device_info: {
        user_agent: request.headers.get('user-agent') || undefined,
      },
      note,
    };

    const entry = await createTimeEntry(input);

    // Calcola ore lavorate oggi
    const todayEntries = await getTodayEntries(employee_id);
    const clockIns = todayEntries.filter(e => e.entry_type === 'clock_in');
    const clockOuts = todayEntries.filter(e => e.entry_type === 'clock_out');

    let hoursWorkedToday = 0;
    for (let i = 0; i < Math.min(clockIns.length, clockOuts.length); i++) {
      const inTime = new Date(clockIns[i].timestamp).getTime();
      const outTime = new Date(clockOuts[i].timestamp).getTime();
      if (outTime > inTime) {
        hoursWorkedToday += (outTime - inTime) / (1000 * 60 * 60);
      }
    }

    return NextResponse.json<TAApiResponse<{
      entry: TimeEntry;
      is_on_duty: boolean;
      hours_worked_today: number;
    }>>({
      success: true,
      data: {
        entry,
        is_on_duty: entry_type === 'clock_in' || entry_type === 'break_end',
        hours_worked_today: Math.round(hoursWorkedToday * 100) / 100,
      },
      message: entry_type === 'clock_in'
        ? 'Entrata registrata!'
        : entry_type === 'clock_out'
        ? 'Uscita registrata!'
        : entry_type === 'break_start'
        ? 'Inizio pausa registrato'
        : 'Fine pausa registrata',
    });

  } catch (error) {
    console.error('Clock error:', error);
    return NextResponse.json<TAApiResponse<null>>({
      success: false,
      error: 'Errore durante la timbratura',
    }, { status: 500 });
  }
}

/**
 * GET /api/time-attendance/clock?employee_id=xxx
 * Ottiene lo stato attuale del dipendente
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employee_id');

    if (!employeeId) {
      return NextResponse.json<TAApiResponse<null>>({
        success: false,
        error: 'employee_id richiesto',
      }, { status: 400 });
    }

    const employee = await getEmployee(employeeId);
    if (!employee) {
      return NextResponse.json<TAApiResponse<null>>({
        success: false,
        error: 'Dipendente non trovato',
      }, { status: 404 });
    }

    const lastEntry = await getEmployeeLastEntry(employeeId);
    const todayEntries = await getTodayEntries(employeeId);

    // Calcola ore lavorate oggi
    const clockIns = todayEntries
      .filter(e => e.entry_type === 'clock_in')
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const clockOuts = todayEntries
      .filter(e => e.entry_type === 'clock_out')
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    let hoursWorkedToday = 0;
    for (let i = 0; i < Math.min(clockIns.length, clockOuts.length); i++) {
      const inTime = new Date(clockIns[i].timestamp).getTime();
      const outTime = new Date(clockOuts[i].timestamp).getTime();
      if (outTime > inTime) {
        hoursWorkedToday += (outTime - inTime) / (1000 * 60 * 60);
      }
    }

    // Se sono in servizio, aggiungi tempo dall'ultimo clock_in
    const isOnDuty = lastEntry?.entry_type === 'clock_in' || lastEntry?.entry_type === 'break_end';
    if (isOnDuty && clockIns.length > clockOuts.length) {
      const lastClockIn = clockIns[clockIns.length - 1];
      const now = Date.now();
      const lastClockInTime = new Date(lastClockIn.timestamp).getTime();
      hoursWorkedToday += (now - lastClockInTime) / (1000 * 60 * 60);
    }

    return NextResponse.json<TAApiResponse<{
      employee: typeof employee;
      is_on_duty: boolean;
      last_entry: TimeEntry | null;
      today_entries: TimeEntry[];
      hours_worked_today: number;
      first_clock_in_today: string | null;
    }>>({
      success: true,
      data: {
        employee,
        is_on_duty: isOnDuty,
        last_entry: lastEntry,
        today_entries: todayEntries,
        hours_worked_today: Math.round(hoursWorkedToday * 100) / 100,
        first_clock_in_today: clockIns[0]?.timestamp
          ? new Date(clockIns[0].timestamp).toISOString()
          : null,
      },
    });

  } catch (error) {
    console.error('Get clock status error:', error);
    return NextResponse.json<TAApiResponse<null>>({
      success: false,
      error: 'Errore nel recupero dello stato',
    }, { status: 500 });
  }
}
