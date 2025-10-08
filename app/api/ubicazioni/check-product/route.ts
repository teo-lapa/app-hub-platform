import { NextRequest, NextResponse } from 'next/server';

/**
 * API per verificare se un prodotto esiste già in un'ubicazione
 */
export async function POST(request: NextRequest) {
  try {
    const { productId, locationId } = await request.json();

    if (!productId || !locationId) {
      return NextResponse.json({
        success: false,
        error: 'Parametri mancanti'
      }, { status: 400 });
    }

    const odooUrl = process.env.ODOO_URL || process.env.NEXT_PUBLIC_ODOO_URL;
    const odooDb = process.env.ODOO_DB || process.env.NEXT_PUBLIC_ODOO_DB;

    // Autenticazione
    const authResponse = await fetch(`${odooUrl}/web/session/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          db: odooDb,
          login: process.env.ODOO_USERNAME || 'paul@lapa.ch',
          password: process.env.ODOO_PASSWORD || 'lapa201180'
        },
        id: 1
      })
    });

    const authData = await authResponse.json();
    if (!authData.result || !authData.result.uid) {
      throw new Error('Autenticazione fallita');
    }

    const setCookieHeader = authResponse.headers.get('set-cookie');
    const sessionMatch = setCookieHeader?.match(/session_id=([^;]+)/);
    const sessionId = sessionMatch ? sessionMatch[1] : null;

    // Cerca quants del prodotto in questa ubicazione
    const quantResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
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
          method: 'search_count',
          args: [[
            ['product_id', '=', productId],
            ['location_id', '=', locationId],
            ['quantity', '>', 0]
          ]],
          kwargs: {}
        },
        id: 2
      })
    });

    const quantData = await quantResponse.json();
    const count = quantData.result || 0;

    return NextResponse.json({
      success: true,
      exists: count > 0,
      count
    });

  } catch (error: any) {
    console.error('❌ Errore verifica prodotto:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore nella verifica'
    }, { status: 500 });
  }
}
