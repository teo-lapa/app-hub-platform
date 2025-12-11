import { NextRequest, NextResponse } from 'next/server';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

export const dynamic = 'force-dynamic';

/**
 * Calcola la distanza tra due punti GPS usando la formula Haversine
 * @returns distanza in metri
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Raggio della Terra in metri
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Formatta la distanza in modo leggibile
 */
function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

/**
 * POST /api/sales-radar/check-in
 *
 * Registra una visita al cliente nel chatter di Odoo
 *
 * Request JSON:
 * {
 *   record_id: number,
 *   record_type: 'partner' | 'lead',
 *   visitor_location: { lat: number, lng: number },
 *   client_location: { lat: number, lng: number },
 *   client_name: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Get Odoo session from cookies
    const sessionId = request.cookies.get('odoo_session_id')?.value;

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Non autenticato - Odoo session non trovata'
      }, { status: 401 });
    }

    const client = createOdooRPCClient(sessionId);

    // 2. Parse request body
    const body = await request.json();
    const { record_id, record_type, visitor_location, client_location, client_name } = body;

    console.log('[Check-in] Request:', { record_id, record_type, client_name });

    if (!record_id || !record_type) {
      return NextResponse.json({
        success: false,
        error: 'record_id e record_type sono obbligatori'
      }, { status: 400 });
    }

    // Validate record_id is a valid number
    const numericRecordId = parseInt(String(record_id), 10);
    if (isNaN(numericRecordId) || numericRecordId <= 0) {
      return NextResponse.json({
        success: false,
        error: `record_id non valido: ${record_id}. Deve essere un numero positivo.`
      }, { status: 400 });
    }

    if (!['partner', 'lead'].includes(record_type)) {
      return NextResponse.json({
        success: false,
        error: 'record_type deve essere "partner" o "lead"'
      }, { status: 400 });
    }

    // 3. Get current user info using getCurrentUser method
    let vendorName = 'Venditore';
    try {
      const currentUser = await client.getCurrentUser();
      if (currentUser?.name) {
        vendorName = currentUser.name;
      }
    } catch (e) {
      console.warn('[Check-in] Could not get current user:', e);
    }

    // 4. Calculate distance if locations provided
    let distanceText = '';
    if (visitor_location?.lat && visitor_location?.lng && client_location?.lat && client_location?.lng) {
      const distanceMeters = calculateDistance(
        visitor_location.lat,
        visitor_location.lng,
        client_location.lat,
        client_location.lng
      );
      distanceText = ` | 📏 ${formatDistance(distanceMeters)} dal cliente`;
    }

    // 5. Format timestamp in Zurich timezone
    const now = new Date();
    const dateStr = now.toLocaleDateString('it-CH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Europe/Zurich'
    });
    const timeStr = now.toLocaleTimeString('it-CH', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Zurich'
    });

    // 6. Create message text (plain text, no complex HTML)
    const gpsText = visitor_location?.lat && visitor_location?.lng
      ? ` | 📍 GPS: ${visitor_location.lat.toFixed(4)}, ${visitor_location.lng.toFixed(4)}`
      : '';

    const messageText = `📍 VISITA REGISTRATA | 📅 ${dateStr} ${timeStr} | 👤 ${vendorName}${gpsText}${distanceText}`;

    // 7. Post to chatter using callKw
    const model = record_type === 'lead' ? 'crm.lead' : 'res.partner';

    console.log('[Check-in] Posting to chatter:', { model, numericRecordId, messageText });

    const messageId = await client.callKw(
      model,
      'message_post',
      [numericRecordId],
      {
        body: messageText,
        message_type: 'comment'
      }
    );

    console.log('[Check-in] Success, message_id:', messageId);

    return NextResponse.json({
      success: true,
      message_id: messageId,
      message: 'Visita registrata con successo'
    });

  } catch (error) {
    console.error('[Check-in] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Errore durante il check-in'
    }, { status: 500 });
  }
}
