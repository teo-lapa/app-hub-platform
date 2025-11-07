import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin } from '@/lib/odoo/admin-session';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * POST /api/catalogo-venditori/search-products
 *
 * Search for products by name or code in Odoo catalog
 *
 * Body:
 * {
 *   query: string  // Search query (min 2 characters)
 * }
 *
 * Returns:
 * {
 *   success: true,
 *   products: [
 *     {
 *       id: number,
 *       name: string,
 *       default_code?: string,
 *       list_price?: number,
 *       image_128?: string
 *     }
 *   ],
 *   count: number
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query } = body;

    console.log('🔍 [SEARCH-PRODUCTS] Search request:', query);

    // Validate query
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return NextResponse.json(
        {
          success: false,
          error: 'Query deve essere almeno 2 caratteri',
        },
        { status: 400 }
      );
    }

    const searchQuery = query.trim();

    // Search products in Odoo by name or default_code
    const products = await callOdooAsAdmin(
      'product.product',
      'search_read',
      [],
      {
        domain: [
          '|',
          ['name', 'ilike', searchQuery],
          ['default_code', 'ilike', searchQuery],
          ['sale_ok', '=', true], // Only products that can be sold
        ],
        fields: [
          'id',
          'name',
          'default_code',
          'list_price',
          'image_128',
          'qty_available',
        ],
        limit: 50,
        order: 'name ASC',
      }
    );

    console.log(`✅ [SEARCH-PRODUCTS] Found ${products?.length || 0} products`);

    return NextResponse.json(
      {
        success: true,
        products: products || [],
        count: products?.length || 0,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('❌ [SEARCH-PRODUCTS] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore nella ricerca prodotti',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/catalogo-venditori/search-products
 * Health check and endpoint info
 */
export async function GET(request: NextRequest) {
  return NextResponse.json(
    {
      success: true,
      endpoint: '/api/catalogo-venditori/search-products',
      description: 'Search products in Odoo catalog by name or code',
      version: '1.0.0',
      usage: {
        method: 'POST',
        body: {
          query: 'string (min 2 characters)',
        },
        response: {
          success: 'boolean',
          products: 'Product[]',
          count: 'number',
        },
      },
    },
    { status: 200 }
  );
}
