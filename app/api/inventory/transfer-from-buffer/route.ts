import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    const { productId, quantity, destLocationId, lotNumber, expiryDate } = await req.json();

    if (!productId || !quantity || !destLocationId || !lotNumber) {
      return NextResponse.json({
        success: false,
        error: 'Parametri mancanti'
      });
    }

    // ✅ Usa sessione utente loggato
    const userCookies = cookies().toString();
    const { cookies: odooCookies } = await getOdooSession(userCookies);

    // Trova buffer location (WH/Stock/Buffer o simile)
    const bufferLocations = await callOdoo(
      odooCookies,
      'stock.location',
      'search_read',
      [],
      {
        domain: [
          ['usage', '=', 'internal'],
          '|',
          ['name', 'ilike', 'buffer'],
          ['name', 'ilike', 'transit']
        ],
        fields: ['id'],
        limit: 1
      }
    );

    let bufferLocationId;
    if (!bufferLocations || bufferLocations.length === 0) {
      // Se non c'è buffer, usa stock location principale
      const stockLocations = await callOdoo(
        odooCookies,
        'stock.location',
        'search_read',
        [],
        {
          domain: [
            ['usage', '=', 'internal'],
            ['name', '=', 'Stock']
          ],
          fields: ['id'],
          limit: 1
        }
      );

      if (!stockLocations || stockLocations.length === 0) {
        throw new Error('Ubicazione buffer/stock non trovata');
      }

      bufferLocationId = stockLocations[0].id;
    } else {
      bufferLocationId = bufferLocations[0].id;
    }

    // Trova picking type interno
    const pickingTypes = await callOdoo(
      odooCookies,
      'stock.picking.type',
      'search_read',
      [],
      {
        domain: [['code', '=', 'internal']],
        fields: ['id'],
        limit: 1
      }
    );

    if (!pickingTypes || pickingTypes.length === 0) {
      throw new Error('Tipo trasferimento interno non trovato');
    }

    // Crea o trova lotto se specificato
    let lotId = null;
    if (lotNumber) {
      // Cerca lotto esistente
      const existingLots = await callOdoo(
        odooCookies,
        'stock.lot',
        'search_read',
        [],
        {
          domain: [
            ['product_id', '=', productId],
            ['name', '=', lotNumber]
          ],
          fields: ['id'],
          limit: 1
        }
      );

      if (existingLots && existingLots.length > 0) {
        lotId = existingLots[0].id;

        // Aggiorna scadenza se fornita
        if (expiryDate) {
          await callOdoo(odooCookies, 'stock.lot', 'write', [[lotId], {
            expiration_date: expiryDate
          }]);
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

        const newLotIds = await callOdoo(odooCookies, 'stock.lot', 'create', [[lotData]]);
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

    const pickingId = await callOdoo(odooCookies, 'stock.picking', 'create', [[pickingData]]);

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

    const moveId = await callOdoo(odooCookies, 'stock.move', 'create', [[moveData]]);

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

      await callOdoo(odooCookies, 'stock.move.line', 'create', [[moveLineData]]);
    }

    // Conferma e valida picking
    await callOdoo(odooCookies, 'stock.picking', 'action_confirm', [[pickingId[0]]]);
    await callOdoo(odooCookies, 'stock.picking', 'action_assign', [[pickingId[0]]]);

    // Se non c'è lotto, imposta quantità fatto
    if (!lotId) {
      const moves = await callOdoo(
        odooCookies,
        'stock.move',
        'search_read',
        [],
        {
          domain: [['picking_id', '=', pickingId[0]]],
          fields: ['id'],
          limit: 100
        }
      );

      for (const move of moves) {
        await callOdoo(odooCookies, 'stock.move', 'write', [[move.id], {
          quantity_done: quantity
        }]);
      }
    }

    // Valida trasferimento
    await callOdoo(odooCookies, 'stock.picking', 'button_validate', [[pickingId[0]]]);

    return NextResponse.json({
      success: true,
      pickingId: pickingId[0],
      message: 'Trasferimento completato con successo'
    });

  } catch (error: any) {
    console.error('Errore trasferimento:', error);

    // ✅ Se utente non loggato, ritorna 401
    if (error.message?.includes('non autenticato') || error.message?.includes('Devi fare login')) {
      return NextResponse.json({
        success: false,
        error: 'Devi fare login per accedere a questa funzione'
      }, { status: 401 });
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Errore nel trasferimento'
    }, { status: 500 });
  }
}
