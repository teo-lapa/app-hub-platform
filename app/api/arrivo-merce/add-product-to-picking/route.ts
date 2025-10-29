import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * ADD PRODUCT TO PICKING
 *
 * Aggiunge un prodotto al Purchase Order collegato al picking
 * Questo crea automaticamente i movimenti nel picking
 *
 * INPUT:
 * - picking_id: ID del picking (ricezione)
 * - product_id: ID del prodotto da aggiungere
 * - quantity: quantità da ricevere
 * - lot_number: numero lotto (opzionale)
 * - expiry_date: data scadenza (opzionale)
 *
 * OUTPUT:
 * - po_line_id: ID della purchase.order.line creata
 * - purchase_order_id: ID del PO aggiornato
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

    // Step 1: Trova il Purchase Order collegato al picking
    const picking = await callOdoo(cookies, 'stock.picking', 'read', [
      [picking_id],
      ['partner_id', 'origin', 'purchase_id']
    ]);

    if (!picking || picking.length === 0) {
      return NextResponse.json({ error: 'Picking non trovato' }, { status: 404 });
    }

    const pickingData = picking[0];
    console.log('📋 Picking trovato:', pickingData);

    // Trova il Purchase Order
    let purchaseOrderId = null;

    if (pickingData.purchase_id) {
      // Modo diretto: campo purchase_id
      purchaseOrderId = pickingData.purchase_id[0];
      console.log('✅ PO trovato da campo purchase_id:', purchaseOrderId);
    } else if (pickingData.origin) {
      // Modo alternativo: cerca PO dal campo origin (es: "P00123")
      const poSearch = await callOdoo(cookies, 'purchase.order', 'search', [
        [['name', '=', pickingData.origin]]
      ]);

      if (poSearch && poSearch.length > 0) {
        purchaseOrderId = poSearch[0];
        console.log('✅ PO trovato da origin:', purchaseOrderId);
      }
    }

    if (!purchaseOrderId) {
      return NextResponse.json({
        error: 'Purchase Order non trovato. Il picking potrebbe non essere collegato a un ordine di acquisto.'
      }, { status: 404 });
    }

    // Step 2: Recupera informazioni sul PO
    const purchaseOrder = await callOdoo(cookies, 'purchase.order', 'read', [
      [purchaseOrderId],
      ['id', 'name', 'partner_id', 'state', 'currency_id']
    ]);

    if (!purchaseOrder || purchaseOrder.length === 0) {
      return NextResponse.json({ error: 'Purchase Order non trovato' }, { status: 404 });
    }

    const poData = purchaseOrder[0];
    console.log('📝 Purchase Order trovato:', poData.name, '- Stato:', poData.state);

    // Step 3: Recupera informazioni sul prodotto
    const product = await callOdoo(cookies, 'product.product', 'read', [
      [product_id],
      ['name', 'uom_po_id', 'seller_ids']
    ]);

    if (!product || product.length === 0) {
      return NextResponse.json({ error: 'Prodotto non trovato' }, { status: 404 });
    }

    const productData = product[0];
    console.log('📦 Prodotto trovato:', productData.name);

    // Step 4: Cerca il prezzo dal fornitore
    let productPrice = 0;
    if (productData.seller_ids && productData.seller_ids.length > 0) {
      // Cerca il prezzo per questo fornitore
      const supplierInfo = await callOdoo(cookies, 'product.supplierinfo', 'search_read', [
        [
          ['id', 'in', productData.seller_ids],
          ['partner_id', '=', poData.partner_id[0]]
        ],
        ['price', 'min_qty']
      ]);

      if (supplierInfo && supplierInfo.length > 0) {
        productPrice = supplierInfo[0].price;
        console.log('💰 Prezzo fornitore trovato:', productPrice);
      }
    }

    // Step 5: Crea purchase.order.line
    const poLineData: any = {
      order_id: purchaseOrderId,
      product_id: product_id,
      name: productData.name,
      product_qty: quantity || 1,
      product_uom: productData.uom_po_id[0],
      price_unit: productPrice,
      date_planned: new Date().toISOString().split('T')[0] // Data di oggi
    };

    console.log('🔨 Creazione purchase.order.line...');
    const poLineId = await callOdoo(cookies, 'purchase.order.line', 'create', [poLineData]);
    console.log('✅ Purchase.order.line creata:', poLineId);

    // Step 6: Se il PO è in stato 'draft', confermalo per generare i movimenti
    if (poData.state === 'draft') {
      console.log('🔄 Confermo Purchase Order...');
      await callOdoo(cookies, 'purchase.order', 'button_confirm', [[purchaseOrderId]]);
      console.log('✅ Purchase Order confermato');
    }

    // Step 7: Recupera i dati della riga creata
    const finalPoLine = await callOdoo(cookies, 'purchase.order.line', 'read', [
      [poLineId],
      [
        'id',
        'order_id',
        'product_id',
        'product_qty',
        'product_uom',
        'price_unit',
        'price_subtotal',
        'date_planned'
      ]
    ]);

    console.log('✅ [ADD-PRODUCT] Prodotto aggiunto con successo al Purchase Order!');
    console.log('   Questo creerà automaticamente i movimenti nel picking');

    return NextResponse.json({
      success: true,
      po_line_id: poLineId,
      purchase_order_id: purchaseOrderId,
      purchase_order_name: poData.name,
      po_line: finalPoLine[0]
    });

  } catch (error: any) {
    console.error('❌ [ADD-PRODUCT] Error:', error);
    return NextResponse.json({
      error: error.message || 'Errore durante l\'aggiunta del prodotto al picking',
      details: error.toString()
    }, { status: 500 });
  }
}
