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
    const { original_picking_id, partner_id, products, note } = body;

    if (!original_picking_id || !partner_id || !products || products.length === 0) {
      return NextResponse.json({ error: 'Dati reso mancanti' }, { status: 400 });
    }

    if (!note || note.trim() === '') {
      return NextResponse.json({ error: 'Motivo reso obbligatorio' }, { status: 400 });
    }

    // Get original picking to reference
    const originalPickings = await callOdoo(
      sessionId,
      'stock.picking',
      'read',
      [[original_picking_id]],
      { fields: ['name', 'picking_type_id', 'location_id', 'location_dest_id'] }
    );

    const originalPicking = originalPickings[0];

    // Find return picking type
    const returnPickingTypes = await callOdoo(
      sessionId,
      'stock.picking.type',
      'search_read',
      [[['code', '=', 'incoming'], ['warehouse_id', '!=', false]]],
      { fields: ['id'], limit: 1 }
    );

    const returnPickingTypeId = returnPickingTypes[0]?.id;

    if (!returnPickingTypeId) {
      return NextResponse.json({ error: 'Tipo picking reso non trovato' }, { status: 404 });
    }

    // Create return picking
    const pickingData = {
      picking_type_id: returnPickingTypeId,
      partner_id: partner_id,
      origin: `Reso da ${originalPicking.name}`,
      note: note,
      location_id: originalPicking.location_dest_id[0], // Customer location
      location_dest_id: originalPicking.location_id[0], // Warehouse location
      move_lines: []
    };

    const returnPickingId = await callOdoo(
      sessionId,
      'stock.picking',
      'create',
      [pickingData]
    );

    // Create stock moves for each product
    for (const product of products) {
      await callOdoo(
        sessionId,
        'stock.move',
        'create',
        [{
          name: `Reso: ${product.name}`,
          product_id: product.product_id,
          product_uom_qty: product.quantity,
          product_uom: 1, // Unit of measure - should be fetched from product
          picking_id: returnPickingId,
          location_id: originalPicking.location_dest_id[0],
          location_dest_id: originalPicking.location_id[0]
        }]
      );
    }

    // Confirm the return picking
    await callOdoo(
      sessionId,
      'stock.picking',
      'action_confirm',
      [[returnPickingId]]
    );

    return NextResponse.json({
      success: true,
      return_picking_id: returnPickingId,
      message: 'Reso creato con successo'
    });
  } catch (error: any) {
    console.error('Error creating return:', error);
    return NextResponse.json(
      { error: error.message || 'Errore creazione reso' },
      { status: 500 }
    );
  }
}
