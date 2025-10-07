import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    console.log('🚀 [update-quantity] Starting request');
    console.log('🌍 [update-quantity] VERCEL_URL:', process.env.VERCEL_URL);
    console.log('🌍 [update-quantity] NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL);

    const { productId, locationId, quantId, quantity, lotId, lotNumber, lotName, expiryDate, isNewProduct } = await req.json();

    if (!productId || !locationId || quantity === undefined) {
      return NextResponse.json({
        success: false,
        error: 'Parametri mancanti'
      });
    }

    // Usa lotName se fornito, altrimenti lotNumber (retrocompatibilità)
    const actualLotName = lotName || lotNumber;

    // Helper per chiamate RPC tramite /api/odoo/rpc
    const odooRpc = async (model: string, method: string, args: any[] = [], kwargs: any = {}) => {
      // Determina l'URL base corretto usando l'host della richiesta
      const host = req.headers.get('host');
      const protocol = host?.includes('localhost') ? 'http' : 'https';
      const baseUrl = `${protocol}://${host}`;

      console.log(`🌐 [odooRpc] Host: ${host}, URL: ${baseUrl}/api/odoo/rpc - Model: ${model} - Method: ${method}`);

      try {
        const response = await fetch(`${baseUrl}/api/odoo/rpc`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': req.headers.get('cookie') || ''
          },
          body: JSON.stringify({ model, method, args, kwargs })
        });

        console.log(`📡 [odooRpc] Response status: ${response.status}`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ [odooRpc] Error response (${response.status}):`, errorText);
          throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 200)}`);
        }

        return await response.json();
      } catch (error: any) {
        console.error(`❌ [odooRpc] Fetch error:`, error.message);
        throw error;
      }
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
            name: actualLotName,
            company_id: 1
          };

          if (expiryDate) {
            lotData.expiration_date = expiryDate;
          }

          const newLotData = await odooRpc('stock.lot', 'create', [[lotData]]);
          actualLotId = newLotData.result[0];
        }
      }

      // Aggiorna il quant specifico con la quantità di conteggio inventario
      const updateData: any = {
        inventory_quantity: quantity
      };

      console.log(`📝 Scrivo inventory_quantity: ${quantity} sul quant ${quantId}`);

      // IMPORTANTE: Scrivo SOLO inventory_quantity, NON applico l'inventario automaticamente
      // L'utente vedrà la differenza in Odoo e potrà applicare manualmente
      await odooRpc('stock.quant', 'write', [[quantId], updateData]);

      console.log(`✅ inventory_quantity scritto correttamente`);

      // NON chiamare action_apply_inventory qui!
      // L'utente applicherà l'inventario manualmente da Odoo quando ha finito tutto il conteggio

      return NextResponse.json({
        success: true,
        message: 'Conteggio inventario salvato con successo'
      });
    }

    // ALTRIMENTI: Logica vecchia per nuovi prodotti o senza quantId
    // Gestisci creazione lotto se necessario
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
          name: actualLotName,
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
      const foundQuantId = quants[0].id;

      // Aggiorna la quantità inventario
      await odooRpc('stock.quant', 'write', [[foundQuantId], {
        inventory_quantity: quantity
      }]);

      // NON applicare automaticamente - l'utente applicherà da Odoo

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

      const newQuant = newQuantData.result || [];

      if (newQuant.length > 0) {
        // NON applicare automaticamente - l'utente applicherà da Odoo

        return NextResponse.json({
          success: true,
          message: 'Conteggio inventario creato'
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