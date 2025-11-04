/**
 * MAESTRO AI - Active Customers Analytics API
 *
 * GET /api/maestro/analytics/customers
 *
 * Returns detailed analytics for active customers from Vercel Postgres:
 * - Total active customers
 * - Customer list with health scores
 * - Breakdown by salesperson
 * - Geographic distribution (city/region)
 * - New vs recurring customers
 * - Customer trend over time
 * - Churn rate calculation
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export const dynamic = 'force-dynamic';

interface PeriodRange {
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
}

/**
 * Calculate date range for the specified period
 */
function getPeriodRange(period: string): PeriodRange {
  const now = new Date();
  const end = new Date(now);
  let start = new Date(now);
  let previousStart = new Date(now);
  let previousEnd = new Date(now);

  switch (period) {
    case 'week':
      start.setDate(now.getDate() - 7);
      previousStart.setDate(now.getDate() - 14);
      previousEnd.setDate(now.getDate() - 7);
      break;
    case 'month':
      start.setMonth(now.getMonth() - 1);
      previousStart.setMonth(now.getMonth() - 2);
      previousEnd.setMonth(now.getMonth() - 1);
      break;
    case 'quarter':
      start.setMonth(now.getMonth() - 3);
      previousStart.setMonth(now.getMonth() - 6);
      previousEnd.setMonth(now.getMonth() - 3);
      break;
    case 'year':
      start.setFullYear(now.getFullYear() - 1);
      previousStart.setFullYear(now.getFullYear() - 2);
      previousEnd.setFullYear(now.getFullYear() - 1);
      break;
    default:
      start.setMonth(now.getMonth() - 3);
      previousStart.setMonth(now.getMonth() - 6);
      previousEnd.setMonth(now.getMonth() - 3);
  }

  return { start, end, previousStart, previousEnd };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'quarter';
    const salespersonId = searchParams.get('salesperson_id');

    console.log('📊 [CUSTOMERS-ANALYTICS] Request:', { period, salespersonId });

    const { start, end, previousStart, previousEnd } = getPeriodRange(period);

    console.log('📅 [CUSTOMERS-ANALYTICS] Period ranges:', {
      current: `${start.toISOString()} - ${end.toISOString()}`,
      previous: `${previousStart.toISOString()} - ${previousEnd.toISOString()}`
    });

    // Build base WHERE clause
    const baseConditions = ['is_active = true'];
    const params: any[] = [start.toISOString(), end.toISOString()];
    let paramIndex = 3;

    if (salespersonId) {
      baseConditions.push(`assigned_salesperson_id = $${paramIndex}`);
      params.push(parseInt(salespersonId));
      paramIndex++;
    }

    const whereClause = baseConditions.join(' AND ');

    // QUERY 1: Total customers with activity in period
    const totalResult = await sql.query(
      `SELECT COUNT(*) as total
       FROM customer_avatars
       WHERE ${whereClause}
         AND last_order_date >= $1
         AND last_order_date <= $2`,
      params
    );
    const totalCustomers = parseInt(totalResult.rows[0]?.total || '0');

    // QUERY 2: New customers (first_order_date in period)
    const newResult = await sql.query(
      `SELECT COUNT(*) as new
       FROM customer_avatars
       WHERE ${whereClause}
         AND first_order_date >= $1
         AND first_order_date <= $2`,
      params
    );
    const newCustomers = parseInt(newResult.rows[0]?.new || '0');

    // QUERY 3: Recurring customers (first_order_date before period, but active in period)
    const recurringResult = await sql.query(
      `SELECT COUNT(*) as recurring
       FROM customer_avatars
       WHERE ${whereClause}
         AND first_order_date < $1
         AND last_order_date >= $1
         AND last_order_date <= $2`,
      params
    );
    const recurringCustomers = parseInt(recurringResult.rows[0]?.recurring || '0');

    // QUERY 4: Churn calculation - customers active in previous period but NOT in current period
    const prevParams = [previousStart.toISOString(), previousEnd.toISOString()];
    if (salespersonId) {
      prevParams.push(salespersonId);
    }

    const previousActiveResult = await sql.query(
      `SELECT COUNT(*) as prev_active
       FROM customer_avatars
       WHERE ${whereClause}
         AND last_order_date >= $1
         AND last_order_date <= $2`,
      prevParams
    );
    const previousActive = parseInt(previousActiveResult.rows[0]?.prev_active || '0');

    const churnedResult = await sql.query(
      `SELECT COUNT(*) as churned
       FROM customer_avatars
       WHERE ${whereClause}
         AND last_order_date >= $1
         AND last_order_date <= $2
         AND odoo_partner_id NOT IN (
           SELECT odoo_partner_id
           FROM customer_avatars
           WHERE ${whereClause}
             AND last_order_date >= $3
             AND last_order_date <= $4
         )`,
      [...prevParams, start.toISOString(), end.toISOString()]
    );
    const churned = parseInt(churnedResult.rows[0]?.churned || '0');
    const churnRate = previousActive > 0 ? (churned / previousActive) * 100 : 0;

    // QUERY 5: Customers list with details
    const customersList = await sql.query(
      `SELECT
         id::text,
         name,
         city,
         total_orders as "orderCount",
         total_revenue as "totalRevenue",
         health_score as "healthScore",
         churn_risk_score as "churnRisk"
       FROM customer_avatars
       WHERE ${whereClause}
         AND last_order_date >= $1
         AND last_order_date <= $2
       ORDER BY total_revenue DESC`,
      params
    );

    // QUERY 6: Breakdown by salesperson
    const bySalespersonResult = await sql.query(
      `SELECT
         assigned_salesperson_id as "salespersonId",
         assigned_salesperson_name as "salespersonName",
         COUNT(*) as "customerCount"
       FROM customer_avatars
       WHERE is_active = true
         AND last_order_date >= $1
         AND last_order_date <= $2
         ${salespersonId ? `AND assigned_salesperson_id = $3` : ''}
         AND assigned_salesperson_id IS NOT NULL
       GROUP BY assigned_salesperson_id, assigned_salesperson_name
       ORDER BY "customerCount" DESC`,
      salespersonId ? params : [start.toISOString(), end.toISOString()]
    );

    const totalForPercentage = bySalespersonResult.rows.reduce(
      (sum, row) => sum + parseInt(row.customerCount),
      0
    );

    const bySalesperson = bySalespersonResult.rows.map((row) => ({
      salespersonId: row.salespersonId,
      salespersonName: row.salespersonName,
      customerCount: parseInt(row.customerCount),
      percentage: totalForPercentage > 0
        ? parseFloat(((parseInt(row.customerCount) / totalForPercentage) * 100).toFixed(1))
        : 0
    }));

    // QUERY 7: Breakdown by city
    const byCityResult = await sql.query(
      `SELECT
         city,
         COUNT(*) as "customerCount"
       FROM customer_avatars
       WHERE ${whereClause}
         AND last_order_date >= $1
         AND last_order_date <= $2
         AND city IS NOT NULL
         AND city != ''
       GROUP BY city
       ORDER BY "customerCount" DESC
       LIMIT 10`,
      params
    );

    const totalCitiesCount = byCityResult.rows.reduce(
      (sum, row) => sum + parseInt(row.customerCount),
      0
    );

    const byCity = byCityResult.rows.map((row) => ({
      city: row.city,
      customerCount: parseInt(row.customerCount),
      percentage: totalCitiesCount > 0
        ? parseFloat(((parseInt(row.customerCount) / totalCitiesCount) * 100).toFixed(1))
        : 0
    }));

    // QUERY 8: Daily/Weekly trend
    const trendInterval = period === 'week' ? '1 day' : period === 'month' ? '1 day' : '1 week';
    const trendResult = await sql.query(
      `SELECT
         DATE_TRUNC('${period === 'week' || period === 'month' ? 'day' : 'week'}', last_order_date) as date,
         COUNT(DISTINCT odoo_partner_id) as customers
       FROM customer_avatars
       WHERE ${whereClause}
         AND last_order_date >= $1
         AND last_order_date <= $2
       GROUP BY DATE_TRUNC('${period === 'week' || period === 'month' ? 'day' : 'week'}', last_order_date)
       ORDER BY date ASC`,
      params
    );

    const customersTrend = trendResult.rows.map((row) => ({
      date: row.date,
      customers: parseInt(row.customers)
    }));

    console.log('✅ [CUSTOMERS-ANALYTICS] Results:', {
      totalCustomers,
      newCustomers,
      recurringCustomers,
      churnRate: `${churnRate.toFixed(2)}%`,
      customersList: customersList.rows.length,
      bySalesperson: bySalesperson.length,
      byCity: byCity.length,
      trendPoints: customersTrend.length
    });

    return NextResponse.json({
      success: true,
      analytics: {
        totalCustomers,
        newCustomers,
        recurringCustomers,
        churnRate: parseFloat(churnRate.toFixed(2)),
        customersTrend,
        customersList: customersList.rows,
        bySalesperson,
        byCity
      }
    });

  } catch (error: any) {
    console.error('❌ [CUSTOMERS-ANALYTICS] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          message: error.message || 'Failed to fetch customers analytics',
          details: error
        }
      },
      { status: 500 }
    );
  }
}
