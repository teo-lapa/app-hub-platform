import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

export const dynamic = 'force-dynamic';

interface DailyStats {
  date: string;
  hours_worked: number;
  entries_count: number;
  first_clock_in?: string;
  last_clock_out?: string;
}

// Helper robusto per calcolare i bounds di un giorno in timezone Rome
const getRomeDayBounds = (refDate: Date) => {
  const TIMEZONE = 'Europe/Rome';
  const romeStr = refDate.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
  const [year, month, day] = romeStr.split('-').map(Number);

  // Determina offset per ora legale
  const testDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const romeTime = testDate.toLocaleString('en-US', { timeZone: TIMEZONE, hour: 'numeric', hour12: false });
  const utcHour = testDate.getUTCHours();
  const romeHour = parseInt(romeTime);
  const offsetHours = romeHour - utcHour;

  const midnightUTC = Date.UTC(year, month - 1, day, 0, 0, 0) - (offsetHours * 60 * 60 * 1000);
  const endOfDayUTC = midnightUTC + (24 * 60 * 60 * 1000) - 1;

  return {
    start: new Date(midnightUTC),
    end: new Date(endOfDayUTC),
    dateStr: romeStr
  };
};

// Helper per calcolare ore lavorate da entries
function calculateHoursFromEntries(
  entries: Array<{ entry_type: string; timestamp: string }>,
  includeOngoing = false,
  wasOnDutyAtStart = false,
  periodStart?: Date
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

  // Se ancora in servizio e includeOngoing è true, aggiungi tempo fino ad ora
  // IMPORTANTE: aggiungi SEMPRE se lastClockIn esiste, anche durante pausa!
  // Il tempo in pausa verrà sottratto dal breakTime sotto
  if (includeOngoing && lastClockIn) {
    workingTime += Date.now() - lastClockIn.getTime();
  }

  // Se in pausa, aggiungi il tempo della pausa corrente al breakTime
  // Questo verrà sottratto dal workingTime nel calcolo finale
  if (includeOngoing && lastBreakStart) {
    breakTime += Date.now() - lastBreakStart.getTime();
  }

  return Math.max(0, (workingTime - breakTime) / 3600000);
}

/**
 * GET /api/time-attendance/employee-stats?contact_id=xxx&company_id=xxx
 * Ottiene statistiche dettagliate per un dipendente (oggi, ieri, settimana, mese)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get('contact_id');
    const companyId = searchParams.get('company_id');

    if (!contactId) {
      return NextResponse.json({
        success: false,
        error: 'contact_id richiesto',
      }, { status: 400 });
    }

    const TIMEZONE = 'Europe/Rome';
    const now = new Date();

    // Calcola bounds per oggi
    const todayBounds = getRomeDayBounds(now);
    const todayStart = todayBounds.start;
    const todayEnd = todayBounds.end;

    // Ieri
    const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayBounds = getRomeDayBounds(yesterdayDate);
    const yesterdayStart = yesterdayBounds.start;
    const yesterdayEnd = yesterdayBounds.end;

    // Inizio settimana (lunedì)
    const romeDayOfWeek = new Date(now.toLocaleDateString('en-CA', { timeZone: TIMEZONE }) + 'T12:00:00Z').getDay();
    const diff = romeDayOfWeek === 0 ? 6 : romeDayOfWeek - 1;
    const mondayDate = new Date(now.getTime() - diff * 24 * 60 * 60 * 1000);
    const weekBounds = getRomeDayBounds(mondayDate);
    const weekStart = weekBounds.start;

    // Inizio mese
    const romeMonthStr = now.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
    const [romeYear, romeMonth] = romeMonthStr.split('-').map(Number);
    const firstOfMonth = new Date(Date.UTC(romeYear, romeMonth - 1, 1, 12, 0, 0));
    const monthBounds = getRomeDayBounds(firstOfMonth);
    const monthStart = monthBounds.start;

    // Log per debug
    console.log('[EmployeeStats] Contact:', contactId);
    console.log('[EmployeeStats] Today:', todayStart.toISOString(), '-', todayEnd.toISOString());
    console.log('[EmployeeStats] Week start:', weekStart.toISOString());
    console.log('[EmployeeStats] Month start:', monthStart.toISOString());

    // Controlla se era in servizio prima di oggi
    const lastEntryBeforeToday = await sql`
      SELECT entry_type, timestamp
      FROM ta_time_entries
      WHERE contact_id = ${parseInt(contactId)}
        AND timestamp < ${todayStart.toISOString()}
      ORDER BY timestamp DESC
      LIMIT 1
    `;
    // Era in servizio se l'ultimo entry prima di oggi era clock_in, break_end, o break_start
    // break_start significa che era in servizio (anche se in pausa)
    const wasOnDutyBeforeToday = lastEntryBeforeToday.rows.length > 0 &&
      (lastEntryBeforeToday.rows[0].entry_type === 'clock_in' ||
       lastEntryBeforeToday.rows[0].entry_type === 'break_end' ||
       lastEntryBeforeToday.rows[0].entry_type === 'break_start');

    // Query per oggi
    const todayResult = await sql`
      SELECT entry_type, timestamp
      FROM ta_time_entries
      WHERE contact_id = ${parseInt(contactId)}
        AND timestamp >= ${todayStart.toISOString()}
        AND timestamp <= ${todayEnd.toISOString()}
      ORDER BY timestamp ASC
    `;

    // Query per ieri
    const yesterdayResult = await sql`
      SELECT entry_type, timestamp
      FROM ta_time_entries
      WHERE contact_id = ${parseInt(contactId)}
        AND timestamp >= ${yesterdayStart.toISOString()}
        AND timestamp <= ${yesterdayEnd.toISOString()}
      ORDER BY timestamp ASC
    `;

    // Query per settimana (include tutto da lunedì)
    const weekResult = await sql`
      SELECT entry_type, timestamp
      FROM ta_time_entries
      WHERE contact_id = ${parseInt(contactId)}
        AND timestamp >= ${weekStart.toISOString()}
        AND timestamp <= ${todayEnd.toISOString()}
      ORDER BY timestamp ASC
    `;

    // Query per mese
    const monthResult = await sql`
      SELECT entry_type, timestamp
      FROM ta_time_entries
      WHERE contact_id = ${parseInt(contactId)}
        AND timestamp >= ${monthStart.toISOString()}
        AND timestamp <= ${todayEnd.toISOString()}
      ORDER BY timestamp ASC
    `;

    // Query per giorni lavorati nel mese
    const daysWorkedResult = await sql`
      SELECT DISTINCT DATE(timestamp AT TIME ZONE 'Europe/Rome') as work_date
      FROM ta_time_entries
      WHERE contact_id = ${parseInt(contactId)}
        AND timestamp >= ${monthStart.toISOString()}
        AND timestamp <= ${todayEnd.toISOString()}
        AND entry_type = 'clock_in'
    `;

    // Query per verificare se era in servizio prima dell'inizio settimana
    const lastEntryBeforeWeek = await sql`
      SELECT entry_type
      FROM ta_time_entries
      WHERE contact_id = ${parseInt(contactId)}
        AND timestamp < ${weekStart.toISOString()}
      ORDER BY timestamp DESC
      LIMIT 1
    `;
    const wasOnDutyBeforeWeek = lastEntryBeforeWeek.rows.length > 0 &&
      (lastEntryBeforeWeek.rows[0].entry_type === 'clock_in' ||
       lastEntryBeforeWeek.rows[0].entry_type === 'break_end' ||
       lastEntryBeforeWeek.rows[0].entry_type === 'break_start');

    // Query per verificare se era in servizio prima dell'inizio mese
    const lastEntryBeforeMonth = await sql`
      SELECT entry_type
      FROM ta_time_entries
      WHERE contact_id = ${parseInt(contactId)}
        AND timestamp < ${monthStart.toISOString()}
      ORDER BY timestamp DESC
      LIMIT 1
    `;
    const wasOnDutyBeforeMonth = lastEntryBeforeMonth.rows.length > 0 &&
      (lastEntryBeforeMonth.rows[0].entry_type === 'clock_in' ||
       lastEntryBeforeMonth.rows[0].entry_type === 'break_end' ||
       lastEntryBeforeMonth.rows[0].entry_type === 'break_start');

    // Log risultati query
    console.log('[EmployeeStats] Today entries:', todayResult.rows.length);
    console.log('[EmployeeStats] Yesterday entries:', yesterdayResult.rows.length);
    console.log('[EmployeeStats] Week entries:', weekResult.rows.length);
    console.log('[EmployeeStats] Month entries:', monthResult.rows.length);
    console.log('[EmployeeStats] Was on duty before today:', wasOnDutyBeforeToday);

    // Calcola ore
    const todayEntries = todayResult.rows.map(r => ({ entry_type: r.entry_type as string, timestamp: r.timestamp as string }));
    const yesterdayEntries = yesterdayResult.rows.map(r => ({ entry_type: r.entry_type as string, timestamp: r.timestamp as string }));
    const weekEntries = weekResult.rows.map(r => ({ entry_type: r.entry_type as string, timestamp: r.timestamp as string }));
    const monthEntries = monthResult.rows.map(r => ({ entry_type: r.entry_type as string, timestamp: r.timestamp as string }));

    // Per oggi, se era in servizio da ieri, inizia da mezzanotte
    const hoursToday = calculateHoursFromEntries(todayEntries, true, wasOnDutyBeforeToday, todayStart);
    const hoursYesterday = calculateHoursFromEntries(yesterdayEntries, false);
    // Per settimana e mese, passa wasOnDutyBefore e il relativo start
    const hoursWeek = calculateHoursFromEntries(weekEntries, true, wasOnDutyBeforeWeek, weekStart);
    const hoursMonth = calculateHoursFromEntries(monthEntries, true, wasOnDutyBeforeMonth, monthStart);

    const daysWorkedMonth = daysWorkedResult.rows.length;
    const avgHoursPerDay = daysWorkedMonth > 0 ? hoursMonth / daysWorkedMonth : 0;

    // Ottieni info contatto da Odoo
    let contactInfo = null;
    try {
      const odoo = createOdooRPCClient();
      const contacts = await odoo.searchRead(
        'res.partner',
        [['id', '=', parseInt(contactId)]],
        ['id', 'name', 'function', 'email', 'phone', 'mobile', 'image_128', 'parent_id'],
        1
      ) as Array<{ id: number; name: string; function?: string; email?: string; phone?: string; mobile?: string; image_128?: string; parent_id?: [number, string] | false }>;

      if (contacts.length > 0) {
        const c = contacts[0];
        contactInfo = {
          id: c.id,
          name: c.name,
          function: c.function,
          email: c.email,
          phone: c.phone || c.mobile,
          image: c.image_128,
          company: c.parent_id ? c.parent_id[1] : null,
        };
      }
    } catch {
      // Ignora errori Odoo
    }

    // Statistiche giornaliere per la settimana
    const dailyStats: DailyStats[] = [];
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(mondayDate.getTime() + i * 24 * 60 * 60 * 1000);
      if (dayDate > now) break;

      const dayBounds = getRomeDayBounds(dayDate);

      // Controlla se era in servizio prima di questo giorno
      const lastEntryBeforeDay = await sql`
        SELECT entry_type
        FROM ta_time_entries
        WHERE contact_id = ${parseInt(contactId)}
          AND timestamp < ${dayBounds.start.toISOString()}
        ORDER BY timestamp DESC
        LIMIT 1
      `;
      const wasOnDutyBeforeDay = lastEntryBeforeDay.rows.length > 0 &&
        (lastEntryBeforeDay.rows[0].entry_type === 'clock_in' || lastEntryBeforeDay.rows[0].entry_type === 'break_end');

      const dayEntries = weekEntries.filter(e => {
        const t = new Date(e.timestamp);
        return t >= dayBounds.start && t <= dayBounds.end;
      });

      // Calcola ore includendo se era in servizio da giorno prima
      const isToday = dayBounds.dateStr === todayBounds.dateStr;
      const hours = calculateHoursFromEntries(dayEntries, isToday, wasOnDutyBeforeDay, dayBounds.start);

      const clockIns = dayEntries.filter(e => e.entry_type === 'clock_in');
      const clockOuts = dayEntries.filter(e => e.entry_type === 'clock_out');

      dailyStats.push({
        date: dayBounds.dateStr,
        hours_worked: Math.round(hours * 100) / 100,
        entries_count: dayEntries.length,
        first_clock_in: clockIns[0]?.timestamp,
        last_clock_out: clockOuts[clockOuts.length - 1]?.timestamp,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        contact: contactInfo,
        stats: {
          today: {
            hours: Math.round(hoursToday * 100) / 100,
            entries: todayResult.rows.length,
          },
          yesterday: {
            hours: Math.round(hoursYesterday * 100) / 100,
            entries: yesterdayResult.rows.length,
          },
          week: {
            hours: Math.round(hoursWeek * 100) / 100,
            entries: weekResult.rows.length,
            days_worked: dailyStats.filter(d => d.hours_worked > 0).length,
          },
          month: {
            hours: Math.round(hoursMonth * 100) / 100,
            entries: monthResult.rows.length,
            days_worked: daysWorkedMonth,
            avg_hours_per_day: Math.round(avgHoursPerDay * 100) / 100,
          },
        },
        daily_breakdown: dailyStats,
      },
    });

  } catch (error) {
    console.error('Employee stats API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore nel caricamento statistiche',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
