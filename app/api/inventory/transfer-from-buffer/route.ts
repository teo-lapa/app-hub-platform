import { NextRequest, NextResponse } from 'next/server';
import { getOdooClient } from '@/lib/odoo-client';

export async function POST(req: NextRequest) {
  try {
    const { productId, quantity, destLocationId, lotNumber, expiryDate } = await req.json();

    if (!productId || !quantity || !destLocationId || !lotNumber) {
      return NextResponse.json({
        success: false,
        error: 'Parametri mancanti'
      });
    }

    const client = await getOdooClient();

    // Trova buffer location (WH/Stock/Buffer o simile)
    const bufferLocations = await client.searchRead(
      'stock.location',
      [
        ['usage', '=', 'internal'],
        '|',
        ['name', 'ilike', 'buffer'],
        ['name', 'ilike', 'transit']
      ],
      ['id'],
      1
    );

    if (!bufferLocations || bufferLocations.length === 0) {
      // Se non c'è buffer, usa stock location principale
      const stockLocations = await client.searchRead(
        'stock.location',
        [
          ['usage', '=', 'internal'],
          ['name', '=', 'Stock']
        ],
        ['id'],
        1
      );

      if (!stockLocations || stockLocations.length === 0) {
        throw new Error('Ubicazione buffer/stock non trovata');
      }

      bufferLocations.push(stockLocations[0]);
    }

    const bufferLocationId = bufferLocations[0].id;

    // Trova picking type interno
    const pickingTypes = await client.searchRead(
      'stock.picking.type',
      [['code', '=', 'internal']],
      ['id'],
      1
    );

    if (!pickingTypes || pickingTypes.length === 0) {
      throw new Error('Tipo trasferimento interno non trovato');
    }

    // Crea o trova lotto se specificato
    let lotId = null;
    if (lotNumber) {
      // Cerca lotto esistente
      const existingLots = await client.searchRead(
        'stock.lot',
        [
          ['product_id', '=', productId],
          ['name', '=', lotNumber]
        ],
        ['id'],
        1
      );

      if (existingLots && existingLots.length > 0) {
        lotId = existingLots[0].id;

        // Aggiorna scadenza se fornita
        if (expiryDate) {
          await client.write('stock.lot', [lotId], {
            expiration_date: expiryDate
          });
        }
      } else {
        // Crea nuovo lotto
        const lotData: any = {
          product_id: productId,
          name: lotNumber,
          company_id: 1
        };

        if (expiryDate) {
          lotData.expiration_date = expiryDate;
        }

        const newLotIds = await client.create('stock.lot', [lotData]);
        lotId = newLotIds[0];
      }
    }

    // Crea picking di trasferimento
    const pickingData = {
      picking_type_id: pickingTypes[0].id,
      location_id: bufferLocationId,
      location_dest_id: destLocationId,
      origin: `Transfer-${Date.now()}`,
      immediate_transfer: true
    };

    const pickingId = await client.create('stock.picking', [pickingData]);

    // Crea stock move
    const moveData: any = {
      picking_id: pickingId[0],
      product_id: productId,
      product_uom_qty: quantity,
      location_id: bufferLocationId,
      location_dest_id: destLocationId,
      name: `Transfer ${lotNumber || ''}`,
      company_id: 1
    };

    const moveId = await client.create('stock.move', [moveData]);

    // Se c'è un lotto, crea move line
    if (lotId) {
      const moveLineData = {
        move_id: moveId[0],
        product_id: productId,
        lot_id: lotId,
        qty_done: quantity,
        location_id: bufferLocationId,
        location_dest_id: destLocationId,
        company_id: 1
      };

      await client.create('stock.move.line', [moveLineData]);
    }

    // Conferma e valida picking
    await client.call('stock.picking', 'action_confirm', [[pickingId[0]]]);
    await client.call('stock.picking', 'action_assign', [[pickingId[0]]]);

    // Se non c'è lotto, imposta quantità fatto
    if (!lotId) {
      const moves = await client.searchRead(
        'stock.move',
        [['picking_id', '=', pickingId[0]]],
        ['id'],
        100
      );

      for (const move of moves) {
        await client.write('stock.move', [move.id], {
          quantity_done: quantity
        });
      }
    }

    // Valida trasferimento
    await client.call('stock.picking', 'button_validate', [[pickingId[0]]]);

    return NextResponse.json({
      success: true,
      pickingId: pickingId[0],
      message: 'Trasferimento completato con successo'
    });

  } catch (error) {
    console.error('Errore trasferimento:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Errore nel trasferimento'
    });
  }
}