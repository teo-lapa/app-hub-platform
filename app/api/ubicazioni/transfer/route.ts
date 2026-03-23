import { NextRequest, NextResponse } from 'next/server';
import { getOdooSessionId } from '@/lib/odoo/odoo-helper';
import { injectLangContext } from '@/lib/odoo/user-lang';

export async function POST(request: NextRequest) {
  try {
    const sessionId = await getOdooSessionId();
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Sessione non valida. Effettua il login.' },
        { status: 401 }
      );
    }

    const {
      productId,
      sourceLocationId,
      destLocationId,
      quantity,
      lotName,
      lotId,
      expiryDate,
      isFromCatalog
    } = await request.json();

    if (!productId || !sourceLocationId || !destLocationId || !quantity) {
      return NextResponse.json({
        success: false,
        error: 'Parametri mancanti'
      }, { status: 400 });
    }

    // Il lotto non è più obbligatorio - viene gestito solo se presente

    // Se è dal catalogo con lotto, la scadenza è obbligatoria
    if (isFromCatalog && lotName && lotName.trim() && !expiryDate) {
      return NextResponse.json({
        success: false,
        error: 'Scadenza obbligatoria quando si specifica un lotto'
      }, { status: 400 });
    }

    const odooUrl = process.env.ODOO_URL || process.env.NEXT_PUBLIC_ODOO_URL;

    console.log('🚚 Trasferimento interno:', {
      productId,
      from: sourceLocationId,
      to: destLocationId,
      qty: quantity,
      lot: lotName,
      lotId,
      isFromCatalog,
      expiryDate
    });

    // 1. Ottieni picking type interno
    const pickingTypeResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'stock.picking.type',
          method: 'search_read',
          args: [[['code', '=', 'internal']]],
          kwargs: injectLangContext({
            fields: ['id'],
            limit: 1
          })
        },
        id: 2
      })
    });

    const pickingTypeData = await pickingTypeResponse.json();
    const pickingTypes = pickingTypeData.result || [];

    if (!pickingTypes || pickingTypes.length === 0) {
      throw new Error('Picking type interno non trovato');
    }

    const pickingTypeId = pickingTypes[0].id;

    // 2. Controlla se il prodotto ha tracking attivo
    const productResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'product.product',
          method: 'read',
          args: [[productId], ['tracking']],
          kwargs: injectLangContext({})
        },
        id: 2.5
      })
    });

    const productData = await productResponse.json();
    const tracking = productData.result?.[0]?.tracking || 'none';
    const hasTracking = tracking === 'lot' || tracking === 'serial';

    console.log(`📦 Prodotto ${productId} - tracking: ${tracking}, hasTracking: ${hasTracking}`);

    // Se il prodotto ha tracking, il lotto è obbligatorio
    if (hasTracking && (!lotName || !lotName.trim())) {
      return NextResponse.json({
        success: false,
        error: 'Questo prodotto richiede un numero di lotto obbligatorio'
      }, { status: 400 });
    }

    // 3. Se dal catalogo, crea o trova il lotto (solo se c'è tracking o lotto specificato)
    let finalLotId = lotId;

    if (lotName && lotName.trim() && (isFromCatalog || !finalLotId)) {
      // Cerca se esiste già un lotto con questo nome per questo prodotto
      const lotSearchResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session_id=${sessionId}`
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            model: 'stock.lot',
            method: 'search_read',
            args: [[
              ['name', '=', lotName],
              ['product_id', '=', productId]
            ]],
            kwargs: injectLangContext({
              fields: ['id'],
              limit: 1
            })
          },
          id: 3
        })
      });

      const lotSearchData = await lotSearchResponse.json();
      const existingLots = lotSearchData.result || [];

      if (existingLots.length > 0) {
        finalLotId = existingLots[0].id;
        console.log('📦 Lotto esistente trovato:', finalLotId);
      } else {
        // Crea nuovo lotto
        const lotData: any = {
          name: lotName,
          product_id: productId,
          company_id: 1
        };

        if (expiryDate) {
          lotData.expiration_date = expiryDate;
        }

        const lotCreateResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `session_id=${sessionId}`
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'call',
            params: {
              model: 'stock.lot',
              method: 'create',
              args: [lotData],
              kwargs: injectLangContext({})
            },
            id: 4
          })
        });

        const lotCreateData = await lotCreateResponse.json();
        finalLotId = lotCreateData.result;
        console.log('📦 Nuovo lotto creato:', finalLotId);
      }
    } else if (!lotName || !lotName.trim()) {
      finalLotId = null; // Nessun lotto specificato
      console.log('📦 Trasferimento senza lotto (prodotto non tracciato)');
    }

    // 3. Crea stock.picking
    const pickingCreateResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'stock.picking',
          method: 'create',
          args: [{
            picking_type_id: pickingTypeId,
            location_id: sourceLocationId,
            location_dest_id: destLocationId,
            origin: `WEB-UBICAZIONI-${Date.now()}`
          }],
          kwargs: injectLangContext({})
        },
        id: 3
      })
    });

    const pickingCreateData = await pickingCreateResponse.json();
    const pickingId = pickingCreateData.result;
    console.log('📋 Picking creato:', pickingId);

    // 3. Crea stock.move
    const moveCreateResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'stock.move',
          method: 'create',
          args: [{
            picking_id: pickingId,
            product_id: productId,
            name: `Transfer from ${lotName}`,
            product_uom_qty: quantity,
            location_id: sourceLocationId,
            location_dest_id: destLocationId
          }],
          kwargs: injectLangContext({})
        },
        id: 4
      })
    });

    const moveCreateData = await moveCreateResponse.json();
    const moveId = moveCreateData.result;
    console.log('📦 Move creato:', moveId);

    // 4. Crea move line con o senza lotto
    const moveLineData: any = {
      move_id: moveId,
      picking_id: pickingId,
      product_id: productId,
      qty_done: quantity,
      location_id: sourceLocationId,
      location_dest_id: destLocationId
    };

    // Aggiungi il lotto solo se presente
    if (finalLotId) {
      moveLineData.lot_id = finalLotId;
    }

    await fetch(`${odooUrl}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'stock.move.line',
          method: 'create',
          args: [moveLineData],
          kwargs: injectLangContext({})
        },
        id: 5
      })
    });

    console.log('📦 Move line creata', finalLotId ? `con lotto: ${finalLotId}` : 'senza lotto');

    // 5. Conferma picking
    await fetch(`${odooUrl}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'stock.picking',
          method: 'action_confirm',
          args: [[pickingId]],
          kwargs: injectLangContext({})
        },
        id: 6
      })
    });

    console.log('✅ Picking confermato');

    // 6. Valida picking
    await fetch(`${odooUrl}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'stock.picking',
          method: 'button_validate',
          args: [[pickingId]],
          kwargs: injectLangContext({})
        },
        id: 7
      })
    });

    console.log('✅ Picking validato - trasferimento completato');

    return NextResponse.json({
      success: true,
      pickingId,
      moveId
    });

  } catch (error: any) {
    console.error('❌ Errore trasferimento:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore nel trasferimento'
    }, { status: 500 });
  }
}
