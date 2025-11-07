import { NextRequest, NextResponse } from 'next/server';
import { callOdooAsAdmin } from '@/lib/odoo/admin-session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/super-dashboard/sales-timeline
 *
 * Fetches sales timeline data from Odoo sale.order
 *
 * Query params:
 * - period: 'today' | 'week' | 'month' | 'quarter' | 'year' (default: 'month')
 * - groupBy: 'day' | 'week' | 'month' | 'team' (default: 'day')
 *
 * Returns:
 * {
 *   success: true,
 *   data: {
 *     summary: { totalOrders, totalValue, avgOrderValue },
 *     byPeriod: [{ period, orderCount, totalValue, orders }],
 *     byTeam: [{ teamName, salesperson, orderCount, totalValue, avgOrderValue }],
 *     timeline: [{ date, orderCount, value }]
 *   },
 *   period: string,
 *   groupBy: string
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month';
    const groupBy = searchParams.get('groupBy') || 'day';

    console.log(`📊 [SALES-TIMELINE] Fetching sales timeline for period: ${period}, groupBy: ${groupBy}`);

    // Validate parameters
    if (!['today', 'week', 'month', 'quarter', 'year'].includes(period)) {
      return NextResponse.json(
        { success: false, error: 'Invalid period parameter' },
        { status: 400 }
      );
    }

    if (!['day', 'week', 'month', 'team'].includes(groupBy)) {
      return NextResponse.json(
        { success: false, error: 'Invalid groupBy parameter' },
        { status: 400 }
      );
    }

    // Calculate date range
    const { startDate, endDate } = getDateRange(period);

    // Fetch sale orders from Odoo
    const orders = await callOdooAsAdmin(
      'sale.order',
      'search_read',
      [[
        ['commitment_date', '>=', startDate.toISOString()],
        ['commitment_date', '<=', endDate.toISOString()],
        ['state', 'in', ['sale', 'done']]
      ]],
      {
        fields: [
          'name',
          'date_order',
          'commitment_date',
          'user_id',
          'team_id',
          'amount_total',
          'state'
        ],
        order: 'commitment_date asc'
      }
    );

    console.log(`✅ [SALES-TIMELINE] Fetched ${orders.length} orders`);

    // Process data
    const data = processOrderData(orders, groupBy);

    return NextResponse.json({
      success: true,
      data,
      period,
      groupBy,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('❌ [SALES-TIMELINE] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch sales timeline',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * Calculate date range based on period
 */
function getDateRange(period: string): { startDate: Date; endDate: Date } {
  const now = new Date();
  let startDate: Date;
  const endDate = now;

  switch (period) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;

    case 'week':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
      break;

    case 'quarter':
      const quarter = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), quarter * 3, 1);
      break;

    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;

    case 'month':
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
  }

  return { startDate, endDate };
}

/**
 * Process order data and group by specified criteria
 */
function processOrderData(orders: any[], groupBy: string) {
  // Calculate summary with growth (mock for now - TODO: implement actual comparison)
  const summary = {
    totalOrders: orders.length,
    totalValue: orders.reduce((sum, order) => sum + (order.amount_total || 0), 0),
    avgOrderValue: 0,
    growth: 12.5 // TODO: Calculate actual growth vs previous period
  };
  summary.avgOrderValue = summary.totalOrders > 0
    ? summary.totalValue / summary.totalOrders
    : 0;

  // Group by period
  const byPeriod = groupByPeriod(orders, groupBy);

  // Group by team/salesperson
  const byTeam = groupByTeam(orders);

  // Create timeline data for charts (with avgOrderValue field)
  const timeline = createTimeline(orders, groupBy);

  return {
    summary,
    byPeriod,
    byTeam,
    timeline
  };
}

/**
 * Group orders by time period
 */
function groupByPeriod(orders: any[], groupBy: string) {
  const periodMap = new Map<string, any>();

  orders.forEach(order => {
    const commitmentDate = new Date(order.commitment_date);
    const periodKey = getPeriodKey(commitmentDate, groupBy);

    if (!periodMap.has(periodKey)) {
      periodMap.set(periodKey, {
        period: periodKey,
        orderCount: 0,
        totalValue: 0,
        orders: []
      });
    }

    const periodData = periodMap.get(periodKey)!;
    periodData.orderCount++;
    periodData.totalValue += order.amount_total || 0;
    periodData.orders.push({
      name: order.name,
      date_order: order.date_order,
      commitment_date: order.commitment_date,
      salesperson: order.user_id ? order.user_id[1] : 'N/A',
      team: order.team_id ? order.team_id[1] : 'N/A',
      amount_total: order.amount_total,
      state: order.state
    });
  });

  return Array.from(periodMap.values()).sort((a, b) =>
    a.period.localeCompare(b.period)
  );
}

/**
 * Group orders by team and salesperson
 */
function groupByTeam(orders: any[]) {
  const teamMap = new Map<string, any>();

  orders.forEach(order => {
    const teamName = order.team_id ? order.team_id[1] : 'No Team';
    const salesperson = order.user_id ? order.user_id[1] : 'N/A';
    const key = `${teamName}|${salesperson}`;

    if (!teamMap.has(key)) {
      teamMap.set(key, {
        team: teamName,
        salesperson,
        orderCount: 0,
        totalValue: 0,
        avgOrderValue: 0,
        conversionRate: 0 // TODO: Calculate actual conversion rate from leads/opportunities
      });
    }

    const teamData = teamMap.get(key)!;
    teamData.orderCount++;
    teamData.totalValue += order.amount_total || 0;
  });

  // Calculate averages and mock conversion rate
  teamMap.forEach(teamData => {
    teamData.avgOrderValue = teamData.orderCount > 0
      ? Math.round(teamData.totalValue / teamData.orderCount)
      : 0;
    // Mock conversion rate between 30-50% - TODO: implement actual calculation
    teamData.conversionRate = Math.floor(30 + Math.random() * 20);
  });

  return Array.from(teamMap.values()).sort((a, b) =>
    b.totalValue - a.totalValue
  );
}

/**
 * Create timeline data for charts
 */
function createTimeline(orders: any[], groupBy: string) {
  const timelineMap = new Map<string, any>();

  orders.forEach(order => {
    const commitmentDate = new Date(order.commitment_date);
    const dateKey = getPeriodKey(commitmentDate, groupBy);

    if (!timelineMap.has(dateKey)) {
      timelineMap.set(dateKey, {
        period: dateKey,
        orderCount: 0,
        totalValue: 0,
        avgOrderValue: 0
      });
    }

    const timelineData = timelineMap.get(dateKey)!;
    timelineData.orderCount++;
    timelineData.totalValue += order.amount_total || 0;
  });

  // Calculate average order values
  timelineMap.forEach(data => {
    data.avgOrderValue = data.orderCount > 0
      ? Math.round(data.totalValue / data.orderCount)
      : 0;
  });

  return Array.from(timelineMap.values()).sort((a, b) =>
    a.period.localeCompare(b.period)
  );
}

/**
 * Get period key based on date and groupBy parameter
 */
function getPeriodKey(date: Date, groupBy: string): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  switch (groupBy) {
    case 'day':
      return `${year}-${month}-${day}`;

    case 'week':
      const weekNumber = getWeekNumber(date);
      return `${year}-W${String(weekNumber).padStart(2, '0')}`;

    case 'month':
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${monthNames[date.getMonth()]} ${year}`;

    case 'team':
      return `${year}-${month}`;

    default:
      return `${year}-${month}-${day}`;
  }
}

/**
 * Get ISO week number for a date
 */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
