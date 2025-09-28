import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { productIds, searchQuery } = await request.json();
    console.log('🔍 Ricerca prodotti inventario:', { productIds, searchQuery });

    const odooUrl = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24063382.dev.odoo.com';
    const odooDb = process.env.ODOO_DB || 'lapadevadmin-lapa-v2-staging-2406-24063382';

    // STEP 1: Autenticazione con credenziali corrette (stesso metodo del catalogo)
    console.log('🔑 Autenticazione Odoo per prodotti inventario...');

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
      console.error('❌ Errore autenticazione prodotti:', authData.error);
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

    console.log(`✅ Autenticato per prodotti inventario! UID: ${odooUid}, Session ID: ${sessionId}`);

    // STEP 2: Costruisci la query di ricerca
    let domain: any[] = [];

    if (productIds && productIds.length > 0) {
      // Ricerca per ID specifici
      domain = [['id', 'in', productIds]];
    } else if (searchQuery && searchQuery.trim()) {
      // Ricerca per testo
      const search = searchQuery.trim();
      domain = [
        '|', '|', '|',
        ['name', 'ilike', search],
        ['default_code', 'ilike', search],
        ['barcode', '=', search],
        ['barcode', 'ilike', search]
      ];
    } else {
      // Ricerca generica - primi prodotti
      domain = [['active', '=', true]];
    }

    // STEP 3: Cerca prodotti
    const productsResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
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
          args: [domain],
          kwargs: {
            fields: ['id', 'name', 'default_code', 'barcode', 'image_128', 'uom_id'],
            limit: 20
          }
        },
        id: Math.random()
      })
    });

    const productsData = await productsResponse.json();

    if (productsData.error) {
      throw new Error(productsData.error.message || 'Errore ricerca prodotti');
    }

    console.log(`📦 Trovati ${productsData.result.length} prodotti per inventario`);

    return NextResponse.json({
      success: true,
      data: productsData.result || [],
      products: productsData.result || [],
      method: 'authenticated_session'
    });

  } catch (error: any) {
    console.error('❌ Errore ricerca prodotti inventario:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Errore interno del server' },
      { status: 500 }
    );
  }
}