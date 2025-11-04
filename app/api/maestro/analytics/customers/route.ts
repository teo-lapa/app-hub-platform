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

    // Build base WHERE clause and params for current period
    const params: any[] = [];
    const conditions = ['is_active = true'];
    let paramIndex = 1;

    // Add date range for current period
    conditions.push(`last_order_date >= $${paramIndex++}`);
    params.push(start.toISOString());
    conditions.push(`last_order_date <= $${paramIndex++}`);
    params.push(end.toISOString());

    // Add salesperson filter if present
    if (salespersonId) {
      conditions.push(`assigned_salesperson_id = $${paramIndex++}`);
      params.push(parseInt(salespersonId));
    }

    const whereClause = conditions.join(' AND ');

    console.log('🔍 [CUSTOMERS-ANALYTICS] WHERE clause:', whereClause);
    console.log('🔍 [CUSTOMERS-ANALYTICS] Params:', params);

    // QUERY 1: Total customers with activity in period
    const totalResult = await sql.query(
      `SELECT COUNT(*) as total
       FROM customer_avatars
       WHERE ${whereClause}`,
      params
    );
    const totalCustomers = parseInt(totalResult.rows[0]?.total || '0');

    // QUERY 2: New customers (first_order_date in period)
    const newParams: any[] = [];
    const newConditions = ['is_active = true'];
    let newParamIndex = 1;

    newConditions.push(`first_order_date >= $${newParamIndex++}`);
    newParams.push(start.toISOString());
    newConditions.push(`first_order_date <= $${newParamIndex++}`);
    newParams.push(end.toISOString());

    if (salespersonId) {
      newConditions.push(`assigned_salesperson_id = $${newParamIndex++}`);
      newParams.push(parseInt(salespersonId));
    }

    const newWhereClause = newConditions.join(' AND ');

    const newResult = await sql.query(
      `SELECT COUNT(*) as new
       FROM customer_avatars
       WHERE ${newWhereClause}`,
      newParams
    );
    const newCustomers = parseInt(newResult.rows[0]?.new || '0');

    // QUERY 3: Recurring customers (first_order_date before period, but active in period)
    const recurringParams: any[] = [];
    const recurringConditions = ['is_active = true'];
    let recurringParamIndex = 1;

    recurringConditions.push(`first_order_date < $${recurringParamIndex++}`);
    recurringParams.push(start.toISOString());
    recurringConditions.push(`last_order_date >= $${recurringParamIndex++}`);
    recurringParams.push(start.toISOString());
    recurringConditions.push(`last_order_date <= $${recurringParamIndex++}`);
    recurringParams.push(end.toISOString());

    if (salespersonId) {
      recurringConditions.push(`assigned_salesperson_id = $${recurringParamIndex++}`);
      recurringParams.push(parseInt(salespersonId));
    }

    const recurringWhereClause = recurringConditions.join(' AND ');

    const recurringResult = await sql.query(
      `SELECT COUNT(*) as recurring
       FROM customer_avatars
       WHERE ${recurringWhereClause}`,
      recurringParams
    );
    const recurringCustomers = parseInt(recurringResult.rows[0]?.recurring || '0');

    // QUERY 4: Churn calculation - customers active in previous period but NOT in current period
    const prevParams: any[] = [];
    const prevConditions = ['is_active = true'];
    let prevParamIndex = 1;

    prevConditions.push(`last_order_date >= $${prevParamIndex++}`);
    prevParams.push(previousStart.toISOString());
    prevConditions.push(`last_order_date <= $${prevParamIndex++}`);
    prevParams.push(previousEnd.toISOString());

    if (salespersonId) {
      prevConditions.push(`assigned_salesperson_id = $${prevParamIndex++}`);
      prevParams.push(parseInt(salespersonId));
    }

    const prevWhereClause = prevConditions.join(' AND ');

    const previousActiveResult = await sql.query(
      `SELECT COUNT(*) as prev_active
       FROM customer_avatars
       WHERE ${prevWhereClause}`,
      prevParams
    );
    const previousActive = parseInt(previousActiveResult.rows[0]?.prev_active || '0');

    // Churn: customers active in previous period but NOT in current period
    const churnParams: any[] = [];
    const churnConditions = ['is_active = true'];
    let churnParamIndex = 1;

    churnConditions.push(`last_order_date >= $${churnParamIndex++}`);
    churnParams.push(previousStart.toISOString());
    churnConditions.push(`last_order_date <= $${churnParamIndex++}`);
    churnParams.push(previousEnd.toISOString());

    if (salespersonId) {
      churnConditions.push(`assigned_salesperson_id = $${churnParamIndex++}`);
      churnParams.push(parseInt(salespersonId));
    }

    // Add subquery params for current period
    churnParams.push(start.toISOString());
    churnParams.push(end.toISOString());
    const subqueryStartParam = churnParamIndex++;
    const subqueryEndParam = churnParamIndex++;

    // Build subquery WHERE clause
    const subqueryConditions = ['is_active = true'];
    let subqueryParamIndex = subqueryStartParam;
    subqueryConditions.push(`last_order_date >= $${subqueryParamIndex++}`);
    subqueryConditions.push(`last_order_date <= $${subqueryParamIndex++}`);

    if (salespersonId) {
      subqueryConditions.push(`assigned_salesperson_id = $${subqueryParamIndex++}`);
      churnParams.push(parseInt(salespersonId));
    }

    const churnWhereClause = churnConditions.join(' AND ');
    const subqueryWhereClause = subqueryConditions.join(' AND ');

    const churnedResult = await sql.query(
      `SELECT COUNT(*) as churned
       FROM customer_avatars
       WHERE ${churnWhereClause}
         AND odoo_partner_id NOT IN (
           SELECT odoo_partner_id
           FROM customer_avatars
           WHERE ${subqueryWhereClause}
         )`,
      churnParams
    );
    const churned = parseInt(churnedResult.rows[0]?.churned || '0');
    const churnRate = previousActive > 0 ? (churned / previousActive) * 100 : 0;

    // QUERY 5: Customers list with details (reuse params from QUERY 1)
    // IMPORTANT: Return odoo_partner_id as 'id' for compatibility with customer detail page
    const customersList = await sql.query(
      `SELECT
         odoo_partner_id::text as id,
         name,
         city,
         total_orders as "orderCount",
         total_revenue as "totalRevenue",
         health_score as "healthScore",
         churn_risk_score as "churnRisk"
       FROM customer_avatars
       WHERE ${whereClause}
       ORDER BY total_revenue DESC`,
      params
    );

    // QUERY 6: Breakdown by salesperson
    const salesParams: any[] = [];
    const salesConditions = ['is_active = true'];
    let salesParamIndex = 1;

    salesConditions.push(`last_order_date >= $${salesParamIndex++}`);
    salesParams.push(start.toISOString());
    salesConditions.push(`last_order_date <= $${salesParamIndex++}`);
    salesParams.push(end.toISOString());

    if (salespersonId) {
      salesConditions.push(`assigned_salesperson_id = $${salesParamIndex++}`);
      salesParams.push(parseInt(salespersonId));
    }

    salesConditions.push('assigned_salesperson_id IS NOT NULL');

    const salesWhereClause = salesConditions.join(' AND ');

    const bySalespersonResult = await sql.query(
      `SELECT
         assigned_salesperson_id as "salespersonId",
         assigned_salesperson_name as "salespersonName",
         COUNT(*) as "customerCount"
       FROM customer_avatars
       WHERE ${salesWhereClause}
       GROUP BY assigned_salesperson_id, assigned_salesperson_name
       ORDER BY "customerCount" DESC`,
      salesParams
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
    const cityParams: any[] = [];
    const cityConditions = ['is_active = true'];
    let cityParamIndex = 1;

    cityConditions.push(`last_order_date >= $${cityParamIndex++}`);
    cityParams.push(start.toISOString());
    cityConditions.push(`last_order_date <= $${cityParamIndex++}`);
    cityParams.push(end.toISOString());

    if (salespersonId) {
      cityConditions.push(`assigned_salesperson_id = $${cityParamIndex++}`);
      cityParams.push(parseInt(salespersonId));
    }

    cityConditions.push('city IS NOT NULL');
    cityConditions.push(`city != ''`);

    const cityWhereClause = cityConditions.join(' AND ');

    const byCityResult = await sql.query(
      `SELECT
         city,
         COUNT(*) as "customerCount"
       FROM customer_avatars
       WHERE ${cityWhereClause}
       GROUP BY city
       ORDER BY "customerCount" DESC
       LIMIT 10`,
      cityParams
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

    // QUERY 8: Daily/Weekly trend (reuse params from QUERY 1)
    const trendInterval = period === 'week' ? '1 day' : period === 'month' ? '1 day' : '1 week';
    const truncPeriod = period === 'week' || period === 'month' ? 'day' : 'week';

    const trendResult = await sql.query(
      `SELECT
         DATE_TRUNC('${truncPeriod}', last_order_date) as date,
         COUNT(DISTINCT odoo_partner_id) as customers
       FROM customer_avatars
       WHERE ${whereClause}
       GROUP BY DATE_TRUNC('${truncPeriod}', last_order_date)
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
