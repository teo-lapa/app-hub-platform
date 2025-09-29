import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { model, method, args, kwargs } = await request.json();

    console.log(`🔧 [API] RPC Call: ${model}.${method}`, args);

    const odooUrl = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24063382.dev.odoo.com';
    const odooDb = process.env.ODOO_DB || 'lapadevadmin-lapa-v2-staging-2406-24063382';

    // STEP 1: Autenticazione con credenziali (stesso metodo dell'inventario)
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
      console.error('❌ Errore autenticazione RPC:', authData.error);
      return NextResponse.json({ success: false, error: 'Errore autenticazione' }, { status: 401 });
    }

    // STEP 2: Estrazione cookies di sessione
    const cookies = authResponse.headers.get('set-cookie');

    // STEP 3: Chiamata RPC effettiva (con headers come nell'HTML)
    const rpcResponse = await fetch(`${odooUrl}/web/dataset/call_kw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'Cookie': cookies || ''
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: model,
          method: method,
          args: args,
          kwargs: kwargs || {},
          context: {}
        },
        id: Math.floor(Math.random() * 1000000000)
      })
    });

    const rpcData = await rpcResponse.json();

    if (rpcData.error) {
      console.error('❌ Errore RPC:', rpcData.error);
      return NextResponse.json({
        success: false,
        error: rpcData.error.message || 'Errore RPC',
        details: rpcData.error
      }, { status: 500 });
    }

    console.log(`✅ [API] RPC Success: ${model}.${method}`);

    return NextResponse.json({
      success: true,
      result: rpcData.result
    });

  } catch (error) {
    console.error('❌ Errore generale RPC API:', error);
    return NextResponse.json({
      success: false,
      error: 'Errore interno del server',
      details: error instanceof Error ? error.message : 'Errore sconosciuto'
    }, { status: 500 });
  }
}