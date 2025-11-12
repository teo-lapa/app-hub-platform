import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const ODOO_URL = process.env.ODOO_URL || 'https://lapadevadmin-lapa-v2-main-7268478.dev.odoo.com';

async function callOdoo(sessionId: string, model: string, method: string, args: any[] = [], kwargs: any = {}) {
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `session_id=${sessionId}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { model, method, args, kwargs },
      id: Math.floor(Math.random() * 1000000000)
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(JSON.stringify(data.error));
  return data.result;
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const sessionId = cookieStore.get('odoo_session_id')?.value;

    if (!sessionId) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    // Trova picking
    const pickings = await callOdoo(sessionId, 'stock.picking', 'search_read', [[
      ['name', '=', 'WH/OUT/34443']
    ]], { fields: ['id', 'name'] });

    const pickingId = pickings[0].id;

    // Leggi UNA move_line con TUTTI i campi
    const moveLines = await callOdoo(sessionId, 'stock.move.line', 'search_read', [[
      ['picking_id', '=', pickingId]
    ]], {
      fields: [],  // Vuoto = TUTTI i campi
      limit: 3
    });

    return NextResponse.json({
      success: true,
      pickingId,
      totalLines: moveLines.length,
      allFieldsExample: moveLines[0],
      quantityFields: Object.keys(moveLines[0]).filter(k =>
        k.includes('qty') || k.includes('quantity') || k.includes('reserved')
      )
    }, { status: 200 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
