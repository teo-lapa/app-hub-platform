/**
 * MAESTRO AI - Average Order Value Analytics API
 *
 * GET /api/maestro/analytics/avg-order-value
 *
 * Provides detailed average order value analytics including:
 * - Average order value trend over time
 * - Order distribution by value range (0-100, 100-500, 500-1000, 1000+)
 * - Breakdown by salesperson (who has highest avg)
 * - Products that increase/decrease average
 * - Top 10 largest orders
 * - Statistical analysis (median, std deviation, peak)
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

interface AvgOrderValueAnalytics {
  // Overall stats
  avgOrderValue: number;
  medianOrderValue: number;
  stdDeviation: number;
  totalOrders: number;
  totalRevenue: number;

  // Peak order
  peakOrder: {
    orderId: number;
    orderName: string;
    amount: number;
    date: string;
  };

  // Trend data (for line chart)
  avgValueTrend: Array<{
    date: string;
    avgValue: number;
    orderCount: number;
  }>;

  // Distribution by value range (bar chart)
  distributionByRange: Array<{
    range: string;
    rangeLabel: string;
    orderCount: number;
    percentage: number;
    totalRevenue: number;
  }>;

  // Breakdown by salesperson
  bySalesperson: Array<{
    salespersonId: number;
    salespersonName: string;
    avgOrderValue: number;
    totalOrders: number;
    totalRevenue: number;
  }>;

  // Products impact on average
  productImpact: Array<{
    productId: number;
    productName: string;
    avgOrderValue: number;
    orderCount: number;
    totalRevenue: number;
    impact: 'increase' | 'decrease';
  }>;

  // Top 10 largest orders
  topOrders: Array<{
    orderId: number;
    orderName: string;
    customerName: string;
    salespersonName: string;
    date: string;
    amount: number;
    percentageOfAvg: number;
  }>;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = (searchParams.get('period') || 'month') as 'week' | 'month' | 'quarter' | 'year';
    const salespersonIdStr = searchParams.get('salesperson_id');
    const salespersonId = salespersonIdStr ? parseInt(salespersonIdStr) : undefined;

    console.log('\n📊 [AVG-ORDER-VALUE] Request:', {
      period,
      salesperson_id: salespersonId || 'ALL'
    });

    // Calculate date range
    const { startDate, endDate } = calculateDateRange(period);

    console.log('📅 [AVG-ORDER-VALUE] Date range:', {
      startDate: new Date(startDate).toLocaleDateString('it-IT'),
      endDate: new Date(endDate).toLocaleDateString('it-IT')
    });

    // Connect to Odoo
    const { cookies } = await getOdooSession();
    const odoo = createOdooRPCClient(cookies?.replace('session_id=', ''));

    // Build filters for sale.order (only confirmed orders)
    const filters: any[] = [
      ['state', 'in', ['sale', 'done']],
      ['commitment_date', '>=', startDate],
      ['commitment_date', '<=', endDate]
    ];

    if (salespersonId) {
      filters.push(['user_id', '=', salespersonId]);
    }

    console.log('🔍 [AVG-ORDER-VALUE] Fetching orders from Odoo...');

    // Fetch orders with line items
    const orders = await odoo.searchRead(
      'sale.order',
      filters,
      ['id', 'name', 'partner_id', 'user_id', 'commitment_date', 'state', 'amount_total', 'order_line'],
      0  // no limit
    );

    console.log(`✅ [AVG-ORDER-VALUE] Found ${orders.length} orders`);

    // For each order, fetch order lines to get product details
    let orderLineIds: number[] = [];
    orders.forEach(order => {
      if (order.order_line && Array.isArray(order.order_line)) {
        orderLineIds = orderLineIds.concat(order.order_line);
      }
    });

    console.log(`🔍 [AVG-ORDER-VALUE] Fetching ${orderLineIds.length} order lines...`);

    const orderLines = orderLineIds.length > 0
      ? await odoo.searchRead(
          'sale.order.line',
          [['id', 'in', orderLineIds]],
          ['id', 'order_id', 'product_id', 'product_uom_qty', 'price_subtotal'],
          0
        )
      : [];

    console.log(`✅ [AVG-ORDER-VALUE] Found ${orderLines.length} order lines`);

    // Calculate analytics
    const analytics = await calculateAvgOrderValueAnalytics(orders, orderLines, period);

    console.log('✅ [AVG-ORDER-VALUE] Analytics calculated successfully');

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
    console.error('❌ [AVG-ORDER-VALUE] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'AVG_ORDER_VALUE_ANALYTICS_FAILED',
          message: error.message || 'Failed to fetch avg order value analytics'
        }
      },
      { status: 500 }
    );
  }
}

/**
 * Calculate all average order value analytics from raw order data
 */
async function calculateAvgOrderValueAnalytics(
  orders: any[],
  orderLines: any[],
  period: string
): Promise<AvgOrderValueAnalytics> {
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, order) => sum + (order.amount_total || 0), 0);
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // 1. CALCULATE MEDIAN AND STD DEVIATION
  const orderValues = orders.map(o => o.amount_total || 0).sort((a, b) => a - b);
  const medianOrderValue = orderValues.length > 0
    ? orderValues.length % 2 === 0
      ? (orderValues[orderValues.length / 2 - 1] + orderValues[orderValues.length / 2]) / 2
      : orderValues[Math.floor(orderValues.length / 2)]
    : 0;

  const variance = orderValues.reduce((sum, val) => sum + Math.pow(val - avgOrderValue, 2), 0) / (orderValues.length || 1);
  const stdDeviation = Math.sqrt(variance);

  // 2. PEAK ORDER
  const peakOrderData = orders.reduce((max, order) => {
    return (order.amount_total || 0) > (max.amount_total || 0) ? order : max;
  }, orders[0] || {});

  const peakOrder = {
    orderId: peakOrderData?.id || 0,
    orderName: peakOrderData?.name || 'N/D',
    amount: peakOrderData?.amount_total || 0,
    date: peakOrderData?.commitment_date || ''
  };

  // 3. TREND DATA (avg order value over time)
  const trendMap = new Map<string, { totalRevenue: number; orderCount: number }>();

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

    const existing = trendMap.get(dateKey) || { totalRevenue: 0, orderCount: 0 };
    existing.totalRevenue += order.amount_total || 0;
    existing.orderCount += 1;
    trendMap.set(dateKey, existing);
  }

  const avgValueTrend = Array.from(trendMap.entries())
    .map(([date, data]) => ({
      date,
      avgValue: data.orderCount > 0 ? data.totalRevenue / data.orderCount : 0,
      orderCount: data.orderCount
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // 4. DISTRIBUTION BY VALUE RANGE
  const ranges = [
    { range: '0-100', min: 0, max: 100, label: '0-100 CHF' },
    { range: '100-500', min: 100, max: 500, label: '100-500 CHF' },
    { range: '500-1000', min: 500, max: 1000, label: '500-1000 CHF' },
    { range: '1000+', min: 1000, max: Infinity, label: '1000+ CHF' }
  ];

  const distributionByRange = ranges.map(range => {
    const ordersInRange = orders.filter(o => {
      const amount = o.amount_total || 0;
      return amount >= range.min && amount < range.max;
    });

    const totalRevenueInRange = ordersInRange.reduce((sum, o) => sum + (o.amount_total || 0), 0);

    return {
      range: range.range,
      rangeLabel: range.label,
      orderCount: ordersInRange.length,
      percentage: totalOrders > 0 ? parseFloat(((ordersInRange.length / totalOrders) * 100).toFixed(1)) : 0,
      totalRevenue: totalRevenueInRange
    };
  });

  // 5. BY SALESPERSON
  const salespersonMap = new Map<number, { name: string; totalRevenue: number; orderCount: number }>();

  for (const order of orders) {
    if (order.user_id && order.user_id[0]) {
      const id = order.user_id[0];
      const name = order.user_id[1];
      const existing = salespersonMap.get(id) || { name, totalRevenue: 0, orderCount: 0 };
      existing.totalRevenue += order.amount_total || 0;
      existing.orderCount += 1;
      salespersonMap.set(id, existing);
    }
  }

  const bySalesperson = Array.from(salespersonMap.entries())
    .map(([id, data]) => ({
      salespersonId: id,
      salespersonName: data.name,
      avgOrderValue: data.orderCount > 0 ? data.totalRevenue / data.orderCount : 0,
      totalOrders: data.orderCount,
      totalRevenue: data.totalRevenue
    }))
    .sort((a, b) => b.avgOrderValue - a.avgOrderValue);

  // 6. PRODUCT IMPACT ON AVERAGE
  // Build a map of order_id -> order_amount
  const orderAmountMap = new Map<number, number>();
  orders.forEach(order => {
    orderAmountMap.set(order.id, order.amount_total || 0);
  });

  // Group order lines by product
  const productMap = new Map<number, { name: string; totalRevenue: number; orderCount: number }>();

  for (const line of orderLines) {
    if (line.product_id && line.product_id[0]) {
      const productId = line.product_id[0];
      const productName = line.product_id[1];
      const orderId = line.order_id?.[0];

      if (!orderId) continue;

      const existing = productMap.get(productId) || { name: productName, totalRevenue: 0, orderCount: 0 };

      // Only count each order once per product (to get average order value for orders containing this product)
      const orderAmount = orderAmountMap.get(orderId) || 0;

      // We track total revenue of orders containing this product
      existing.totalRevenue += orderAmount;
      existing.orderCount += 1;

      productMap.set(productId, existing);
    }
  }

  const productImpact = Array.from(productMap.entries())
    .map(([id, data]) => {
      const productAvgOrderValue = data.orderCount > 0 ? data.totalRevenue / data.orderCount : 0;
      return {
        productId: id,
        productName: data.name,
        avgOrderValue: productAvgOrderValue,
        orderCount: data.orderCount,
        totalRevenue: data.totalRevenue,
        impact: (productAvgOrderValue > avgOrderValue ? 'increase' : 'decrease') as 'increase' | 'decrease'
      };
    })
    .sort((a, b) => b.avgOrderValue - a.avgOrderValue)
    .slice(0, 10);

  // 7. TOP 10 LARGEST ORDERS
  const topOrders = orders
    .sort((a, b) => (b.amount_total || 0) - (a.amount_total || 0))
    .slice(0, 10)
    .map(order => ({
      orderId: order.id,
      orderName: order.name,
      customerName: order.partner_id?.[1] || 'N/D',
      salespersonName: order.user_id?.[1] || 'N/D',
      date: order.commitment_date,
      amount: order.amount_total || 0,
      percentageOfAvg: avgOrderValue > 0 ? parseFloat(((order.amount_total || 0) / avgOrderValue * 100).toFixed(1)) : 0
    }));

  return {
    avgOrderValue,
    medianOrderValue,
    stdDeviation,
    totalOrders,
    totalRevenue,
    peakOrder,
    avgValueTrend,
    distributionByRange,
    bySalesperson,
    productImpact,
    topOrders
  };
}
