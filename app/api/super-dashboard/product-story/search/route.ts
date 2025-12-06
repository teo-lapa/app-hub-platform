import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdooApi } from '@/lib/odoo-auth';

interface ProductSearchResult {
  id: number;
  name: string;
  default_code: string | false;
  barcode: string | false;
  categ_id: [number, string] | false;
  qty_available: number;
  list_price: number;
  image_128: string | false;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || '';
  const limit = parseInt(searchParams.get('limit') || '20');

  if (!query || query.length < 2) {
    return NextResponse.json({
      success: true,
      products: [],
      message: 'Query too short, minimum 2 characters'
    });
  }

  try {
    const session = await getOdooSession();
    if (!session?.session_id) {
      return NextResponse.json({ success: false, error: 'Odoo authentication failed' }, { status: 401 });
    }

    // Search products by name, code, or barcode
    const productDomain = [
      '|', '|', '|',
      ['name', 'ilike', query],
      ['default_code', 'ilike', query],
      ['barcode', 'ilike', query],
      ['categ_id.name', 'ilike', query]
    ];

    const products = await callOdooApi<ProductSearchResult[]>(session.session_id, {
      model: 'product.product',
      method: 'search_read',
      args: [
        productDomain,
        ['id', 'name', 'default_code', 'barcode', 'categ_id', 'qty_available', 'list_price', 'image_128']
      ],
      kwargs: { limit, order: 'name asc' }
    });

    // Also search by supplier name if no results from direct search
    let supplierProducts: ProductSearchResult[] = [];
    if (products.length < limit) {
      // Search suppliers matching the query
      const suppliers = await callOdooApi<Array<{ id: number; product_tmpl_id: [number, string] }>>(
        session.session_id,
        {
          model: 'product.supplierinfo',
          method: 'search_read',
          args: [
            [['partner_id.name', 'ilike', query]],
            ['product_tmpl_id']
          ],
          kwargs: { limit: 20 }
        }
      );

      if (suppliers.length > 0) {
        const templateIds = [...new Set(suppliers.map(s => s.product_tmpl_id[0]))];

        // Get products from these templates
        supplierProducts = await callOdooApi<ProductSearchResult[]>(session.session_id, {
          model: 'product.product',
          method: 'search_read',
          args: [
            [['product_tmpl_id', 'in', templateIds]],
            ['id', 'name', 'default_code', 'barcode', 'categ_id', 'qty_available', 'list_price', 'image_128']
          ],
          kwargs: { limit: limit - products.length }
        });
      }
    }

    // Merge and deduplicate results
    const allProducts = [...products, ...supplierProducts];
    const uniqueProducts = allProducts.filter((product, index, self) =>
      index === self.findIndex(p => p.id === product.id)
    );

    // Format response
    const formattedProducts = uniqueProducts.map(p => ({
      id: p.id,
      name: p.name,
      code: p.default_code || null,
      barcode: p.barcode || null,
      category: p.categ_id ? p.categ_id[1] : null,
      stock: p.qty_available,
      price: p.list_price,
      image: p.image_128 || null
    }));

    return NextResponse.json({
      success: true,
      products: formattedProducts,
      count: formattedProducts.length
    });

  } catch (error) {
    console.error('Product search error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Search failed'
    }, { status: 500 });
  }
}
