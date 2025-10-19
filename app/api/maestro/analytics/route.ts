/**
 * MAESTRO AI - Analytics Dashboard API
 *
 * GET /api/maestro/analytics
 *
 * Aggregates real data from Vercel Postgres customer_avatars table:
 * - KPIs: total revenue, orders, customers, avg order value
 * - Top performers: by salesperson and by customer
 * - Churn alerts: high-risk customers
 * - Revenue trends: by month (last 6 months)
 * - Health distribution: healthy/warning/critical
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import type { AnalyticsResponse } from '@/lib/maestro/types';

export async function GET(request: NextRequest) {
  try {
    console.log('\n📊 [MAESTRO-ANALYTICS] Fetching dashboard data...');

    // ========================================================================
    // 1. KPIs - Global Aggregations
    // ========================================================================
    const kpisQuery = await sql`
      SELECT
        COALESCE(SUM(total_revenue), 0)::numeric as total_revenue,
        COALESCE(SUM(total_orders), 0)::numeric as total_orders,
        COUNT(*)::numeric as active_customers
      FROM customer_avatars
      WHERE is_active = true
    `;

    const kpisData = kpisQuery.rows[0];
    const totalRevenue = parseFloat(kpisData.total_revenue) || 0;
    const totalOrders = parseFloat(kpisData.total_orders) || 0;
    const activeCustomers = parseInt(kpisData.active_customers) || 0;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    console.log(`✅ KPIs: €${totalRevenue.toFixed(2)} revenue, ${totalOrders} orders, ${activeCustomers} customers`);

    // ========================================================================
    // 2. Top Performers by Salesperson
    // ========================================================================
    const salespersonQuery = await sql`
      SELECT
        COALESCE(assigned_salesperson_name, 'Unassigned') as salesperson_name,
        COALESCE(SUM(total_revenue), 0)::numeric as revenue,
        COALESCE(SUM(total_orders), 0)::numeric as orders,
        COUNT(*)::numeric as customer_count
      FROM customer_avatars
      WHERE is_active = true
      GROUP BY assigned_salesperson_name
      ORDER BY revenue DESC
      LIMIT 10
    `;

    const topSalespeople = salespersonQuery.rows.map(row => ({
      name: row.salesperson_name,
      revenue: parseFloat(row.revenue) || 0,
      orders: parseInt(row.orders) || 0,
      customerCount: parseInt(row.customer_count) || 0,
    }));

    console.log(`✅ Top salespeople: ${topSalespeople.length} found`);

    // ========================================================================
    // 3. Top Performers by Customer
    // ========================================================================
    const topCustomersQuery = await sql`
      SELECT
        id,
        name,
        total_revenue,
        total_orders,
        health_score
      FROM customer_avatars
      WHERE is_active = true
      ORDER BY total_revenue DESC
      LIMIT 10
    `;

    const topCustomers = topCustomersQuery.rows.map(row => ({
      id: row.id,
      name: row.name,
      revenue: parseFloat(row.total_revenue) || 0,
      orders: row.total_orders || 0,
      healthScore: row.health_score || 0,
    }));

    console.log(`✅ Top customers: ${topCustomers.length} found`);

    // ========================================================================
    // 4. Churn Alerts - High Risk Customers (churn_risk_score > 70)
    // ========================================================================
    const churnAlertsQuery = await sql`
      SELECT
        id,
        name,
        city,
        churn_risk_score,
        health_score,
        days_since_last_order,
        avg_order_value
      FROM customer_avatars
      WHERE is_active = true
        AND churn_risk_score > 70
      ORDER BY churn_risk_score DESC
      LIMIT 20
    `;

    const churnAlerts = churnAlertsQuery.rows.map(row => ({
      id: row.id,
      name: row.name,
      city: row.city,
      churnRisk: row.churn_risk_score || 0,
      healthScore: row.health_score || 0,
      daysSinceLastOrder: row.days_since_last_order || 0,
      avgOrderValue: parseFloat(row.avg_order_value) || 0,
    }));

    console.log(`⚠️  Churn alerts: ${churnAlerts.length} high-risk customers`);

    // ========================================================================
    // 5. Revenue by Month (Last 6 Months)
    // ========================================================================
    // Note: Since we only have last_order_date, we'll group by month of last order
    // This is a simplified approximation - ideally we'd have a separate orders table
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const revenueByMonthQuery = await sql`
      SELECT
        TO_CHAR(last_order_date, 'YYYY-MM') as month,
        COUNT(*) as order_count,
        SUM(total_revenue) as revenue
      FROM customer_avatars
      WHERE is_active = true
        AND last_order_date IS NOT NULL
        AND last_order_date >= ${sixMonthsAgo.toISOString().split('T')[0]}
      GROUP BY TO_CHAR(last_order_date, 'YYYY-MM')
      ORDER BY month DESC
      LIMIT 6
    `;

    const revenueByMonth = revenueByMonthQuery.rows.map(row => ({
      month: row.month,
      revenue: parseFloat(row.revenue) || 0,
      orders: parseInt(row.order_count) || 0,
    })).reverse(); // Reverse to show chronological order

    console.log(`✅ Revenue by month: ${revenueByMonth.length} months of data`);

    // ========================================================================
    // 6. Health Distribution
    // ========================================================================
    const healthDistQuery = await sql`
      SELECT
        COUNT(*) FILTER (WHERE health_score >= 80) as healthy,
        COUNT(*) FILTER (WHERE health_score >= 50 AND health_score < 80) as warning,
        COUNT(*) FILTER (WHERE health_score < 50) as critical
      FROM customer_avatars
      WHERE is_active = true
    `;

    const healthDist = healthDistQuery.rows[0];
    const healthDistribution = {
      healthy: parseInt(healthDist.healthy) || 0,
      warning: parseInt(healthDist.warning) || 0,
      critical: parseInt(healthDist.critical) || 0,
    };

    console.log(`✅ Health distribution: ${healthDistribution.healthy} healthy, ${healthDistribution.warning} warning, ${healthDistribution.critical} critical`);

    // ========================================================================
    // Build Response
    // ========================================================================
    const response: AnalyticsResponse = {
      kpis: {
        totalRevenue,
        totalOrders,
        activeCustomers,
        avgOrderValue,
      },
      topPerformers: {
        bySalesperson: topSalespeople,
        byCustomer: topCustomers,
      },
      churnAlerts,
      revenueByMonth,
      healthDistribution,
    };

    console.log('✅ [MAESTRO-ANALYTICS] Dashboard data ready\n');

    return NextResponse.json(response);

  } catch (error: unknown) {
    console.error('❌ [MAESTRO-ANALYTICS] Error fetching dashboard data:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        error: 'Failed to fetch analytics data',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
