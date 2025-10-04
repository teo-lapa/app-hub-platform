import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export async function POST(request: NextRequest) {
  try {
    const { cookies, uid } = await getOdooSession();
    if (!uid) {
      return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
    }

    const body = await request.json();
    const { original_picking_id, partner_id, products, note, photo } = body;

    console.log('📦 RESO API: Ricevuto payload:', {
      original_picking_id,
      partner_id,
      products_count: products?.length,
      has_note: !!note,
      has_photo: !!photo
    });

    if (!original_picking_id || !partner_id || !products || products.length === 0) {
      console.log('❌ RESO API: Dati reso mancanti');
      return NextResponse.json({ error: 'Dati reso mancanti' }, { status: 400 });
    }

    if (!note || note.trim() === '') {
      console.log('❌ RESO API: Motivo reso mancante');
      return NextResponse.json({ error: 'Motivo reso obbligatorio' }, { status: 400 });
    }

    if (!photo) {
      console.log('❌ RESO API: Foto danno mancante');
      return NextResponse.json({ error: 'Foto del danno obbligatoria' }, { status: 400 });
    }

    // Get original picking to reference
    const originalPickings = await callOdoo(
      cookies,
      'stock.picking',
      'read',
      [[original_picking_id]],
      { fields: ['name', 'picking_type_id', 'location_id', 'location_dest_id'] }
    );

    const originalPicking = originalPickings[0];

    // Find return picking type
    const returnPickingTypes = await callOdoo(
      cookies,
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
      cookies,
      'stock.picking',
      'create',
      [pickingData]
    );

    // Create stock moves for each product
    for (const product of products) {
      await callOdoo(
        cookies,
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
      cookies,
      'stock.picking',
      'action_confirm',
      [[returnPickingId]]
    );

    // Allega la foto del danno al picking di reso
    if (photo) {
      console.log('📸 RESO API: Allegando foto del danno...');
      try {
        // Rimuovi il prefixo "data:image/xxx;base64," se presente
        const base64Data = photo.includes('base64,') ? photo.split('base64,')[1] : photo;

        await callOdoo(
          cookies,
          'ir.attachment',
          'create',
          [{
            name: `Foto_Danno_${originalPicking.name}.jpg`,
            type: 'binary',
            datas: base64Data,
            res_model: 'stock.picking',
            res_id: returnPickingId,
            mimetype: 'image/jpeg'
          }]
        );
        console.log('✅ RESO API: Foto allegata con successo');
      } catch (photoError) {
        console.error('⚠️ RESO API: Errore allegando foto (non bloccante):', photoError);
      }
    }

    console.log('✅ RESO API: Reso creato con successo, ID:', returnPickingId);
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
