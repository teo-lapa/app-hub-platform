import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin } from '@/lib/odoo/admin-session';

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

    // Fetch products from Odoo using admin session
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
      image: p.image_128
        ? `data:image/png;base64,${p.image_128}`
        : '/placeholder-product.png',
      category: p.categ_id
        ? { id: p.categ_id[0], name: p.categ_id[1] }
        : null,
      unit: p.uom_id ? p.uom_id[1] : 'Pz',
      description: p.description_sale || null,
      barcode: p.barcode || null,
    }));

    return NextResponse.json({
      products: transformedProducts,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
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
