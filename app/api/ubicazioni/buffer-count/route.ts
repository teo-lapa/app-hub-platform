import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { locationId } = await request.json();

    if (!locationId) {
      return NextResponse.json({
        success: false,
        error: 'locationId richiesto'
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
          login: process.env.ODOO_USERNAME,
          password: process.env.ODOO_PASSWORD
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

    // Conta i prodotti nella location buffer
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
          model: 'stock.quant',
          method: 'search_count',
          args: [[
            ['location_id', '=', locationId],
            ['quantity', '>', 0]
          ]],
          kwargs: {}
        },
        id: 2
      })
    });

    const countData = await countResponse.json();
    const count = countData.result || 0;

    return NextResponse.json({
      success: true,
      count
    });

  } catch (error: any) {
    console.error('Errore buffer count:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore nel conteggio prodotti'
    }, { status: 500 });
  }
}
