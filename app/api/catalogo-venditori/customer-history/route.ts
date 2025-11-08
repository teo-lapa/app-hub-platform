import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/catalogo-venditori/customer-history
 *
 * Fetches customer purchase history and returns aggregated product list
 *
 * Body:
 * - customerId: number - The customer's partner ID
 * - months?: number - Number of months to look back (default: 6)
 *
 * Returns:
 * - List of products with purchase statistics
 * - Sorted by count DESC (most ordered products first)
 */
export async function POST(request: NextRequest) {
  try {
    // Get user session
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      console.error('No valid user session');
      return NextResponse.json(
        { success: false, error: 'User session not valid' },
        { status: 401 }
      );
    }


    const body = await request.json();
    const { customerId, months = 6 } = body;

    console.log('📊 [CATALOGO-VENDITORI] Fetching purchase history for customer:', customerId, 'months:', months);

    // Validate input
    if (!customerId || typeof customerId !== 'number') {
      return NextResponse.json(
        {
          success: false,
          error: 'customerId è richiesto e deve essere un numero'
        },
        { status: 400 }
      );
    }

    // Calculate date range (last X months)
    const dateFrom = new Date();
    dateFrom.setMonth(dateFrom.getMonth() - months);
    const dateFromStr = dateFrom.toISOString().split('T')[0]; // YYYY-MM-DD format

    console.log(`📅 [CATALOGO-VENDITORI] Searching orders from ${dateFromStr} onwards`);

    // Step 1: Fetch confirmed orders from last X months
    const orders = await callOdoo(cookies, 
      'sale.order',
      'search_read',
      [],
      {
        domain: [
          ['partner_id', '=', customerId],
          ['state', 'in', ['sale', 'done']],
          ['date_order', '>=', dateFromStr]
        ],
        fields: ['id', 'name', 'date_order']
      }
    );

    console.log(`✅ [CATALOGO-VENDITORI] Found ${orders.length} confirmed orders`);

    if (orders.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        count: 0,
        message: 'Nessun ordine trovato nel periodo specificato'
      });
    }

    const orderIds = orders.map((o: any) => o.id);

    // Step 2: Fetch all order lines for these orders
    const orderLines = await callOdoo(cookies, 
      'sale.order.line',
      'search_read',
      [],
      {
        domain: [['order_id', 'in', orderIds]],
        fields: [
          'product_id',
          'product_uom_qty',
          'price_unit',
          'order_id'
        ]
      }
    );

    console.log(`✅ [CATALOGO-VENDITORI] Found ${orderLines.length} order lines`);

    // Step 3: Aggregate products by product_id
    const productMap = new Map<number, {
      productId: number;
      productName: string;
      count: number;
      totalQty: number;
      lastPrice: number;
    }>();

    orderLines.forEach((line: any) => {
      if (!line.product_id || line.product_id.length < 2) {
        return; // Skip lines without valid product
      }

      const productId = line.product_id[0];
      const productName = line.product_id[1];
      const qty = line.product_uom_qty || 0;
      const price = line.price_unit || 0;

      if (productMap.has(productId)) {
        const existing = productMap.get(productId)!;
        existing.count += 1;
        existing.totalQty += qty;
        existing.lastPrice = price; // Keep updating to get the most recent price
      } else {
        productMap.set(productId, {
          productId,
          productName,
          count: 1,
          totalQty: qty,
          lastPrice: price
        });
      }
    });

    console.log(`📦 [CATALOGO-VENDITORI] Aggregated ${productMap.size} unique products`);

    // Step 4: Convert map to array and sort by count DESC
    const aggregatedProducts = Array.from(productMap.values()).sort((a, b) => {
      // Primary sort: count DESC (most ordered first)
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      // Secondary sort: totalQty DESC (if same count, more quantity first)
      if (b.totalQty !== a.totalQty) {
        return b.totalQty - a.totalQty;
      }
      // Tertiary sort: alphabetically by name
      return a.productName.localeCompare(b.productName);
    });

    console.log(`✅ [CATALOGO-VENDITORI] Returning ${aggregatedProducts.length} products sorted by popularity`);

    // Log top 5 most ordered products
    if (aggregatedProducts.length > 0) {
      console.log('🏆 [CATALOGO-VENDITORI] Top 5 most ordered products:');
      aggregatedProducts.slice(0, 5).forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.productName} - ordered ${p.count} times (total qty: ${p.totalQty})`);
      });
    }

    return NextResponse.json({
      success: true,
      data: aggregatedProducts.map(p => ({
        product_id: p.productId,
        product_name: p.productName,
        count: p.count,
        total_qty: p.totalQty,
        last_price: p.lastPrice
      })),
      count: aggregatedProducts.length,
      metadata: {
        customerId,
        months,
        dateFrom: dateFromStr,
        ordersAnalyzed: orders.length
      }
    });

  } catch (error: any) {
    console.error('❌ [CATALOGO-VENDITORI] Error fetching customer history:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Errore nel caricamento dello storico acquisti',
        details: error.message
      },
      { status: 500 }
    );
  }
}
