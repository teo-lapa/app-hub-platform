import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin } from '@/lib/odoo/admin-session';
import jwt from 'jsonwebtoken';

/**
 * GET /api/portale-clienti/products
 *
 * Fetches products from Odoo with search, filters, and pagination using admin session
 *
 * Query params:
 * - q: search query (searches name and default_code)
 * - category: category ID filter
 * - availability: 'in_stock' | 'all'
 * - sort: 'name' | 'price_asc' | 'price_desc'
 * - purchased: 'true' | 'false' - filter only previously purchased products (requires auth)
 * - page: page number (default: 1)
 * - limit: items per page (default: 50)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const categoryId = searchParams.get('category');
    const availability = searchParams.get('availability') || 'all';
    const sort = searchParams.get('sort') || 'name';
    const purchased = searchParams.get('purchased') === 'true';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    console.log('📦 [PRODUCTS-API] Fetching products:', {
      query,
      categoryId,
      availability,
      sort,
      purchased,
      page,
      limit
    });

    // Get partnerId and language from JWT (for purchased filter and translations)
    let partnerId: number | null = null;
    let userLang: string = 'it_IT'; // Default to Italian

    // Always try to get user language if authenticated
    const token = request.cookies.get('token')?.value;

    if (token) {
      // Decode JWT to get customer email
      const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
      let decoded: any;

      try {
        decoded = jwt.verify(token, jwtSecret);
        console.log('✅ [PRODUCTS-API] JWT decoded:', decoded.email);

        // Get partner info including language
        const userPartners = await callOdooAsAdmin(
          'res.partner',
          'search_read',
          [],
          {
            domain: [['email', '=', decoded.email]],
            fields: ['id', 'lang'],
            limit: 1
          }
        );

        if (userPartners && userPartners.length > 0) {
          partnerId = userPartners[0].id;
          userLang = userPartners[0].lang || 'it_IT';
          console.log('✅ [PRODUCTS-API] Partner identified:', { partnerId, lang: userLang });
        }
      } catch (jwtError: any) {
        console.warn('⚠️ [PRODUCTS-API] JWT verification failed, using default lang:', jwtError.message);
        // Continue without authentication - use default language
      }
    }

    // Check if purchased filter requires authentication
    if (purchased && !partnerId) {
      console.warn('⚠️ [PRODUCTS-API] Purchased filter requires authentication');
      return NextResponse.json(
        { error: 'Il filtro "prodotti acquistati" richiede autenticazione' },
        { status: 401 }
      );
    }

    // Build domain for Odoo search
    const domain: any[] = [
      ['sale_ok', '=', true],
      ['active', '=', true],
    ];

    // Add search filter
    if (query) {
      domain.push('|');
      domain.push(['name', 'ilike', query]);
      domain.push(['default_code', 'ilike', query]);
    }

    // Add category filter
    if (categoryId && categoryId !== 'all') {
      domain.push(['categ_id', '=', parseInt(categoryId)]);
    }

    // Add availability filter
    if (availability === 'in_stock') {
      domain.push(['qty_available', '>', 0]);
    }

    // Add "purchased products" filter
    if (purchased && partnerId) {
      console.log('🔍 [PRODUCTS-API] Filtering purchased products for partner:', partnerId);

      try {
        // Step 1: Find all confirmed orders for this partner
        const orders = await callOdooAsAdmin(
          'sale.order',
          'search_read',
          [],
          {
            domain: [
              ['partner_id', '=', partnerId],
              ['state', 'in', ['sale', 'done']]
            ],
            fields: ['id'],
          }
        );

        const orderIds = orders.map((o: any) => o.id);
        console.log(`📋 [PRODUCTS-API] Found ${orderIds.length} confirmed orders`);

        if (orderIds.length > 0) {
          // Step 2: Find all order lines from these orders
          const orderLines = await callOdooAsAdmin(
            'sale.order.line',
            'search_read',
            [],
            {
              domain: [['order_id', 'in', orderIds]],
              fields: ['product_id'],
            }
          );

          // Step 3: Extract unique product IDs
          const purchasedProductIds = Array.from(
            new Set(
              orderLines
                .map((line: any) => line.product_id?.[0])
                .filter((id: any) => id !== undefined && id !== null)
            )
          );

          console.log(`✅ [PRODUCTS-API] Found ${purchasedProductIds.length} unique purchased products`);

          if (purchasedProductIds.length > 0) {
            // Add to domain: only show products that were purchased
            domain.push(['id', 'in', purchasedProductIds]);
          } else {
            // No purchased products - return empty result set
            domain.push(['id', '=', -1]); // Impossible condition
          }
        } else {
          // No orders - return empty result set
          domain.push(['id', '=', -1]); // Impossible condition
        }
      } catch (purchaseFilterError: any) {
        console.error('❌ [PRODUCTS-API] Error filtering purchased products:', purchaseFilterError);
        // Don't fail the whole request, just skip the filter
      }
    }

    // Determine sort order
    let order = 'name ASC';
    if (sort === 'price_asc') {
      order = 'list_price ASC';
    } else if (sort === 'price_desc') {
      order = 'list_price DESC';
    }

    // Fetch products from Odoo using admin session with user's language context
    const products = await callOdooAsAdmin(
      'product.product',
      'search_read',
      [],
      {
        domain,
        fields: [
          'id',
          'name',
          'default_code',
          'list_price',
          'qty_available',
          'image_256', // FOTO PIÙ GRANDI come Catalogo LAPA!
          'categ_id',
          'uom_id',
          'description_sale',
          'barcode',
        ],
        limit,
        offset,
        order,
        context: { lang: userLang }, // Traduzioni automatiche in base alla lingua utente!
      }
    );

    console.log(`✅ [PRODUCTS-API] Loaded ${products.length} products in language: ${userLang}`);

    // Get total count for pagination
    const totalCount = await callOdooAsAdmin(
      'product.product',
      'search_count',
      [],
      { domain }
    );

    console.log(`✅ [PRODUCTS-API] Fetched ${products.length} products (total: ${totalCount})`);

    // Transform Odoo data to frontend format
    const transformedProducts = products.map((p: any) => ({
      id: p.id,
      name: p.name,
      code: p.default_code || null,
      price: p.list_price || 0,
      originalPrice: p.list_price || 0,
      hasCustomPrice: false, // TODO: implement custom pricing logic
      quantity: p.qty_available || 0,
      available: (p.qty_available || 0) > 0,
      image: p.image_256
        ? `data:image/jpeg;base64,${p.image_256}`
        : '/placeholder-product.png',
      category: p.categ_id
        ? { id: p.categ_id[0], name: p.categ_id[1] }
        : null,
      unit: p.uom_id ? p.uom_id[1] : 'Pz',
      description: p.description_sale || null,
      barcode: p.barcode || null,
    }));

    const totalPages = Math.ceil(totalCount / limit);
    const hasMore = page < totalPages;

    return NextResponse.json({
      products: transformedProducts,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,
        hasMore,
      },
    });

  } catch (error: any) {
    console.error('❌ [PRODUCTS-API] Error:', error);
    return NextResponse.json(
      { error: 'Errore nel caricamento prodotti', details: error.message },
      { status: 500 }
    );
  }
}
