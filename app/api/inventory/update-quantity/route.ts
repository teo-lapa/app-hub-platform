import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { productId, locationId, quantId, quantity, lotId, lotNumber, lotName, expiryDate, isNewProduct } = await req.json();

    if (!productId || !locationId || quantity === undefined) {
      return NextResponse.json({
        success: false,
        error: 'Parametri mancanti'
      });
    }

    const actualLotName = lotName || lotNumber;

    // Ottieni URL base dalla richiesta
    const url = new URL(req.url);
    const baseUrl = `${url.protocol}//${url.host}`;

    // Helper per chiamate RPC tramite /api/odoo/rpc
    const odooRpc = async (model: string, method: string, args: any[] = [], kwargs: any = {}) => {
      const response = await fetch(`${baseUrl}/api/odoo/rpc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': req.headers.get('cookie') || ''
        },
        body: JSON.stringify({ model, method, args, kwargs })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 200)}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Errore chiamata Odoo');
      }

      return data.result;
    };

    // SE abbiamo quantId, aggiorna QUELLA riga specifica
    if (quantId) {
      console.log(`🎯 Aggiornamento riga specifica quant_id: ${quantId}`);

      // Gestisci il lotto se modificato
      let actualLotId = lotId;
      if (actualLotName) {
        // Cerca o crea il lotto
        const existingLotsData = await odooRpc(
          'stock.lot',
          'search_read',
          [[
            ['product_id', '=', productId],
            ['name', '=', actualLotName]
          ]],
          { fields: ['id'], limit: 1 }
        );

        if (existingLotsData && existingLotsData.length > 0) {
          actualLotId = existingLotsData[0].id;
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
            name: actualLotName,
            company_id: 1
          };

          if (expiryDate) {
            lotData.expiration_date = expiryDate;
          }

          const newLotData = await odooRpc('stock.lot', 'create', [[lotData]]);
          actualLotId = newLotData[0];
        }
      }

      console.log(`📝 Scrivo inventory_quantity: ${quantity} sul quant ${quantId}`);

      // Aggiorna il quant specifico con la quantità di conteggio inventario
      await odooRpc('stock.quant', 'write', [[quantId], {
        inventory_quantity: quantity
      }]);

      console.log(`✅ inventory_quantity scritto correttamente`);

      return NextResponse.json({
        success: true,
        message: 'Conteggio inventario salvato con successo'
      });
    }

    // ALTRIMENTI: Logica vecchia per nuovi prodotti o senza quantId
    let actualLotId = lotId;
    if (!lotId && actualLotName && quantity > 0) {
      // Cerca lotto esistente o creane uno nuovo
      const existingLotsData = await odooRpc(
        'stock.lot',
        'search_read',
        [[
          ['product_id', '=', productId],
          ['name', '=', actualLotName]
        ]],
        { fields: ['id'], limit: 1 }
      );

      if (existingLotsData && existingLotsData.length > 0) {
        actualLotId = existingLotsData[0].id;
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
          name: actualLotName,
          company_id: 1
        };

        if (expiryDate) {
          lotData.expiration_date = expiryDate;
        }

        const newLotData = await odooRpc('stock.lot', 'create', [[lotData]]);
        actualLotId = newLotData[0];
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

    if (quantsData && quantsData.length > 0) {
      const foundQuantId = quantsData[0].id;

      // Aggiorna la quantità inventario
      await odooRpc('stock.quant', 'write', [[foundQuantId], {
        inventory_quantity: quantity
      }]);

      return NextResponse.json({
        success: true,
        message: 'Conteggio inventario salvato'
      });
    } else {
      // Se non esiste il quant, crealo
      const newQuantData = await odooRpc('stock.quant', 'create', [[{
        product_id: productId,
        location_id: locationId,
        lot_id: actualLotId || false,
        inventory_quantity: quantity
      }]]);

      return NextResponse.json({
        success: true,
        message: 'Conteggio inventario creato'
      });
    }

  } catch (error: any) {
    console.error('❌ [update-quantity] Errore:', error);
    return NextResponse.json({
      success: false,
      error: `Errore: ${error.message || String(error)}`
    });
  }
}
