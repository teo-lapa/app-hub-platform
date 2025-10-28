import { NextRequest, NextResponse } from 'next/server';
import { getOdooSessionId } from '@/lib/odoo/odoo-helper';

const DEST_LOCATION_ID_MERCE_DETERIORATA = 648;

interface WasteTransferRequest {
  productId: number;
  sourceLocationId: number;
  quantity: number;
  lotName?: string;
  lotId?: number;
  expiryDate?: string;
  reason: string;
  notes?: string;
  photos: string[]; // Array di base64 (senza prefisso data:image)
}

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
      quantity,
      lotName,
      lotId,
      expiryDate,
      reason,
      notes,
      photos
    }: WasteTransferRequest = await request.json();

    // Validazione parametri obbligatori
    if (!productId || !sourceLocationId || !quantity || !reason) {
      return NextResponse.json({
        success: false,
        error: 'Parametri mancanti: productId, sourceLocationId, quantity, reason sono obbligatori'
      }, { status: 400 });
    }

    if (!photos || !Array.isArray(photos) || photos.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Almeno una foto è obbligatoria per lo scarto'
      }, { status: 400 });
    }

    const odooUrl = process.env.ODOO_URL || process.env.NEXT_PUBLIC_ODOO_URL;

    console.log('🗑️ Trasferimento scarto a MERCE DETERIORATA:', {
      productId,
      from: sourceLocationId,
      to: DEST_LOCATION_ID_MERCE_DETERIORATA,
      qty: quantity,
      lot: lotName,
      lotId,
      reason,
      photos: photos.length
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
          kwargs: {
            fields: ['id'],
            limit: 1
          }
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
          kwargs: {}
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

    // 3. Gestione lotto (se presente)
    let finalLotId = lotId;

    if (lotName && lotName.trim()) {
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
            kwargs: {
              fields: ['id'],
              limit: 1
            }
          },
          id: 3
        })
      });

      const lotSearchData = await lotSearchResponse.json();
      const existingLots = lotSearchData.result || [];

      if (existingLots.length > 0) {
        finalLotId = existingLots[0].id;
        console.log('📦 Lotto esistente trovato:', finalLotId);
      } else if (!finalLotId) {
        // Crea nuovo lotto solo se non esiste e non è stato fornito lotId
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
              kwargs: {}
            },
            id: 4
          })
        });

        const lotCreateData = await lotCreateResponse.json();
        finalLotId = lotCreateData.result;
        console.log('📦 Nuovo lotto creato:', finalLotId);
      }
    } else {
      finalLotId = undefined;
      console.log('📦 Trasferimento senza lotto (prodotto non tracciato)');
    }

    // 4. Prepara note completo con reason
    const fullNotes = `SCARTO - ${reason}${notes ? `\n\nNote: ${notes}` : ''}`;

    // 5. Crea stock.picking con note
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
            location_dest_id: DEST_LOCATION_ID_MERCE_DETERIORATA,
            origin: `WEB-SCARTO-${Date.now()}`,
            note: fullNotes
          }],
          kwargs: {}
        },
        id: 5
      })
    });

    const pickingCreateData = await pickingCreateResponse.json();
    const pickingId = pickingCreateData.result;
    console.log('📋 Picking scarto creato:', pickingId);

    // 6. Crea stock.move
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
            name: `Scarto: ${reason}`,
            product_uom_qty: quantity,
            location_id: sourceLocationId,
            location_dest_id: DEST_LOCATION_ID_MERCE_DETERIORATA
          }],
          kwargs: {}
        },
        id: 6
      })
    });

    const moveCreateData = await moveCreateResponse.json();
    const moveId = moveCreateData.result;
    console.log('📦 Move creato:', moveId);

    // 7. Crea move line con o senza lotto
    const moveLineData: any = {
      move_id: moveId,
      picking_id: pickingId,
      product_id: productId,
      qty_done: quantity,
      location_id: sourceLocationId,
      location_dest_id: DEST_LOCATION_ID_MERCE_DETERIORATA
    };

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
          kwargs: {}
        },
        id: 7
      })
    });

    console.log('📦 Move line creata', finalLotId ? `con lotto: ${finalLotId}` : 'senza lotto');

    // 8. Upload foto come ir.attachment PRIMA di validare il picking
    const attachmentIds: number[] = [];

    for (let i = 0; i < photos.length; i++) {
      const photoBase64 = photos[i];

      // Rimuovi eventuale prefisso data:image se presente
      const cleanBase64 = photoBase64.replace(/^data:image\/[a-z]+;base64,/, '');

      try {
        const attachmentResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `session_id=${sessionId}`
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'call',
            params: {
              model: 'ir.attachment',
              method: 'create',
              args: [{
                name: `SCARTO_${Date.now()}_${i + 1}.jpg`,
                datas: cleanBase64,
                res_model: 'stock.picking',
                res_id: pickingId,
                mimetype: 'image/jpeg'
              }],
              kwargs: {}
            },
            id: 100 + i
          })
        });

        const attachmentData = await attachmentResponse.json();

        if (attachmentData.result) {
          attachmentIds.push(attachmentData.result);
          console.log(`📸 Foto ${i + 1}/${photos.length} uploadata:`, attachmentData.result);
        } else {
          console.error(`❌ Errore upload foto ${i + 1}:`, attachmentData.error);
        }
      } catch (photoError) {
        console.error(`❌ Errore upload foto ${i + 1}:`, photoError);
        // Continua con le altre foto anche se una fallisce
      }
    }

    console.log(`📸 Upload completato: ${attachmentIds.length}/${photos.length} foto caricate`);

    // 9. Conferma picking
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
          kwargs: {}
        },
        id: 8
      })
    });

    console.log('✅ Picking confermato');

    // 10. Valida picking
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
          kwargs: {}
        },
        id: 9
      })
    });

    console.log('✅ Picking validato - scarto completato');

    return NextResponse.json({
      success: true,
      pickingId,
      moveId,
      attachmentIds,
      photosUploaded: attachmentIds.length,
      totalPhotos: photos.length
    });

  } catch (error: any) {
    console.error('❌ Errore trasferimento scarto:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore nel trasferimento scarto'
    }, { status: 500 });
  }
}
