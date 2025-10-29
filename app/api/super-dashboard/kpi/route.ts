import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { callOdooAsAdmin } from '@/lib/odoo/admin-session';

/**
 * GET /api/super-dashboard/kpi
 *
 * Fetches KPI data for Super Dashboard from Odoo + Vercel Postgres
 *
 * Query params:
 * - period: 'today' | 'week' | 'month' | 'quarter' | 'year' (default: 'month')
 *
 * Returns:
 * {
 *   revenue: { value: number, change: number, changeType: 'up'|'down' }
 *   orders: { value: number, change: number, changeType: 'up'|'down' }
 *   customers: { value: number, change: number, changeType: 'up'|'down' }
 *   healthScore: { value: number, change: number, changeType: 'up'|'down' }
 *   stockValue: { value: number, change: number, changeType: 'up'|'down' }
 *   deliveries: { value: number, change: number, changeType: 'up'|'down' }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month';

    console.log(`📊 [SUPER-DASHBOARD-KPI] Fetching KPIs for period: ${period}`);

    // Calculate date ranges
    const { currentStart, currentEnd, previousStart, previousEnd } = getDateRanges(period);

    // Parallel fetch data from Odoo and Vercel Postgres
    const [revenueData, ordersData, customersData, healthData, stockData, deliveriesData] =
      await Promise.all([
        fetchRevenue(currentStart, currentEnd, previousStart, previousEnd),
        fetchOrders(currentStart, currentEnd, previousStart, previousEnd),
        fetchCustomers(),
        fetchHealthScore(),
        fetchStockValue(),
        fetchDeliveries(currentStart, currentEnd, previousStart, previousEnd),
      ]);

    const kpiData = {
      revenue: revenueData,
      orders: ordersData,
      customers: customersData,
      healthScore: healthData,
      stockValue: stockData,
      deliveries: deliveriesData,
    };

    console.log(`✅ [SUPER-DASHBOARD-KPI] KPIs fetched successfully`);

    return NextResponse.json({
      success: true,
      data: kpiData,
      period,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('❌ [SUPER-DASHBOARD-KPI] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch KPIs',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * Calculate date ranges for period comparison
 */
function getDateRanges(period: string) {
  const now = new Date();
  let currentStart: Date, currentEnd: Date, previousStart: Date, previousEnd: Date;

  switch (period) {
    case 'today':
      currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      currentEnd = now;
      previousStart = new Date(currentStart);
      previousStart.setDate(previousStart.getDate() - 1);
      previousEnd = new Date(previousStart);
      previousEnd.setHours(23, 59, 59, 999);
      break;

    case 'week':
      currentStart = new Date(now);
      currentStart.setDate(now.getDate() - 7);
      currentEnd = now;
      previousStart = new Date(currentStart);
      previousStart.setDate(previousStart.getDate() - 7);
      previousEnd = new Date(currentStart);
      break;

    case 'quarter':
      const quarter = Math.floor(now.getMonth() / 3);
      currentStart = new Date(now.getFullYear(), quarter * 3, 1);
      currentEnd = now;
      previousStart = new Date(currentStart);
      previousStart.setMonth(previousStart.getMonth() - 3);
      previousEnd = new Date(currentStart);
      break;

    case 'year':
      currentStart = new Date(now.getFullYear(), 0, 1);
      currentEnd = now;
      previousStart = new Date(now.getFullYear() - 1, 0, 1);
      previousEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
      break;

    case 'month':
    default:
      currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
      currentEnd = now;
      previousStart = new Date(currentStart);
      previousStart.setMonth(previousStart.getMonth() - 1);
      previousEnd = new Date(currentStart);
      previousEnd.setDate(0); // Last day of previous month
      previousEnd.setHours(23, 59, 59, 999);
      break;
  }

  return { currentStart, currentEnd, previousStart, previousEnd };
}

/**
 * Fetch Revenue from Odoo (sale.order)
 */
async function fetchRevenue(
  currentStart: Date,
  currentEnd: Date,
  previousStart: Date,
  previousEnd: Date
) {
  try {
    // Current period
    const currentOrders = await callOdooAsAdmin(
      'sale.order',
      'search_read',
      [[
        ['date_order', '>=', currentStart.toISOString()],
        ['date_order', '<=', currentEnd.toISOString()],
        ['state', 'in', ['sale', 'done']]
      ]],
      { fields: ['amount_total'] }
    );

    const currentRevenue = currentOrders.reduce((sum: number, order: any) =>
      sum + (order.amount_total || 0), 0
    );

    // Previous period
    const previousOrders = await callOdooAsAdmin(
      'sale.order',
      'search_read',
      [[
        ['date_order', '>=', previousStart.toISOString()],
        ['date_order', '<=', previousEnd.toISOString()],
        ['state', 'in', ['sale', 'done']]
      ]],
      { fields: ['amount_total'] }
    );

    const previousRevenue = previousOrders.reduce((sum: number, order: any) =>
      sum + (order.amount_total || 0), 0
    );

    const change = previousRevenue > 0
      ? Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 100)
      : 0;

    return {
      value: currentRevenue,
      change: Math.abs(change),
      changeType: change >= 0 ? 'up' as const : 'down' as const,
      subtitle: 'vs periodo precedente'
    };

  } catch (error) {
    console.error('Error fetching revenue:', error);
    return { value: 0, change: 0, changeType: 'up' as const, subtitle: 'Error' };
  }
}

/**
 * Fetch Orders count from Odoo
 */
async function fetchOrders(
  currentStart: Date,
  currentEnd: Date,
  previousStart: Date,
  previousEnd: Date
) {
  try {
    // Current period
    const currentCount = await callOdooAsAdmin(
      'sale.order',
      'search_count',
      [[
        ['date_order', '>=', currentStart.toISOString()],
        ['date_order', '<=', currentEnd.toISOString()],
        ['state', 'in', ['sale', 'done']]
      ]]
    );

    // Previous period
    const previousCount = await callOdooAsAdmin(
      'sale.order',
      'search_count',
      [[
        ['date_order', '>=', previousStart.toISOString()],
        ['date_order', '<=', previousEnd.toISOString()],
        ['state', 'in', ['sale', 'done']]
      ]]
    );

    const change = previousCount > 0
      ? Math.round(((currentCount - previousCount) / previousCount) * 100)
      : 0;

    // Calculate daily average
    const days = Math.ceil((currentEnd.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24));
    const dailyAvg = Math.round(currentCount / days);

    return {
      value: currentCount,
      change: Math.abs(change),
      changeType: change >= 0 ? 'up' as const : 'down' as const,
      subtitle: `${dailyAvg} ordini/giorno`
    };

  } catch (error) {
    console.error('Error fetching orders:', error);
    return { value: 0, change: 0, changeType: 'up' as const, subtitle: 'Error' };
  }
}

/**
 * Fetch Customers count from Vercel Postgres (customer_avatars)
 */
async function fetchCustomers() {
  try {
    const result = await sql`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as new_count
      FROM customer_avatars
      WHERE is_active = true
    `;

    const total = parseInt(result.rows[0]?.total || '0');
    const newCount = parseInt(result.rows[0]?.new_count || '0');

    return {
      value: total,
      change: newCount,
      changeType: 'up' as const,
      subtitle: `${newCount} nuovi clienti`
    };

  } catch (error) {
    console.error('Error fetching customers:', error);
    return { value: 0, change: 0, changeType: 'up' as const, subtitle: 'Error' };
  }
}

/**
 * Fetch Health Score from Vercel Postgres (average of all customers)
 */
async function fetchHealthScore() {
  try {
    const result = await sql`
      SELECT
        ROUND(AVG(health_score))::INTEGER as avg_health,
        ROUND(AVG(health_score) FILTER (WHERE updated_at >= NOW() - INTERVAL '7 days'))::INTEGER as prev_avg
      FROM customer_avatars
      WHERE is_active = true
    `;

    const currentHealth = result.rows[0]?.avg_health || 50;
    const previousHealth = result.rows[0]?.prev_avg || 50;
    const change = currentHealth - previousHealth;

    return {
      value: currentHealth,
      change: Math.abs(change),
      changeType: change >= 0 ? 'up' as const : 'down' as const,
      subtitle: 'Media clienti'
    };

  } catch (error) {
    console.error('Error fetching health score:', error);
    return { value: 50, change: 0, changeType: 'up' as const, subtitle: 'Error' };
  }
}

/**
 * Fetch Stock Value from Odoo (stock.quant)
 */
async function fetchStockValue() {
  try {
    // Fetch all stock quants with positive quantity
    const quants = await callOdooAsAdmin(
      'stock.quant',
      'search_read',
      [[
        ['quantity', '>', 0],
        ['location_id.usage', '=', 'internal']
      ]],
      { fields: ['product_id', 'quantity'], limit: 10000 }
    );

    // Get product IDs
    const productIds = Array.from(new Set(quants.map((q: any) => q.product_id[0])));

    // Fetch product prices
    const products = await callOdooAsAdmin(
      'product.product',
      'read',
      [productIds],
      { fields: ['id', 'standard_price'] }
    );

    const priceMap = new Map(products.map((p: any) => [p.id, p.standard_price || 0]));

    // Calculate total stock value
    const totalValue = quants.reduce((sum: number, quant: any) => {
      const price = Number(priceMap.get(quant.product_id[0]) || 0);
      const quantity = Number(quant.quantity) || 0;
      return sum + (quantity * price);
    }, 0);

    // Count products
    const productCount = quants.length;

    return {
      value: totalValue,
      change: 8, // Mock change for now
      changeType: 'down' as const,
      subtitle: `${productCount.toLocaleString()} prodotti`
    };

  } catch (error) {
    console.error('Error fetching stock value:', error);
    return { value: 0, change: 0, changeType: 'down' as const, subtitle: 'Error' };
  }
}

/**
 * Fetch Deliveries from Odoo (stock.picking)
 */
async function fetchDeliveries(
  currentStart: Date,
  currentEnd: Date,
  previousStart: Date,
  previousEnd: Date
) {
  try {
    // Current period deliveries
    const currentDeliveries = await callOdooAsAdmin(
      'stock.picking',
      'search',
      [[
        ['scheduled_date', '>=', currentStart.toISOString()],
        ['scheduled_date', '<=', currentEnd.toISOString()],
        ['picking_type_id.code', '=', 'outgoing'],
        ['state', 'in', ['assigned', 'done']]
      ]]
    );

    // Count completed
    const completedDeliveries = await callOdooAsAdmin(
      'stock.picking',
      'search_count',
      [[
        ['scheduled_date', '>=', currentStart.toISOString()],
        ['scheduled_date', '<=', currentEnd.toISOString()],
        ['picking_type_id.code', '=', 'outgoing'],
        ['state', '=', 'done']
      ]]
    );

    // Previous period
    const previousDeliveries = await callOdooAsAdmin(
      'stock.picking',
      'search_count',
      [[
        ['scheduled_date', '>=', previousStart.toISOString()],
        ['scheduled_date', '<=', previousEnd.toISOString()],
        ['picking_type_id.code', '=', 'outgoing'],
        ['state', 'in', ['assigned', 'done']]
      ]]
    );

    const currentCount = currentDeliveries.length || 0;
    const change = previousDeliveries > 0
      ? Math.round(((currentCount - previousDeliveries) / previousDeliveries) * 100)
      : 0;

    return {
      value: currentCount,
      change: Math.abs(change),
      changeType: change >= 0 ? 'up' as const : 'down' as const,
      subtitle: `${completedDeliveries} completate`
    };

  } catch (error) {
    console.error('Error fetching deliveries:', error);
    return { value: 0, change: 0, changeType: 'up' as const, subtitle: 'Error' };
  }
}
