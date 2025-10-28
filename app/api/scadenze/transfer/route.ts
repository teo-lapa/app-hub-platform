import { NextRequest, NextResponse } from 'next/server';
import { getOdooSessionId } from '@/lib/odoo/odoo-helper';
import type { TransferToWasteRequest, TransferToWasteResponse } from '@/lib/types/expiry';

// Location ID per "MERCE DETERIORATA" (Scarti)
const WASTE_LOCATION_ID = 648;

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
      lotId,
      sourceLocationId,
      quantity,
      reason
    }: TransferToWasteRequest = await request.json();

    // Validazione parametri
    if (!productId || !sourceLocationId || !quantity) {
      return NextResponse.json({
        success: false,
        error: 'Parametri mancanti: productId, sourceLocationId e quantity sono obbligatori'
      }, { status: 400 });
    }

    if (!lotId) {
      return NextResponse.json({
        success: false,
        error: 'lotId è obbligatorio per il trasferimento a scarti'
      }, { status: 400 });
    }

    const odooUrl = process.env.ODOO_URL || process.env.NEXT_PUBLIC_ODOO_URL;

    console.log('🗑️ Trasferimento a scarti:', {
      productId,
      lotId,
      from: sourceLocationId,
      to: WASTE_LOCATION_ID,
      qty: quantity,
      reason
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
            fields: ['id', 'name'],
            limit: 1
          }
        },
        id: 1
      })
    });

    const pickingTypeData = await pickingTypeResponse.json();

    if (pickingTypeData.error) {
      console.error('❌ Errore Odoo (picking type):', pickingTypeData.error);
      throw new Error(`Errore Odoo: ${pickingTypeData.error.data?.message || pickingTypeData.error.message}`);
    }

    const pickingTypes = pickingTypeData.result || [];

    if (!pickingTypes || pickingTypes.length === 0) {
      throw new Error('Picking type interno non trovato in Odoo');
    }

    const pickingTypeId = pickingTypes[0].id;
    console.log('✅ Picking type interno trovato:', pickingTypeId);

    // 2. Verifica che il lotto esista
    const lotCheckResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
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
            ['id', '=', lotId],
            ['product_id', '=', productId]
          ]],
          kwargs: {
            fields: ['id', 'name'],
            limit: 1
          }
        },
        id: 2
      })
    });

    const lotCheckData = await lotCheckResponse.json();

    if (lotCheckData.error) {
      console.error('❌ Errore Odoo (verifica lotto):', lotCheckData.error);
      throw new Error(`Errore Odoo: ${lotCheckData.error.data?.message || lotCheckData.error.message}`);
    }

    const lots = lotCheckData.result || [];

    if (lots.length === 0) {
      throw new Error(`Lotto ${lotId} non trovato per il prodotto ${productId}`);
    }

    console.log('✅ Lotto verificato:', lots[0].name);

    // 3. Crea stock.picking
    const pickingOrigin = reason
      ? `SCADENZE-SCARTI: ${reason} - ${Date.now()}`
      : `SCADENZE-SCARTI-${Date.now()}`;

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
            location_dest_id: WASTE_LOCATION_ID,
            origin: pickingOrigin
          }],
          kwargs: {}
        },
        id: 3
      })
    });

    const pickingCreateData = await pickingCreateResponse.json();

    if (pickingCreateData.error) {
      console.error('❌ Errore Odoo (creazione picking):', pickingCreateData.error);
      throw new Error(`Errore nella creazione del picking: ${pickingCreateData.error.data?.message || pickingCreateData.error.message}`);
    }

    const pickingId = pickingCreateData.result;
    console.log('✅ Picking creato:', pickingId);

    // 4. Crea stock.move
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
            name: reason || 'Trasferimento a scarti (scadenza)',
            product_uom_qty: quantity,
            location_id: sourceLocationId,
            location_dest_id: WASTE_LOCATION_ID,
            product_uom: 1 // Unità di misura base
          }],
          kwargs: {}
        },
        id: 4
      })
    });

    const moveCreateData = await moveCreateResponse.json();

    if (moveCreateData.error) {
      console.error('❌ Errore Odoo (creazione move):', moveCreateData.error);
      throw new Error(`Errore nella creazione del movimento: ${moveCreateData.error.data?.message || moveCreateData.error.message}`);
    }

    const moveId = moveCreateData.result;
    console.log('✅ Move creato:', moveId);

    // 5. Crea stock.move.line con lot_id
    const moveLineCreateResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
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
          args: [{
            move_id: moveId,
            picking_id: pickingId,
            product_id: productId,
            lot_id: lotId,
            qty_done: quantity,
            location_id: sourceLocationId,
            location_dest_id: WASTE_LOCATION_ID,
            product_uom_id: 1
          }],
          kwargs: {}
        },
        id: 5
      })
    });

    const moveLineCreateData = await moveLineCreateResponse.json();

    if (moveLineCreateData.error) {
      console.error('❌ Errore Odoo (creazione move line):', moveLineCreateData.error);
      throw new Error(`Errore nella creazione della linea di movimento: ${moveLineCreateData.error.data?.message || moveLineCreateData.error.message}`);
    }

    console.log('✅ Move line creata con lotto:', lotId);

    // 6. Conferma picking (action_confirm)
    const confirmResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
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
        id: 6
      })
    });

    const confirmData = await confirmResponse.json();

    if (confirmData.error) {
      console.error('❌ Errore Odoo (conferma picking):', confirmData.error);
      throw new Error(`Errore nella conferma del picking: ${confirmData.error.data?.message || confirmData.error.message}`);
    }

    console.log('✅ Picking confermato');

    // 7. Valida picking (button_validate)
    const validateResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
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
        id: 7
      })
    });

    const validateData = await validateResponse.json();

    if (validateData.error) {
      console.error('❌ Errore Odoo (validazione picking):', validateData.error);
      throw new Error(`Errore nella validazione del picking: ${validateData.error.data?.message || validateData.error.message}`);
    }

    console.log('✅ Picking validato - trasferimento a scarti completato');

    const response: TransferToWasteResponse = {
      success: true,
      pickingId,
      moveId
    };

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('❌ Errore trasferimento a scarti:', error);

    const response: TransferToWasteResponse = {
      success: false,
      error: error.message || 'Errore nel trasferimento a scarti'
    };

    return NextResponse.json(response, { status: 500 });
  }
}
