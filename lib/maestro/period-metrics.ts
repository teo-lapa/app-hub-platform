/**
 * MAESTRO AI - Period-Specific Metrics
 *
 * Queries Odoo directly for period-specific revenue and orders
 * instead of using lifetime totals from customer_avatars table
 */

import { getOdooSession } from '../odoo-auth';
import { createOdooRPCClient } from '../odoo/rpcClient';

export interface PeriodMetrics {
  revenue: number;
  orders: number;
  customers: number;
  avgOrderValue: number;
}

export interface CustomerPeriodMetrics {
  odoo_partner_id: number;
  name: string;
  revenue: number;
  orders: number;
}

/**
 * Calculate period-specific metrics by querying Odoo sale.order directly
 *
 * @param salespersonId - Filter by salesperson (optional)
 * @param startDate - Period start date (ISO string)
 * @param endDate - Period end date (ISO string)
 * @returns Aggregated metrics for the period
 */
export async function getPeriodMetrics(
  salespersonId?: number,
  startDate?: string,
  endDate?: string
): Promise<PeriodMetrics> {
  try {
    console.log('📊 [PERIOD-METRICS] Fetching period-specific data from Odoo...');
    console.log(`   Salesperson: ${salespersonId || 'ALL'}`);
    console.log(`   Period: ${startDate} to ${endDate}`);

    // Connect to Odoo
    const { cookies } = await getOdooSession();
    const odoo = createOdooRPCClient(cookies?.replace('session_id=', ''));

    // Build filters for sale.order
    const filters: any[] = [
      ['state', 'in', ['sale', 'done']]  // Only confirmed orders
    ];

    if (salespersonId) {
      filters.push(['user_id', '=', salespersonId]);
    }

    if (startDate) {
      filters.push(['commitment_date', '>=', startDate]);
    }

    if (endDate) {
      filters.push(['commitment_date', '<=', endDate]);
    }

    console.log('🔍 [PERIOD-METRICS] Odoo filters:', JSON.stringify(filters));

    // Fetch orders from Odoo
    const orders = await odoo.searchRead(
      'sale.order',
      filters,
      ['id', 'partner_id', 'commitment_date', 'amount_total', 'user_id'],
      0  // no limit
    );

    console.log(`✅ [PERIOD-METRICS] Found ${orders.length} orders in period`);

    // Calculate metrics
    const revenue = orders.reduce((sum: number, order: any) => sum + (order.amount_total || 0), 0);
    const orderCount = orders.length;
    const uniqueCustomers = new Set(orders.map((o: any) => o.partner_id[0])).size;
    const avgOrderValue = orderCount > 0 ? revenue / orderCount : 0;

    const metrics: PeriodMetrics = {
      revenue: parseFloat(revenue.toFixed(2)),
      orders: orderCount,
      customers: uniqueCustomers,
      avgOrderValue: parseFloat(avgOrderValue.toFixed(2))
    };

    console.log('✅ [PERIOD-METRICS] Results:', {
      revenue: `CHF ${metrics.revenue.toLocaleString()}`,
      orders: metrics.orders,
      customers: metrics.customers,
      avgOrderValue: `CHF ${metrics.avgOrderValue.toLocaleString()}`
    });

    return metrics;

  } catch (error) {
    console.error('❌ [PERIOD-METRICS] Error fetching period metrics:', error);
    throw error;
  }
}

/**
 * Get period-specific metrics grouped by customer
 *
 * @param salespersonId - Filter by salesperson (optional)
 * @param startDate - Period start date (ISO string)
 * @param endDate - Period end date (ISO string)
 * @returns Array of customer metrics for the period
 */
export async function getCustomerPeriodMetrics(
  salespersonId?: number,
  startDate?: string,
  endDate?: string
): Promise<CustomerPeriodMetrics[]> {
  try {
    console.log('📊 [CUSTOMER-PERIOD-METRICS] Fetching customer-specific period data...');

    // Connect to Odoo
    const { cookies } = await getOdooSession();
    const odoo = createOdooRPCClient(cookies?.replace('session_id=', ''));

    // Build filters for sale.order
    const filters: any[] = [
      ['state', 'in', ['sale', 'done']]
    ];

    if (salespersonId) {
      filters.push(['user_id', '=', salespersonId]);
    }

    if (startDate) {
      filters.push(['commitment_date', '>=', startDate]);
    }

    if (endDate) {
      filters.push(['commitment_date', '<=', endDate]);
    }

    // Fetch orders from Odoo
    const orders = await odoo.searchRead(
      'sale.order',
      filters,
      ['id', 'partner_id', 'amount_total'],
      0
    );

    console.log(`✅ [CUSTOMER-PERIOD-METRICS] Found ${orders.length} orders`);

    // Group by customer
    const customerMap = new Map<number, { name: string; revenue: number; orders: number }>();

    for (const order of orders) {
      const partnerId = order.partner_id[0];
      const partnerName = order.partner_id[1];
      const amount = order.amount_total || 0;

      if (!customerMap.has(partnerId)) {
        customerMap.set(partnerId, {
          name: partnerName,
          revenue: 0,
          orders: 0
        });
      }

      const customer = customerMap.get(partnerId)!;
      customer.revenue += amount;
      customer.orders += 1;
    }

    // Convert to array
    const customerMetrics: CustomerPeriodMetrics[] = Array.from(customerMap.entries()).map(([partnerId, data]) => ({
      odoo_partner_id: partnerId,
      name: data.name,
      revenue: parseFloat(data.revenue.toFixed(2)),
      orders: data.orders
    }));

    console.log(`✅ [CUSTOMER-PERIOD-METRICS] Grouped into ${customerMetrics.length} customers`);

    return customerMetrics;

  } catch (error) {
    console.error('❌ [CUSTOMER-PERIOD-METRICS] Error:', error);
    throw error;
  }
}

/**
 * Calculate date range for a given period
 */
export function calculateDateRange(period: 'week' | 'month' | 'quarter' | 'year'): { startDate: string; endDate: string } {
  const now = new Date();
  const endDate = now.toISOString();

  const startDate = new Date();
  switch (period) {
    case 'week':
      startDate.setDate(now.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(now.getMonth() - 1);
      break;
    case 'quarter':
      startDate.setMonth(now.getMonth() - 3);
      break;
    case 'year':
      startDate.setFullYear(now.getFullYear() - 1);
      break;
  }

  return {
    startDate: startDate.toISOString(),
    endDate
  };
}

/**
 * Calculate previous period date range (for trend comparison)
 */
export function calculatePreviousPeriodDateRange(period: 'week' | 'month' | 'quarter' | 'year'): { startDate: string; endDate: string } {
  const now = new Date();

  const endDate = new Date();
  const startDate = new Date();

  switch (period) {
    case 'week':
      // Previous week: from -14 days to -7 days
      endDate.setDate(now.getDate() - 7);
      startDate.setDate(now.getDate() - 14);
      break;
    case 'month':
      // Previous month: from -2 months to -1 month
      endDate.setMonth(now.getMonth() - 1);
      startDate.setMonth(now.getMonth() - 2);
      break;
    case 'quarter':
      // Previous quarter: from -6 months to -3 months
      endDate.setMonth(now.getMonth() - 3);
      startDate.setMonth(now.getMonth() - 6);
      break;
    case 'year':
      // Previous year: from -2 years to -1 year
      endDate.setFullYear(now.getFullYear() - 1);
      startDate.setFullYear(now.getFullYear() - 2);
      break;
  }

  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  };
}

/**
 * Calculate trend percentage change between current and previous period
 * Returns the percentage change: ((current - previous) / previous) * 100
 *
 * @param currentValue - Current period value
 * @param previousValue - Previous period value
 * @returns Percentage change (e.g., 15.5 for +15.5%, -10.2 for -10.2%)
 */
export function calculateTrendPercentage(currentValue: number, previousValue: number): number {
  // Edge case: if previous value is 0 or null
  if (!previousValue || previousValue === 0) {
    // If current is also 0, no change
    if (!currentValue || currentValue === 0) {
      return 0;
    }
    // If we have current value but no previous, consider it 100% increase
    return 100;
  }

  const percentageChange = ((currentValue - previousValue) / previousValue) * 100;
  return parseFloat(percentageChange.toFixed(1));
}

export interface PeriodMetricsWithTrends extends PeriodMetrics {
  revenueTrend: number;
  ordersTrend: number;
  customersTrend: number;
  avgOrderValueTrend: number;
}

/**
 * Get period metrics with trends by comparing current vs previous period
 */
export async function getPeriodMetricsWithTrends(
  period: 'week' | 'month' | 'quarter' | 'year',
  salespersonId?: number
): Promise<PeriodMetricsWithTrends> {
  try {
    console.log('📊 [PERIOD-METRICS-TRENDS] Fetching current and previous period...');

    // Calculate date ranges
    const currentRange = calculateDateRange(period);
    const previousRange = calculatePreviousPeriodDateRange(period);

    console.log('📅 [PERIOD-METRICS-TRENDS] Current period:', {
      start: new Date(currentRange.startDate).toLocaleDateString('it-IT'),
      end: new Date(currentRange.endDate).toLocaleDateString('it-IT')
    });
    console.log('📅 [PERIOD-METRICS-TRENDS] Previous period:', {
      start: new Date(previousRange.startDate).toLocaleDateString('it-IT'),
      end: new Date(previousRange.endDate).toLocaleDateString('it-IT')
    });

    // Fetch both periods in parallel
    const [currentMetrics, previousMetrics] = await Promise.all([
      getPeriodMetrics(salespersonId, currentRange.startDate, currentRange.endDate),
      getPeriodMetrics(salespersonId, previousRange.startDate, previousRange.endDate)
    ]);

    console.log('✅ [PERIOD-METRICS-TRENDS] Current metrics:', currentMetrics);
    console.log('✅ [PERIOD-METRICS-TRENDS] Previous metrics:', previousMetrics);

    // Calculate trends
    const revenueTrend = calculateTrendPercentage(currentMetrics.revenue, previousMetrics.revenue);
    const ordersTrend = calculateTrendPercentage(currentMetrics.orders, previousMetrics.orders);
    const customersTrend = calculateTrendPercentage(currentMetrics.customers, previousMetrics.customers);
    const avgOrderValueTrend = calculateTrendPercentage(currentMetrics.avgOrderValue, previousMetrics.avgOrderValue);

    console.log('📈 [PERIOD-METRICS-TRENDS] Calculated trends:', {
      revenueTrend: `${revenueTrend > 0 ? '+' : ''}${revenueTrend}%`,
      ordersTrend: `${ordersTrend > 0 ? '+' : ''}${ordersTrend}%`,
      customersTrend: `${customersTrend > 0 ? '+' : ''}${customersTrend}%`,
      avgOrderValueTrend: `${avgOrderValueTrend > 0 ? '+' : ''}${avgOrderValueTrend}%`
    });

    return {
      ...currentMetrics,
      revenueTrend,
      ordersTrend,
      customersTrend,
      avgOrderValueTrend
    };

  } catch (error) {
    console.error('❌ [PERIOD-METRICS-TRENDS] Error:', error);
    throw error;
  }
}

/**
 * Get revenue trend data grouped by day/month for charts
 */
export async function getRevenueTrend(
  period: 'week' | 'month' | 'quarter' | 'year',
  salespersonId?: number
): Promise<Array<{ date: string; revenue: number; orders: number }>> {
  try {
    console.log('📈 [REVENUE-TREND] Fetching trend data...');

    // Connect to Odoo
    const { cookies } = await getOdooSession();
    const odoo = createOdooRPCClient(cookies?.replace('session_id=', ''));

    // Calculate date range
    const { startDate, endDate } = calculateDateRange(period);

    // Build filters
    const filters: any[] = [
      ['state', 'in', ['sale', 'done']],
      ['commitment_date', '>=', startDate],
      ['commitment_date', '<=', endDate]
    ];

    if (salespersonId) {
      filters.push(['user_id', '=', salespersonId]);
    }

    // Fetch orders
    const orders = await odoo.searchRead(
      'sale.order',
      filters,
      ['id', 'commitment_date', 'amount_total'],
      0
    );

    console.log(`✅ [REVENUE-TREND] Found ${orders.length} orders for trend`);

    // Group by date (day or month depending on period)
    const trendMap = new Map<string, { revenue: number; orders: number }>();

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

      if (!trendMap.has(dateKey)) {
        trendMap.set(dateKey, { revenue: 0, orders: 0 });
      }

      const entry = trendMap.get(dateKey)!;
      entry.revenue += order.amount_total || 0;
      entry.orders += 1;
    }

    // Convert to array and sort by date
    const trendData = Array.from(trendMap.entries())
      .map(([date, data]) => ({
        date,
        revenue: parseFloat(data.revenue.toFixed(2)),
        orders: data.orders
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    console.log(`✅ [REVENUE-TREND] Grouped into ${trendData.length} data points`);

    return trendData;

  } catch (error) {
    console.error('❌ [REVENUE-TREND] Error:', error);
    throw error;
  }
}
