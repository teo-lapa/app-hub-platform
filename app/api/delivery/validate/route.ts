import { NextRequest, NextResponse } from 'next/server';

const ODOO_URL = process.env.ODOO_URL || process.env.NEXT_PUBLIC_ODOO_URL;

async function callOdoo(sessionId: string, model: string, method: string, args: any[], kwargs: any = {}) {
  const response = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Openerp-Session-Id': sessionId
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: {
        model,
        method,
        args,
        kwargs
      }
    })
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.data?.message || 'Errore Odoo');
  }

  return data.result;
}

export async function POST(request: NextRequest) {
  try {
    const sessionId = request.cookies.get('session_id')?.value;
    if (!sessionId) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    const body = await request.json();
    const { picking_id, products } = body;

    if (!picking_id || !products || products.length === 0) {
      return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 });
    }

    // Update quantity_done for each product
    for (const product of products) {
      await callOdoo(
        sessionId,
        'stock.move',
        'write',
        [[product.move_id], { quantity_done: product.quantity_done }]
      );
    }

    // Validate the picking (button_validate)
    const result = await callOdoo(
      sessionId,
      'stock.picking',
      'button_validate',
      [[picking_id]]
    );

    // If validation creates a backorder wizard, handle it
    if (result && typeof result === 'object' && result.res_model === 'stock.backorder.confirmation') {
      // Auto-confirm backorder creation
      await callOdoo(
        sessionId,
        'stock.backorder.confirmation',
        'process',
        [[result.res_id]]
      );
    }

    // Update picking state to done
    await callOdoo(
      sessionId,
      'stock.picking',
      'write',
      [[picking_id], { state: 'done' }]
    );

    return NextResponse.json({
      success: true,
      message: 'Consegna validata con successo'
    });
  } catch (error: any) {
    console.error('Error validating delivery:', error);
    return NextResponse.json(
      { error: error.message || 'Errore validazione consegna' },
      { status: 500 }
    );
  }
}
