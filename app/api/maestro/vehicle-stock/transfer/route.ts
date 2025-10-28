/**
 * MAESTRO AI - Vehicle Stock Transfer API Endpoint
 *
 * POST /api/maestro/vehicle-stock/transfer
 * Create stock transfer (reload vehicle from warehouse)
 *
 * ARCHITECTURE: Uses SAME approach as Gestione Ubicazioni
 * - Direct Odoo API calls via /web/dataset/call_kw
 * - Cookie-based authentication with getOdooSessionId()
 * - Creates picking → move → move_line → confirm + validate
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOdooSessionId } from '@/lib/odoo/odoo-helper';
import { ADMIN_USER_IDS } from '@/lib/maestro/vehicle-stock-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Vehicle location mappings (same as vehicle-stock-service.ts)
const SALESPERSON_VEHICLE_MAPPING: Record<number, number> = {
  121: 607,  // Alessandro Motta → WH/BMW ZH542378 A
  407: 605,  // Domingos Ferreira → WH/BMW ZH638565 D
  14: 606,   // Mihai Nita → WH/BMW ZH969307 M
  249: 608,  // Gregorio Buccolieri → WH/COMO 6278063 G
};

/**
 * POST /api/maestro/vehicle-stock/transfer
 *
 * Request body:
 * {
 *   products: [{ product_id: number, quantity: number }],
 *   type: "reload",
 *   notes?: string
 * }
 */
export async function POST(request: NextRequest) {
  console.log('\n📤 [API] POST /api/maestro/vehicle-stock/transfer');

  try {
    // 1. Get Odoo session (same as Gestione Ubicazioni)
    const sessionId = await getOdooSessionId();
    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Sessione non valida. Effettua il login.'
      }, { status: 401 });
    }

    console.log('✅ Session ID ottenuto');

    // 2. Get Odoo URL
    const odooUrl = process.env.ODOO_URL || process.env.NEXT_PUBLIC_ODOO_URL;
    if (!odooUrl) {
      throw new Error('ODOO_URL non configurato');
    }

    // 3. Parse request body
    const body = await request.json();
    const { products, type, notes } = body;

    if (!products || products.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Nessun prodotto selezionato'
      }, { status: 400 });
    }

    // 4. Determine target salesperson
    const searchParams = request.nextUrl.searchParams;
    const salespersonIdParam = searchParams.get('salesperson_id');

    let targetSalespersonId: number;
    if (salespersonIdParam) {
      targetSalespersonId = parseInt(salespersonIdParam, 10);
      console.log(`   Creating transfer for salesperson: ${targetSalespersonId}`);
    } else {
      // Use logged-in user - get UID from cookie
      // TODO: Extract UID from session cookie if needed
      throw new Error('salesperson_id required');
    }

    // 5. Get vehicle location for this salesperson
    const vehicleLocationId = SALESPERSON_VEHICLE_MAPPING[targetSalespersonId];
    if (!vehicleLocationId) {
      return NextResponse.json({
        success: false,
        error: `Nessuna ubicazione veicolo mappata per il venditore ${targetSalespersonId}`
      }, { status: 404 });
    }

    console.log(`   Vehicle location ID: ${vehicleLocationId}`);

    // 6. Get warehouse stock location (source)
    // HARDCODED: WH/Stock location ID (same as Gestione Ubicazioni uses location ID 8)
    const warehouseLocationId = 8; // WH/Stock location

    console.log(`   Source (Warehouse): ${warehouseLocationId}`);
    console.log(`   Destination (Vehicle): ${vehicleLocationId}`);

    // 7. Get picking type for internal transfer
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
        id: 1
      })
    });

    const pickingTypeData = await pickingTypeResponse.json();
    const pickingTypes = pickingTypeData.result || [];

    if (!pickingTypes || pickingTypes.length === 0) {
      throw new Error('Picking type interno non trovato');
    }

    const pickingTypeId = pickingTypes[0].id;
    console.log(`   Picking type ID: ${pickingTypeId}`);

    // 8. Create stock.picking
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
            location_id: warehouseLocationId,
            location_dest_id: vehicleLocationId,
            origin: `VEICOLO-RELOAD-${targetSalespersonId}-${Date.now()}`,
            note: notes || `Ricarica veicolo - ${products.length} prodotti`
          }],
          kwargs: {}
        },
        id: 2
      })
    });

    const pickingCreateData = await pickingCreateResponse.json();

    if (!pickingCreateData.result) {
      console.error('❌ Errore creazione picking:', pickingCreateData);
      throw new Error('Errore nella creazione del picking');
    }

    const pickingId = pickingCreateData.result;
    console.log(`📋 Picking creato: ${pickingId}`);

    // 9. Create stock.move for each product
    const moveIds: number[] = [];

    for (const product of products) {
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
              product_id: product.product_id,
              name: `Reload Product ${product.product_id}`,
              product_uom_qty: product.quantity,
              location_id: warehouseLocationId,
              location_dest_id: vehicleLocationId
            }],
            kwargs: {}
          },
          id: 3
        })
      });

      const moveCreateData = await moveCreateResponse.json();
      const moveId = moveCreateData.result;
      moveIds.push(moveId);

      console.log(`  ✓ Move creato: ${moveId} per prodotto ${product.product_id} (qty: ${product.quantity})`);
    }

    // 10. Confirm picking (crea le move lines automaticamente)
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
        id: 5
      })
    });

    console.log('✅ Picking confermato');

    // 11. Assign picking (Odoo riserva automaticamente i prodotti dalle ubicazioni disponibili)
    const assignResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
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
          method: 'action_assign',
          args: [[pickingId]],
          kwargs: {}
        },
        id: 6
      })
    });

    console.log('✅ Picking assigned - prodotti riservati automaticamente');

    // 12. Recupera dati autista (nome) e veicolo (targa) per il batch
    console.log('🚚 [Batch] Recupero dati autista e veicolo...');

    const userResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'res.users',
          method: 'read',
          args: [[targetSalespersonId], ['name']],
          kwargs: {}
        },
        id: 7
      })
    });

    const userData = await userResponse.json();
    const driverName = userData.result?.[0]?.name || 'Autista Sconosciuto';
    console.log(`  ✓ Autista: ${driverName} (ID: ${targetSalespersonId})`);

    // Recupera ubicazione veicolo per ottenere targa dal nome
    const vehicleLocationResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'stock.location',
          method: 'read',
          args: [[vehicleLocationId], ['name', 'complete_name']],
          kwargs: {}
        },
        id: 8
      })
    });

    const vehicleData = await vehicleLocationResponse.json();
    const vehicleLocationName = vehicleData.result?.[0]?.name || 'Veicolo Sconosciuto';
    // Estrai targa dal nome (es: "BMW ZH542378 A" → "ZH542378")
    const plateMatch = vehicleLocationName.match(/[A-Z]{2}\s?\d{4,6}/);
    const plate = plateMatch ? plateMatch[0].replace(/\s/g, '') : vehicleLocationName;
    console.log(`  ✓ Targa: ${plate} (Location: ${vehicleLocationName})`);

    // 13. Crea stock.picking.batch
    console.log('📦 [Batch] Creazione batch per caricamento macchina...');

    const batchName = `CARICO-${driverName.toUpperCase()}-${plate}-${new Date().toISOString().split('T')[0]}`;

    const batchCreateResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'stock.picking.batch',
          method: 'create',
          args: [{
            name: batchName,
            user_id: targetSalespersonId,
            x_studio_autista_del_giro: targetSalespersonId,
            x_studio_auto_del_giro: plate,
            picking_ids: [[6, 0, [pickingId]]], // Relazione many2many: aggiungi pickingId al batch
            scheduled_date: new Date().toISOString(),
            state: 'draft' // Inizia come draft, poi confermiamo subito
          }],
          kwargs: {}
        },
        id: 9
      })
    });

    const batchCreateData = await batchCreateResponse.json();

    if (!batchCreateData.result) {
      console.error('❌ Errore creazione batch:', batchCreateData);
      throw new Error('Errore nella creazione del batch');
    }

    const batchId = batchCreateData.result;
    console.log(`✅ Batch creato: ${batchId} (${batchName})`);

    // 14. Conferma il batch (stato → in_progress)
    const batchConfirmResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'stock.picking.batch',
          method: 'action_confirm',
          args: [[batchId]],
          kwargs: {}
        },
        id: 10
      })
    });

    console.log('✅ Batch confermato - stato pronto per prelievo');
    console.log('⏳ Picking e Batch pronti per validazione su Odoo');

    return NextResponse.json({
      success: true,
      data: {
        picking_id: pickingId,
        batch_id: batchId,
        batch_name: batchName,
        driver_name: driverName,
        vehicle_plate: plate,
        move_ids: moveIds,
        state: 'assigned',
        message: 'Trasferimento e Batch creati con successo'
      },
      timestamp: new Date().toISOString()
    }, { status: 201 });

  } catch (error: any) {
    console.error('❌ [API] Error creating transfer:', error);

    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create transfer',
        details: error.message
      }
    }, { status: 500 });
  }
}
