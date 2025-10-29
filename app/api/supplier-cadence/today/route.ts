/**
 * API Route: /api/supplier-cadence/today
 *
 * Endpoints:
 * - GET: Fornitori da ordinare oggi (overdue inclusi)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getSuppliersToOrderToday,
  enrichCadenceWithMetadata,
  sortSuppliers,
} from '@/lib/mock-data/supplier-cadence-mock';
import type { CadenceWithMetadata } from '@/lib/types/supplier-cadence';

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
export async function GET(request: NextRequest) {
  try {
    // Fetch suppliers to order today (includes overdue)
    let suppliers = getSuppliersToOrderToday();

    // Enrich with metadata
    const suppliersWithMetadata: CadenceWithMetadata[] = suppliers.map(enrichCadenceWithMetadata);

    // Sort by urgency: overdue first (days_overdue DESC), then by next_order_date ASC
    const sorted = suppliersWithMetadata.sort((a, b) => {
      // Overdue first
      if (a.days_overdue > 0 && b.days_overdue === 0) return -1;
      if (a.days_overdue === 0 && b.days_overdue > 0) return 1;

      // If both overdue, sort by most overdue first
      if (a.days_overdue > 0 && b.days_overdue > 0) {
        return b.days_overdue - a.days_overdue;
      }

      // Otherwise sort by next_order_date
      if (!a.next_order_date) return 1;
      if (!b.next_order_date) return -1;
      return a.next_order_date.localeCompare(b.next_order_date);
    });

    // Calculate summary
    const overdue = sorted.filter(s => s.days_overdue > 0).length;
    const today = sorted.filter(s => s.days_overdue === 0).length;

    return NextResponse.json(
      {
        suppliers: sorted,
        count: sorted.length,
        summary: {
          overdue,
          today,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('GET /api/supplier-cadence/today error:', error);
    return NextResponse.json(
      {
        error: 'Errore server durante recupero fornitori da ordinare oggi',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
