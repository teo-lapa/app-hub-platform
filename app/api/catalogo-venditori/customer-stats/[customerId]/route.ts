import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/catalogo-venditori/customer-stats/[customerId]
 *
 * Retrieves customer statistics:
 * - Total revenue (fatturato)
 * - Number of orders
 * - Average order value
 * - Suggested discount % based on customer tier
 *
 * Returns: customer statistics for price suggestions
 */

interface RouteContext {
  params: {
    customerId: string;
  };
}

export async function GET(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const customerId = parseInt(params.customerId);

    if (isNaN(customerId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid customer ID' },
        { status: 400 }
      );
    }

    console.log('📊 [CUSTOMER-STATS-API] Fetching stats for customer:', customerId);

    // Get user session
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      console.error('❌ [CUSTOMER-STATS-API] No valid user session');
      return NextResponse.json(
        { success: false, error: 'User session not valid' },
        { status: 401 }
      );
    }

    // Fetch customer info
    console.log('🔍 [CUSTOMER-STATS-API] Fetching customer info...');
    const partners = await callOdoo(
      cookies,
      'res.partner',
      'search_read',
      [],
      {
        domain: [['id', '=', customerId]],
        fields: ['id', 'name', 'total_invoiced', 'sale_order_count'],
        limit: 1
      }
    );

    if (!partners || partners.length === 0) {
      console.error('❌ [CUSTOMER-STATS-API] Customer not found:', customerId);
      return NextResponse.json(
        { success: false, error: `Customer ${customerId} not found` },
        { status: 404 }
      );
    }

    const customer = partners[0];
    console.log('✅ [CUSTOMER-STATS-API] Customer found:', customer.name);

    // Fetch confirmed orders for this customer
    console.log('🔍 [CUSTOMER-STATS-API] Fetching orders...');
    const orders = await callOdoo(
      cookies,
      'sale.order',
      'search_read',
      [],
      {
        domain: [
          ['partner_id', '=', customerId],
          ['state', 'in', ['sale', 'done']]
        ],
        fields: ['id', 'amount_total', 'date_order'],
        order: 'date_order desc'
      }
    );

    console.log(`✅ [CUSTOMER-STATS-API] Found ${orders.length} orders`);

    // Calculate statistics
    const totalRevenue = customer.total_invoiced || 0;
    const orderCount = orders.length;
    const avgOrderValue = orderCount > 0
      ? orders.reduce((sum: number, o: any) => sum + o.amount_total, 0) / orderCount
      : 0;

    // Determine customer tier and suggested discount based on revenue
    let customerTier = 'STANDARD';
    let suggestedDiscount = 0;

    if (totalRevenue >= 100000) {
      customerTier = 'VIP';
      suggestedDiscount = 10;
    } else if (totalRevenue >= 50000) {
      customerTier = 'GOLD';
      suggestedDiscount = 7;
    } else if (totalRevenue >= 20000) {
      customerTier = 'SILVER';
      suggestedDiscount = 5;
    } else if (totalRevenue >= 5000) {
      customerTier = 'BRONZE';
      suggestedDiscount = 3;
    }

    // Get recent orders (last 3 months) for trend analysis
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const recentOrders = orders.filter((o: any) =>
      new Date(o.date_order) >= threeMonthsAgo
    );

    const recentRevenue = recentOrders.reduce((sum: number, o: any) => sum + o.amount_total, 0);

    console.log('✅ [CUSTOMER-STATS-API] Statistics calculated:', {
      tier: customerTier,
      totalRevenue: totalRevenue.toFixed(2),
      orderCount,
      avgOrderValue: avgOrderValue.toFixed(2),
      suggestedDiscount
    });

    return NextResponse.json({
      success: true,
      customer: {
        id: customer.id,
        name: customer.name,
        tier: customerTier
      },
      statistics: {
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        totalOrders: orderCount,
        avgOrderValue: parseFloat(avgOrderValue.toFixed(2)),
        recentRevenue: parseFloat(recentRevenue.toFixed(2)),
        recentOrderCount: recentOrders.length,
        suggestedDiscount
      }
    });

  } catch (error: any) {
    console.error('💥 [CUSTOMER-STATS-API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error fetching customer statistics',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
