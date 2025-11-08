import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/catalogo-venditori/product-history/[productId]
 *
 * Retrieves price history for a product across different customers.
 * Shows how much this product has been sold to other customers.
 *
 * Query params:
 * - limit: number of recent orders to analyze (default: 50)
 *
 * Returns: price statistics, average price, min/max prices
 */

interface RouteContext {
  params: {
    productId: string;
  };
}

export async function GET(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const productId = parseInt(params.productId);
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    if (isNaN(productId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid product ID' },
        { status: 400 }
      );
    }

    console.log('📊 [PRODUCT-HISTORY-API] Fetching history for product:', productId);

    // Get user session
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      console.error('❌ [PRODUCT-HISTORY-API] No valid user session');
      return NextResponse.json(
        { success: false, error: 'User session not valid' },
        { status: 401 }
      );
    }

    // Fetch product info
    console.log('🔍 [PRODUCT-HISTORY-API] Fetching product info...');
    const products = await callOdoo(
      cookies,
      'product.product',
      'search_read',
      [],
      {
        domain: [['id', '=', productId]],
        fields: ['id', 'name', 'default_code', 'list_price'],
        limit: 1
      }
    );

    if (!products || products.length === 0) {
      console.error('❌ [PRODUCT-HISTORY-API] Product not found:', productId);
      return NextResponse.json(
        { success: false, error: `Product ${productId} not found` },
        { status: 404 }
      );
    }

    const product = products[0];
    console.log('✅ [PRODUCT-HISTORY-API] Product found:', product.name);

    // Fetch recent order lines with this product (confirmed orders only)
    console.log('🔍 [PRODUCT-HISTORY-API] Fetching order lines...');
    const orderLines = await callOdoo(
      cookies,
      'sale.order.line',
      'search_read',
      [],
      {
        domain: [
          ['product_id', '=', productId],
          ['state', 'in', ['sale', 'done']] // Only confirmed orders
        ],
        fields: [
          'id',
          'order_id',
          'product_uom_qty',
          'price_unit',
          'discount',
          'price_subtotal',
          'create_date'
        ],
        limit: limit,
        order: 'create_date desc'
      }
    );

    console.log(`✅ [PRODUCT-HISTORY-API] Found ${orderLines.length} order lines`);

    if (orderLines.length === 0) {
      return NextResponse.json({
        success: true,
        product: {
          id: product.id,
          name: product.name,
          code: product.default_code,
          standardPrice: product.list_price
        },
        statistics: {
          totalOrders: 0,
          avgPrice: product.list_price,
          minPrice: product.list_price,
          maxPrice: product.list_price,
          avgDiscount: 0
        },
        recentSales: []
      });
    }

    // Get unique order IDs to fetch customer info
    const orderIdsSet = new Set(orderLines.map((line: any) => line.order_id[0]));
    const orderIds = Array.from(orderIdsSet);

    console.log('🔍 [PRODUCT-HISTORY-API] Fetching orders info...');
    const orders = await callOdoo(
      cookies,
      'sale.order',
      'search_read',
      [],
      {
        domain: [['id', 'in', orderIds]],
        fields: ['id', 'name', 'partner_id', 'date_order']
      }
    );

    // Create order lookup map
    const orderMap = new Map(orders.map((o: any) => [o.id, o]));

    // Calculate statistics
    const prices = orderLines.map((line: any) => line.price_unit);
    const discounts = orderLines.map((line: any) => line.discount || 0);

    const avgPrice = prices.reduce((sum: number, p: number) => sum + p, 0) / prices.length;
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const avgDiscount = discounts.reduce((sum: number, d: number) => sum + d, 0) / discounts.length;

    // Prepare recent sales with customer info
    const recentSales = orderLines.slice(0, 20).map((line: any) => {
      const order = orderMap.get(line.order_id[0]);
      return {
        orderId: order?.id,
        orderName: order?.name,
        customerName: order?.partner_id ? order.partner_id[1] : 'Unknown',
        quantity: line.product_uom_qty,
        priceUnit: line.price_unit,
        discount: line.discount || 0,
        subtotal: line.price_subtotal,
        date: order?.date_order || line.create_date
      };
    });

    console.log('✅ [PRODUCT-HISTORY-API] Statistics calculated:', {
      avgPrice: avgPrice.toFixed(2),
      minPrice: minPrice.toFixed(2),
      maxPrice: maxPrice.toFixed(2),
      avgDiscount: avgDiscount.toFixed(1)
    });

    return NextResponse.json({
      success: true,
      product: {
        id: product.id,
        name: product.name,
        code: product.default_code,
        standardPrice: product.list_price
      },
      statistics: {
        totalOrders: orderLines.length,
        avgPrice: parseFloat(avgPrice.toFixed(2)),
        minPrice: parseFloat(minPrice.toFixed(2)),
        maxPrice: parseFloat(maxPrice.toFixed(2)),
        avgDiscount: parseFloat(avgDiscount.toFixed(1))
      },
      recentSales
    });

  } catch (error: any) {
    console.error('💥 [PRODUCT-HISTORY-API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error fetching product history',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
