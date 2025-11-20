import { NextRequest, NextResponse } from 'next/server';
import { searchNearbyPlaces, getPlaceDetails, PlaceLocation } from '@/lib/services/google-places';

export const dynamic = 'force-dynamic';

interface SearchRequestBody {
  location: PlaceLocation;
  radius: number; // in metri
  type?: string;
  keyword?: string;
}

/**
 * POST /api/sales-radar/search
 *
 * Cerca aziende nelle vicinanze usando Google Places API
 *
 * Body:
 * - location: { lat: number, lng: number }
 * - radius: number (metri)
 * - type: string (opzionale) - es: 'restaurant', 'cafe', 'store'
 * - keyword: string (opzionale) - es: 'pizza', 'hotel'
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      console.error('❌ NEXT_PUBLIC_GOOGLE_MAPS_API_KEY non configurata');
      return NextResponse.json({
        success: false,
        error: 'Google Maps API Key non configurata'
      }, { status: 500 });
    }

    // Parse request body
    const body: SearchRequestBody = await request.json();

    if (!body.location || typeof body.location.lat !== 'number' || typeof body.location.lng !== 'number') {
      return NextResponse.json({
        success: false,
        error: 'Location GPS valida richiesta (lat, lng)'
      }, { status: 400 });
    }

    if (!body.radius || body.radius < 100 || body.radius > 50000) {
      return NextResponse.json({
        success: false,
        error: 'Radius deve essere tra 100 e 50000 metri'
      }, { status: 400 });
    }

    console.log('🔍 [SALES-RADAR] Ricerca aziende:', {
      location: body.location,
      radius: body.radius,
      type: body.type,
      keyword: body.keyword
    });

    // Cerca aziende nelle vicinanze
    const places = await searchNearbyPlaces({
      location: body.location,
      radius: body.radius,
      type: body.type,
      keyword: body.keyword
    }, apiKey);

    console.log(`✅ [SALES-RADAR] Trovate ${places.length} aziende`);

    // Per ogni luogo, cerca dettagli completi (telefono, website, etc.)
    const placesWithDetails = await Promise.all(
      places.map(async (place) => {
        try {
          const details = await getPlaceDetails(
            {
              place_id: place.place_id,
              fields: [
                'place_id',
                'name',
                'formatted_address',
                'formatted_phone_number',
                'international_phone_number',
                'website',
                'url',
                'geometry',
                'rating',
                'user_ratings_total',
                'opening_hours',
                'types',
                'business_status',
                'price_level'
              ]
            },
            apiKey
          );

          return {
            place_id: place.place_id,
            name: place.name,
            address: details?.formatted_address || place.vicinity || '',
            phone: details?.formatted_phone_number || '',
            international_phone: details?.international_phone_number || '',
            website: details?.website || '',
            google_maps_url: details?.url || `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
            location: place.geometry.location,
            types: place.types || [],
            rating: place.rating,
            user_ratings_total: place.user_ratings_total,
            opening_hours: details?.opening_hours || place.opening_hours,
            business_status: place.business_status || 'OPERATIONAL',
            price_level: place.price_level
          };
        } catch (error) {
          console.error(`⚠️ Errore dettagli per ${place.name}:`, error);
          // Ritorna dati base se fallisce il recupero dettagli
          return {
            place_id: place.place_id,
            name: place.name,
            address: place.vicinity || '',
            phone: '',
            international_phone: '',
            website: '',
            google_maps_url: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
            location: place.geometry.location,
            types: place.types || [],
            rating: place.rating,
            user_ratings_total: place.user_ratings_total,
            opening_hours: place.opening_hours,
            business_status: place.business_status || 'OPERATIONAL',
            price_level: place.price_level
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      data: placesWithDetails,
      count: placesWithDetails.length,
      search_params: {
        location: body.location,
        radius: body.radius,
        type: body.type,
        keyword: body.keyword
      }
    });

  } catch (error) {
    console.error('❌ [SALES-RADAR] Errore ricerca:', error);

    // Log dettagliato dell'errore per debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error('❌ [SALES-RADAR] Error details:', {
      message: errorMessage,
      stack: errorStack,
      apiKeyPresent: !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
      apiKeyLength: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.length
    });

    return NextResponse.json({
      success: false,
      error: 'Errore durante la ricerca aziende',
      details: errorMessage,
      debug: process.env.NODE_ENV === 'development' ? {
        stack: errorStack,
        apiKeyConfigured: !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      } : undefined
    }, { status: 500 });
  }
}
