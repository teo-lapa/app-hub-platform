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
  entries_today: number;
}

// Helper per calcolare ore lavorate da entries
function calculateHoursFromEntries(entries: Array<{ entry_type: string; timestamp: string }>, includeOngoing = false): number {
  let workingTime = 0;
  let breakTime = 0;
  let lastClockIn: Date | null = null;
  let lastBreakStart: Date | null = null;

  for (const entry of entries) {
    const entryTime = new Date(entry.timestamp);
    switch (entry.entry_type) {
      case 'clock_in':
        lastClockIn = entryTime;
        break;
      case 'clock_out':
        if (lastClockIn) {
          workingTime += entryTime.getTime() - lastClockIn.getTime();
          lastClockIn = null;
        }
        break;
      case 'break_start':
        lastBreakStart = entryTime;
        break;
      case 'break_end':
        if (lastBreakStart) {
          breakTime += entryTime.getTime() - lastBreakStart.getTime();
          lastBreakStart = null;
        }
        break;
    }
  }

  // Se ancora in servizio e includeOngoing è true, aggiungi tempo fino ad ora
  if (includeOngoing && lastClockIn) {
    workingTime += Date.now() - lastClockIn.getTime();
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

    // Helper per ottenere data locale corretta
    const getLocalDateBounds = (date: Date) => {
      // Ottieni la data in formato Europe/Rome
      const localDateStr = date.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
      // Crea date start/end per quel giorno in UTC che corrispondono a mezzanotte Rome
      const dayStart = new Date(localDateStr + 'T00:00:00');
      const dayEnd = new Date(localDateStr + 'T23:59:59.999');
      // Correggi per offset Rome (UTC+1 o UTC+2)
      const offsetMs = dayStart.getTimezoneOffset() * 60 * 1000;
      // Per l'Italia, mezzanotte locale è 23:00 UTC (inverno) o 22:00 UTC (estate)
      return {
        start: new Date(dayStart.getTime() - offsetMs + (1 * 60 * 60 * 1000)), // +1 per CET base
        end: new Date(dayEnd.getTime() - offsetMs + (1 * 60 * 60 * 1000))
      };
    };

    // Data di riferimento
    const targetDate = dateStr ? new Date(dateStr + 'T12:00:00') : new Date();

    // Calcola bounds per oggi
    const todayStr = targetDate.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
    const dayStart = new Date(todayStr + 'T00:00:00+01:00'); // CET
    const dayEnd = new Date(todayStr + 'T23:59:59.999+01:00');

    // Ieri
    const yesterdayDate = new Date(targetDate);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
    const yesterdayStart = new Date(yesterdayStr + 'T00:00:00+01:00');
    const yesterdayEnd = new Date(yesterdayStr + 'T23:59:59.999+01:00');

    // Inizio settimana (lunedì)
    const tempDate = new Date(targetDate);
    const dayOfWeek = tempDate.getDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Lunedì = 0
    tempDate.setDate(tempDate.getDate() - diff);
    const weekStartStr = tempDate.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
    const weekStart = new Date(weekStartStr + 'T00:00:00+01:00');

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

      // Calcola stato attuale
      const lastEntry = entries.length > 0 ? entries[entries.length - 1] : null;
      const isOnDuty = lastEntry && (lastEntry.entry_type === 'clock_in' || lastEntry.entry_type === 'break_end');
      const isOnBreak = lastEntry?.entry_type === 'break_start';

      // Calcola ore lavorate con helper function
      const entriesToday = entries.map(e => ({ entry_type: e.entry_type as string, timestamp: e.timestamp as string }));
      const hoursToday = calculateHoursFromEntries(entriesToday, true); // include ongoing
      const hoursYesterday = calculateHoursFromEntries(yesterdayEntries, false);
      const hoursWeek = calculateHoursFromEntries(weekEntries, true); // include ongoing per oggi

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

    return NextResponse.json({
      success: true,
      data: {
        date: targetDate.toISOString().split('T')[0],
        week_start: weekStart.toISOString().split('T')[0],
        stats: {
          total_employees: employeeStatuses.length,
          on_duty: onDutyCount,
          on_break: onBreakCount,
          off_duty: employeeStatuses.length - onDutyCount,
          total_hours_today: Math.round(totalHoursToday * 100) / 100,
          total_hours_yesterday: Math.round(totalHoursYesterday * 100) / 100,
          total_hours_week: Math.round(totalHoursWeek * 100) / 100,
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
