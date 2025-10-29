/**
 * API Route: /api/supplier-cadence/[id]
 *
 * Endpoints:
 * - PUT: Aggiorna cadenza esistente
 * - DELETE: Elimina cadenza
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getSupplierById,
  updateSupplierCadence,
  deleteSupplierCadence,
  enrichCadenceWithMetadata,
  calculateNextOrderDate,
} from '@/lib/mock-data/supplier-cadence-mock';
import {
  updateCadenceSchema,
  validateRequestBody,
} from '@/lib/validation/supplier-cadence-schemas';

// ============================================================================
// PUT /api/supplier-cadence/[id]
// ============================================================================

/**
 * PUT: Aggiorna cadenza esistente
 *
 * Body (tutti i campi opzionali, ma almeno uno richiesto):
 * {
 *   cadence_type?: CadenceType,
 *   cadence_value?: number | null,
 *   weekdays?: Weekday[] | null,
 *   is_active?: boolean,
 *   next_order_date?: string | null,
 *   last_order_date?: string | null,
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
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10);

    // Validate ID
    if (isNaN(id) || id < 1) {
      return NextResponse.json(
        {
          error: 'ID non valido',
          details: 'L\'ID deve essere un numero positivo',
        },
        { status: 400 }
      );
    }

    // Check if cadence exists
    const existingCadence = getSupplierById(id);
    if (!existingCadence) {
      return NextResponse.json(
        {
          error: 'Cadenza non trovata',
          details: `Nessuna cadenza trovata con ID ${id}`,
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

    // Se viene aggiornata la cadenza ma non next_order_date, ricalcolalo
    if (
      (updates.cadence_type || updates.cadence_value || updates.weekdays) &&
      !updates.next_order_date
    ) {
      const cadenceType = updates.cadence_type || existingCadence.cadence_type;
      const cadenceValue = updates.cadence_value !== undefined
        ? updates.cadence_value
        : existingCadence.cadence_value;
      const weekdays = updates.weekdays !== undefined
        ? updates.weekdays
        : existingCadence.weekdays;
      const lastOrderDate = updates.last_order_date || existingCadence.last_order_date;

      if (lastOrderDate) {
        updates.next_order_date = calculateNextOrderDate(
          lastOrderDate,
          cadenceType,
          cadenceValue,
          weekdays
        );
      }
    }

    // Update cadence
    const updatedCadence = updateSupplierCadence(id, updates);

    if (!updatedCadence) {
      // Should not happen (already checked above), but safety check
      return NextResponse.json(
        {
          error: 'Errore aggiornamento cadenza',
          details: 'Cadenza non trovata durante aggiornamento',
        },
        { status: 404 }
      );
    }

    // Enrich with metadata
    const enrichedCadence = enrichCadenceWithMetadata(updatedCadence);

    return NextResponse.json(
      {
        success: true,
        supplier: enrichedCadence,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`PUT /api/supplier-cadence/${params.id} error:`, error);

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
 * DELETE: Elimina cadenza
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
    const id = parseInt(params.id, 10);

    // Validate ID
    if (isNaN(id) || id < 1) {
      return NextResponse.json(
        {
          error: 'ID non valido',
          details: 'L\'ID deve essere un numero positivo',
        },
        { status: 400 }
      );
    }

    // Check if cadence exists
    const existingCadence = getSupplierById(id);
    if (!existingCadence) {
      return NextResponse.json(
        {
          error: 'Cadenza non trovata',
          details: `Nessuna cadenza trovata con ID ${id}`,
        },
        { status: 404 }
      );
    }

    // Delete cadence
    const deleted = deleteSupplierCadence(id);

    if (!deleted) {
      // Should not happen (already checked above), but safety check
      return NextResponse.json(
        {
          error: 'Errore eliminazione cadenza',
          details: 'Impossibile eliminare la cadenza',
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: `Cadenza per ${existingCadence.supplier_name} eliminata con successo`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`DELETE /api/supplier-cadence/${params.id} error:`, error);

    return NextResponse.json(
      {
        error: 'Errore server durante eliminazione cadenza',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
