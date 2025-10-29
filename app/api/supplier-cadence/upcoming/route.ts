/**
 * API Route: /api/supplier-cadence/upcoming
 *
 * Endpoints:
 * - GET: Prossimi ordini pianificati (nei prossimi N giorni)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getUpcomingOrders,
  enrichCadenceWithMetadata,
} from '@/lib/mock-data/supplier-cadence-mock';
import {
  upcomingOrdersQuerySchema,
  validateRequestBody,
} from '@/lib/validation/supplier-cadence-schemas';
import type { CadenceWithMetadata } from '@/lib/types/supplier-cadence';

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
    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const queryObj = {
      days: searchParams.get('days') || undefined,
    };

    // Validate query params
    const validation = upcomingOrdersQuerySchema.safeParse(queryObj);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Parametri query non validi',
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const { days } = validation.data;

    // Fetch upcoming orders
    let suppliers = getUpcomingOrders(days);

    // Enrich with metadata
    const suppliersWithMetadata: CadenceWithMetadata[] = suppliers.map(enrichCadenceWithMetadata);

    // Sort by next_order_date ASC (più urgenti prima)
    const sorted = suppliersWithMetadata.sort((a, b) => {
      if (!a.next_order_date) return 1;
      if (!b.next_order_date) return -1;
      return a.next_order_date.localeCompare(b.next_order_date);
    });

    // Calculate date range for response
    const today = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    const dateFrom = today.toISOString().split('T')[0];
    const dateTo = endDate.toISOString().split('T')[0];

    return NextResponse.json(
      {
        suppliers: sorted,
        count: sorted.length,
        filters: {
          days,
          date_from: dateFrom,
          date_to: dateTo,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('GET /api/supplier-cadence/upcoming error:', error);
    return NextResponse.json(
      {
        error: 'Errore server durante recupero ordini pianificati',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
