import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

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
  const R = 6371000; // Raggio della Terra in metri
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
 * POST /api/time-attendance/qr/validate
 * Valida un QR code e la posizione GPS del dipendente
 *
 * Body:
 * - qr_secret: Il codice segreto del QR scansionato
 * - latitude: Latitudine GPS del dispositivo
 * - longitude: Longitudine GPS del dispositivo
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { qr_secret, latitude, longitude } = body;

    // Validazione input
    if (!qr_secret) {
      return NextResponse.json({
        success: false,
        error: 'QR code richiesto',
        code: 'QR_REQUIRED',
      }, { status: 400 });
    }

    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json({
        success: false,
        error: 'Posizione GPS richiesta',
        code: 'GPS_REQUIRED',
      }, { status: 400 });
    }

    // Cerca la sede con questo QR secret
    const result = await sql`
      SELECT
        id,
        company_id,
        name,
        address,
        latitude,
        longitude,
        radius_meters,
        is_active
      FROM ta_locations
      WHERE qr_secret = ${qr_secret}
        AND is_active = true
    `;

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'QR code non valido o sede non attiva',
        code: 'INVALID_QR',
      }, { status: 404 });
    }

    const location = result.rows[0];
    const locationLat = parseFloat(location.latitude);
    const locationLon = parseFloat(location.longitude);
    const radiusMeters = location.radius_meters || 100;

    // Calcola la distanza tra il dispositivo e la sede
    const distance = calculateDistance(
      latitude,
      longitude,
      locationLat,
      locationLon
    );

    const isWithinGeofence = distance <= radiusMeters;

    if (!isWithinGeofence) {
      return NextResponse.json({
        success: false,
        error: `Sei troppo lontano dalla sede. Distanza: ${Math.round(distance)}m, Raggio consentito: ${radiusMeters}m`,
        code: 'OUT_OF_GEOFENCE',
        data: {
          location_id: location.id,
          location_name: location.name,
          distance_meters: Math.round(distance),
          radius_meters: radiusMeters,
          within_geofence: false,
        },
      }, { status: 403 });
    }

    // Validazione OK!
    return NextResponse.json({
      success: true,
      message: 'Posizione verificata',
      data: {
        location_id: location.id,
        location_name: location.name,
        company_id: location.company_id,
        address: location.address,
        distance_meters: Math.round(distance),
        radius_meters: radiusMeters,
        within_geofence: true,
      },
    });

  } catch (error) {
    console.error('QR Validate error:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore nella validazione',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
