import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * POST /api/catalogo-venditori/search-products
 *
 * Search for products by name or code in Odoo catalog
 * Uses the logged-in user's session.
 *
 * Body:
 * {
 *   query: string  // Search query (min 2 characters)
 *   customerId?: number  // Optional: If provided, returns last purchase date for this customer
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
 *       image_128?: string,
 *       last_purchase_date?: string  // Only if customerId provided
 *     }
 *   ],
 *   count: number
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Get user session
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      console.error('❌ [SEARCH-PRODUCTS] No valid user session');
      return NextResponse.json(
        { success: false, error: 'User session not valid' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { query, customerId } = body;

    console.log('🔍 [SEARCH-PRODUCTS] Search request:', query, '(User UID:', uid, ', Customer:', customerId || 'none', ')');

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
    const products = await callOdoo(
      cookies,
      'product.product',
      'search_read',
      [],
      {
        domain: [
          '|',
          ['name', 'ilike', searchQuery],
          ['default_code', 'ilike', searchQuery],
          ['sale_ok', '=', true], // Only products that can be sold
          ['active', '=', true], // Only active products (not archived)
        ],
        fields: [
          'id',
          'name',
          'default_code',
          'list_price',
          'image_128',
          'qty_available',
          'uom_id',
          'incoming_qty',
        ],
        limit: 50,
        order: 'name ASC',
      }
    );

    console.log(`✅ [SEARCH-PRODUCTS] Found ${products?.length || 0} products`);

    // Fetch incoming stock moves to get expected arrival dates
    let incomingDates: Map<number, string> = new Map();
    if (products && products.length > 0) {
      const productIds = products.map((p: any) => p.id);

      // Get incoming stock moves (waiting, confirmed, or assigned) for these products
      const stockMoves = await callOdoo(
        cookies,
        'stock.move',
        'search_read',
        [],
        {
          domain: [
            ['product_id', 'in', productIds],
            ['state', 'in', ['waiting', 'confirmed', 'assigned']],
            ['picking_code', '=', 'incoming'], // Only incoming moves
          ],
          fields: ['product_id', 'date', 'date_deadline'],
          order: 'date ASC', // Earliest date first
          limit: 500,
        }
      );

      console.log(`📅 [SEARCH-PRODUCTS] Found ${stockMoves?.length || 0} incoming stock moves`);

      // Map each product to its earliest incoming date
      stockMoves?.forEach((move: any) => {
        const productId = Array.isArray(move.product_id) ? move.product_id[0] : move.product_id;
        const arrivalDate = move.date || move.date_deadline;

        if (arrivalDate && !incomingDates.has(productId)) {
          incomingDates.set(productId, arrivalDate);
        }
      });

      console.log(`✅ [SEARCH-PRODUCTS] Mapped arrival dates for ${incomingDates.size} products`);
    }

    // If customerId provided, fetch last purchase date for each product
    let productsWithHistory = products || [];
    if (customerId && products && products.length > 0) {
      console.log('📅 [SEARCH-PRODUCTS] Fetching last purchase dates for customer', customerId);

      const productIds = products.map((p: any) => p.id);

      // Get order lines for this customer with these products
      const orderLines = await callOdoo(
        cookies,
        'sale.order.line',
        'search_read',
        [],
        {
          domain: [
            ['product_id', 'in', productIds],
            ['order_partner_id', '=', customerId],
            ['state', 'in', ['sale', 'done']],
          ],
          fields: ['product_id', 'order_id', 'create_date'],
          order: 'create_date DESC',
          limit: 1000,
        }
      );

      // Create a map of product_id to last purchase date
      const lastPurchaseMap = new Map<number, string>();
      orderLines?.forEach((line: any) => {
        const productId = Array.isArray(line.product_id) ? line.product_id[0] : line.product_id;
        if (!lastPurchaseMap.has(productId)) {
          lastPurchaseMap.set(productId, line.create_date);
        }
      });

      // Add last purchase date and incoming date to products
      productsWithHistory = products.map((product: any) => ({
        ...product,
        last_purchase_date: lastPurchaseMap.get(product.id) || null,
        incoming_date: incomingDates.get(product.id) || null,
      }));

      console.log(`✅ [SEARCH-PRODUCTS] Added purchase history for ${lastPurchaseMap.size} products`);
    } else {
      // Add incoming date even if no customer specified
      productsWithHistory = products.map((product: any) => ({
        ...product,
        incoming_date: incomingDates.get(product.id) || null,
      }));
    }

    return NextResponse.json(
      {
        success: true,
        products: productsWithHistory,
        count: productsWithHistory.length,
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
