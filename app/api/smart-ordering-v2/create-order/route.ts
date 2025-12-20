import { NextRequest, NextResponse } from 'next/server';
import { createOdoo, searchReadOdoo } from '@/lib/odoo/odoo-helper';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { supplierId, items } = body;

    if (!supplierId || !items || items.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'supplierId e items sono richiesti'
      }, { status: 400 });
    }

    console.log(`📦 Creazione ordine per fornitore ${supplierId} con ${items.length} prodotti`);

    // 1. Trova il fornitore in Odoo (inclusa la valuta per gli acquisti)
    const partners = await searchReadOdoo('res.partner', [
      ['id', '=', supplierId]
    ], ['name', 'email', 'property_purchase_currency_id']);

    if (!partners || partners.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Fornitore non trovato'
      }, { status: 404 });
    }

    const supplier = partners[0];
    console.log(`✅ Fornitore trovato: ${supplier.name}`);

    // 2. Prepara le righe ordine
    const orderLines = [];

    // Format date for Odoo: 'YYYY-MM-DD HH:MM:SS'
    const now = new Date();
    const odooDate = now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0') + ' ' +
      String(now.getHours()).padStart(2, '0') + ':' +
      String(now.getMinutes()).padStart(2, '0') + ':' +
      String(now.getSeconds()).padStart(2, '0');

    for (const item of items) {
      // Cerca il prodotto per ottenere le info necessarie
      const products = await searchReadOdoo('product.product', [
        ['id', '=', item.productId]
      ], ['name', 'uom_id', 'standard_price', 'list_price']);

      if (products && products.length > 0) {
        const product = products[0];
        orderLines.push([0, 0, {
          product_id: item.productId,
          product_qty: item.qty,
          product_uom: product.uom_id[0],
          price_unit: product.standard_price || product.list_price || 0,
          name: product.name,
          date_planned: odooDate
        }]);
      }
    }

    if (orderLines.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Nessun prodotto valido trovato'
      }, { status: 400 });
    }

    // 3. Crea l'ordine di acquisto in Odoo
    const orderData: Record<string, unknown> = {
      partner_id: supplierId,
      order_line: orderLines,
      notes: `🤖 Ordine generato automaticamente da LAPA Smart Ordering AI\nData: ${new Date().toLocaleString('it-IT')}\nProdotti: ${items.length}`
    };

    // Imposta la valuta del fornitore se presente
    if (supplier.property_purchase_currency_id && supplier.property_purchase_currency_id[0]) {
      orderData.currency_id = supplier.property_purchase_currency_id[0];
      console.log(`💱 Valuta fornitore: ${supplier.property_purchase_currency_id[1]} (ID: ${supplier.property_purchase_currency_id[0]})`);
    }

    console.log(`🚀 Creazione purchase.order in Odoo...`);
    const orderId = await createOdoo('purchase.order', orderData);

    console.log(`✅ Ordine creato con ID: ${orderId}`);

    // 4. Opzionale: conferma automaticamente l'ordine
    // await callOdoo('purchase.order', 'button_confirm', [[orderId]]);

    return NextResponse.json({
      success: true,
      orderId: orderId,
      supplierName: supplier.name,
      itemCount: orderLines.length,
      message: `Ordine ${orderId} creato per ${supplier.name} con ${orderLines.length} prodotti`
    });

  } catch (error: any) {
    console.error('❌ Errore creazione ordine:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
