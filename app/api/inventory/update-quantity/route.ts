import { NextRequest, NextResponse } from 'next/server';
import { getOdooClient } from '@/lib/odoo/client';
import { getServerSession } from '@/lib/auth/session';

export async function POST(req: NextRequest) {
  try {
    const { productId, locationId, quantId, quantity, lotId, lotNumber, lotName, expiryDate, isNewProduct } = await req.json();

    if (!productId || !locationId || quantity === undefined) {
      return NextResponse.json({
        success: false,
        error: 'Parametri mancanti'
      });
    }

    // Ottieni sessione Odoo
    const session = await getServerSession(req);
    if (!session) {
      return NextResponse.json({
        success: false,
        error: 'Non autenticato'
      });
    }

    const client = getOdooClient();
    const actualLotName = lotName || lotNumber;

    // SE abbiamo quantId, aggiorna QUELLA riga specifica
    if (quantId) {
      console.log(`🎯 Aggiornamento riga specifica quant_id: ${quantId}`);

      // Gestisci il lotto se modificato
      let actualLotId = lotId;
      if (actualLotName) {
        // Cerca o crea il lotto
        const existingLots = await client.searchRead(
          'stock.lot',
          [[['product_id', '=', productId], ['name', '=', actualLotName]]],
          ['id'],
          session,
          1
        );

        if (existingLots && existingLots.length > 0) {
          actualLotId = existingLots[0].id;
          // Aggiorna scadenza se fornita
          if (expiryDate) {
            await client.write('stock.lot', [actualLotId], {
              expiration_date: expiryDate
            }, session);
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

          const newLotId = await client.create('stock.lot', [lotData], session);
          actualLotId = newLotId;
        }
      }

      console.log(`📝 Scrivo inventory_quantity: ${quantity} sul quant ${quantId}`);

      // Aggiorna il quant specifico con la quantità di conteggio inventario
      await client.write('stock.quant', [quantId], {
        inventory_quantity: quantity
      }, session);

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
      const existingLots = await client.searchRead(
        'stock.lot',
        [[['product_id', '=', productId], ['name', '=', actualLotName]]],
        ['id'],
        session,
        1
      );

      if (existingLots && existingLots.length > 0) {
        actualLotId = existingLots[0].id;
        // Aggiorna scadenza se fornita
        if (expiryDate) {
          await client.write('stock.lot', [actualLotId], {
            expiration_date: expiryDate
          }, session);
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

        const newLotId = await client.create('stock.lot', [lotData], session);
        actualLotId = newLotId;
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
      [domain],
      ['id'],
      session,
      1
    );

    if (quants && quants.length > 0) {
      const foundQuantId = quants[0].id;

      // Aggiorna la quantità inventario
      await client.write('stock.quant', [foundQuantId], {
        inventory_quantity: quantity
      }, session);

      return NextResponse.json({
        success: true,
        message: 'Conteggio inventario salvato'
      });
    } else {
      // Se non esiste il quant, crealo
      await client.create('stock.quant', [{
        product_id: productId,
        location_id: locationId,
        lot_id: actualLotId || false,
        inventory_quantity: quantity
      }], session);

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
