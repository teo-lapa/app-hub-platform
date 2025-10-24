import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';
import { cookies } from 'next/headers';

/**
 * GET /api/portale-clienti/products
 *
 * Fetches products from Odoo with search, filters, and pagination
 *
 * Query params:
 * - q: search query (searches name and default_code)
 * - category: category ID filter
 * - availability: 'in_stock' | 'all'
 * - sort: 'name' | 'price_asc' | 'price_desc'
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
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    console.log('📦 [PRODUCTS-API] Fetching products:', {
      query,
      categoryId,
      availability,
      sort,
      page,
      limit
    });

    // Get Odoo session from cookies
    const cookieStore = await cookies();
    const userCookies = cookieStore.toString();
    const { cookies: odooCookies } = await getOdooSession(userCookies);

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

    // Determine sort order
    let order = 'name ASC';
    if (sort === 'price_asc') {
      order = 'list_price ASC';
    } else if (sort === 'price_desc') {
      order = 'list_price DESC';
    }

    // Fetch products from Odoo
    const products = await callOdoo(
      odooCookies,
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
          'image_128',
          'categ_id',
          'uom_id',
          'description_sale',
          'barcode',
        ],
        limit,
        offset,
        order,
      }
    );

    // Get total count for pagination
    const totalCount = await callOdoo(
      odooCookies,
      'product.product',
      'search_count',
      [],
      { domain }
    );

    // Get customer-specific pricelist if available
    // First, get the customer's partner ID from session
    try {
      const sessionInfo = await callOdoo(
        odooCookies,
        'res.users',
        'read',
        [[2]], // User ID
        { fields: ['partner_id'] }
      );

      if (sessionInfo && sessionInfo[0]?.partner_id) {
        const partnerId = sessionInfo[0].partner_id[0];

        // Get partner's pricelist
        const partnerData = await callOdoo(
          odooCookies,
          'res.partner',
          'read',
          [[partnerId]],
          { fields: ['property_product_pricelist'] }
        );

        if (partnerData && partnerData[0]?.property_product_pricelist) {
          const pricelistId = partnerData[0].property_product_pricelist[0];

          // Get custom prices for each product
          const productIds = products.map((p: any) => p.id);

          const customPrices = await callOdoo(
            odooCookies,
            'product.pricelist',
            'get_products_price',
            [[pricelistId], productIds],
            {}
          );

          // Merge custom prices with products
          products.forEach((product: any) => {
            if (customPrices && customPrices[product.id]) {
              product.customer_price = customPrices[product.id];
              product.has_custom_price = product.customer_price !== product.list_price;
            } else {
              product.customer_price = product.list_price;
              product.has_custom_price = false;
            }
          });
        }
      }
    } catch (priceError) {
      console.warn('⚠️ [PRODUCTS-API] Could not fetch custom prices:', priceError);
      // Continue without custom prices
      products.forEach((product: any) => {
        product.customer_price = product.list_price;
        product.has_custom_price = false;
      });
    }

    // Format products for frontend
    const formattedProducts = products.map((product: any) => ({
      id: product.id,
      name: product.name,
      code: product.default_code || null,
      price: product.customer_price || product.list_price,
      originalPrice: product.list_price,
      hasCustomPrice: product.has_custom_price || false,
      quantity: product.qty_available || 0,
      available: product.qty_available > 0,
      image: product.image_128
        ? `data:image/png;base64,${product.image_128}`
        : '/placeholder-product.png',
      category: product.categ_id ? {
        id: product.categ_id[0],
        name: product.categ_id[1],
      } : null,
      unit: product.uom_id ? product.uom_id[1] : 'Pz',
      description: product.description_sale || null,
      barcode: product.barcode || null,
    }));

    console.log(`✅ [PRODUCTS-API] Fetched ${formattedProducts.length} products`);

    return NextResponse.json({
      products: formattedProducts,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: offset + products.length < totalCount,
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
