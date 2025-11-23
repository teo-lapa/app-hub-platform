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

// Helper per calcolare ore lavorate da entries
function calculateHoursFromEntries(entries: Array<{ entry_type: string; timestamp: string }>): number {
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

    // Timezone Europe/Rome
    const TIMEZONE = 'Europe/Rome';
    const now = new Date();

    // Calcola offset per ora legale/solare
    const romeOffset = now.toLocaleString('en-US', { timeZone: TIMEZONE, timeZoneName: 'shortOffset' });
    const isDST = romeOffset.includes('+02') || romeOffset.includes('+2');
    const tzOffset = isDST ? '+02:00' : '+01:00';

    // Oggi
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
    const todayStart = new Date(todayStr + 'T00:00:00' + tzOffset);
    const todayEnd = new Date(todayStr + 'T23:59:59.999' + tzOffset);

    // Ieri
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
    const yesterdayStart = new Date(yesterdayStr + 'T00:00:00' + tzOffset);
    const yesterdayEnd = new Date(yesterdayStr + 'T23:59:59.999' + tzOffset);

    // Inizio settimana (lunedì)
    const tempDate = new Date(now);
    const dayOfWeek = tempDate.getDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    tempDate.setDate(tempDate.getDate() - diff);
    const weekStartStr = tempDate.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
    const weekStart = new Date(weekStartStr + 'T00:00:00' + tzOffset);

    // Inizio mese
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStartStr = monthStart.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
    const monthStartDate = new Date(monthStartStr + 'T00:00:00' + tzOffset);

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

    // Query per settimana
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
        AND timestamp >= ${monthStartDate.toISOString()}
        AND timestamp <= ${todayEnd.toISOString()}
      ORDER BY timestamp ASC
    `;

    // Query per giorni lavorati nel mese (per calcolo media)
    const daysWorkedResult = await sql`
      SELECT DISTINCT DATE(timestamp AT TIME ZONE 'Europe/Rome') as work_date
      FROM ta_time_entries
      WHERE contact_id = ${parseInt(contactId)}
        AND timestamp >= ${monthStartDate.toISOString()}
        AND timestamp <= ${todayEnd.toISOString()}
        AND entry_type = 'clock_in'
    `;

    // Calcola ore
    const todayEntries = todayResult.rows.map(r => ({ entry_type: r.entry_type as string, timestamp: r.timestamp as string }));
    const yesterdayEntries = yesterdayResult.rows.map(r => ({ entry_type: r.entry_type as string, timestamp: r.timestamp as string }));
    const weekEntries = weekResult.rows.map(r => ({ entry_type: r.entry_type as string, timestamp: r.timestamp as string }));
    const monthEntries = monthResult.rows.map(r => ({ entry_type: r.entry_type as string, timestamp: r.timestamp as string }));

    const hoursToday = calculateHoursFromEntries(todayEntries);
    const hoursYesterday = calculateHoursFromEntries(yesterdayEntries);
    const hoursWeek = calculateHoursFromEntries(weekEntries);
    const hoursMonth = calculateHoursFromEntries(monthEntries);

    const daysWorkedMonth = daysWorkedResult.rows.length;
    const avgHoursPerDay = daysWorkedMonth > 0 ? hoursMonth / daysWorkedMonth : 0;

    // Ottieni info contatto da Odoo (opzionale)
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
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      if (d > now) break;

      const dateStr = d.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
      const dayStartDate = new Date(dateStr + 'T00:00:00' + tzOffset);
      const dayEndDate = new Date(dateStr + 'T23:59:59.999' + tzOffset);

      const dayEntries = weekEntries.filter(e => {
        const t = new Date(e.timestamp);
        return t >= dayStartDate && t <= dayEndDate;
      });

      const hours = calculateHoursFromEntries(dayEntries);
      const clockIns = dayEntries.filter(e => e.entry_type === 'clock_in');
      const clockOuts = dayEntries.filter(e => e.entry_type === 'clock_out');

      dailyStats.push({
        date: dateStr,
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
