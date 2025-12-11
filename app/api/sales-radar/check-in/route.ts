import { NextRequest, NextResponse } from 'next/server';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';
import { callOdoo } from '@/lib/odoo-auth';

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

    if (!record_id || !record_type) {
      return NextResponse.json({
        success: false,
        error: 'record_id e record_type sono obbligatori'
      }, { status: 400 });
    }

    if (!['partner', 'lead'].includes(record_type)) {
      return NextResponse.json({
        success: false,
        error: 'record_type deve essere "partner" o "lead"'
      }, { status: 400 });
    }

    // 3. Get current user info
    const userInfo = await client.callKw('res.users', 'search_read', [
      [['id', '=', await client.callKw('res.users', 'search', [[]], { limit: 1 }).then(() => {
        // Get current user ID from session
        return client.callKw('res.users', 'search_read', [[]], {
          fields: ['id', 'name', 'partner_id'],
          limit: 1
        });
      })]],
    ], { fields: ['id', 'name', 'partner_id'] });

    // Simpler approach: get current user directly
    const currentUser = await client.searchRead(
      'res.users',
      [['id', '!=', 0]],
      ['id', 'name', 'partner_id'],
      1
    );

    // Actually get the logged in user via a known working method
    let vendorName = 'Venditore';
    try {
      const sessionInfo = await client.callKw('res.users', 'read', [
        [client.uid || 2],  // fallback to admin if no uid
        ['name']
      ]);
      if (sessionInfo && sessionInfo[0]) {
        vendorName = sessionInfo[0].name;
      }
    } catch {
      // Keep default vendor name
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

    // 5. Format timestamp
    const now = new Date();
    const dateStr = now.toLocaleDateString('it-CH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('it-CH', {
      hour: '2-digit',
      minute: '2-digit'
    });

    // 6. Create message text (plain text, no complex HTML)
    const gpsText = visitor_location?.lat && visitor_location?.lng
      ? ` | 📍 GPS: ${visitor_location.lat.toFixed(4)}, ${visitor_location.lng.toFixed(4)}`
      : '';

    const messageText = `📍 VISITA REGISTRATA | 📅 ${dateStr} ${timeStr} | 👤 ${vendorName}${gpsText}${distanceText}`;

    // 7. Post to chatter
    const model = record_type === 'lead' ? 'crm.lead' : 'res.partner';

    // Build cookies string for callOdoo
    const cookies = `session_id=${sessionId}`;

    const messageId = await callOdoo(
      cookies,
      model,
      'message_post',
      [record_id],
      {
        body: messageText,
        message_type: 'comment'
      }
    );

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
