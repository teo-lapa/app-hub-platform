import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { productId, locationId, quantity, lotId, lotNumber, expiryDate, isNewProduct } = await req.json();

    if (!productId || !locationId || quantity === undefined) {
      return NextResponse.json({
        success: false,
        error: 'Parametri mancanti'
      });
    }

    // Helper per chiamate RPC tramite /api/odoo/rpc
    const odooRpc = async (model: string, method: string, args: any[] = [], kwargs: any = {}) => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/odoo/rpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, method, args, kwargs })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore chiamata Odoo');
      }

      return await response.json();
    };

    // Gestisci creazione lotto se necessario
    let actualLotId = lotId;
    if (!lotId && lotNumber && quantity > 0) {
      // Cerca lotto esistente o creane uno nuovo
      const existingLotsData = await odooRpc(
        'stock.lot',
        'search_read',
        [[
          ['product_id', '=', productId],
          ['name', '=', lotNumber]
        ]],
        { fields: ['id'], limit: 1 }
      );

      const existingLots = existingLotsData.result || [];

      if (existingLots.length > 0) {
        actualLotId = existingLots[0].id;
        // Aggiorna scadenza se fornita
        if (expiryDate) {
          await odooRpc('stock.lot', 'write', [[actualLotId], {
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

        const newLotData = await odooRpc('stock.lot', 'create', [[lotData]]);
        actualLotId = newLotData.result[0];
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

    const quantsData = await odooRpc(
      'stock.quant',
      'search_read',
      [domain],
      { fields: ['id'], limit: 1 }
    );

    const quants = quantsData.result || [];

    if (quants.length > 0) {
      const quantId = quants[0].id;

      // Aggiorna la quantità inventario
      await odooRpc('stock.quant', 'write', [[quantId], {
        inventory_quantity: quantity
      }]);

      // Applica l'inventario
      await odooRpc('stock.quant', 'action_apply_inventory', [[quantId]]);

      return NextResponse.json({
        success: true,
        message: 'Giacenza aggiornata con successo'
      });
    } else {
      // Se non esiste il quant, crealo
      const newQuantData = await odooRpc('stock.quant', 'create', [[{
        product_id: productId,
        location_id: locationId,
        lot_id: actualLotId || false,
        inventory_quantity: quantity
      }]]);

      const newQuant = newQuantData.result || [];

      if (newQuant.length > 0) {
        // Applica l'inventario
        await odooRpc('stock.quant', 'action_apply_inventory', [newQuant]);

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