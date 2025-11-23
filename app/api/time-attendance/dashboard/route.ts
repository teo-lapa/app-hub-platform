import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

interface EmployeeStatus {
  contact_id: number;
  contact_name: string;
  contact_function?: string;
  contact_image?: string;
  is_on_duty: boolean;
  is_on_break: boolean;
  last_entry?: {
    entry_type: string;
    timestamp: string;
    location_name?: string;
    break_type?: 'coffee_break' | 'lunch_break';
  };
  hours_worked_today: number;
  hours_worked_yesterday: number;
  hours_worked_week: number;
  hours_worked_month: number;
  entries_today: number;
}

// Helper per calcolare ore lavorate da entries
// wasOnDutyAtStart: true se il dipendente era già in servizio all'inizio del periodo
// periodStart: inizio del periodo per calcolare ore se wasOnDutyAtStart è true
// periodEnd: fine del periodo per giorni completati (es. mezzanotte per ieri)
function calculateHoursFromEntries(
  entries: Array<{ entry_type: string; timestamp: string }>,
  includeOngoing = false,
  wasOnDutyAtStart = false,
  periodStart?: Date,
  periodEnd?: Date
): number {
  let workingTime = 0;
  let breakTime = 0;
  let lastClockIn: Date | null = wasOnDutyAtStart && periodStart ? periodStart : null;
  let lastBreakStart: Date | null = null;
  let isOnBreak = false;

  for (const entry of entries) {
    const entryTime = new Date(entry.timestamp);
    switch (entry.entry_type) {
      case 'clock_in':
        lastClockIn = entryTime;
        isOnBreak = false;
        break;
      case 'clock_out':
        if (lastClockIn) {
          workingTime += entryTime.getTime() - lastClockIn.getTime();
          lastClockIn = null;
        }
        // Reset anche lastBreakStart perché clock_out chiude tutto
        lastBreakStart = null;
        isOnBreak = false;
        break;
      case 'break_start':
        lastBreakStart = entryTime;
        isOnBreak = true;
        break;
      case 'break_end':
        if (lastBreakStart) {
          breakTime += entryTime.getTime() - lastBreakStart.getTime();
          lastBreakStart = null;
        }
        isOnBreak = false;
        break;
    }
  }

  // Se ancora in servizio, calcola ore fino a:
  // - now se includeOngoing è true (oggi)
  // - periodEnd se fornito (giorni passati come ieri)
  if (lastClockIn) {
    if (includeOngoing) {
      workingTime += Date.now() - lastClockIn.getTime();
    } else if (periodEnd) {
      // Per giorni completati: calcola fino a fine giornata
      workingTime += periodEnd.getTime() - lastClockIn.getTime();
    }
  }

  // Se in pausa, aggiungi il tempo della pausa corrente al breakTime
  if (lastBreakStart) {
    if (includeOngoing) {
      breakTime += Date.now() - lastBreakStart.getTime();
    } else if (periodEnd) {
      breakTime += periodEnd.getTime() - lastBreakStart.getTime();
    }
  }

  return Math.max(0, (workingTime - breakTime) / 3600000);
}

/**
 * GET /api/time-attendance/dashboard?company_id=xxx
 * Ottiene lo stato presenze di tutti i dipendenti di un'azienda
 * Solo per admin/manager
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('company_id');
    const dateStr = searchParams.get('date'); // Opzionale, default oggi

    if (!companyId) {
      return NextResponse.json({
        success: false,
        error: 'company_id richiesto',
      }, { status: 400 });
    }

    // Usa timezone Europe/Rome per calcoli corretti
    const TIMEZONE = 'Europe/Rome';

    // Helper robusto per calcolare i bounds di un giorno in timezone Rome
    // Restituisce date UTC che corrispondono a mezzanotte-23:59 in Rome
    const getRomeDayBounds = (refDate: Date) => {
      // Ottieni la data in formato Rome
      const romeStr = refDate.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
      const [year, month, day] = romeStr.split('-').map(Number);

      // Determina se è ora legale in Italia
      // L'ora legale in Italia va dall'ultima domenica di marzo all'ultima domenica di ottobre
      const testDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
      const romeTime = testDate.toLocaleString('en-US', { timeZone: TIMEZONE, hour: 'numeric', hour12: false });
      const utcHour = testDate.getUTCHours();
      const romeHour = parseInt(romeTime);
      const offsetHours = romeHour - utcHour;

      // Crea mezzanotte Rome in UTC
      // Se offsetHours è 1 (CET), mezzanotte Rome = 23:00 UTC del giorno prima
      // Se offsetHours è 2 (CEST), mezzanotte Rome = 22:00 UTC del giorno prima
      const midnightUTC = Date.UTC(year, month - 1, day, 0, 0, 0) - (offsetHours * 60 * 60 * 1000);
      const endOfDayUTC = midnightUTC + (24 * 60 * 60 * 1000) - 1; // 23:59:59.999 Rome

      return {
        start: new Date(midnightUTC),
        end: new Date(endOfDayUTC),
        dateStr: romeStr
      };
    };

    // Data di riferimento
    const targetDate = dateStr ? new Date(dateStr + 'T12:00:00Z') : new Date();

    // Calcola bounds per oggi
    const todayBounds = getRomeDayBounds(targetDate);
    const dayStart = todayBounds.start;
    const dayEnd = todayBounds.end;

    // Ieri
    const yesterdayDate = new Date(targetDate.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayBounds = getRomeDayBounds(yesterdayDate);
    const yesterdayStart = yesterdayBounds.start;
    const yesterdayEnd = yesterdayBounds.end;

    // Inizio settimana (lunedì)
    // Calcola il giorno della settimana in timezone Rome (0=Dom, 1=Lun, ...)
    const romeDayOfWeek = new Date(targetDate.toLocaleDateString('en-CA', { timeZone: TIMEZONE }) + 'T12:00:00Z').getDay();
    const diff = romeDayOfWeek === 0 ? 6 : romeDayOfWeek - 1; // Lunedì = 0
    const mondayDate = new Date(targetDate.getTime() - diff * 24 * 60 * 60 * 1000);
    const weekBounds = getRomeDayBounds(mondayDate);
    const weekStart = weekBounds.start;

    // Log per debug
    console.log('[Dashboard] Target date:', targetDate.toISOString());
    console.log('[Dashboard] Today bounds:', dayStart.toISOString(), '-', dayEnd.toISOString());
    console.log('[Dashboard] Yesterday bounds:', yesterdayStart.toISOString(), '-', yesterdayEnd.toISOString());
    console.log('[Dashboard] Week start:', weekStart.toISOString());

    // Ottieni lista dipendenti da Odoo
    const odoo = createOdooRPCClient();
    let employees: Array<{ id: number; name: string; function?: string; image_128?: string }> = [];

    try {
      const result = await odoo.searchRead(
        'res.partner',
        [['parent_id', '=', parseInt(companyId)]],
        ['id', 'name', 'function', 'image_128'],
        100
      );
      employees = result as typeof employees;
    } catch (odooError) {
      console.warn('Errore Odoo, procedo solo con dati locali:', odooError);
    }

    // Ottieni l'ultimo entry di ogni dipendente PRIMA di oggi
    // Serve per sapere se erano già in servizio (clock_in ieri senza clock_out)
    const lastEntryBeforeTodayResult = await sql`
      SELECT DISTINCT ON (contact_id)
        contact_id,
        entry_type,
        timestamp
      FROM ta_time_entries
      WHERE company_id = ${parseInt(companyId)}
        AND timestamp < ${dayStart.toISOString()}
      ORDER BY contact_id, timestamp DESC
    `;

    // Mappa: contact_id -> true se era in servizio prima di oggi
    const wasOnDutyBeforeToday = new Map<number, boolean>();
    for (const entry of lastEntryBeforeTodayResult.rows) {
      // Era in servizio se l'ultimo entry prima di oggi era clock_in, break_end, o break_start
      // break_start significa che era in servizio (anche se in pausa)
      const wasOnDuty = entry.entry_type === 'clock_in' || entry.entry_type === 'break_end' || entry.entry_type === 'break_start';
      wasOnDutyBeforeToday.set(entry.contact_id, wasOnDuty);
    }

    // Ottieni l'ultimo entry di ogni dipendente PRIMA di ieri
    // Serve per calcolare le ore di ieri se erano già in servizio da prima
    const lastEntryBeforeYesterdayResult = await sql`
      SELECT DISTINCT ON (contact_id)
        contact_id,
        entry_type,
        timestamp
      FROM ta_time_entries
      WHERE company_id = ${parseInt(companyId)}
        AND timestamp < ${yesterdayStart.toISOString()}
      ORDER BY contact_id, timestamp DESC
    `;

    // Mappa: contact_id -> true se era in servizio prima di ieri
    const wasOnDutyBeforeYesterday = new Map<number, boolean>();
    for (const entry of lastEntryBeforeYesterdayResult.rows) {
      const wasOnDuty = entry.entry_type === 'clock_in' || entry.entry_type === 'break_end' || entry.entry_type === 'break_start';
      wasOnDutyBeforeYesterday.set(entry.contact_id, wasOnDuty);
    }

    // Ottieni tutte le timbrature del giorno per l'azienda
    const entriesResult = await sql`
      SELECT
        contact_id,
        entry_type,
        timestamp,
        location_name,
        break_type
      FROM ta_time_entries
      WHERE company_id = ${parseInt(companyId)}
        AND timestamp >= ${dayStart.toISOString()}
        AND timestamp <= ${dayEnd.toISOString()}
      ORDER BY timestamp ASC
    `;

    // Timbrature di ieri
    const yesterdayEntriesResult = await sql`
      SELECT contact_id, entry_type, timestamp
      FROM ta_time_entries
      WHERE company_id = ${parseInt(companyId)}
        AND timestamp >= ${yesterdayStart.toISOString()}
        AND timestamp <= ${yesterdayEnd.toISOString()}
      ORDER BY timestamp ASC
    `;

    // Timbrature della settimana
    const weekEntriesResult = await sql`
      SELECT contact_id, entry_type, timestamp
      FROM ta_time_entries
      WHERE company_id = ${parseInt(companyId)}
        AND timestamp >= ${weekStart.toISOString()}
        AND timestamp <= ${dayEnd.toISOString()}
      ORDER BY timestamp ASC
    `;

    // Inizio mese (primo giorno del mese in timezone Rome)
    const romeMonthStr = targetDate.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
    const [romeYear, romeMonth] = romeMonthStr.split('-').map(Number);
    const firstOfMonth = new Date(Date.UTC(romeYear, romeMonth - 1, 1, 12, 0, 0));
    const monthBounds = getRomeDayBounds(firstOfMonth);
    const monthStartDate = monthBounds.start;

    // Timbrature del mese
    const monthEntriesResult = await sql`
      SELECT contact_id, entry_type, timestamp
      FROM ta_time_entries
      WHERE company_id = ${parseInt(companyId)}
        AND timestamp >= ${monthStartDate.toISOString()}
        AND timestamp <= ${dayEnd.toISOString()}
      ORDER BY timestamp ASC
    `;

    // Raggruppa timbrature per dipendente - oggi
    const entriesByContact = new Map<number, typeof entriesResult.rows>();
    for (const entry of entriesResult.rows) {
      if (!entriesByContact.has(entry.contact_id)) {
        entriesByContact.set(entry.contact_id, []);
      }
      entriesByContact.get(entry.contact_id)!.push(entry);
    }

    // Raggruppa timbrature per dipendente - ieri
    const yesterdayByContact = new Map<number, Array<{ entry_type: string; timestamp: string }>>();
    for (const entry of yesterdayEntriesResult.rows) {
      if (!yesterdayByContact.has(entry.contact_id)) {
        yesterdayByContact.set(entry.contact_id, []);
      }
      yesterdayByContact.get(entry.contact_id)!.push({
        entry_type: entry.entry_type as string,
        timestamp: entry.timestamp as string,
      });
    }

    // Raggruppa timbrature per dipendente - settimana
    const weekByContact = new Map<number, Array<{ entry_type: string; timestamp: string }>>();
    for (const entry of weekEntriesResult.rows) {
      if (!weekByContact.has(entry.contact_id)) {
        weekByContact.set(entry.contact_id, []);
      }
      weekByContact.get(entry.contact_id)!.push({
        entry_type: entry.entry_type as string,
        timestamp: entry.timestamp as string,
      });
    }

    // Raggruppa timbrature per dipendente - mese
    const monthByContact = new Map<number, Array<{ entry_type: string; timestamp: string }>>();
    for (const entry of monthEntriesResult.rows) {
      if (!monthByContact.has(entry.contact_id)) {
        monthByContact.set(entry.contact_id, []);
      }
      monthByContact.get(entry.contact_id)!.push({
        entry_type: entry.entry_type as string,
        timestamp: entry.timestamp as string,
      });
    }

    // Calcola stato per ogni dipendente
    const employeeStatuses: EmployeeStatus[] = [];

    // Se abbiamo lista da Odoo, usa quella
    const contactIds = employees.length > 0
      ? employees.map(e => e.id)
      : Array.from(entriesByContact.keys());

    for (const contactId of contactIds) {
      const employee = employees.find(e => e.id === contactId);
      const entries = entriesByContact.get(contactId) || [];
      const yesterdayEntries = yesterdayByContact.get(contactId) || [];
      const weekEntries = weekByContact.get(contactId) || [];
      const monthEntries = monthByContact.get(contactId) || [];

      // Controlla se era già in servizio prima di oggi (clock_in ieri senza clock_out)
      const wasOnDutyBefore = wasOnDutyBeforeToday.get(contactId) || false;
      // Controlla se era già in servizio prima di ieri (per calcolo ore ieri)
      const wasOnDutyBeforeYest = wasOnDutyBeforeYesterday.get(contactId) || false;

      // Calcola stato attuale
      const lastEntry = entries.length > 0 ? entries[entries.length - 1] : null;
      // È in servizio se: ultimo entry oggi è clock_in/break_end, OPPURE era in servizio ieri e non ha fatto clock_out oggi
      const hasClockOutToday = entries.some(e => e.entry_type === 'clock_out');
      const isOnDutyFromToday = lastEntry && (lastEntry.entry_type === 'clock_in' || lastEntry.entry_type === 'break_end');
      const isOnDutyFromYesterday = wasOnDutyBefore && !hasClockOutToday;
      const isOnDuty = isOnDutyFromToday || isOnDutyFromYesterday;
      const isOnBreak = lastEntry?.entry_type === 'break_start';

      // Calcola ore lavorate con helper function
      // Se era in servizio prima di oggi, inizia il conteggio da mezzanotte
      const entriesToday = entries.map(e => ({ entry_type: e.entry_type as string, timestamp: e.timestamp as string }));
      const hoursToday = calculateHoursFromEntries(entriesToday, true, wasOnDutyBefore, dayStart);
      // Per ieri: passa periodEnd (fine giornata ieri) per calcolare ore fino a mezzanotte
      // se clock_in ieri senza clock_out, conta le ore fino a fine giornata ieri
      const hoursYesterday = calculateHoursFromEntries(yesterdayEntries, false, wasOnDutyBeforeYest, yesterdayStart, yesterdayEnd);
      const hoursWeek = calculateHoursFromEntries(weekEntries, true); // week include tutto da lunedì
      const hoursMonth = calculateHoursFromEntries(monthEntries, true); // month include tutto dal 1°

      employeeStatuses.push({
        contact_id: contactId,
        contact_name: employee?.name || `Dipendente ${contactId}`,
        contact_function: employee?.function,
        contact_image: employee?.image_128,
        is_on_duty: Boolean(isOnDuty),
        is_on_break: Boolean(isOnBreak),
        last_entry: lastEntry ? {
          entry_type: lastEntry.entry_type,
          timestamp: lastEntry.timestamp,
          location_name: lastEntry.location_name,
          break_type: lastEntry.break_type,
        } : undefined,
        hours_worked_today: Math.round(hoursToday * 100) / 100,
        hours_worked_yesterday: Math.round(hoursYesterday * 100) / 100,
        hours_worked_week: Math.round(hoursWeek * 100) / 100,
        hours_worked_month: Math.round(hoursMonth * 100) / 100,
        entries_today: entries.length,
      });
    }

    // Ordina: prima in servizio, poi per nome
    employeeStatuses.sort((a, b) => {
      if (a.is_on_duty !== b.is_on_duty) return a.is_on_duty ? -1 : 1;
      return a.contact_name.localeCompare(b.contact_name);
    });

    // Statistiche aggregate
    const onDutyCount = employeeStatuses.filter(e => e.is_on_duty).length;
    const onBreakCount = employeeStatuses.filter(e => e.is_on_break).length;
    const totalHoursToday = employeeStatuses.reduce((sum, e) => sum + e.hours_worked_today, 0);
    const totalHoursYesterday = employeeStatuses.reduce((sum, e) => sum + e.hours_worked_yesterday, 0);
    const totalHoursWeek = employeeStatuses.reduce((sum, e) => sum + e.hours_worked_week, 0);
    const totalHoursMonth = employeeStatuses.reduce((sum, e) => sum + e.hours_worked_month, 0);

    return NextResponse.json({
      success: true,
      data: {
        date: targetDate.toISOString().split('T')[0],
        week_start: weekStart.toISOString().split('T')[0],
        month_start: monthStartDate.toISOString().split('T')[0],
        stats: {
          total_employees: employeeStatuses.length,
          on_duty: onDutyCount,
          on_break: onBreakCount,
          off_duty: employeeStatuses.length - onDutyCount,
          total_hours_today: Math.round(totalHoursToday * 100) / 100,
          total_hours_yesterday: Math.round(totalHoursYesterday * 100) / 100,
          total_hours_week: Math.round(totalHoursWeek * 100) / 100,
          total_hours_month: Math.round(totalHoursMonth * 100) / 100,
        },
        employees: employeeStatuses,
      },
    });

  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore nel caricamento dashboard',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
