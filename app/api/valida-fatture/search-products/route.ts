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

    // Search in both languages to find translated product names
    const fattureFields = [
      'id', 'name', 'default_code', 'barcode',
      'list_price', 'standard_price', 'uom_id', 'seller_ids'
    ];

    const [productsIt, productsEn] = await Promise.all([
      callOdoo(cookies, 'product.product', 'search_read', [productDomain], {
        fields: fattureFields, limit: 50, order: 'name asc', context: { lang: 'it_IT' }
      }),
      callOdoo(cookies, 'product.product', 'search_read', [productDomain], {
        fields: fattureFields, limit: 50, order: 'name asc', context: { lang: 'en_US' }
      }),
    ]);

    // Merge and deduplicate by product ID (Italian results take priority)
    const seenIds = new Set<number>();
    const products: any[] = [];
    for (const p of [...(productsIt || []), ...(productsEn || [])]) {
      if (!seenIds.has(p.id)) {
        seenIds.add(p.id);
        products.push(p);
      }
    }

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
