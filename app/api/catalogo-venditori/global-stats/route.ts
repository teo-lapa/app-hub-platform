import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * GET /api/catalogo-venditori/global-stats
 *
 * Retrieves global customer statistics for the last 3 months:
 * - Average order value across all customers
 * - Total revenue
 * - Number of customers
 * - Number of orders
 *
 * Used to compare individual customer performance against the average
 */

export async function GET(request: NextRequest) {
  try {
    console.log('📊 [GLOBAL-STATS-API] Fetching global customer statistics...');

    // Get user session
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      console.error('❌ [GLOBAL-STATS-API] No valid user session');
      return NextResponse.json(
        { success: false, error: 'User session not valid' },
        { status: 401 }
      );
    }

    // Calculate date range for last 3 months
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const dateFromStr = threeMonthsAgo.toISOString().split('T')[0];

    console.log(`🔍 [GLOBAL-STATS-API] Fetching orders from ${dateFromStr} onwards...`);

    // Fetch all confirmed orders from the last 3 months
    const orders = await callOdoo(
      cookies,
      'sale.order',
      'search_read',
      [],
      {
        domain: [
          ['state', 'in', ['sale', 'done']],
          ['date_order', '>=', dateFromStr]
        ],
        fields: ['id', 'partner_id', 'amount_total', 'date_order']
      }
    );

    if (!orders || orders.length === 0) {
      console.log('⚠️ [GLOBAL-STATS-API] No orders found in the last 3 months');
      return NextResponse.json({
        success: true,
        stats: {
          averageOrderValue: 0,
          totalRevenue: 0,
          customerCount: 0,
          orderCount: 0
        }
      });
    }

    console.log(`✅ [GLOBAL-STATS-API] Found ${orders.length} orders in the last 3 months`);

    // Calculate statistics
    const totalRevenue = orders.reduce((sum: number, order: any) => sum + order.amount_total, 0);
    const averageOrderValue = totalRevenue / orders.length;

    // Get unique customer count
    const uniqueCustomers = new Set(orders.map((order: any) => order.partner_id[0]));
    const customerCount = uniqueCustomers.size;

    console.log('📊 [GLOBAL-STATS-API] Global statistics calculated:', {
      totalRevenue: totalRevenue.toFixed(2),
      averageOrderValue: averageOrderValue.toFixed(2),
      customerCount,
      orderCount: orders.length
    });

    return NextResponse.json({
      success: true,
      stats: {
        averageOrderValue,
        totalRevenue,
        customerCount,
        orderCount: orders.length
      }
    });

  } catch (error: any) {
    console.error('💥 [GLOBAL-STATS-API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error fetching global statistics',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
