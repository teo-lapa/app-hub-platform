/**
 * MAESTRO AI - Product Search API Endpoint
 *
 * GET /api/maestro/products/search
 * Search products by name, code, or barcode
 *
 * AUTHENTICATION: Cookie-based Odoo session
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/maestro/products/search
 *
 * Search products for vehicle stock reload
 *
 * Query params:
 * - q: string (required) - Search query (min 3 chars)
 * - limit: number (optional) - Max results (default 20)
 *
 * Returns:
 * {
 *   success: true,
 *   products: [
 *     {
 *       id: number,
 *       name: string,
 *       code: string,
 *       barcode?: string,
 *       image_url?: string,
 *       uom?: string
 *     }
 *   ],
 *   count: number
 * }
 */
export async function GET(request: NextRequest) {
  console.log('\n🔍 [API] GET /api/maestro/products/search');

  try {
    // 1. Get user cookies (AUTHENTICATION)
    const userCookies = request.headers.get('cookie');

    if (!userCookies) {
      console.warn('⚠️  [API] No cookies provided');
      return NextResponse.json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Devi effettuare il login per cercare prodotti'
        }
      }, { status: 401 });
    }

    // 2. Get Odoo session and uid
    const { cookies, uid } = await getOdooSession(userCookies);

    if (!uid || !cookies) {
      console.warn('⚠️  [API] Invalid Odoo session');
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_SESSION',
          message: 'Sessione non valida. Effettua nuovamente il login.'
        }
      }, { status: 401 });
    }

    // 3. Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!query || query.trim().length < 3) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_QUERY',
          message: 'La ricerca deve contenere almeno 3 caratteri'
        }
      }, { status: 400 });
    }

    console.log(`   Query: "${query}"`);
    console.log(`   Limit: ${limit}`);

    // 4. Search products in Odoo
    // Search by name, default_code (internal reference), or barcode
    // Search in BOTH Italian and English to find translated product names
    const searchDomain = [
      '&',
      ['sale_ok', '=', true],  // Only products available for sale
      '|', '|',
      ['name', 'ilike', query],
      ['default_code', 'ilike', query],
      ['barcode', 'ilike', query]
    ];
    const searchFields = ['id', 'name', 'default_code', 'barcode', 'image_128', 'uom_id'];

    const [productsIt, productsEn] = await Promise.all([
      callOdoo(cookies, 'product.product', 'search_read', [searchDomain], {
        fields: searchFields, limit, order: 'name asc', context: { lang: 'it_IT' }
      }),
      callOdoo(cookies, 'product.product', 'search_read', [searchDomain], {
        fields: searchFields, limit, order: 'name asc', context: { lang: 'en_US' }
      }),
    ]);

    // Merge and deduplicate by product ID (Italian results take priority for name)
    const seenIds = new Set<number>();
    const products: any[] = [];
    for (const p of [...(productsIt || []), ...(productsEn || [])]) {
      if (!seenIds.has(p.id)) {
        seenIds.add(p.id);
        products.push(p);
      }
    }

    console.log(`✅ [API] Found ${products.length} products`);

    // 5. Transform to frontend format
    const transformedProducts = products.map((p: any) => ({
      id: p.id,
      name: p.name,
      code: p.default_code || '',
      barcode: p.barcode || undefined,
      image_url: p.image_128 ? `data:image/png;base64,${p.image_128}` : undefined,
      uom: p.uom_id ? p.uom_id[1] : 'pz'
    }));

    // 6. Return results
    return NextResponse.json({
      success: true,
      products: transformedProducts,
      count: transformedProducts.length,
      query: query,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ [API] Error searching products:', error);

    // Handle Odoo session errors
    if (error.message?.includes('session') || error.message?.includes('Session')) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'ODOO_SESSION_ERROR',
          message: 'Sessione Odoo scaduta. Ricarica la pagina.',
          details: error.message
        }
      }, { status: 401 });
    }

    // Generic error
    return NextResponse.json({
      success: false,
      error: {
        code: 'SEARCH_ERROR',
        message: 'Errore durante la ricerca prodotti',
        details: error.message
      }
    }, { status: 500 });
  }
}
