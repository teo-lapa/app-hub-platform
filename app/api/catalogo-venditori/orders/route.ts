import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession, callOdoo } from '@/lib/odoo-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/catalogo-venditori/orders
 *
 * Retrieves sale orders with optional date filtering
 *
 * Query params:
 * - period: 'week' | 'month' | '3months' (optional)
 * - customerId: number (optional - filter by specific customer)
 *
 * Returns list of orders with their details
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period');
    const customerId = searchParams.get('customerId');

    console.log('📋 [ORDERS-API] Fetching orders with filters:', { period, customerId });

    // Get user session
    const cookieHeader = request.headers.get('cookie');
    const { cookies, uid } = await getOdooSession(cookieHeader || undefined);

    if (!uid) {
      console.error('❌ [ORDERS-API] No valid user session');
      return NextResponse.json(
        { success: false, error: 'User session not valid' },
        { status: 401 }
      );
    }

    // Build date filter based on period
    let dateFilter: any[] = [];
    if (period) {
      const now = new Date();
      let startDate: Date;

      switch (period) {
        case 'week':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate = new Date(now);
          startDate.setMonth(now.getMonth() - 1);
          break;
        case '3months':
          startDate = new Date(now);
          startDate.setMonth(now.getMonth() - 3);
          break;
        default:
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 7); // Default to week
      }

      const startDateStr = startDate.toISOString().split('T')[0];
      dateFilter = [['date_order', '>=', startDateStr]];
      console.log(`📅 [ORDERS-API] Filtering from ${startDateStr} (${period})`);
    }

    // Build domain filters
    const domain: any[] = [
      ['company_id', '=', 1], // Only LAPA company orders
      ...dateFilter,
    ];

    // Add customer filter if provided
    if (customerId) {
      domain.push(['partner_id', '=', parseInt(customerId)]);
    }

    console.log('🔍 [ORDERS-API] Domain:', JSON.stringify(domain));

    // Fetch orders from Odoo
    const orders = await callOdoo(
      cookies,
      'sale.order',
      'search_read',
      [],
      {
        domain,
        fields: [
          'id',
          'name',
          'partner_id',
          'date_order',
          'state',
          'amount_total',
          'create_date',
          'commitment_date',
          'user_id',
        ],
        order: 'date_order DESC',
        limit: 100,
      }
    );

    if (!orders) {
      console.error('❌ [ORDERS-API] Failed to fetch orders');
      return NextResponse.json(
        { success: false, error: 'Failed to fetch orders from Odoo' },
        { status: 500 }
      );
    }

    console.log(`✅ [ORDERS-API] Found ${orders.length} orders`);

    // Format orders for frontend
    const formattedOrders = orders.map((order: any) => ({
      id: order.id,
      name: order.name,
      partner_name: order.partner_id && Array.isArray(order.partner_id) ? order.partner_id[1] : 'N/A',
      partner_id: order.partner_id && Array.isArray(order.partner_id) ? order.partner_id[0] : null,
      date: order.date_order || order.create_date,
      state: order.state,
      total: order.amount_total || 0,
      delivery_date: order.commitment_date || null,
      salesperson: order.user_id && Array.isArray(order.user_id) ? order.user_id[1] : 'N/A',
    }));

    // Calculate stats
    const stats = {
      total_orders: formattedOrders.length,
      draft_orders: formattedOrders.filter((o: any) => o.state === 'draft').length,
      confirmed_orders: formattedOrders.filter((o: any) => ['sale', 'done'].includes(o.state)).length,
      total_amount: formattedOrders.reduce((sum: number, o: any) => sum + o.total, 0),
    };

    return NextResponse.json({
      success: true,
      orders: formattedOrders,
      stats,
      period: period || 'all',
    });

  } catch (error: any) {
    console.error('💥 [ORDERS-API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error fetching orders',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
