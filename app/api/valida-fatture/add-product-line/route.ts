import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

/**
 * POST /api/valida-fatture/add-product-line
 *
 * Aggiunge una nuova riga prodotto alla fattura bozza
 * Body: {
 *   invoice_id: number,
 *   product_id: number,
 *   quantity: number,
 *   price_unit: number,
 *   name?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    console.log('➕ [ADD-PRODUCT-LINE] Starting...');

    const userCookies = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(userCookies || undefined);

    if (!uid) {
      return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
    }

    const body = await request.json();
    const { invoice_id, product_id, quantity, price_unit, name } = body;

    if (!invoice_id || !product_id || !quantity || price_unit === undefined) {
      return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 });
    }

    console.log(`➕ [ADD-PRODUCT-LINE] Adding product ${product_id} to invoice ${invoice_id}`);

    // Carica dati prodotto
    const product = await callOdoo(
      cookies,
      'product.product',
      'read',
      [[product_id]],
      {
        fields: ['name', 'uom_id', 'taxes_id']
      }
    );

    if (!product || product.length === 0) {
      throw new Error('Prodotto non trovato');
    }

    const productData = product[0];

    // Crea nuova riga fattura
    const newLine = await callOdoo(
      cookies,
      'account.move.line',
      'create',
      [{
        move_id: invoice_id,
        product_id: product_id,
        name: name || productData.name,
        quantity: quantity,
        price_unit: price_unit,
        product_uom_id: productData.uom_id ? productData.uom_id[0] : false,
        tax_ids: productData.taxes_id || [],
      }]
    );

    console.log(`✅ [ADD-PRODUCT-LINE] Created line ID: ${newLine}`);

    // Ricarica fattura aggiornata
    const updatedInvoice = await callOdoo(
      cookies,
      'account.move',
      'read',
      [[invoice_id]],
      {
        fields: ['amount_total', 'amount_untaxed', 'amount_tax']
      }
    );

    return NextResponse.json({
      success: true,
      line_id: newLine,
      new_total: updatedInvoice[0].amount_total
    });

  } catch (error: any) {
    console.error('❌ [ADD-PRODUCT-LINE] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Errore aggiunta riga' },
      { status: 500 }
    );
  }
}
