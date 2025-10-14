import { NextRequest, NextResponse } from 'next/server';

interface ReturnItem {
  productId: number;
  productName: string;
  quantityToReturn: number;
  originalQuantity: number;
  bufferZone: 'secco' | 'secco_sopra' | 'frigo' | 'pingu';
  lotName?: string;
  pickingName?: string;
  customerName?: string;
  driverName?: string;
}

// Mapping zone buffer → ID Odoo
const BUFFER_ZONE_IDS: { [key: string]: number | null } = {
  'secco': null, // Verrà cercato dinamicamente
  'secco_sopra': null,
  'frigo': null,
  'pingu': null
};

export async function POST(request: NextRequest) {
  try {
    // ========== CONTROLLA SESSION_ID UTENTE LOGGATO ==========
    const cookieStore = cookies();
    const sessionId = cookieStore.get('odoo_session_id')?.value;

    if (!sessionId) {
      console.error('❌ [Resi] Utente NON loggato - accesso negato');
      return NextResponse.json(
        { success: false, error: 'Devi fare login per accedere a questa risorsa' },
        { status: 401 }
      );
    }

    const odooUrl = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';

    console.log('✅ [Resi] Usando session_id dell\'utente loggato');

    const body = await request.json();
    const { vanLocationId, vanLocationName, returns } = body as {
      vanLocationId: number;
      vanLocationName: string;
      returns: ReturnItem[];
    };

    if (!vanLocationId || !returns || returns.length === 0) {
      return NextResponse.json({ success: false, error: 'Parametri mancanti' }, { status: 400 });
    }

    console.log(`🔄 [Resi] Creazione ${returns.length} resi da furgone ${vanLocationName}`);

    // STEP 1: Cerca le ubicazioni buffer (WH/Stock/Buffer/*)
    console.log('🔍 [Resi] Ricerca ubicazioni buffer...');

    const searchBufferResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': odooApiKey
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'stock.location',
          method: 'search_read',
          args: [[
            ['complete_name', 'ilike', '%Buffer%'],
            ['usage', '=', 'internal']
          ]],
          kwargs: {
            fields: ['id', 'name', 'complete_name'],
            limit: 50
          }
        },
        id: Math.floor(Math.random() * 1000000)
      })
    });

    if (!searchBufferResponse.ok) {
      throw new Error('Errore ricerca ubicazioni buffer');
    }

    const bufferData = await searchBufferResponse.json();
    const bufferLocations = bufferData.result || [];

    console.log(`📦 [Resi] Trovate ${bufferLocations.length} ubicazioni buffer`);

    // Mappa zone buffer → ID
    for (const location of bufferLocations) {
      const name = location.complete_name.toLowerCase();

      if (name.includes('secco sopra') || name.includes('secco_sopra')) {
        BUFFER_ZONE_IDS['secco_sopra'] = location.id;
      } else if (name.includes('secco')) {
        BUFFER_ZONE_IDS['secco'] = location.id;
      } else if (name.includes('frigo')) {
        BUFFER_ZONE_IDS['frigo'] = location.id;
      } else if (name.includes('pingu')) {
        BUFFER_ZONE_IDS['pingu'] = location.id;
      }
    }

    console.log('📍 [Resi] Mapping ubicazioni buffer:', BUFFER_ZONE_IDS);

    // STEP 2: Raggruppa resi per zona buffer
    const returnsByZone: { [key: string]: ReturnItem[] } = {
      'secco': [],
      'secco_sopra': [],
      'frigo': [],
      'pingu': []
    };

    for (const returnItem of returns) {
      if (returnItem.quantityToReturn > 0) {
        returnsByZone[returnItem.bufferZone].push(returnItem);
      }
    }

    // STEP 3: Crea un internal transfer per ogni zona buffer
    const createdTransfers = [];

    for (const [zoneName, zoneReturns] of Object.entries(returnsByZone)) {
      if (zoneReturns.length === 0) continue;

      const bufferLocationId = BUFFER_ZONE_IDS[zoneName];

      if (!bufferLocationId) {
        console.warn(`⚠️ [Resi] Ubicazione buffer non trovata per zona: ${zoneName}, skip...`);
        continue;
      }

      console.log(`📤 [Resi] Creazione transfer per zona ${zoneName} (${zoneReturns.length} prodotti)`);

      // Crea stock.picking (Internal Transfer: Furgone → Buffer)
      const pickingResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
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
              picking_type_id: 5, // Internal Transfer (ID 5 di solito)
              location_id: vanLocationId, // Da: Furgone
              location_dest_id: bufferLocationId, // A: Buffer zona
              origin: `RESO_FURGONE_${vanLocationName}_${new Date().toISOString().split('T')[0]}`,
              note: `Reso massivo da furgone ${vanLocationName} a buffer ${zoneName.toUpperCase()}\nCreato: ${new Date().toLocaleString('it-IT')}`
            }],
            kwargs: {}
          },
          id: Math.floor(Math.random() * 1000000)
        })
      });

      if (!pickingResponse.ok) {
        console.error(`❌ [Resi] Errore creazione picking per zona ${zoneName}`);
        continue;
      }

      const pickingData = await pickingResponse.json();

      if (pickingData.error) {
        console.error(`❌ [Resi] Errore Odoo:`, pickingData.error);
        continue;
      }

      const pickingId = pickingData.result;
      console.log(`✅ [Resi] Picking ${pickingId} creato per zona ${zoneName}`);

      // Crea stock.move per ogni prodotto
      const movesCreated = [];

      for (const returnItem of zoneReturns) {
        const moveResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
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
                name: returnItem.productName,
                picking_id: pickingId,
                product_id: returnItem.productId,
                product_uom_qty: returnItem.quantityToReturn,
                product_uom: 1, // Unità (ID 1 di solito = PZ)
                location_id: vanLocationId,
                location_dest_id: bufferLocationId,
                note: returnItem.customerName ? `Cliente: ${returnItem.customerName}` : undefined
              }],
              kwargs: {}
            },
            id: Math.floor(Math.random() * 1000000)
          })
        });

        if (!moveResponse.ok) {
          console.error(`❌ [Resi] Errore creazione move per prodotto ${returnItem.productName}`);
          continue;
        }

        const moveData = await moveResponse.json();

        if (moveData.error) {
          console.error(`❌ [Resi] Errore Odoo move:`, moveData.error);
          continue;
        }

        const moveId = moveData.result;
        movesCreated.push(moveId);
        console.log(`  ✓ Move ${moveId} creato: ${returnItem.productName} x${returnItem.quantityToReturn}`);
      }

      // Conferma il picking (_action_confirm)
      try {
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
            id: Math.floor(Math.random() * 1000000)
          })
        });

        const confirmData = await confirmResponse.json();
        console.log(`✅ [Resi] Picking ${pickingId} confermato`);

        // Assegna quantità e valida
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
              method: 'action_assign',
              args: [[pickingId]],
              kwargs: {}
            },
            id: Math.floor(Math.random() * 1000000)
          })
        });

        console.log(`✅ [Resi] Picking ${pickingId} assegnato`);

      } catch (error) {
        console.warn(`⚠️ [Resi] Errore conferma picking ${pickingId}:`, error);
      }

      createdTransfers.push({
        pickingId,
        zone: zoneName,
        productsCount: zoneReturns.length,
        movesCreated: movesCreated.length
      });
    }

    console.log(`✅ [Resi] Completato! ${createdTransfers.length} transfer creati`);

    return NextResponse.json({
      success: true,
      transfers: createdTransfers,
      message: `${createdTransfers.length} resi creati con successo`
    });

  } catch (error: any) {
    console.error('❌ [Resi] Errore:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore del server'
    }, { status: 500 });
  }
}
