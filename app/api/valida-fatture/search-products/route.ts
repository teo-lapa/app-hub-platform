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
    const { search_term } = body;

    console.log(`🔍 [SEARCH-PRODUCTS] Searching in general catalog, term: "${search_term || 'ALL'}"`);

    // Cerca nel CATALOGO GENERALE LAPA (non solo fornitore specifico)
    const productDomain: any[] = [
      ['purchase_ok', '=', true], // Prodotti acquistabili
    ];

    // Aggiungi filtro per termine di ricerca se specificato
    if (search_term && search_term.trim().length > 0) {
      const term = search_term.trim();
      productDomain.push('|');
      productDomain.push(['name', 'ilike', term]);
      productDomain.push('|');
      productDomain.push(['default_code', 'ilike', term]);
      productDomain.push(['barcode', 'ilike', term]);
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
