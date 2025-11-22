import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

/**
 * GET /api/time-attendance/qr/generate?location_id=xxx
 * Genera i dati per il QR code di una sede
 *
 * Il QR code contiene un URL che include il qr_secret della sede
 * Questo QR va stampato e appeso nella sede fisica
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const locationId = searchParams.get('location_id');

    if (!locationId) {
      return NextResponse.json({
        success: false,
        error: 'location_id richiesto',
      }, { status: 400 });
    }

    // Cerca la sede
    const result = await sql`
      SELECT
        id,
        company_id,
        name,
        address,
        latitude,
        longitude,
        radius_meters,
        qr_secret,
        is_active
      FROM ta_locations
      WHERE id = ${locationId}
    `;

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Sede non trovata',
      }, { status: 404 });
    }

    const location = result.rows[0];

    // Genera URL per il QR code
    // Il QR conterrà questo URL che l'app scansionerà
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app-hub-platform.vercel.app';
    const qrUrl = `${baseUrl}/time-attendance/clock?qr=${location.qr_secret}`;

    // Genera anche un JSON compatto per QR più piccoli
    const qrData = {
      type: 'ta_clock',
      secret: location.qr_secret,
      loc: location.name,
    };

    return NextResponse.json({
      success: true,
      data: {
        location: {
          id: location.id,
          name: location.name,
          address: location.address,
          latitude: parseFloat(location.latitude),
          longitude: parseFloat(location.longitude),
          radius_meters: location.radius_meters,
          is_active: location.is_active,
        },
        qr: {
          // URL completo - può essere usato direttamente
          url: qrUrl,
          // Dati JSON compatti - per QR più piccoli
          json: JSON.stringify(qrData),
          // Solo il secret - minimo indispensabile
          secret: location.qr_secret,
        },
        instructions: [
          '1. Genera il QR code usando uno dei formati sopra',
          '2. Stampa il QR in formato A4 o A5',
          '3. Appendi il QR in un punto visibile della sede',
          '4. I dipendenti scansioneranno questo QR per timbrare',
          `5. Il geofence è impostato a ${location.radius_meters}m dal centro`,
        ],
      },
    });

  } catch (error) {
    console.error('QR Generate error:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore nella generazione QR',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
