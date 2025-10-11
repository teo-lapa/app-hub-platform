import { NextRequest, NextResponse } from 'next/server';
import { getOdooSessionId } from '@/lib/odoo/odoo-helper';

export async function POST(request: NextRequest) {
  try {
    const sessionId = await getOdooSessionId();
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Sessione non valida. Effettua il login.' },
        { status: 401 }
      );
    }

    const { locationId } = await request.json();

    if (!locationId) {
      return NextResponse.json({
        success: false,
        error: 'locationId richiesto'
      }, { status: 400 });
    }

    const odooUrl = process.env.ODOO_URL || process.env.NEXT_PUBLIC_ODOO_URL;

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
