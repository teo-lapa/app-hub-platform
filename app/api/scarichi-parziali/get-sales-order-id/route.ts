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

    const { salesOrderName } = await request.json();

    if (!salesOrderName) {
      return NextResponse.json(
        { success: false, error: 'Nome sales order mancante' },
        { status: 400 }
      );
    }

    // Cerca il sales order per nome
    const salesOrders = await callOdoo(sessionId, 'sale.order', 'search_read', [[
      ['name', '=', salesOrderName]
    ]], {
      fields: ['id', 'name'],
      limit: 1
    });

    if (salesOrders && salesOrders.length > 0) {
      return NextResponse.json({
        success: true,
        salesOrderId: salesOrders[0].id
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Sales order non trovato'
      });
    }

  } catch (error: any) {
    console.error('❌ Errore get-sales-order-id:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore del server'
    }, { status: 500 });
  }
}
