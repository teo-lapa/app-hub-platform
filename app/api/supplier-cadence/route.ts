/**
 * API Route: /api/supplier-cadence
 *
 * Endpoints:
 * - GET: Lista tutti i fornitori con cadenze (con filtri e sorting)
 * - POST: Crea nuova cadenza per fornitore
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAllSuppliers,
  createSupplierCadence,
  enrichCadenceWithMetadata,
  filterSuppliers,
  sortSuppliers,
  calculateStatistics,
  calculateNextOrderDate,
} from '@/lib/mock-data/supplier-cadence-mock';
import {
  createCadenceSchema,
  cadenceFiltersSchema,
  validateRequestBody,
} from '@/lib/validation/supplier-cadence-schemas';
import type { CadenceWithMetadata, CadenceStatistics } from '@/lib/types/supplier-cadence';

// ============================================================================
// GET /api/supplier-cadence
// ============================================================================

/**
 * GET: Lista tutti i fornitori con cadenze
 *
 * Query params:
 * - is_active: 'true' | 'false' | undefined (all)
 * - cadence_type: 'fixed_days' | 'weekly' | 'biweekly' | 'monthly'
 * - search: string (ricerca supplier_name)
 * - status: 'on_time' | 'due_soon' | 'overdue' | 'inactive'
 * - sort_by: 'next_order_date' | 'supplier_name' | 'last_order_date'
 * - sort_direction: 'asc' | 'desc'
 *
 * Response:
 * {
 *   suppliers: CadenceWithMetadata[],
 *   stats: CadenceStatistics,
 *   count: number
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const queryObj = {
      is_active: searchParams.get('is_active') || undefined,
      cadence_type: searchParams.get('cadence_type') || undefined,
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined,
      sort_by: searchParams.get('sort_by') || 'next_order_date',
      sort_direction: searchParams.get('sort_direction') || 'asc',
    };

    // Validate filters
    const filtersValidation = cadenceFiltersSchema.safeParse(queryObj);
    if (!filtersValidation.success) {
      return NextResponse.json(
        {
          error: 'Parametri query non validi',
          details: filtersValidation.error.issues,
        },
        { status: 400 }
      );
    }

    const filters = filtersValidation.data;

    // Fetch suppliers
    let suppliers = getAllSuppliers();

    // Apply filters
    suppliers = filterSuppliers(suppliers, {
      is_active: filters.is_active,
      cadence_type: filters.cadence_type,
      search: filters.search,
      status: filters.status,
    });

    // Sort
    suppliers = sortSuppliers(suppliers, filters.sort_by, filters.sort_direction);

    // Enrich with metadata
    const suppliersWithMetadata: CadenceWithMetadata[] = suppliers.map(enrichCadenceWithMetadata);

    // Calculate statistics (on ALL suppliers, not filtered)
    const allSuppliers = getAllSuppliers();
    const stats = calculateStatistics(allSuppliers);

    return NextResponse.json(
      {
        suppliers: suppliersWithMetadata,
        stats,
        count: suppliersWithMetadata.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('GET /api/supplier-cadence error:', error);
    return NextResponse.json(
      {
        error: 'Errore server durante recupero cadenze',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/supplier-cadence
// ============================================================================

/**
 * POST: Crea nuova cadenza per fornitore
 *
 * Body:
 * {
 *   supplier_id: number,
 *   supplier_name: string,
 *   cadence_type: CadenceType,
 *   cadence_value?: number | null,
 *   weekdays?: Weekday[] | null,
 *   next_order_date?: string | null,
 *   average_lead_time_days?: number,
 *   notes?: string | null,
 *   updated_by?: string
 * }
 *
 * Response:
 * {
 *   success: true,
 *   supplier: CadenceWithMetadata
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Parse body
    const body = await request.json();

    // Validate input
    const validation = validateRequestBody(createCadenceSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: validation.error,
          details: validation.details.issues,
        },
        { status: 400 }
      );
    }

    const input = validation.data;

    // Se next_order_date non è fornito, calcolalo
    let nextOrderDate = input.next_order_date;
    if (!nextOrderDate && input.cadence_value && input.cadence_type) {
      const today = new Date().toISOString().split('T')[0];
      nextOrderDate = calculateNextOrderDate(
        today,
        input.cadence_type,
        input.cadence_value,
        input.weekdays || null
      );
    }

    // Create cadence
    const newCadence = createSupplierCadence({
      supplier_id: input.supplier_id,
      supplier_name: input.supplier_name,
      cadence_type: input.cadence_type,
      cadence_value: input.cadence_value || null,
      weekdays: input.weekdays || null,
      is_active: true,
      next_order_date: nextOrderDate || null,
      last_order_date: null,
      average_lead_time_days: input.average_lead_time_days || 0,
      total_orders_last_6m: 0,
      calculated_cadence_days: null,
      notes: input.notes || null,
      updated_by: input.updated_by || null,
    });

    // Enrich with metadata
    const enrichedCadence = enrichCadenceWithMetadata(newCadence);

    return NextResponse.json(
      {
        success: true,
        supplier: enrichedCadence,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/supplier-cadence error:', error);

    // Check if it's a JSON parse error
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          error: 'Body JSON non valido',
          details: error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Errore server durante creazione cadenza',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
