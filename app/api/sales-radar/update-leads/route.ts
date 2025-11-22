import { NextRequest, NextResponse } from 'next/server';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';
import { getPlaceDetails, PlaceResult } from '@/lib/services/google-places';

export const dynamic = 'force-dynamic';

interface UpdateLeadsRequestBody {
  latitude: number;
  longitude: number;
  radius: number; // in metri
}

interface UpdateLeadsResponse {
  success: boolean;
  updated: number;
  errors: number;
}

// Regex per estrarre place_id dalla descrizione
const PLACE_ID_REGEX = /Google Place ID: ([^\n]+)/;

// Regex per estrarre coordinate dalla descrizione
const COORDINATES_REGEX = /Coordinate: ([-\d.]+),\s*([-\d.]+)/;

/**
 * Calcola distanza tra due punti (Haversine formula)
 */
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Raggio della Terra in metri
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // in metri
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Formatta lo stato del business in italiano
 */
function formatBusinessStatus(status?: string): string {
  const statusMap: Record<string, string> = {
    'OPERATIONAL': 'Operativo',
    'CLOSED_TEMPORARILY': 'Chiuso temporaneamente',
    'CLOSED_PERMANENTLY': 'Chiuso permanentemente'
  };
  return statusMap[status || ''] || status || 'Non disponibile';
}

/**
 * Formatta gli orari di apertura
 */
function formatOpeningHours(openingHours?: PlaceResult['opening_hours']): string {
  if (!openingHours?.weekday_text || openingHours.weekday_text.length === 0) {
    return 'Orari non disponibili';
  }

  return openingHours.weekday_text
    .map(text =>
      text
        .replace('Monday', 'Lun')
        .replace('Tuesday', 'Mar')
        .replace('Wednesday', 'Mer')
        .replace('Thursday', 'Gio')
        .replace('Friday', 'Ven')
        .replace('Saturday', 'Sab')
        .replace('Sunday', 'Dom')
        .replace('Closed', 'Chiuso')
        .replace('Open 24 hours', 'Aperto 24h')
    )
    .join('\n');
}

/**
 * Aggiorna la descrizione con i nuovi dati Google
 */
function updateDescription(
  currentDescription: string,
  placeDetails: PlaceResult
): string {
  // Rimuovi vecchi dati Google dalla descrizione
  let cleanDescription = currentDescription
    .replace(/Rating Google: [^\n]+\n?/g, '')
    .replace(/Stato attivita: [^\n]+\n?/g, '')
    .replace(/Orari apertura:\n[\s\S]*?(?=\n\n|$)/g, '')
    .replace(/Ultimo aggiornamento: [^\n]+\n?/g, '')
    .trim();

  // Aggiungi nuovi dati
  let updatedSection = '\n\n--- Dati Google Places ---';

  if (placeDetails.rating !== undefined) {
    updatedSection += `\nRating Google: ${placeDetails.rating}/5`;
    if (placeDetails.user_ratings_total) {
      updatedSection += ` (${placeDetails.user_ratings_total} recensioni)`;
    }
  }

  if (placeDetails.business_status) {
    updatedSection += `\nStato attivita: ${formatBusinessStatus(placeDetails.business_status)}`;
  }

  if (placeDetails.opening_hours?.weekday_text) {
    updatedSection += `\nOrari apertura:\n${formatOpeningHours(placeDetails.opening_hours)}`;
  }

  // Timestamp aggiornamento
  const now = new Date();
  const timestamp = now.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  updatedSection += `\n\nUltimo aggiornamento: ${timestamp}`;

  return cleanDescription + updatedSection;
}

/**
 * POST /api/sales-radar/update-leads
 *
 * Aggiorna i dati Google Places per i Lead esistenti nell'area specificata
 *
 * Body:
 * - latitude: number (centro dell'area)
 * - longitude: number (centro dell'area)
 * - radius: number (raggio in metri)
 *
 * Risposta:
 * - success: boolean
 * - updated: number (numero lead aggiornati)
 * - errors: number (numero errori)
 */
export async function POST(request: NextRequest) {
  try {
    // Get odoo_session_id from cookies
    const sessionId = request.cookies.get('odoo_session_id')?.value;

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Non autenticato - Odoo session non trovata'
      }, { status: 401 });
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      console.error('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY non configurata');
      return NextResponse.json({
        success: false,
        error: 'Google Maps API Key non configurata'
      }, { status: 500 });
    }

    // Parse request body
    const body: UpdateLeadsRequestBody = await request.json();

    if (typeof body.latitude !== 'number' || typeof body.longitude !== 'number') {
      return NextResponse.json({
        success: false,
        error: 'Latitude e longitude richieste (numeri)'
      }, { status: 400 });
    }

    if (!body.radius || body.radius < 100 || body.radius > 50000) {
      return NextResponse.json({
        success: false,
        error: 'Radius deve essere tra 100 e 50000 metri'
      }, { status: 400 });
    }

    console.log('[UPDATE-LEADS] Avvio aggiornamento lead:', {
      latitude: body.latitude,
      longitude: body.longitude,
      radius: body.radius
    });

    const client = createOdooRPCClient(sessionId);

    // Carica tutti i lead con descrizione (che potrebbero contenere place_id)
    // Non filtriamo per coordinate qui, lo faremo dopo
    const leads = await client.searchRead(
      'crm.lead',
      [
        ['description', '!=', false],
        ['description', 'ilike', 'Google Place ID:']
      ],
      ['id', 'name', 'description'],
      0, // Nessun limite
      'id desc'
    );

    console.log(`[UPDATE-LEADS] Trovati ${leads.length} lead con place_id`);

    // Filtra lead nell'area specificata
    const leadsInArea = leads.filter((lead: any) => {
      const coordMatch = lead.description?.match(COORDINATES_REGEX);
      if (!coordMatch) return false;

      const leadLat = parseFloat(coordMatch[1]);
      const leadLng = parseFloat(coordMatch[2]);

      if (isNaN(leadLat) || isNaN(leadLng)) return false;

      const distance = calculateDistance(
        body.latitude,
        body.longitude,
        leadLat,
        leadLng
      );

      return distance <= body.radius;
    });

    console.log(`[UPDATE-LEADS] ${leadsInArea.length} lead nell'area (raggio ${body.radius}m)`);

    let updated = 0;
    let errors = 0;

    // Aggiorna ogni lead
    for (const lead of leadsInArea) {
      try {
        // Estrai place_id dalla descrizione
        const placeIdMatch = lead.description?.match(PLACE_ID_REGEX);
        if (!placeIdMatch) {
          console.warn(`[UPDATE-LEADS] Lead ${lead.id} senza place_id valido`);
          errors++;
          continue;
        }

        const placeId = placeIdMatch[1].trim();
        console.log(`[UPDATE-LEADS] Aggiornamento lead ${lead.id} (${lead.name}) - place_id: ${placeId}`);

        // Chiama Google Places Details API
        const placeDetails = await getPlaceDetails(
          {
            place_id: placeId,
            fields: [
              'place_id',
              'name',
              'rating',
              'user_ratings_total',
              'opening_hours',
              'business_status'
            ]
          },
          apiKey
        );

        if (!placeDetails) {
          console.warn(`[UPDATE-LEADS] Nessun dettaglio trovato per place_id: ${placeId}`);
          errors++;
          continue;
        }

        // Aggiorna la descrizione con i nuovi dati
        const updatedDescription = updateDescription(
          lead.description || '',
          placeDetails
        );

        // Salva in Odoo
        await client.callKw(
          'crm.lead',
          'write',
          [[lead.id], { description: updatedDescription }]
        );

        console.log(`[UPDATE-LEADS] Lead ${lead.id} aggiornato con successo`);
        updated++;

      } catch (error) {
        console.error(`[UPDATE-LEADS] Errore aggiornamento lead ${lead.id}:`, error);
        errors++;
      }
    }

    console.log(`[UPDATE-LEADS] Completato: ${updated} aggiornati, ${errors} errori`);

    return NextResponse.json({
      success: true,
      updated,
      errors
    } as UpdateLeadsResponse);

  } catch (error) {
    console.error('[UPDATE-LEADS] Errore:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore durante l\'aggiornamento dei lead',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
