import { NextRequest, NextResponse } from 'next/server';
import {
  getOrganizationLocations,
  createWorkLocation,
} from '@/lib/time-attendance/db';
import { TAApiResponse, WorkLocation } from '@/lib/time-attendance/types';

/**
 * GET /api/time-attendance/locations?org_id=xxx
 * Lista sedi dell'organizzazione
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id');

    if (!orgId) {
      return NextResponse.json<TAApiResponse<null>>({
        success: false,
        error: 'org_id richiesto',
      }, { status: 400 });
    }

    const locations = await getOrganizationLocations(orgId);

    return NextResponse.json<TAApiResponse<{
      locations: WorkLocation[];
      total: number;
    }>>({
      success: true,
      data: {
        locations,
        total: locations.length,
      },
    });

  } catch (error) {
    console.error('Get locations error:', error);
    return NextResponse.json<TAApiResponse<null>>({
      success: false,
      error: 'Errore nel recupero sedi',
    }, { status: 500 });
  }
}

/**
 * POST /api/time-attendance/locations
 * Crea nuova sede (solo admin)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      org_id,
      name,
      address,
      latitude,
      longitude,
      radius_meters,
      is_primary,
    } = body;

    // Validazione
    if (!org_id || !name || latitude === undefined || longitude === undefined) {
      return NextResponse.json<TAApiResponse<null>>({
        success: false,
        error: 'org_id, name, latitude e longitude sono obbligatori',
      }, { status: 400 });
    }

    // Validazione coordinate
    if (latitude < -90 || latitude > 90) {
      return NextResponse.json<TAApiResponse<null>>({
        success: false,
        error: 'Latitudine non valida (deve essere tra -90 e 90)',
      }, { status: 400 });
    }

    if (longitude < -180 || longitude > 180) {
      return NextResponse.json<TAApiResponse<null>>({
        success: false,
        error: 'Longitudine non valida (deve essere tra -180 e 180)',
      }, { status: 400 });
    }

    const location = await createWorkLocation({
      org_id,
      name,
      address,
      latitude,
      longitude,
      radius_meters: radius_meters || 100,
      is_primary: is_primary || false,
    });

    return NextResponse.json<TAApiResponse<{ location: WorkLocation }>>({
      success: true,
      data: { location },
      message: `Sede "${name}" creata con successo`,
    });

  } catch (error) {
    console.error('Create location error:', error);
    return NextResponse.json<TAApiResponse<null>>({
      success: false,
      error: 'Errore nella creazione della sede',
    }, { status: 500 });
  }
}
