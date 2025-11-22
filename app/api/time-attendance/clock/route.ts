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
}

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
    const { contact_id, company_id, entry_type, latitude, longitude, qr_secret } = body;

    if (!contact_id || !entry_type) {
      return NextResponse.json({ success: false, error: 'contact_id e entry_type obbligatori' }, { status: 400 });
    }

    if (!['clock_in', 'clock_out', 'break_start', 'break_end'].includes(entry_type)) {
      return NextResponse.json({ success: false, error: 'entry_type non valido' }, { status: 400 });
    }

    if (!qr_secret) {
      return NextResponse.json({ success: false, error: 'Scansiona il QR Code della sede', code: 'QR_REQUIRED' }, { status: 400 });
    }

    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json({ success: false, error: 'Attiva la geolocalizzazione', code: 'GPS_REQUIRED' }, { status: 400 });
    }

    // Validazione QR + Geofencing
    const locationResult = await sql`
      SELECT id, company_id, name, latitude, longitude, radius_meters
      FROM ta_locations WHERE qr_secret = ${qr_secret} AND is_active = true
    `;

    if (locationResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'QR Code non valido', code: 'INVALID_QR' }, { status: 404 });
    }

    const loc = locationResult.rows[0];
    const locLat = parseFloat(loc.latitude);
    const locLon = parseFloat(loc.longitude);
    const radius = loc.radius_meters || 100;
    const distance = calculateDistance(latitude, longitude, locLat, locLon);

    if (distance > radius) {
      return NextResponse.json({
        success: false,
        error: `Troppo lontano dalla sede "${loc.name}". Distanza: ${Math.round(distance)}m, Max: ${radius}m`,
        code: 'OUT_OF_GEOFENCE',
        data: { distance_meters: Math.round(distance), radius_meters: radius, location_name: loc.name }
      }, { status: 403 });
    }

    const effectiveCompanyId = company_id || loc.company_id;

    // Verifica ultima timbratura
    const lastResult = await sql`
      SELECT entry_type FROM ta_time_entries WHERE contact_id = ${contact_id} ORDER BY timestamp DESC LIMIT 1
    `;
    const lastType = lastResult.rows[0]?.entry_type;

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

    const timestamp = new Date().toISOString();
    const result = await sql`
      INSERT INTO ta_time_entries (contact_id, company_id, entry_type, timestamp, latitude, longitude, qr_code_verified, location_id, location_name)
      VALUES (${contact_id}, ${effectiveCompanyId}, ${entry_type}, ${timestamp}, ${latitude}, ${longitude}, true, ${loc.id}, ${loc.name})
      RETURNING *
    `;

    const messages: Record<string, string> = {
      clock_in: 'Entrata registrata! Buon lavoro!',
      clock_out: 'Uscita registrata! A presto!',
      break_start: 'Inizio pausa registrato.',
      break_end: 'Fine pausa registrata.',
    };

    return NextResponse.json({
      success: true,
      data: {
        entry: result.rows[0],
        location: { id: loc.id, name: loc.name, distance_meters: Math.round(distance) }
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
      SELECT id, entry_type, timestamp, location_name FROM ta_time_entries
      WHERE contact_id = ${parseInt(contactId)} ORDER BY timestamp DESC LIMIT 1
    `;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayResult = await sql`
      SELECT entry_type, timestamp, location_name FROM ta_time_entries
      WHERE contact_id = ${parseInt(contactId)} AND timestamp >= ${todayStart.toISOString()}
      ORDER BY timestamp ASC
    `;

    let workingTime = 0, breakTime = 0;
    let lastClockIn: Date | null = null, lastBreakStart: Date | null = null;

    for (const e of todayResult.rows) {
      const t = new Date(e.timestamp);
      if (e.entry_type === 'clock_in') lastClockIn = t;
      else if (e.entry_type === 'clock_out' && lastClockIn) { workingTime += t.getTime() - lastClockIn.getTime(); lastClockIn = null; }
      else if (e.entry_type === 'break_start') lastBreakStart = t;
      else if (e.entry_type === 'break_end' && lastBreakStart) { breakTime += t.getTime() - lastBreakStart.getTime(); lastBreakStart = null; }
    }

    if (lastClockIn) workingTime += Date.now() - lastClockIn.getTime();
    const hoursWorkedToday = Math.max(0, (workingTime - breakTime) / 3600000);

    const last = lastResult.rows[0];
    return NextResponse.json({
      success: true,
      data: {
        last_entry: last || null,
        is_on_duty: last && (last.entry_type === 'clock_in' || last.entry_type === 'break_end'),
        is_on_break: last?.entry_type === 'break_start',
        hours_worked_today: Math.round(hoursWorkedToday * 100) / 100,
        entries_today: todayResult.rows,
      },
    });
  } catch (error) {
    console.error('Get clock error:', error);
    return NextResponse.json({ success: false, error: 'Errore recupero stato' }, { status: 500 });
  }
}
