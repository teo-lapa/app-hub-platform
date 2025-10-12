import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { model, method, args = [], kwargs = {} } = body;

    console.log(`📡 Odoo Proxy: ${model}.${method}`);

    // Usa l'autenticazione unificata
    const authResponse = await fetch(`${request.nextUrl.origin}/api/auth/unified-odoo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const authData = await authResponse.json();

    if (!authData.success) {
      return NextResponse.json(
        { error: 'Autenticazione fallita' },
        { status: 401 }
      );
    }

    const odooUrl = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-staging-2406-24517859.dev.odoo.com';
    const cookies = authData.cookies || [];

    // Chiama Odoo con le credenziali
    const odooResponse = await fetch(`${odooUrl}/web/dataset/call_kw/${model}/${method}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'Cookie': cookies.join('; '),
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'call',
        params: { model, method, args, kwargs },
        id: Date.now(),
      }),
    });

    const data = await odooResponse.json();

    if (data.error) {
      console.error('❌ Odoo Error:', data.error);
      return NextResponse.json(
        { error: data.error.data?.message || data.error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ result: data.result });

  } catch (error: any) {
    console.error('❌ Proxy Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
