/**
 * API Route: /api/supplier-cadence/today
 *
 * Endpoints:
 * - GET: Fornitori da ordinare oggi (overdue inclusi)
 */

import { NextResponse } from 'next/server';
import { getUrgentSuppliersToday } from '@/lib/suppliers/db-queries';

export const dynamic = 'force-dynamic';

// ============================================================================
// GET /api/supplier-cadence/today
// ============================================================================

/**
 * GET: Fornitori da ordinare oggi
 *
 * Restituisce tutti i fornitori la cui next_order_date è oggi o passata (overdue).
 * Ordinati per urgenza: overdue prima, poi today.
 *
 * Response:
 * {
 *   suppliers: CadenceWithMetadata[],
 *   count: number,
 *   summary: {
 *     overdue: number,
 *     today: number
 *   }
 * }
 */
export async function GET() {
  try {
    const suppliers = await getUrgentSuppliersToday();

    return NextResponse.json(
      {
        suppliers,
        count: suppliers.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('GET /api/supplier-cadence/today error:', error);
    return NextResponse.json(
      {
        error: 'Errore server durante recupero fornitori urgenti',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
