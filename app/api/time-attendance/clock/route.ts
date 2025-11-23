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
  location_id?: string;
  location_name?: string;
  break_type?: 'coffee_break' | 'lunch_break';
  break_max_minutes?: number;
}

// Configurazione pause
const BREAK_CONFIG = {
  coffee_break: { maxMinutes: 20, name: 'Pausa Caffè' },
  lunch_break: { maxMinutes: 60, name: 'Pausa Pranzo' },
} as const;

/**
 * Calcola la distanza tra due punti GPS usando la formula di Haversine
 * @returns distanza in metri
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * POST /api/time-attendance/clock
 * Registra una timbratura con validazione QR + GPS geofencing
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contact_id, company_id, entry_type, latitude, longitude, qr_secret, break_type, contact_name } = body;

    if (!contact_id || !entry_type) {
      return NextResponse.json({ success: false, error: 'contact_id e entry_type obbligatori' }, { status: 400 });
    }

    if (!['clock_in', 'clock_out', 'break_start', 'break_end'].includes(entry_type)) {
      return NextResponse.json({ success: false, error: 'entry_type non valido' }, { status: 400 });
    }

    // Per le pause (break_start/break_end), NON serve QR né GPS
    const isBreakAction = entry_type === 'break_start' || entry_type === 'break_end';

    // QR e GPS richiesti SOLO per clock_in e clock_out
    if (!isBreakAction) {
      if (!qr_secret) {
        return NextResponse.json({ success: false, error: 'Scansiona il QR Code della sede', code: 'QR_REQUIRED' }, { status: 400 });
      }

      if (latitude === undefined || longitude === undefined) {
        return NextResponse.json({ success: false, error: 'Attiva la geolocalizzazione', code: 'GPS_REQUIRED' }, { status: 400 });
      }
    }

    // Validazione QR + Geofencing (solo per clock_in/clock_out)
    let loc = null;
    let distance = 0;

    if (!isBreakAction && qr_secret) {
      const locationResult = await sql`
        SELECT id, company_id, name, latitude, longitude, radius_meters
        FROM ta_locations WHERE qr_secret = ${qr_secret} AND is_active = true
      `;

      if (locationResult.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'QR Code non valido', code: 'INVALID_QR' }, { status: 404 });
      }

      loc = locationResult.rows[0];
      const locLat = parseFloat(loc.latitude);
      const locLon = parseFloat(loc.longitude);
      const radius = loc.radius_meters || 100;
      distance = calculateDistance(latitude, longitude, locLat, locLon);

      if (distance > radius) {
        return NextResponse.json({
          success: false,
          error: `Troppo lontano dalla sede "${loc.name}". Distanza: ${Math.round(distance)}m, Max: ${radius}m`,
          code: 'OUT_OF_GEOFENCE',
          data: { distance_meters: Math.round(distance), radius_meters: radius, location_name: loc.name }
        }, { status: 403 });
      }
    }

    const effectiveCompanyId = company_id || loc?.company_id;

    // Verifica ultima timbratura
    const lastResult = await sql`
      SELECT entry_type, break_type, timestamp FROM ta_time_entries WHERE contact_id = ${contact_id} ORDER BY timestamp DESC LIMIT 1
    `;
    const lastEntry = lastResult.rows[0];
    const lastType = lastEntry?.entry_type;

    if (entry_type === 'clock_in' && lastType === 'clock_in') {
      return NextResponse.json({ success: false, error: 'Già timbrato in entrata' }, { status: 400 });
    }
    if (entry_type === 'clock_out' && (!lastType || lastType === 'clock_out')) {
      return NextResponse.json({ success: false, error: 'Non sei timbrato in entrata' }, { status: 400 });
    }
    if (entry_type === 'break_start' && lastType !== 'clock_in' && lastType !== 'break_end') {
      return NextResponse.json({ success: false, error: 'Devi essere in servizio per la pausa' }, { status: 400 });
    }
    if (entry_type === 'break_end' && lastType !== 'break_start') {
      return NextResponse.json({ success: false, error: 'Nessuna pausa in corso' }, { status: 400 });
    }

    // Validazione break_type per break_start
    let breakMaxMinutes: number | null = null;
    let breakTypeName = '';

    if (entry_type === 'break_start') {
      if (!break_type || !['coffee_break', 'lunch_break'].includes(break_type)) {
        return NextResponse.json({ success: false, error: 'Tipo pausa non valido. Scegli Pausa Caffè o Pausa Pranzo.' }, { status: 400 });
      }
      breakMaxMinutes = BREAK_CONFIG[break_type as keyof typeof BREAK_CONFIG].maxMinutes;
      breakTypeName = BREAK_CONFIG[break_type as keyof typeof BREAK_CONFIG].name;
    }

    const timestamp = new Date().toISOString();

    // INSERT diverso per break vs clock
    let result;
    if (isBreakAction) {
      // Per break_end, recupera break_type dalla pausa aperta
      const finalBreakType = entry_type === 'break_end' ? lastEntry?.break_type : break_type;

      result = await sql`
        INSERT INTO ta_time_entries (contact_id, company_id, entry_type, timestamp, latitude, longitude, qr_code_verified, break_type, break_max_minutes, contact_name)
        VALUES (${contact_id}, ${effectiveCompanyId}, ${entry_type}, ${timestamp}, ${latitude || null}, ${longitude || null}, false, ${finalBreakType || null}, ${breakMaxMinutes}, ${contact_name || null})
        RETURNING *
      `;
    } else {
      result = await sql`
        INSERT INTO ta_time_entries (contact_id, company_id, entry_type, timestamp, latitude, longitude, qr_code_verified, location_id, location_name, contact_name)
        VALUES (${contact_id}, ${effectiveCompanyId}, ${entry_type}, ${timestamp}, ${latitude}, ${longitude}, true, ${loc?.id}, ${loc?.name}, ${contact_name || null})
        RETURNING *
      `;
    }

    const messages: Record<string, string> = {
      clock_in: 'Entrata registrata! Buon lavoro!',
      clock_out: 'Uscita registrata! A presto!',
      break_start: `${breakTypeName || 'Pausa'} iniziata! Max ${breakMaxMinutes} minuti.`,
      break_end: 'Pausa terminata. Buon lavoro!',
    };

    return NextResponse.json({
      success: true,
      data: {
        entry: result.rows[0],
        location: loc ? { id: loc.id, name: loc.name, distance_meters: Math.round(distance) } : null,
        break_info: entry_type === 'break_start' ? {
          type: break_type,
          max_minutes: breakMaxMinutes,
          name: breakTypeName,
        } : null,
      },
      message: messages[entry_type],
    });

  } catch (error) {
    console.error('Clock error:', error);
    return NextResponse.json({ success: false, error: 'Errore timbratura', details: error instanceof Error ? error.message : 'Unknown' }, { status: 500 });
  }
}

/**
 * GET /api/time-attendance/clock?contact_id=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get('contact_id');

    if (!contactId) {
      return NextResponse.json({ success: false, error: 'contact_id richiesto' }, { status: 400 });
    }

    const lastResult = await sql`
      SELECT id, entry_type, timestamp, location_name, break_type, break_max_minutes FROM ta_time_entries
      WHERE contact_id = ${parseInt(contactId)} ORDER BY timestamp DESC LIMIT 1
    `;

    // Usa timezone Europe/Rome per calcolare mezzanotte italiana
    const TIMEZONE = 'Europe/Rome';
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: TIMEZONE }); // YYYY-MM-DD in Rome timezone
    const todayStart = new Date(todayStr + 'T00:00:00+01:00'); // Mezzanotte CET (approssimato)

    // Calcola offset corretto per ora legale/solare
    const romeOffset = now.toLocaleString('en-US', { timeZone: TIMEZONE, timeZoneName: 'shortOffset' });
    const isDST = romeOffset.includes('+02') || romeOffset.includes('+2');
    const todayStartRome = new Date(todayStr + (isDST ? 'T00:00:00+02:00' : 'T00:00:00+01:00'));

    const todayResult = await sql`
      SELECT entry_type, timestamp, location_name, break_type, break_max_minutes FROM ta_time_entries
      WHERE contact_id = ${parseInt(contactId)} AND timestamp >= ${todayStartRome.toISOString()}
      ORDER BY timestamp ASC
    `;

    // Controlla se era in servizio prima di oggi (clock_in ieri senza clock_out)
    const lastEntryBeforeToday = await sql`
      SELECT entry_type, timestamp
      FROM ta_time_entries
      WHERE contact_id = ${parseInt(contactId)}
        AND timestamp < ${todayStartRome.toISOString()}
      ORDER BY timestamp DESC
      LIMIT 1
    `;
    const wasOnDutyBeforeToday = lastEntryBeforeToday.rows.length > 0 &&
      (lastEntryBeforeToday.rows[0].entry_type === 'clock_in' ||
       lastEntryBeforeToday.rows[0].entry_type === 'break_end' ||
       lastEntryBeforeToday.rows[0].entry_type === 'break_start');

    let workingTime = 0, breakTime = 0;
    // Se era in servizio prima di oggi, inizia il conteggio da mezzanotte
    let lastClockIn: Date | null = wasOnDutyBeforeToday ? todayStartRome : null;
    let lastBreakStart: Date | null = null;

    for (const e of todayResult.rows) {
      const t = new Date(e.timestamp);
      if (e.entry_type === 'clock_in') lastClockIn = t;
      else if (e.entry_type === 'clock_out' && lastClockIn) {
        workingTime += t.getTime() - lastClockIn.getTime();
        lastClockIn = null;
        lastBreakStart = null; // Reset anche break
      }
      else if (e.entry_type === 'break_start') lastBreakStart = t;
      else if (e.entry_type === 'break_end' && lastBreakStart) {
        breakTime += t.getTime() - lastBreakStart.getTime();
        lastBreakStart = null;
      }
    }

    // Se ancora in servizio, aggiungi tempo fino ad ora (anche durante pausa)
    if (lastClockIn) workingTime += Date.now() - lastClockIn.getTime();
    // Se in pausa, aggiungi tempo pausa corrente
    if (lastBreakStart) breakTime += Date.now() - lastBreakStart.getTime();
    const hoursWorkedToday = Math.max(0, (workingTime - breakTime) / 3600000);

    const last = lastResult.rows[0];
    const isOnBreak = last?.entry_type === 'break_start';

    // Calcola info pausa attiva
    let activeBreakInfo = null;
    if (isOnBreak && last) {
      const breakStartTime = new Date(last.timestamp);
      const breakElapsedMs = Date.now() - breakStartTime.getTime();
      const breakElapsedMinutes = Math.floor(breakElapsedMs / 60000);
      const maxMinutes = last.break_max_minutes || (last.break_type === 'coffee_break' ? 20 : 60);
      const isExceeded = breakElapsedMinutes >= maxMinutes;
      const effectiveElapsed = isExceeded ? maxMinutes : breakElapsedMinutes;

      activeBreakInfo = {
        type: last.break_type,
        name: last.break_type === 'coffee_break' ? 'Pausa Caffè' : 'Pausa Pranzo',
        started_at: last.timestamp,
        max_minutes: maxMinutes,
        elapsed_minutes: effectiveElapsed,
        is_exceeded: isExceeded,
        exceeded_by_minutes: isExceeded ? breakElapsedMinutes - maxMinutes : 0,
      };
    }

    // Calcola is_on_duty considerando anche clock_in da ieri
    const hasClockOutToday = todayResult.rows.some((e) => e.entry_type === 'clock_out');
    const isOnDutyFromToday = last && (last.entry_type === 'clock_in' || last.entry_type === 'break_end' || last.entry_type === 'break_start');
    const isOnDutyFromYesterday = wasOnDutyBeforeToday && !hasClockOutToday;
    const isOnDuty = isOnDutyFromToday || isOnDutyFromYesterday;

    return NextResponse.json({
      success: true,
      data: {
        last_entry: last || null,
        is_on_duty: isOnDuty,
        is_on_break: isOnBreak,
        active_break: activeBreakInfo,
        hours_worked_today: Math.round(hoursWorkedToday * 100) / 100,
        entries_today: todayResult.rows,
      },
    });
  } catch (error) {
    console.error('Get clock error:', error);
    return NextResponse.json({ success: false, error: 'Errore recupero stato' }, { status: 500 });
  }
}
