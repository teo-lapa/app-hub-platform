import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export async function POST(request: NextRequest) {
  try {
    const { page = 1, limit = 50, search } = await request.json();

    console.log('🛒 Richiesta catalogo LAPA:', { page, limit, search });

    const odooUrl = process.env.ODOO_URL!;
    const odooDb = process.env.ODOO_DB || 'lapadevadmin-lapa-v2-staging-2406-24063382';

    // STEP 1: Autenticazione con credenziali corrette
    console.log('🔑 Autenticazione con credenziali utente...');

    // Prima autentichiamoci con le credenziali corrette
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
    console.log('🔍 Risposta autenticazione completa:', JSON.stringify(authData, null, 2));

    if (authData.error) {
      console.error('❌ Errore autenticazione:', authData.error);
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

    console.log(`✅ Autenticato con successo! UID: ${odooUid}, Session ID: ${sessionId}`);

    // STEP 2: Carica prodotti usando la sessione autenticata
    try {
      console.log('✅ Usando sessione Odoo esistente');

      const offset = (page - 1) * limit;
      let domain: any[] = [['sale_ok', '=', true]];

      if (search && search.trim()) {
        domain = [
          ['sale_ok', '=', true],
          '|', '|', '|',
          ['name', 'ilike', search],
          ['default_code', 'ilike', search],
          ['barcode', '=', search],
          ['categ_id.name', 'ilike', search]
        ];
      }

      // Conta totale prodotti
      const countResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
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
            method: 'search_count',
            args: [domain],
            kwargs: {}
          },
          id: Math.random()
        })
      });

      const countData = await countResponse.json();
      const totalCount = countData.result || 0;

      // Carica prodotti
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
              fields: [
                'id', 'name', 'default_code', 'barcode', 'list_price',
                'categ_id', 'image_1920', 'description_sale', 'qty_available',
                'uom_id', 'standard_price', 'active', 'detailed_type'
              ],
              offset: offset,
              limit: limit,
              order: 'name ASC'
            }
          },
          id: Math.random()
        })
      });

        const productsData = await productsResponse.json();

      if (productsData && productsData.result && Array.isArray(productsData.result)) {
        console.log(`✅ Caricati ${productsData.result.length} prodotti dal catalogo LAPA!`);

        return NextResponse.json({
          success: true,
          data: productsData.result,
          total: totalCount,
          page: page,
          limit: limit,
          user: 'paul@lapa.ch',
          method: 'authenticated_session'
        });
      } else {
        throw new Error(productsData.error?.message || 'Errore nel caricamento prodotti');
      }

    } catch (error: any) {
      console.error('❌ Errore nel caricamento prodotti:', error);
      return NextResponse.json({
        success: false,
        error: 'Errore nel caricamento prodotti',
        details: error.message
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('💥 Errore generale API:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore interno del server',
      details: error.message
    }, { status: 500 });
  }
}