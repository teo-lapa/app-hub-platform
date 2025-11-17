import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { callOdoo } from '@/lib/odoo-auth';

/**
 * GET /api/controllo-prezzi/products-without-rules?pricelistIds=1,2,3&filter=without
 *
 * Recupera prodotti con o senza regole di prezzo per i listini specificati
 *
 * Query params:
 * - pricelistIds: lista di ID listini separati da virgola (es: "1,2,3,4,5")
 * - filter: "without" (senza regole) o "with" (con regole)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const pricelistIdsParam = searchParams.get('pricelistIds');
    const filter = searchParams.get('filter') || 'without'; // default: without

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

    // Parse pricelist IDs
    const pricelistIds: number[] = pricelistIdsParam
      ? pricelistIdsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
      : [];

    console.log(`🔍 Recupero prodotti ${filter === 'with' ? 'CON' : 'SENZA'} regole di prezzo per listini:`, pricelistIds);

    // STEP 1: Recupera tutti i prodotti attivi
    const products = await callOdoo(
      cookieHeader,
      'product.product',
      'search_read',
      [],
      {
        domain: [
          ['sale_ok', '=', true],
          ['active', '=', true],
          ['type', '=', 'product']
        ],
        fields: ['id', 'name', 'default_code', 'list_price', 'standard_price', 'categ_id'],
        limit: 0
      }
    );

    if (!products || products.length === 0) {
      return NextResponse.json({
        success: true,
        products: [],
        count: 0
      });
    }

    console.log(`✅ Trovati ${products.length} prodotti attivi`);

    // STEP 2: Recupera regole di prezzo per i listini specificati
    let domain: any[] = [
      ['product_id', '!=', false],
      ['applied_on', '=', '0_product_variant']
    ];

    // Se sono specificati listini, filtra solo per quelli
    if (pricelistIds.length > 0) {
      domain.push(['pricelist_id', 'in', pricelistIds]);
    }

    const pricelistItems = await callOdoo(
      cookieHeader,
      'product.pricelist.item',
      'search_read',
      [],
      {
        domain: domain,
        fields: ['product_id', 'pricelist_id'],
        limit: 0
      }
    );

    // Crea set di product IDs che hanno regole per i listini specificati
    const productsWithRules = new Set<number>();
    if (pricelistItems && pricelistItems.length > 0) {
      pricelistItems.forEach((item: any) => {
        if (item.product_id && Array.isArray(item.product_id)) {
          productsWithRules.add(item.product_id[0]);
        }
      });
    }

    console.log(`✅ Trovati ${productsWithRules.size} prodotti CON regole di prezzo per i listini selezionati`);

    // STEP 3: Filtra prodotti in base al filtro richiesto
    let filteredProducts;
    if (filter === 'with') {
      // Prodotti CON regole
      filteredProducts = products.filter((product: any) => {
        return productsWithRules.has(product.id);
      });
    } else {
      // Prodotti SENZA regole
      filteredProducts = products.filter((product: any) => {
        return !productsWithRules.has(product.id);
      });
    }

    console.log(`✅ Trovati ${filteredProducts.length} prodotti ${filter === 'with' ? 'CON' : 'SENZA'} regole di prezzo`);

    // Formatta risultati
    const formattedProducts = filteredProducts.map((product: any) => ({
      id: product.id,
      name: product.name,
      code: product.default_code || '',
      listPrice: product.list_price || 0,
      costPrice: product.standard_price || 0,
      category: product.categ_id ? product.categ_id[1] : 'Senza categoria'
    }));

    return NextResponse.json({
      success: true,
      products: formattedProducts,
      count: formattedProducts.length
    });

  } catch (error: any) {
    console.error('❌ Errore recupero prodotti senza regole:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore durante il recupero dei prodotti'
    }, { status: 500 });
  }
}
