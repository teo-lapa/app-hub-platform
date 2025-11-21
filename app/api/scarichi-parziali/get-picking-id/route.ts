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
      params: {
        model,
        method,
        args,
        kwargs
      },
      id: Math.floor(Math.random() * 1000000000)
    })
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`Errore ${model}.${method}: ${JSON.stringify(data.error)}`);
  }

  return data.result;
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const sessionId = cookieStore.get('odoo_session_id')?.value;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Non autenticato' },
        { status: 401 }
      );
    }

    const { pickingName } = await request.json();

    if (!pickingName) {
      return NextResponse.json(
        { success: false, error: 'Nome picking mancante' },
        { status: 400 }
      );
    }

    // Cerca il picking per nome
    const pickings = await callOdoo(sessionId, 'stock.picking', 'search_read', [[
      ['name', '=', pickingName]
    ]], {
      fields: ['id', 'name'],
      limit: 1
    });

    if (pickings && pickings.length > 0) {
      return NextResponse.json({
        success: true,
        pickingId: pickings[0].id
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Picking non trovato'
      });
    }

  } catch (error: any) {
    console.error('❌ Errore get-picking-id:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore del server'
    }, { status: 500 });
  }
}
