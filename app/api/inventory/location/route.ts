import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { locationCode } = await request.json();

    if (!locationCode) {
      return NextResponse.json(
        { success: false, error: 'Codice ubicazione richiesto' },
        { status: 400 }
      );
    }

    console.log('🔍 Ricerca ubicazione:', locationCode);

    const odooUrl = process.env.ODOO_URL!;
    const odooDb = process.env.ODOO_DB || 'lapadevadmin-lapa-v2-staging-2406-24063382';

    // STEP 1: Autenticazione con credenziali corrette (stesso metodo del catalogo)
    console.log('🔑 Autenticazione Odoo per ubicazioni...');

    const authResponse = await fetch(`${odooUrl}/web/session/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          db: odooDb,
          login: 'paul@lapa.ch',
          password: 'lapa201180'
        },
        id: 1
      })
    });

    const authData = await authResponse.json();

    if (authData.error) {
      console.error('❌ Errore autenticazione ubicazioni:', authData.error);
      return NextResponse.json({
        success: false,
        error: 'Autenticazione fallita',
        details: authData.error.message
      }, { status: 401 });
    }

    if (!authData.result || !authData.result.uid) {
      return NextResponse.json({
        success: false,
        error: 'Autenticazione fallita - credenziali non valide',
        details: 'UID non ricevuto'
      }, { status: 401 });
    }

    const odooUid = authData.result.uid;

    // Estraiamo il session_id dai headers
    const setCookieHeader = authResponse.headers.get('set-cookie');
    let sessionId = null;

    if (setCookieHeader) {
      const sessionMatch = setCookieHeader.match(/session_id=([^;]+)/);
      sessionId = sessionMatch ? sessionMatch[1] : null;
    }

    console.log(`✅ Autenticato per ubicazioni! UID: ${odooUid}, Session ID: ${sessionId}`);

    // STEP 2: Cerca ubicazione
    const locationResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
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
          method: 'search_read',
          args: [
            [
              '|',
              ['barcode', '=', locationCode],
              ['name', 'ilike', locationCode]
            ]
          ],
          kwargs: {
            fields: ['id', 'name', 'complete_name', 'barcode'],
            limit: 1
          }
        },
        id: Math.random()
      })
    });

    const locationData = await locationResponse.json();

    if (locationData.error) {
      throw new Error(locationData.error.message || 'Errore ricerca ubicazione');
    }

    if (!locationData.result || locationData.result.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Ubicazione non trovata',
        details: `Nessuna ubicazione trovata per: ${locationCode}`
      }, { status: 404 });
    }

    const location = locationData.result[0];
    console.log(`📍 Ubicazione trovata: ${location.name}`);

    // STEP 3: Cerca prodotti in questa ubicazione (inclusi quelli con quantità 0)
    const inventoryResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session_id=${sessionId}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: 'stock.quant',
          method: 'search_read',
          args: [
            [
              ['location_id', '=', location.id]
            ]
          ],
          kwargs: {
            fields: ['product_id', 'quantity', 'reserved_quantity', 'lot_id'],
            limit: 100
          }
        },
        id: Math.random()
      })
    });

    const inventoryData = await inventoryResponse.json();

    if (inventoryData.error) {
      throw new Error(inventoryData.error.message || 'Errore ricerca inventario');
    }

    let products = inventoryData.result || [];
    console.log(`📦 Trovati ${products.length} record inventario nell'ubicazione`);

    // Se non ci sono prodotti, cerca alcuni prodotti del catalogo per gestione inventario
    if (products.length === 0) {
      console.log('🔍 Nessun inventario esistente, carico prodotti del catalogo per gestione...');

      const catalogResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
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
            method: 'search_read',
            args: [
              [['active', '=', true], ['type', '=', 'product']]
            ],
            kwargs: {
              fields: ['id', 'name', 'default_code', 'barcode'],
              limit: 20,
              order: 'name ASC'
            }
          },
          id: Math.random()
        })
      });

      const catalogData = await catalogResponse.json();
      if (catalogData.result) {
        products = catalogData.result.map((product: any) => ({
          product_id: [product.id, product.name],
          quantity: 0,
          reserved_quantity: 0,
          lot_id: false,
          _catalog_item: true
        }));
        console.log(`📋 Caricati ${products.length} prodotti del catalogo per gestione inventario`);
      }
    }

    return NextResponse.json({
      success: true,
      location: location,
      inventory: products,
      method: 'authenticated_session'
    });

  } catch (error: any) {
    console.error('❌ Errore ricerca ubicazione:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Errore interno del server' },
      { status: 500 }
    );
  }
}