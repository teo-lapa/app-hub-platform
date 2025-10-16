import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * ADD PRODUCT TO PICKING
 *
 * Aggiunge un prodotto a un picking esistente
 * Crea stock.move e stock.move.line
 *
 * INPUT:
 * - picking_id: ID del picking (ricezione)
 * - product_id: ID del prodotto da aggiungere
 * - quantity: quantità da ricevere
 * - lot_number: numero lotto (opzionale)
 * - expiry_date: data scadenza (opzionale)
 *
 * OUTPUT:
 * - move_id: ID del stock.move creato
 * - move_line_id: ID della stock.move.line creata
 */
export async function POST(request: NextRequest) {
  try {
    const userCookies = request.headers.get('cookie') || undefined;
    const { cookies, uid } = await getOdooSession(userCookies);

    if (!uid) {
      return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
    }

    const body = await request.json();
    const { picking_id, product_id, quantity, lot_number, expiry_date } = body;

    if (!picking_id || !product_id) {
      return NextResponse.json({
        error: 'Parametri mancanti: picking_id e product_id richiesti'
      }, { status: 400 });
    }

    console.log('📦 [ADD-PRODUCT] Aggiunta prodotto al picking:', {
      picking_id,
      product_id,
      quantity,
      lot_number,
      expiry_date
    });

    // Step 1: Recupera informazioni sul picking
    const picking = await callOdoo(cookies, 'stock.picking', 'read', [
      [picking_id],
      ['partner_id', 'location_id', 'location_dest_id', 'picking_type_id']
    ]);

    if (!picking || picking.length === 0) {
      return NextResponse.json({ error: 'Picking non trovato' }, { status: 404 });
    }

    const pickingData = picking[0];
    console.log('📋 Picking trovato:', pickingData);

    // Step 2: Recupera informazioni sul prodotto
    const product = await callOdoo(cookies, 'product.product', 'read', [
      [product_id],
      ['name', 'uom_id', 'tracking']
    ]);

    if (!product || product.length === 0) {
      return NextResponse.json({ error: 'Prodotto non trovato' }, { status: 404 });
    }

    const productData = product[0];
    console.log('📦 Prodotto trovato:', productData.name);

    // Step 3: Crea stock.move
    const moveData = {
      name: productData.name,
      product_id: product_id,
      product_uom_qty: quantity || 1,
      product_uom: productData.uom_id[0],
      picking_id: picking_id,
      location_id: pickingData.location_id[0],
      location_dest_id: pickingData.location_dest_id[0],
      picking_type_id: pickingData.picking_type_id[0],
      state: 'draft'
    };

    console.log('🔨 Creazione stock.move...');
    const moveId = await callOdoo(cookies, 'stock.move', 'create', [moveData]);
    console.log('✅ Stock.move creato:', moveId);

    // Step 4: Conferma il move per creare automaticamente le move_lines
    await callOdoo(cookies, 'stock.move', '_action_confirm', [[moveId]]);
    console.log('✅ Stock.move confermato');

    // Step 5: Recupera le move_line create automaticamente
    const moveLines = await callOdoo(cookies, 'stock.move.line', 'search_read', [
      [['move_id', '=', moveId]],
      ['id', 'product_id', 'product_uom_id', 'location_id', 'location_dest_id']
    ]);

    let moveLineId = null;

    if (moveLines.length > 0) {
      moveLineId = moveLines[0].id;
      console.log('✅ Stock.move.line esistente trovata:', moveLineId);
    } else {
      // Se non è stata creata automaticamente, la creiamo manualmente
      console.log('🔨 Creazione stock.move.line manuale...');

      const moveLineData: any = {
        move_id: moveId,
        product_id: product_id,
        product_uom_id: productData.uom_id[0],
        location_id: pickingData.location_id[0],
        location_dest_id: pickingData.location_dest_id[0],
        picking_id: picking_id,
        quantity: quantity || 1,
        qty_done: 0
      };

      moveLineId = await callOdoo(cookies, 'stock.move.line', 'create', [moveLineData]);
      console.log('✅ Stock.move.line creata:', moveLineId);
    }

    // Step 6: Se c'è un lotto, gestiscilo
    let lotId = null;
    if (lot_number) {
      console.log('🏷️ Gestione lotto:', lot_number);

      // Cerca se il lotto esiste già
      const existingLots = await callOdoo(cookies, 'stock.lot', 'search_read', [
        [['name', '=', lot_number], ['product_id', '=', product_id]],
        ['id', 'name']
      ]);

      if (existingLots.length > 0) {
        lotId = existingLots[0].id;
        console.log('✅ Lotto esistente trovato:', lotId);
      } else {
        // Crea nuovo lotto
        const lotData: any = {
          name: lot_number,
          product_id: product_id,
          company_id: 1 // TODO: recuperare company_id dal picking
        };

        if (expiry_date) {
          lotData.expiration_date = expiry_date;
        }

        lotId = await callOdoo(cookies, 'stock.lot', 'create', [lotData]);
        console.log('✅ Nuovo lotto creato:', lotId);
      }

      // Aggiorna la move_line con il lotto
      await callOdoo(cookies, 'stock.move.line', 'write', [
        [moveLineId],
        { lot_id: lotId, lot_name: lot_number }
      ]);
      console.log('✅ Lotto assegnato alla move_line');
    }

    // Step 7: Recupera i dati completi della move_line creata
    const finalMoveLine = await callOdoo(cookies, 'stock.move.line', 'read', [
      [moveLineId],
      [
        'id',
        'move_id',
        'product_id',
        'product_uom_id',
        'lot_id',
        'lot_name',
        'qty_done',
        'quantity',
        'location_id',
        'location_dest_id'
      ]
    ]);

    console.log('✅ [ADD-PRODUCT] Prodotto aggiunto con successo al picking!');

    return NextResponse.json({
      success: true,
      move_id: moveId,
      move_line_id: moveLineId,
      lot_id: lotId,
      move_line: finalMoveLine[0]
    });

  } catch (error: any) {
    console.error('❌ [ADD-PRODUCT] Error:', error);
    return NextResponse.json({
      error: error.message || 'Errore durante l\'aggiunta del prodotto al picking',
      details: error.toString()
    }, { status: 500 });
  }
}
