import { NextRequest, NextResponse } from 'next/server';
import { createOdooClient } from '@/lib/odoo/client';

export async function POST(request: NextRequest) {
  try {
    const { productId, destLocationId, quantity, lotNumber, expiryDate } = await request.json();

    if (!productId || !destLocationId || !quantity) {
      return NextResponse.json(
        { success: false, error: 'Parametri mancanti per il trasferimento' },
        { status: 400 }
      );
    }

    console.log('🔄 Trasferimento buffer → scaffale:', { productId, destLocationId, quantity });

    const odooClient = createOdooClient();

    // Utilizza la sessione Odoo dal cookie
    const sessionCookie = request.cookies.get('odoo_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json(
        { success: false, error: 'Sessione Odoo non trovata' },
        { status: 401 }
      );
    }

    const session = JSON.parse(decodeURIComponent(sessionCookie));

    // Buffer location ID = 8 (come nell'HTML)
    const BUFFER_LOCATION_ID = 8;

    // 1. Trova picking type interno
    const pickingTypes = await odooClient.callKw(
      'stock.picking.type',
      'search_read',
      [
        [['code', '=', 'internal']],
        ['id', 'name']
      ],
      { limit: 1 },
      session
    );

    if (!pickingTypes || pickingTypes.length === 0) {
      throw new Error('Picking type interno non trovato');
    }

    // 2. Crea picking
    const pickingData = {
      picking_type_id: pickingTypes[0].id,
      location_id: BUFFER_LOCATION_ID,
      location_dest_id: destLocationId,
      origin: `WEB-BUFFER-${Date.now()}`,
      state: 'draft'
    };

    const pickingId = await odooClient.callKw(
      'stock.picking',
      'create',
      [pickingData],
      {},
      session
    );

    console.log('📦 Picking creato:', pickingId);

    // 3. Crea stock move
    const moveData = {
      picking_id: pickingId,
      product_id: productId,
      name: `Transfer from Buffer`,
      product_uom_qty: quantity,
      location_id: BUFFER_LOCATION_ID,
      location_dest_id: destLocationId,
      state: 'draft'
    };

    const moveId = await odooClient.callKw(
      'stock.move',
      'create',
      [moveData],
      {},
      session
    );

    console.log('📋 Move creato:', moveId);

    // 4. Gestione lotto se necessario
    if (lotNumber) {
      // Cerca o crea lotto
      let lots = await odooClient.callKw(
        'stock.production.lot',
        'search_read',
        [
          [['product_id', '=', productId], ['name', '=', lotNumber]],
          ['id', 'name']
        ],
        { limit: 1 },
        session
      );

      let lotId;
      if (lots && lots.length > 0) {
        lotId = lots[0].id;
      } else {
        // Crea nuovo lotto
        const lotData: any = {
          product_id: productId,
          name: lotNumber
        };

        if (expiryDate) {
          lotData.expiration_date = expiryDate;
        }

        lotId = await odooClient.callKw(
          'stock.production.lot',
          'create',
          [lotData],
          {},
          session
        );
      }

      // 5. Crea move line con lotto
      const moveLineData = {
        move_id: moveId,
        picking_id: pickingId,
        product_id: productId,
        qty_done: quantity,
        location_id: BUFFER_LOCATION_ID,
        location_dest_id: destLocationId,
        lot_id: lotId
      };

      await odooClient.callKw(
        'stock.move.line',
        'create',
        [moveLineData],
        {},
        session
      );
    } else {
      // 5. Crea move line senza lotto
      const moveLineData = {
        move_id: moveId,
        picking_id: pickingId,
        product_id: productId,
        qty_done: quantity,
        location_id: BUFFER_LOCATION_ID,
        location_dest_id: destLocationId
      };

      await odooClient.callKw(
        'stock.move.line',
        'create',
        [moveLineData],
        {},
        session
      );
    }

    // 6. Conferma picking
    await odooClient.callKw(
      'stock.picking',
      'action_confirm',
      [pickingId],
      {},
      session
    );

    await odooClient.callKw(
      'stock.picking',
      'button_validate',
      [pickingId],
      {},
      session
    );

    console.log('✅ Trasferimento completato');

    return NextResponse.json({
      success: true,
      data: {
        picking_id: pickingId,
        move_id: moveId
      }
    });

  } catch (error: any) {
    console.error('Errore trasferimento:', error);

    // Gestione sessione scaduta
    if (error.message && error.message.includes('session')) {
      return NextResponse.json(
        { success: false, error: 'Odoo Session Expired' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Errore interno del server' },
      { status: 500 }
    );
  }
}