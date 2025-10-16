import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

/**
 * POST /api/valida-fatture/search-products
 *
 * Cerca prodotti in Odoo filtrati per fornitore
 * Body: { supplier_id: number, search_term?: string }
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔍 [SEARCH-PRODUCTS] Starting...');

    const userCookies = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(userCookies || undefined);

    if (!uid) {
      return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 });
    }

    const body = await request.json();
    const { supplier_id, search_term } = body;

    if (!supplier_id) {
      return NextResponse.json({ error: 'supplier_id richiesto' }, { status: 400 });
    }

    console.log(`🔍 [SEARCH-PRODUCTS] Searching products for supplier ${supplier_id}, term: "${search_term || 'ALL'}"`);

    // Costruisci domain per cercare prodotti del fornitore
    const domain: any[] = [
      ['purchase_ok', '=', true], // Prodotti acquistabili
    ];

    // Cerca prodotti dove il fornitore è tra i seller_ids
    // In Odoo i fornitori sono in product.supplierinfo con partner_id
    // Cerchiamo prima gli ID dei supplierinfo per questo fornitore
    const supplierInfos = await callOdoo(
      cookies,
      'product.supplierinfo',
      'search_read',
      [
        [['partner_id', '=', supplier_id]]
      ],
      {
        fields: ['product_tmpl_id', 'product_id', 'price'],
        limit: 200
      }
    );

    console.log(`📦 [SEARCH-PRODUCTS] Found ${supplierInfos.length} supplier products`);

    if (supplierInfos.length === 0) {
      return NextResponse.json({
        success: true,
        products: []
      });
    }

    // Estrai product IDs (possono essere product.product o product.template)
    const productIds = supplierInfos
      .filter((si: any) => si.product_id && si.product_id[0])
      .map((si: any) => si.product_id[0]);

    if (productIds.length === 0) {
      return NextResponse.json({
        success: true,
        products: []
      });
    }

    // Cerca i prodotti con questi IDs
    const productDomain: any[] = [['id', 'in', productIds]];

    // Aggiungi filtro per termine di ricerca se specificato
    if (search_term && search_term.trim().length > 0) {
      productDomain.push('|');
      productDomain.push(['name', 'ilike', search_term]);
      productDomain.push('|');
      productDomain.push(['default_code', 'ilike', search_term]);
      productDomain.push(['barcode', 'ilike', search_term]);
    }

    const products = await callOdoo(
      cookies,
      'product.product',
      'search_read',
      [productDomain],
      {
        fields: [
          'id',
          'name',
          'default_code',
          'barcode',
          'list_price',
          'standard_price',
          'uom_id',
          'seller_ids'
        ],
        limit: 50,
        order: 'name asc'
      }
    );

    console.log(`✅ [SEARCH-PRODUCTS] Found ${products.length} matching products`);

    return NextResponse.json({
      success: true,
      products
    });

  } catch (error: any) {
    console.error('❌ [SEARCH-PRODUCTS] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Errore ricerca prodotti' },
      { status: 500 }
    );
  }
}
