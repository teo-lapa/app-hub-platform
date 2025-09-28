import { NextRequest, NextResponse } from 'next/server';
import { getOdooClient } from '@/lib/odoo-client';

export async function POST(req: NextRequest) {
  try {
    const { productId, locationId, quantity, lotId } = await req.json();

    if (!productId || !locationId || quantity === undefined) {
      return NextResponse.json({
        success: false,
        error: 'Parametri mancanti'
      });
    }

    const client = await getOdooClient();

    // Trova il quant specifico
    const domain: any[] = [
      ['product_id', '=', productId],
      ['location_id', '=', locationId]
    ];

    if (lotId) {
      domain.push(['lot_id', '=', lotId]);
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
        lot_id: lotId || false,
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