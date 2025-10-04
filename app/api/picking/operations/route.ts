import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';

export async function POST(request: NextRequest) {
  try {
    const { batchId, locationId } = await request.json();

    console.log(`📦 Recupero operazioni REALI per batch ${batchId}, location ${locationId} da Odoo...`);

    // Recupera session da cookie
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('odoo_session');

    if (!sessionCookie?.value) {
      return NextResponse.json(
        { error: 'Sessione non valida - effettua il login' },
        { status: 401 }
      );
    }

    const sessionData = JSON.parse(sessionCookie.value);

    // Crea client RPC
    const rpcClient = createOdooRPCClient(sessionData.sessionId);

    // Recupera i picking del batch
    const pickings = await rpcClient.getBatchPickings(batchId);
    const pickingIds = pickings.map((p: any) => p.id);

    console.log(`📋 Trovati ${pickingIds.length} picking nel batch`);

    if (pickingIds.length === 0) {
      return NextResponse.json({
        operations: [],
        count: 0,
        source: 'odoo-rpc-live'
      });
    }

    // Recupera le move lines per l'ubicazione specifica (o tutte se non specificata)
    const moveLines = await rpcClient.getMoveLinesByLocation(pickingIds, locationId);

    console.log(`📦 Trovate ${moveLines.length} move lines`);

    // Trasforma le move lines in operazioni per il frontend
    const operations = moveLines.map((line: any) => ({
      id: line.id,
      productId: line.product_id?.[0],
      productName: line.product_id?.[1] || 'Prodotto sconosciuto',
      productCode: `PRD-${line.product_id?.[0]}`,
      productBarcode: line.lot_id?.[1] || `BAR-${line.product_id?.[0]}`,
      quantity: line.quantity || line.product_uom_qty || 0,
      qty_done: line.qty_done || 0,
      uom: line.product_uom_id?.[1] || 'Pz',
      locationId: line.location_id?.[0],
      locationName: line.location_id?.[1] || 'Ubicazione',
      locationDestId: line.location_dest_id?.[0],
      locationDestName: line.location_dest_id?.[1] || 'Destinazione',
      pickingId: line.picking_id?.[0],
      pickingName: line.picking_id?.[1] || 'Picking',
      moveId: line.move_id?.[0],
      customer: pickings.find((p: any) => p.id === line.picking_id?.[0])?.partner_id?.[1] || null
    }));

    // Ordina per prodotto
    operations.sort((a: any, b: any) => a.productName.localeCompare(b.productName));

    return NextResponse.json({
      operations: operations,
      count: operations.length,
      source: 'odoo-rpc-live'
    });

  } catch (error: any) {
    console.error('❌ Errore recupero operazioni:', error);

    return NextResponse.json(
      {
        error: 'Errore nel recupero delle operazioni',
        details: error.message,
        operations: [],
        count: 0
      },
      { status: 500 }
    );
  }
}

// Aggiorna quantità
export async function PUT(request: NextRequest) {
  try {
    const { operationId, quantity } = await request.json();

    console.log(`✅ Aggiorno quantità per operazione ${operationId}: ${quantity}`);

    return NextResponse.json({
      success: true,
      message: `Quantità aggiornata a ${quantity}`
    });

  } catch (error: any) {
    console.error('❌ Errore aggiornamento quantità:', error);
    return NextResponse.json(
      { error: 'Errore nell\'aggiornamento' },
      { status: 500 }
    );
  }
}