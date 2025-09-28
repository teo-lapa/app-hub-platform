import { NextRequest, NextResponse } from 'next/server';
import { getOdooClient } from '@/lib/odoo-client';

export async function POST(req: NextRequest) {
  try {
    const { productId, locationId, quantity, lotId, lotNumber, expiryDate, isNewProduct } = await req.json();

    if (!productId || !locationId || quantity === undefined) {
      return NextResponse.json({
        success: false,
        error: 'Parametri mancanti'
      });
    }

    const client = await getOdooClient();

    // Gestisci creazione lotto se necessario
    let actualLotId = lotId;
    if (!lotId && lotNumber && quantity > 0) {
      // Cerca lotto esistente o creane uno nuovo
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
        actualLotId = existingLots[0].id;
        // Aggiorna scadenza se fornita
        if (expiryDate) {
          await client.write('stock.lot', [actualLotId], {
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
        actualLotId = newLotIds[0];
      }
    }

    // Trova il quant specifico
    const domain: any[] = [
      ['product_id', '=', productId],
      ['location_id', '=', locationId]
    ];

    if (actualLotId) {
      domain.push(['lot_id', '=', actualLotId]);
    } else {
      domain.push(['lot_id', '=', false]);
    }

    const quants = await client.searchRead(
      'stock.quant',
      domain,
      ['id'],
      1
    );

    if (quants && quants.length > 0) {
      const quantId = quants[0].id;

      // Aggiorna la quantità inventario
      await client.write('stock.quant', [quantId], {
        inventory_quantity: quantity
      });

      // Applica l'inventario
      await client.call('stock.quant', 'action_apply_inventory', [[quantId]]);

      return NextResponse.json({
        success: true,
        message: 'Giacenza aggiornata con successo'
      });
    } else {
      // Se non esiste il quant, crealo
      const newQuant = await client.create('stock.quant', [{
        product_id: productId,
        location_id: locationId,
        lot_id: actualLotId || false,
        inventory_quantity: quantity
      }]);

      if (newQuant && newQuant.length > 0) {
        // Applica l'inventario
        await client.call('stock.quant', 'action_apply_inventory', [newQuant]);

        return NextResponse.json({
          success: true,
          message: 'Giacenza creata e aggiornata'
        });
      }
    }

    return NextResponse.json({
      success: false,
      error: 'Impossibile aggiornare la giacenza'
    });

  } catch (error) {
    console.error('Errore aggiornamento giacenza:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore nell\'aggiornamento della giacenza'
    });
  }
}