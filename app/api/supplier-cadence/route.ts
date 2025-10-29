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
  createSupplier,
  getStatistics,
} from '@/lib/suppliers/db-queries';
import {
  createCadenceSchema,
  cadenceFiltersSchema,
  validateRequestBody,
} from '@/lib/validation/supplier-cadence-schemas';
import type { CadenceWithMetadata, CadenceStatistics, CadenceStatus } from '@/lib/types/supplier-cadence';

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

    // Fetch suppliers from database with filters
    const suppliers = await getAllSuppliers({
      is_active: filters.is_active,
      cadence_type: filters.cadence_type as any,
      search: filters.search,
      status: filters.status as CadenceStatus,
      sort_by: filters.sort_by as any,
      sort_direction: filters.sort_direction as any,
    });

    // Enrich with metadata
    const suppliersWithMetadata: CadenceWithMetadata[] = suppliers.map(enrichSupplierWithMetadata);

    // Calculate statistics
    const stats = await getStatistics();

    return NextResponse.json(
      {
        suppliers: suppliersWithMetadata,
        stats: {
          total_active: Number(stats.total_active) || 0,
          total_inactive: Number(stats.total_inactive) || 0,
          urgent_today: Number(stats.urgent_today) || 0,
          due_tomorrow: Number(stats.due_tomorrow) || 0,
          due_this_week: Number(stats.due_this_week) || 0,
          overdue: Number(stats.overdue) || 0,
          avg_cadence_days: Math.round(Number(stats.avg_cadence_days) || 7),
          avg_reliability_score: Math.round(Number(stats.avg_reliability_score) || 80),
        },
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

// Helper function to enrich supplier with metadata
function enrichSupplierWithMetadata(supplier: any): CadenceWithMetadata {
  const daysUntil = supplier.days_until_next_order;

  let status: CadenceStatus = 'on_time';
  if (!supplier.is_active) {
    status = 'inactive';
  } else if (daysUntil !== null) {
    if (daysUntil < 0) status = 'overdue';
    else if (daysUntil <= 3) status = 'due_soon';
    else status = 'on_time';
  }

  let urgency: 'low' | 'medium' | 'high' | 'critical' = 'low';
  if (daysUntil !== null) {
    if (daysUntil < 0) urgency = 'critical';
    else if (daysUntil === 0) urgency = 'critical';
    else if (daysUntil === 1) urgency = 'high';
    else if (daysUntil <= 3) urgency = 'medium';
    else urgency = 'low';
  }

  // Calculate days_since_last_order
  let daysSinceLastOrder: number | null = null;
  if (supplier.last_order_date) {
    const lastOrderDate = new Date(supplier.last_order_date);
    const today = new Date();
    const diffTime = today.getTime() - lastOrderDate.getTime();
    daysSinceLastOrder = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  // Calculate days_overdue
  const daysOverdue = (daysUntil !== null && daysUntil < 0) ? Math.abs(daysUntil) : 0;

  return {
    id: supplier.id,
    supplier_id: supplier.odoo_supplier_id,
    supplier_name: supplier.name,
    cadence_type: supplier.cadence_type,
    cadence_value: supplier.cadence_value,
    weekdays: null,
    is_active: supplier.is_active,
    next_order_date: supplier.next_order_date ? new Date(supplier.next_order_date).toISOString().split('T')[0] : null,
    last_order_date: supplier.last_order_date ? new Date(supplier.last_order_date).toISOString().split('T')[0] : null,
    average_lead_time_days: supplier.average_lead_time_days,
    total_orders_last_6m: supplier.total_orders,
    calculated_cadence_days: supplier.cadence_value,
    notes: supplier.notes,
    created_at: supplier.created_at,
    updated_at: supplier.updated_at,
    updated_by: null,
    days_since_last_order: daysSinceLastOrder,
    days_until_next_order: daysUntil,
    days_overdue: daysOverdue,
    status,
    urgency,
    is_overdue: daysUntil !== null && daysUntil < 0,
    critical_products_count: supplier.critical_products_count || 0,
  };
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

    // Create supplier in database
    const newSupplier = await createSupplier({
      odoo_supplier_id: input.supplier_id,
      name: input.supplier_name,
      cadence_type: input.cadence_type,
      cadence_value: input.cadence_value || 7,
      average_lead_time_days: input.average_lead_time_days || 3,
      last_cadence_order_date: new Date().toISOString().split('T')[0], // Start from today
      notes: input.notes || null,
    });

    // Enrich with metadata
    const enrichedSupplier = enrichSupplierWithMetadata(newSupplier);

    return NextResponse.json(
      {
        success: true,
        supplier: enrichedSupplier,
      },
      { status: 201 }
    );
  } catch (error: any) {
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

    // Check if supplier already exists
    if (error.message && error.message.includes('already exists')) {
      return NextResponse.json(
        {
          error: 'Fornitore già esistente',
          details: error.message,
        },
        { status: 409 }
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
