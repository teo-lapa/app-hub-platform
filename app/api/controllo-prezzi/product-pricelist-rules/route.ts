import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/controllo-prezzi/product-pricelist-rules?productId=123
 *
 * Recupera TUTTE le regole di prezzo (pricelist items) per un prodotto specifico
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const productId = searchParams.get('productId');

    if (!productId) {
      return NextResponse.json({
        success: false,
        error: 'productId richiesto'
      }, { status: 400 });
    }

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('odoo_session_id');

    if (!sessionCookie?.value) {
      return NextResponse.json({
        success: false,
        error: 'Sessione non valida'
      }, { status: 401 });
    }

    const sessionId = sessionCookie.value;
    const cookieHeader = `session_id=${sessionId}`;

    console.log(`📋 Recupero regole di prezzo per prodotto ${productId}...`);

    // Recupera tutte le regole per questo prodotto
    const pricelistItems = await callOdoo(
      cookieHeader,
      'product.pricelist.item',
      'search_read',
      [],
      {
        domain: [
          ['product_id', '=', parseInt(productId)],
          ['applied_on', '=', '0_product_variant']
        ],
        fields: [
          'id',
          'pricelist_id',
          'compute_price',
          'fixed_price',
          'percent_price',
          'price_discount',
          'min_quantity'
        ],
        limit: 0
      }
    );

    if (!pricelistItems || pricelistItems.length === 0) {
      return NextResponse.json({
        success: true,
        rules: [],
        count: 0
      });
    }

    console.log(`✅ Trovate ${pricelistItems.length} regole di prezzo`);

    // Formatta risultati
    const formattedRules = pricelistItems.map((item: any) => ({
      id: item.id,
      pricelistId: item.pricelist_id ? item.pricelist_id[0] : 0,
      pricelistName: item.pricelist_id ? item.pricelist_id[1] : 'Sconosciuto',
      computePrice: item.compute_price, // 'fixed', 'percentage', 'formula'
      fixedPrice: item.fixed_price || 0,
      percentPrice: item.percent_price || 0, // Sconto percentuale
      priceDiscount: item.price_discount || 0,
      minQuantity: item.min_quantity || 1
    }));

    return NextResponse.json({
      success: true,
      rules: formattedRules,
      count: formattedRules.length
    });

  } catch (error: any) {
    console.error('❌ Errore recupero regole prezzo:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore durante il recupero delle regole'
    }, { status: 500 });
  }
}
