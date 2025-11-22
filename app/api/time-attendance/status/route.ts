import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

interface TimeEntry {
  id: string;
  contact_id: number;
  company_id: number;
  entry_type: 'clock_in' | 'clock_out' | 'break_start' | 'break_end';
  timestamp: string;
  latitude?: number;
  longitude?: number;
  qr_code_verified: boolean;
  location_name?: string;
}

interface ClockStatus {
  is_on_duty: boolean;
  last_entry: TimeEntry | null;
  today_entries: TimeEntry[];
  hours_worked_today: number;
  first_clock_in_today: string | null;
}

/**
 * GET /api/time-attendance/status?contact_id=xxx
 * Ritorna lo stato attuale della timbratura per un contatto
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get('contact_id');

    if (!contactId) {
      return NextResponse.json({
        success: false,
        error: 'contact_id richiesto',
      }, { status: 400 });
    }

    const contactIdNum = parseInt(contactId, 10);

    // Ottieni tutti gli entry di oggi per questo contatto
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    let todayEntries: TimeEntry[] = [];
    let lastEntry: TimeEntry | null = null;

    try {
      // Query per gli entry di oggi
      const todayResult = await sql`
        SELECT
          id,
          contact_id,
          company_id,
          entry_type,
          timestamp,
          latitude,
          longitude,
          qr_code_verified,
          location_name
        FROM ta_time_entries
        WHERE contact_id = ${contactIdNum}
          AND timestamp >= ${todayStart.toISOString()}
          AND timestamp <= ${todayEnd.toISOString()}
        ORDER BY timestamp ASC
      `;

      todayEntries = todayResult.rows.map(row => ({
        id: row.id,
        contact_id: row.contact_id,
        company_id: row.company_id,
        entry_type: row.entry_type,
        timestamp: row.timestamp,
        latitude: row.latitude,
        longitude: row.longitude,
        qr_code_verified: row.qr_code_verified,
        location_name: row.location_name,
      }));

      // Query per l'ultimo entry
      const lastResult = await sql`
        SELECT
          id,
          contact_id,
          company_id,
          entry_type,
          timestamp,
          latitude,
          longitude,
          qr_code_verified,
          location_name
        FROM ta_time_entries
        WHERE contact_id = ${contactIdNum}
        ORDER BY timestamp DESC
        LIMIT 1
      `;

      if (lastResult.rows.length > 0) {
        const row = lastResult.rows[0];
        lastEntry = {
          id: row.id,
          contact_id: row.contact_id,
          company_id: row.company_id,
          entry_type: row.entry_type,
          timestamp: row.timestamp,
          latitude: row.latitude,
          longitude: row.longitude,
          qr_code_verified: row.qr_code_verified,
          location_name: row.location_name,
        };
      }
    } catch (dbError) {
      // Database non disponibile - usa dati vuoti
      console.warn('Database non disponibile, ritorno dati vuoti:', dbError);
    }

    // Calcola se è in servizio
    const isOnDuty = lastEntry?.entry_type === 'clock_in' || lastEntry?.entry_type === 'break_end';

    // Calcola ore lavorate oggi
    let hoursWorkedToday = 0;
    let firstClockInToday: string | null = null;

    if (todayEntries.length > 0) {
      // Trova il primo clock_in di oggi
      const firstClockIn = todayEntries.find(e => e.entry_type === 'clock_in');
      if (firstClockIn) {
        firstClockInToday = firstClockIn.timestamp;
      }

      // Calcola ore lavorate (escludendo le pause)
      let workingTime = 0;
      let breakTime = 0;
      let lastClockIn: Date | null = null;
      let lastBreakStart: Date | null = null;

      for (const entry of todayEntries) {
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

      // Se ancora in servizio, aggiungi tempo fino ad ora
      if (lastClockIn && isOnDuty) {
        workingTime += new Date().getTime() - lastClockIn.getTime();
      }

      // Sottrai pause
      const netWorkingTime = workingTime - breakTime;
      hoursWorkedToday = Math.max(0, netWorkingTime / (1000 * 60 * 60));
    }

    const status: ClockStatus = {
      is_on_duty: isOnDuty,
      last_entry: lastEntry,
      today_entries: todayEntries,
      hours_worked_today: Math.round(hoursWorkedToday * 100) / 100,
      first_clock_in_today: firstClockInToday,
    };

    return NextResponse.json({
      success: true,
      data: status,
    });

  } catch (error) {
    console.error('Status API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore nel recupero stato timbratura',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
