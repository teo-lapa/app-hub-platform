/**
 * API Route: /api/supplier-cadence/[id]
 *
 * Endpoints:
 * - PATCH: Aggiorna cadenza esistente
 * - DELETE: Elimina cadenza (soft delete)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getSupplierById,
  updateSupplier,
  deleteSupplier,
} from '@/lib/suppliers/db-queries';
import {
  updateCadenceSchema,
  validateRequestBody,
} from '@/lib/validation/supplier-cadence-schemas';

// Import enrichment function from main route
function enrichSupplierWithMetadata(supplier: any): any {
  const daysUntil = supplier.days_until_next_order;

  let status: 'on_time' | 'due_soon' | 'overdue' | 'inactive' = 'on_time';
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
    days_until_next_order: daysUntil,
    status,
    urgency,
    is_overdue: daysUntil !== null && daysUntil < 0,
    critical_products_count: supplier.critical_products_count || 0,
  };
}

// ============================================================================
// PATCH /api/supplier-cadence/[id]
// ============================================================================

/**
 * PATCH: Aggiorna cadenza esistente
 *
 * Body (tutti i campi opzionali, ma almeno uno richiesto):
 * {
 *   cadence_type?: CadenceType,
 *   cadence_value?: number,
 *   is_active?: boolean,
 *   notes?: string | null
 * }
 *
 * Response:
 * {
 *   success: true,
 *   supplier: CadenceWithMetadata
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;

    // Check if supplier exists
    const existingSupplier = await getSupplierById(id);
    if (!existingSupplier) {
      return NextResponse.json(
        {
          error: 'Fornitore non trovato',
          details: `Nessun fornitore trovato con ID ${id}`,
        },
        { status: 404 }
      );
    }

    // Parse body
    const body = await request.json();

    // Validate input
    const validation = validateRequestBody(updateCadenceSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: validation.error,
          details: validation.details.issues,
        },
        { status: 400 }
      );
    }

    const updates = validation.data;

    // Update supplier in database
    const updatedSupplier = await updateSupplier(id, {
      cadence_type: updates.cadence_type,
      cadence_value: updates.cadence_value !== undefined ? (updates.cadence_value ?? undefined) : undefined,
      last_cadence_order_date: updates.last_order_date ?? undefined,
      is_active: updates.is_active,
      notes: updates.notes ?? undefined,
    });

    // Enrich with metadata
    const enrichedSupplier = enrichSupplierWithMetadata(updatedSupplier);

    return NextResponse.json(
      {
        success: true,
        supplier: enrichedSupplier,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error(`PATCH /api/supplier-cadence/${params.id} error:`, error);

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

    // Check for not found error
    if (error.message && error.message.includes('not found')) {
      return NextResponse.json(
        {
          error: 'Fornitore non trovato',
          details: error.message,
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: 'Errore server durante aggiornamento cadenza',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/supplier-cadence/[id]
// ============================================================================

/**
 * DELETE: Elimina cadenza (soft delete)
 *
 * Response:
 * {
 *   success: true,
 *   message: string
 * }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;

    // Check if supplier exists
    const existingSupplier = await getSupplierById(id);
    if (!existingSupplier) {
      return NextResponse.json(
        {
          error: 'Fornitore non trovato',
          details: `Nessun fornitore trovato con ID ${id}`,
        },
        { status: 404 }
      );
    }

    // Soft delete supplier
    await deleteSupplier(id);

    return NextResponse.json(
      {
        success: true,
        message: `Cadenza per ${existingSupplier.name} disattivata con successo`,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error(`DELETE /api/supplier-cadence/${params.id} error:`, error);

    // Check for not found error
    if (error.message && error.message.includes('not found')) {
      return NextResponse.json(
        {
          error: 'Fornitore non trovato',
          details: error.message,
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: 'Errore server durante eliminazione cadenza',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
