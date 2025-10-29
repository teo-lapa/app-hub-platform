/**
 * API Route: /api/supplier-cadence/upcoming
 *
 * Endpoints:
 * - GET: Prossimi ordini pianificati (nei prossimi N giorni)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUpcomingSuppliers } from '@/lib/suppliers/db-queries';

export const dynamic = 'force-dynamic';

// ============================================================================
// GET /api/supplier-cadence/upcoming
// ============================================================================

/**
 * GET: Prossimi ordini pianificati
 *
 * Restituisce fornitori da ordinare nei prossimi N giorni (escluso oggi).
 * Ordinati per next_order_date ASC (più urgenti prima).
 *
 * Query params:
 * - days: number (default: 7, min: 1, max: 365)
 *
 * Response:
 * {
 *   suppliers: CadenceWithMetadata[],
 *   count: number,
 *   filters: {
 *     days: number,
 *     date_from: string,
 *     date_to: string
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const daysParam = searchParams.get('days');
    const days = daysParam ? parseInt(daysParam, 10) : 7;

    // Validate days parameter
    if (isNaN(days) || days < 1 || days > 365) {
      return NextResponse.json(
        {
          error: 'Parametro days non valido',
          details: 'days deve essere un numero tra 1 e 365',
        },
        { status: 400 }
      );
    }

    const suppliers = await getUpcomingSuppliers(days);

    return NextResponse.json(
      {
        suppliers,
        count: suppliers.length,
        days,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('GET /api/supplier-cadence/upcoming error:', error);
    return NextResponse.json(
      {
        error: 'Errore server durante recupero fornitori prossimi',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
