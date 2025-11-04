/**
 * MAESTRO AI - Active Customers Analytics API
 *
 * GET /api/maestro/analytics/customers
 *
 * Returns detailed analytics for active customers:
 * - Total active customers
 * - Customer list with health scores
 * - Breakdown by salesperson
 * - Geographic distribution (city/region)
 * - New vs recurring customers
 * - Customer trend over time
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

interface CustomerAnalytics {
  totalCustomers: number;
  newCustomers: number;
  recurringCustomers: number;
  churnRate: number;
  customersTrend: Array<{
    date: string;
    customers: number;
  }>;
  customersList: Array<{
    id: string;
    name: string;
    city: string;
    orderCount: number;
    totalRevenue: number;
    healthScore: number;
    churnRisk: number;
  }>;
  bySalesperson: Array<{
    salespersonId: number;
    salespersonName: string;
    customerCount: number;
    percentage: number;
  }>;
  byCity: Array<{
    city: string;
    customerCount: number;
    percentage: number;
  }>;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'quarter';
    const salespersonIdParam = searchParams.get('salesperson_id');
    const salespersonId = salespersonIdParam ? parseInt(salespersonIdParam) : undefined;

    console.log('\n📊 [CUSTOMERS-ANALYTICS] Fetching customers data...', { period, salespersonId });

    // Calculate date range
    const now = new Date();
    const endDate = now.toISOString().split('T')[0];
    let startDate: string;

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      case 'quarter':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      case 'year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      default:
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }

    // Previous period for comparison
    const periodDays = Math.floor((now.getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
    const previousStartDate = new Date(new Date(startDate).getTime() - periodDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // ========================================================================
    // 1. Total Active Customers in Period
    // ========================================================================
    const totalCustomersQuery = salespersonId
      ? await sql`
          SELECT COUNT(DISTINCT id)::int as total
          FROM customer_avatars
          WHERE is_active = true
            AND last_order_date >= ${startDate}
            AND last_order_date <= ${endDate}
            AND assigned_salesperson_id = ${salespersonId}
        `
      : await sql`
          SELECT COUNT(DISTINCT id)::int as total
          FROM customer_avatars
          WHERE is_active = true
            AND last_order_date >= ${startDate}
            AND last_order_date <= ${endDate}
        `;

    const totalCustomers = totalCustomersQuery.rows[0]?.total || 0;

    // ========================================================================
    // 2. New vs Recurring Customers
    // ========================================================================
    const newCustomersQuery = salespersonId
      ? await sql`
          SELECT COUNT(DISTINCT id)::int as total
          FROM customer_avatars
          WHERE is_active = true
            AND first_order_date >= ${startDate}
            AND first_order_date <= ${endDate}
            AND assigned_salesperson_id = ${salespersonId}
        `
      : await sql`
          SELECT COUNT(DISTINCT id)::int as total
          FROM customer_avatars
          WHERE is_active = true
            AND first_order_date >= ${startDate}
            AND first_order_date <= ${endDate}
        `;

    const newCustomers = newCustomersQuery.rows[0]?.total || 0;
    const recurringCustomers = totalCustomers - newCustomers;

    // ========================================================================
    // 3. Churn Rate (customers who were active in previous period but not in current)
    // ========================================================================
    const previousCustomersQuery = salespersonId
      ? await sql`
          SELECT COUNT(DISTINCT id)::int as total
          FROM customer_avatars
          WHERE is_active = true
            AND last_order_date >= ${previousStartDate}
            AND last_order_date < ${startDate}
            AND assigned_salesperson_id = ${salespersonId}
        `
      : await sql`
          SELECT COUNT(DISTINCT id)::int as total
          FROM customer_avatars
          WHERE is_active = true
            AND last_order_date >= ${previousStartDate}
            AND last_order_date < ${startDate}
        `;

    const previousCustomers = previousCustomersQuery.rows[0]?.total || 0;

    // Churned = customers active in previous period but NOT active in current period
    const churnedCustomersQuery = salespersonId
      ? await sql`
          SELECT COUNT(DISTINCT id)::int as total
          FROM customer_avatars
          WHERE is_active = true
            AND last_order_date >= ${previousStartDate}
            AND last_order_date < ${startDate}
            AND assigned_salesperson_id = ${salespersonId}
            AND id NOT IN (
              SELECT id FROM customer_avatars
              WHERE last_order_date >= ${startDate}
              AND last_order_date <= ${endDate}
              AND assigned_salesperson_id = ${salespersonId}
            )
        `
      : await sql`
          SELECT COUNT(DISTINCT id)::int as total
          FROM customer_avatars
          WHERE is_active = true
            AND last_order_date >= ${previousStartDate}
            AND last_order_date < ${startDate}
            AND id NOT IN (
              SELECT id FROM customer_avatars
              WHERE last_order_date >= ${startDate}
              AND last_order_date <= ${endDate}
            )
        `;

    const churnedCustomers = churnedCustomersQuery.rows[0]?.total || 0;
    const churnRate = previousCustomers > 0 ? (churnedCustomers / previousCustomers) * 100 : 0;

    console.log(`✅ Customers: ${totalCustomers} total, ${newCustomers} new, ${recurringCustomers} recurring, ${churnRate.toFixed(1)}% churn`);

    // ========================================================================
    // 4. Customers Trend (daily/weekly/monthly based on period)
    // ========================================================================
    let trendInterval = 'day';
    if (period === 'quarter' || period === 'year') {
      trendInterval = 'week';
    }

    const trendQuery = salespersonId
      ? await sql`
          SELECT
            DATE_TRUNC(${trendInterval}, last_order_date)::date as date,
            COUNT(DISTINCT id)::int as customers
          FROM customer_avatars
          WHERE is_active = true
            AND last_order_date >= ${startDate}
            AND last_order_date <= ${endDate}
            AND assigned_salesperson_id = ${salespersonId}
          GROUP BY DATE_TRUNC(${trendInterval}, last_order_date)
          ORDER BY date ASC
        `
      : await sql`
          SELECT
            DATE_TRUNC(${trendInterval}, last_order_date)::date as date,
            COUNT(DISTINCT id)::int as customers
          FROM customer_avatars
          WHERE is_active = true
            AND last_order_date >= ${startDate}
            AND last_order_date <= ${endDate}
          GROUP BY DATE_TRUNC(${trendInterval}, last_order_date)
          ORDER BY date ASC
        `;

    const customersTrend = trendQuery.rows.map(row => ({
      date: row.date,
      customers: row.customers
    }));

    // ========================================================================
    // 5. Customers List with Details
    // ========================================================================
    const customersListQuery = salespersonId
      ? await sql`
          SELECT
            id,
            name,
            city,
            total_orders as order_count,
            total_revenue,
            health_score,
            churn_risk_score as churn_risk
          FROM customer_avatars
          WHERE is_active = true
            AND last_order_date >= ${startDate}
            AND last_order_date <= ${endDate}
            AND assigned_salesperson_id = ${salespersonId}
          ORDER BY total_revenue DESC
        `
      : await sql`
          SELECT
            id,
            name,
            city,
            total_orders as order_count,
            total_revenue,
            health_score,
            churn_risk_score as churn_risk
          FROM customer_avatars
          WHERE is_active = true
            AND last_order_date >= ${startDate}
            AND last_order_date <= ${endDate}
          ORDER BY total_revenue DESC
        `;

    const customersList = customersListQuery.rows.map(row => ({
      id: row.id,
      name: row.name,
      city: row.city || 'N/D',
      orderCount: parseInt(row.order_count) || 0,
      totalRevenue: parseFloat(row.total_revenue) || 0,
      healthScore: Math.round(parseFloat(row.health_score) || 0),
      churnRisk: Math.round(parseFloat(row.churn_risk) || 0)
    }));

    console.log(`✅ Customers list: ${customersList.length} customers`);

    // ========================================================================
    // 6. Breakdown by Salesperson (skip if filtering by specific salesperson)
    // ========================================================================
    let bySalesperson: Array<{
      salespersonId: number;
      salespersonName: string;
      customerCount: number;
      percentage: number;
    }> = [];

    if (!salespersonId) {
      const bySalespersonQuery = await sql`
        SELECT
          assigned_salesperson_id as salesperson_id,
          assigned_salesperson_name as salesperson_name,
          COUNT(DISTINCT id)::int as customer_count
        FROM customer_avatars
        WHERE is_active = true
          AND last_order_date >= ${startDate}
          AND last_order_date <= ${endDate}
          AND assigned_salesperson_id IS NOT NULL
        GROUP BY assigned_salesperson_id, assigned_salesperson_name
        ORDER BY customer_count DESC
      `;

      bySalesperson = bySalespersonQuery.rows.map(row => ({
        salespersonId: row.salesperson_id,
        salespersonName: row.salesperson_name,
        customerCount: row.customer_count,
        percentage: totalCustomers > 0 ? Math.round((row.customer_count / totalCustomers) * 100) : 0
      }));

      console.log(`✅ By salesperson: ${bySalesperson.length} salespeople`);
    }

    // ========================================================================
    // 7. Geographic Distribution by City
    // ========================================================================
    const byCityQuery = salespersonId
      ? await sql`
          SELECT
            COALESCE(city, 'Sconosciuta') as city,
            COUNT(DISTINCT id)::int as customer_count
          FROM customer_avatars
          WHERE is_active = true
            AND last_order_date >= ${startDate}
            AND last_order_date <= ${endDate}
            AND assigned_salesperson_id = ${salespersonId}
          GROUP BY city
          ORDER BY customer_count DESC
          LIMIT 10
        `
      : await sql`
          SELECT
            COALESCE(city, 'Sconosciuta') as city,
            COUNT(DISTINCT id)::int as customer_count
          FROM customer_avatars
          WHERE is_active = true
            AND last_order_date >= ${startDate}
            AND last_order_date <= ${endDate}
          GROUP BY city
          ORDER BY customer_count DESC
          LIMIT 10
        `;

    const byCity = byCityQuery.rows.map(row => ({
      city: row.city,
      customerCount: row.customer_count,
      percentage: totalCustomers > 0 ? Math.round((row.customer_count / totalCustomers) * 100) : 0
    }));

    console.log(`✅ By city: ${byCity.length} cities`);

    // ========================================================================
    // Build Response
    // ========================================================================
    const analytics: CustomerAnalytics = {
      totalCustomers,
      newCustomers,
      recurringCustomers,
      churnRate: Math.round(churnRate * 10) / 10, // Round to 1 decimal
      customersTrend,
      customersList,
      bySalesperson,
      byCity
    };

    console.log('✅ [CUSTOMERS-ANALYTICS] Data ready\n');

    return NextResponse.json({
      success: true,
      analytics
    });

  } catch (error: unknown) {
    console.error('❌ [CUSTOMERS-ANALYTICS] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        success: false,
        error: {
          message: 'Failed to fetch customers analytics',
          details: errorMessage
        }
      },
      { status: 500 }
    );
  }
}
