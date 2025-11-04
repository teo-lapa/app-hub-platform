/**
 * MAESTRO AI - Orders Analytics API
 *
 * GET /api/maestro/analytics/orders
 *
 * Provides detailed order analytics including:
 * - Order count trend over time
 * - Breakdown by salesperson
 * - Breakdown by order state
 * - Breakdown by customer
 * - Daily distribution (by day of week)
 * - Statistics (avg orders per day, peak day)
 *
 * Query params:
 * - period: week | month | quarter | year
 * - salesperson_id: filter by salesperson (optional)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOdooSession } from '@/lib/odoo-auth';
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';
import { calculateDateRange } from '@/lib/maestro/period-metrics';

export const dynamic = 'force-dynamic';

interface OrderAnalytics {
  // Overall stats
  totalOrders: number;
  avgOrdersPerDay: number;
  peakDay: {
    date: string;
    count: number;
  };

  // Trend data (for line chart)
  ordersTrend: Array<{
    date: string;
    orders: number;
  }>;

  // Breakdown by salesperson
  bySalesperson: Array<{
    salespersonId: number;
    salespersonName: string;
    orders: number;
    percentage: number;
  }>;

  // Breakdown by state
  byState: Array<{
    state: string;
    stateLabel: string;
    orders: number;
    percentage: number;
  }>;

  // Breakdown by customer (top 10)
  byCustomer: Array<{
    customerId: number;
    customerName: string;
    orders: number;
    percentage: number;
  }>;

  // Distribution by day of week
  byDayOfWeek: Array<{
    day: string;
    dayLabel: string;
    orders: number;
  }>;

  // Recent orders list (for scrollable table)
  recentOrders: Array<{
    orderId: number;
    orderName: string;
    customerName: string;
    salespersonName: string;
    date: string;
    state: string;
    stateLabel: string;
    amount: number;
  }>;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = (searchParams.get('period') || 'month') as 'week' | 'month' | 'quarter' | 'year';
    const salespersonIdStr = searchParams.get('salesperson_id');
    const salespersonId = salespersonIdStr ? parseInt(salespersonIdStr) : undefined;

    console.log('\n📊 [ORDERS-ANALYTICS] Request:', {
      period,
      salesperson_id: salespersonId || 'ALL'
    });

    // Calculate date range
    const { startDate, endDate } = calculateDateRange(period);

    console.log('📅 [ORDERS-ANALYTICS] Date range:', {
      startDate: new Date(startDate).toLocaleDateString('it-IT'),
      endDate: new Date(endDate).toLocaleDateString('it-IT')
    });

    // Connect to Odoo
    const { cookies } = await getOdooSession();
    const odoo = createOdooRPCClient(cookies?.replace('session_id=', ''));

    // Build filters for sale.order
    const filters: any[] = [
      ['state', 'in', ['draft', 'sent', 'sale', 'done', 'cancel']],
      ['commitment_date', '>=', startDate],
      ['commitment_date', '<=', endDate]
    ];

    if (salespersonId) {
      filters.push(['user_id', '=', salespersonId]);
    }

    console.log('🔍 [ORDERS-ANALYTICS] Fetching orders from Odoo...');

    // Fetch orders from Odoo
    const orders = await odoo.searchRead(
      'sale.order',
      filters,
      ['id', 'name', 'partner_id', 'user_id', 'commitment_date', 'state', 'amount_total'],
      0  // no limit
    );

    console.log(`✅ [ORDERS-ANALYTICS] Found ${orders.length} orders`);

    // Calculate analytics
    const analytics = await calculateOrderAnalytics(orders, period);

    console.log('✅ [ORDERS-ANALYTICS] Analytics calculated successfully');

    return NextResponse.json({
      success: true,
      period,
      salesperson_id: salespersonId,
      date_range: {
        start: startDate,
        end: endDate
      },
      analytics
    });

  } catch (error: any) {
    console.error('❌ [ORDERS-ANALYTICS] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'ORDERS_ANALYTICS_FAILED',
          message: error.message || 'Failed to fetch orders analytics'
        }
      },
      { status: 500 }
    );
  }
}

/**
 * Calculate all order analytics from raw order data
 */
async function calculateOrderAnalytics(orders: any[], period: string): Promise<OrderAnalytics> {
  const totalOrders = orders.length;

  // 1. TREND DATA (for line chart)
  const trendMap = new Map<string, number>();
  for (const order of orders) {
    const orderDate = new Date(order.commitment_date);
    let dateKey: string;

    if (period === 'week' || period === 'month') {
      // Group by day: YYYY-MM-DD
      dateKey = orderDate.toISOString().split('T')[0];
    } else {
      // Group by month: YYYY-MM
      dateKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
    }

    trendMap.set(dateKey, (trendMap.get(dateKey) || 0) + 1);
  }

  const ordersTrend = Array.from(trendMap.entries())
    .map(([date, orders]) => ({ date, orders }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // 2. PEAK DAY
  const peakEntry = ordersTrend.length > 0
    ? ordersTrend.reduce((max, curr) => (curr.orders > max.orders ? curr : max))
    : { date: '', orders: 0 };

  // 3. AVG ORDERS PER DAY
  const daysInPeriod = trendMap.size || 1;
  const avgOrdersPerDay = parseFloat((totalOrders / daysInPeriod).toFixed(1));

  // 4. BY SALESPERSON
  const salespersonMap = new Map<number, { name: string; count: number }>();
  for (const order of orders) {
    if (order.user_id && order.user_id[0]) {
      const id = order.user_id[0];
      const name = order.user_id[1];
      if (!salespersonMap.has(id)) {
        salespersonMap.set(id, { name, count: 0 });
      }
      salespersonMap.get(id)!.count += 1;
    }
  }

  const bySalesperson = Array.from(salespersonMap.entries())
    .map(([id, data]) => ({
      salespersonId: id,
      salespersonName: data.name,
      orders: data.count,
      percentage: parseFloat(((data.count / totalOrders) * 100).toFixed(1))
    }))
    .sort((a, b) => b.orders - a.orders);

  // 5. BY STATE
  const stateMap = new Map<string, number>();
  const stateLabels: Record<string, string> = {
    draft: 'Bozza',
    sent: 'Inviato',
    sale: 'Vendita',
    done: 'Completato',
    cancel: 'Annullato'
  };

  for (const order of orders) {
    const state = order.state || 'draft';
    stateMap.set(state, (stateMap.get(state) || 0) + 1);
  }

  const byState = Array.from(stateMap.entries())
    .map(([state, count]) => ({
      state,
      stateLabel: stateLabels[state] || state,
      orders: count,
      percentage: parseFloat(((count / totalOrders) * 100).toFixed(1))
    }))
    .sort((a, b) => b.orders - a.orders);

  // 6. BY CUSTOMER (top 10)
  const customerMap = new Map<number, { name: string; count: number }>();
  for (const order of orders) {
    if (order.partner_id && order.partner_id[0]) {
      const id = order.partner_id[0];
      const name = order.partner_id[1];
      if (!customerMap.has(id)) {
        customerMap.set(id, { name, count: 0 });
      }
      customerMap.get(id)!.count += 1;
    }
  }

  const byCustomer = Array.from(customerMap.entries())
    .map(([id, data]) => ({
      customerId: id,
      customerName: data.name,
      orders: data.count,
      percentage: parseFloat(((data.count / totalOrders) * 100).toFixed(1))
    }))
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 10);

  // 7. BY DAY OF WEEK
  const dayNames = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
  const dayMap = new Map<number, number>();

  for (const order of orders) {
    const orderDate = new Date(order.commitment_date);
    const dayOfWeek = orderDate.getDay(); // 0 = Sunday, 6 = Saturday
    dayMap.set(dayOfWeek, (dayMap.get(dayOfWeek) || 0) + 1);
  }

  const byDayOfWeek = Array.from({ length: 7 }, (_, i) => ({
    day: i.toString(),
    dayLabel: dayNames[i],
    orders: dayMap.get(i) || 0
  }));

  // 8. RECENT ORDERS (last 50, sorted by date desc)
  const recentOrders = orders
    .sort((a, b) => new Date(b.commitment_date).getTime() - new Date(a.commitment_date).getTime())
    .slice(0, 50)
    .map(order => ({
      orderId: order.id,
      orderName: order.name,
      customerName: order.partner_id?.[1] || 'N/D',
      salespersonName: order.user_id?.[1] || 'N/D',
      date: order.commitment_date,
      state: order.state,
      stateLabel: stateLabels[order.state] || order.state,
      amount: order.amount_total || 0
    }));

  return {
    totalOrders,
    avgOrdersPerDay,
    peakDay: {
      date: peakEntry.date,
      count: peakEntry.orders
    },
    ordersTrend,
    bySalesperson,
    byState,
    byCustomer,
    byDayOfWeek,
    recentOrders
  };
}
