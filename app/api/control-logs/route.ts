import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface ControlLogData {
  batch_id: number;
  batch_name: string;
  zone_id: string;
  zone_name: string;
  product_id: number;
  product_name: string;
  qty_requested: number;
  qty_picked: number;
  status: 'ok' | 'error_qty' | 'missing' | 'damaged' | 'lot_error' | 'location_error' | 'note';
  note?: string;
  controlled_by_user_id: number;
  controlled_by_name: string;
  driver_name?: string;
  vehicle_name?: string;
}

// POST: Salva un controllo
export async function POST(request: NextRequest) {
  try {
    const data: ControlLogData = await request.json();

    console.log('📝 Salvataggio controllo:', {
      batch: data.batch_name,
      zone: data.zone_name,
      product: data.product_name,
      status: data.status,
      user: data.controlled_by_name
    });

    // Validazione
    if (!data.batch_id || !data.product_id || !data.status || !data.controlled_by_user_id) {
      return NextResponse.json(
        { error: 'Campi obbligatori mancanti' },
        { status: 400 }
      );
    }

    // Inserimento nel database
    const result = await sql`
      INSERT INTO control_logs (
        batch_id,
        batch_name,
        zone_id,
        zone_name,
        product_id,
        product_name,
        qty_requested,
        qty_picked,
        status,
        note,
        controlled_by_user_id,
        controlled_by_name,
        driver_name,
        vehicle_name
      ) VALUES (
        ${data.batch_id},
        ${data.batch_name},
        ${data.zone_id},
        ${data.zone_name},
        ${data.product_id},
        ${data.product_name},
        ${data.qty_requested},
        ${data.qty_picked},
        ${data.status},
        ${data.note || null},
        ${data.controlled_by_user_id},
        ${data.controlled_by_name},
        ${data.driver_name || null},
        ${data.vehicle_name || null}
      )
      RETURNING id, controlled_at
    `;

    console.log('✅ Controllo salvato:', result.rows[0]);

    return NextResponse.json({
      success: true,
      control_id: result.rows[0].id,
      controlled_at: result.rows[0].controlled_at
    });

  } catch (error: any) {
    console.error('❌ Errore salvataggio controllo:', error);
    return NextResponse.json(
      { error: 'Errore salvataggio controllo', details: error.message },
      { status: 500 }
    );
  }
}

// GET: Recupera controlli
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batch_id');
    const zoneId = searchParams.get('zone_id');
    const productId = searchParams.get('product_id');
    const status = searchParams.get('status');

    let query = sql`SELECT * FROM control_logs WHERE 1=1`;

    // Filtri dinamici
    if (batchId) {
      query = sql`${query} AND batch_id = ${parseInt(batchId)}`;
    }
    if (zoneId) {
      query = sql`${query} AND zone_id = ${zoneId}`;
    }
    if (productId) {
      query = sql`${query} AND product_id = ${parseInt(productId)}`;
    }
    if (status) {
      query = sql`${query} AND status = ${status}`;
    }

    query = sql`${query} ORDER BY controlled_at DESC LIMIT 1000`;

    const result = await query;

    return NextResponse.json({
      success: true,
      controls: result.rows,
      count: result.rowCount
    });

  } catch (error: any) {
    console.error('❌ Errore recupero controlli:', error);
    return NextResponse.json(
      { error: 'Errore recupero controlli', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE: Cancella un controllo (undo)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const controlId = searchParams.get('id');

    if (!controlId) {
      return NextResponse.json(
        { error: 'ID controllo mancante' },
        { status: 400 }
      );
    }

    const result = await sql`
      DELETE FROM control_logs
      WHERE id = ${controlId}
      RETURNING id
    `;

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Controllo non trovato' },
        { status: 404 }
      );
    }

    console.log('🗑️ Controllo cancellato:', controlId);

    return NextResponse.json({
      success: true,
      message: 'Controllo cancellato'
    });

  } catch (error: any) {
    console.error('❌ Errore cancellazione controllo:', error);
    return NextResponse.json(
      { error: 'Errore cancellazione controllo', details: error.message },
      { status: 500 }
    );
  }
}
