/**
 * API Route: Supplier Order Cadence
 *
 * ESEMPIO di implementazione API per gestione cadenze ordini fornitori.
 * Rinominare in route.ts per attivare.
 *
 * Endpoints:
 * - GET /api/supplier-cadence?supplier_id=123  -> Ottieni cadenza per fornitore
 * - GET /api/supplier-cadence                  -> Lista cadenze con filtri
 * - POST /api/supplier-cadence                 -> Crea nuova cadenza
 * - PATCH /api/supplier-cadence?supplier_id=123 -> Aggiorna cadenza
 * - DELETE /api/supplier-cadence?supplier_id=123 -> Elimina cadenza
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getSupplierCadence,
  listCadences,
  createSupplierCadence,
  updateSupplierCadence,
  deleteSupplierCadence,
} from '@/lib/db/supplier-cadence-db';
import {
  CadenceType,
  CreateCadenceRequest,
  UpdateCadenceRequest,
  validateCadenceConfig,
} from '@/lib/types/supplier-cadence';

// ============================================================================
// GET: Ottieni cadenza singola o lista
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const supplierId = searchParams.get('supplier_id');

    // Caso 1: Ottieni cadenza per supplier_id specifico
    if (supplierId) {
      const cadence = await getSupplierCadence(parseInt(supplierId));

      if (!cadence) {
        return NextResponse.json(
          { error: 'Cadenza non trovata' },
          { status: 404 }
        );
      }

      return NextResponse.json({ cadence });
    }

    // Caso 2: Lista cadenze con filtri opzionali
    const isActive = searchParams.get('is_active');
    const cadenceType = searchParams.get('cadence_type') as CadenceType | null;
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const result = await listCadences(
      {
        ...(isActive !== null && { is_active: isActive === 'true' }),
        ...(cadenceType && { cadence_type: cadenceType }),
        ...(search && { search }),
      },
      {
        limit,
        offset,
        order_by: 'next_order_date',
        order_direction: 'asc',
      }
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('❌ [API] Error in GET /api/supplier-cadence:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST: Crea nuova cadenza
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validazione input
    if (!body.supplier_id || !body.supplier_name || !body.cadence_type) {
      return NextResponse.json(
        { error: 'Missing required fields: supplier_id, supplier_name, cadence_type' },
        { status: 400 }
      );
    }

    // Validazione configurazione cadenza
    const validation = validateCadenceConfig(
      body.cadence_type,
      body.cadence_value ?? null,
      body.weekdays ?? null
    );

    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid cadence configuration', message: validation.error },
        { status: 400 }
      );
    }

    // Crea cadenza
    const cadenceData: CreateCadenceRequest = {
      supplier_id: body.supplier_id,
      supplier_name: body.supplier_name,
      cadence_type: body.cadence_type as CadenceType,
      cadence_value: body.cadence_value ?? null,
      weekdays: body.weekdays ?? null,
      next_order_date: body.next_order_date ?? null,
      average_lead_time_days: body.average_lead_time_days ?? 0,
      notes: body.notes ?? null,
      updated_by: body.updated_by ?? 'api',
    };

    const cadence = await createSupplierCadence(cadenceData);

    return NextResponse.json(
      { cadence, message: 'Cadenza creata con successo' },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('❌ [API] Error in POST /api/supplier-cadence:', error);

    // Handle UNIQUE constraint violation
    if (error.message?.includes('già esistente')) {
      return NextResponse.json(
        { error: 'Conflict', message: 'Cadenza già esistente per questo fornitore' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH: Aggiorna cadenza esistente
// ============================================================================

export async function PATCH(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const supplierId = searchParams.get('supplier_id');

    if (!supplierId) {
      return NextResponse.json(
        { error: 'Missing required parameter: supplier_id' },
        { status: 400 }
      );
    }

    const body = await req.json();

    // Validazione configurazione cadenza (se cambiano type/value/weekdays)
    if (body.cadence_type || body.cadence_value !== undefined || body.weekdays !== undefined) {
      // Fetch cadenza corrente per merge
      const current = await getSupplierCadence(parseInt(supplierId));
      if (!current) {
        return NextResponse.json(
          { error: 'Cadenza non trovata' },
          { status: 404 }
        );
      }

      const validation = validateCadenceConfig(
        body.cadence_type ?? current.cadence_type,
        body.cadence_value !== undefined ? body.cadence_value : current.cadence_value,
        body.weekdays !== undefined ? body.weekdays : current.weekdays
      );

      if (!validation.valid) {
        return NextResponse.json(
          { error: 'Invalid cadence configuration', message: validation.error },
          { status: 400 }
        );
      }
    }

    // Update cadenza
    const updates: UpdateCadenceRequest = {
      ...(body.cadence_type && { cadence_type: body.cadence_type as CadenceType }),
      ...(body.cadence_value !== undefined && { cadence_value: body.cadence_value }),
      ...(body.weekdays !== undefined && { weekdays: body.weekdays }),
      ...(body.is_active !== undefined && { is_active: body.is_active }),
      ...(body.next_order_date !== undefined && { next_order_date: body.next_order_date }),
      ...(body.last_order_date !== undefined && { last_order_date: body.last_order_date }),
      ...(body.average_lead_time_days !== undefined && {
        average_lead_time_days: body.average_lead_time_days,
      }),
      ...(body.notes !== undefined && { notes: body.notes }),
      updated_by: body.updated_by ?? 'api',
    };

    const cadence = await updateSupplierCadence(
      parseInt(supplierId),
      updates,
      body.change_reason ?? undefined
    );

    return NextResponse.json({
      cadence,
      message: 'Cadenza aggiornata con successo',
    });
  } catch (error: any) {
    console.error('❌ [API] Error in PATCH /api/supplier-cadence:', error);

    if (error.message?.includes('non trovata')) {
      return NextResponse.json(
        { error: 'Not found', message: error.message },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE: Elimina cadenza
// ============================================================================

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const supplierId = searchParams.get('supplier_id');

    if (!supplierId) {
      return NextResponse.json(
        { error: 'Missing required parameter: supplier_id' },
        { status: 400 }
      );
    }

    // Verifica esistenza
    const cadence = await getSupplierCadence(parseInt(supplierId));
    if (!cadence) {
      return NextResponse.json(
        { error: 'Cadenza non trovata' },
        { status: 404 }
      );
    }

    await deleteSupplierCadence(parseInt(supplierId));

    return NextResponse.json({
      message: 'Cadenza eliminata con successo',
    });
  } catch (error: any) {
    console.error('❌ [API] Error in DELETE /api/supplier-cadence:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
