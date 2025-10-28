/**
 * MAESTRO AI - Customer Detail API
 *
 * GET /api/maestro/customers/[id]
 * Ritorna dati completi del cliente:
 * - Avatar (metrics AI)
 * - Ordini recenti da Odoo
 * - Raccomandazioni attive
 * - Interactions history
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import type { CustomerAvatar, Recommendation, Interaction } from '@/lib/maestro/types';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { canAccessCustomer } from '@/lib/maestro/permissions';

interface OrderFromOdoo {
  id: number;
  name: string;
  date_order: string;
  amount_total: number;
  state: string;
  order_line: any[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 🔐 STEP 0: Autenticazione
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - Login required' },
        { status: 401 }
      );
    }

    const customerAvatarId = parseInt(params.id, 10);
    console.log(`📊 [MAESTRO-API] Fetching customer detail for Customer Avatar ID: ${customerAvatarId}`);

    // 1. Fetch customer avatar from DB (using internal ID, not odoo_partner_id)
    const avatarResult = await sql`
      SELECT * FROM customer_avatars
      WHERE id = ${customerAvatarId}
    `;

    if (avatarResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    const avatarData = avatarResult.rows[0];

    // 🔐 STEP 1: Controllo Permessi
    const hasAccess = canAccessCustomer(user, avatarData.assigned_salesperson_id);

    if (!hasAccess) {
      console.log(`❌ [MAESTRO-API] User ${user.email} denied access to customer ${avatarData.name} (salesperson: ${avatarData.assigned_salesperson_id})`);
      return NextResponse.json(
        { error: 'Forbidden - You do not have permission to view this customer' },
        { status: 403 }
      );
    }

    console.log(`✅ [MAESTRO-API] User ${user.email} granted access to customer ${avatarData.name}`);

    // Parse JSON fields
    const avatar: CustomerAvatar = {
      ...avatarData,
      top_products: typeof avatarData.top_products === 'string'
        ? JSON.parse(avatarData.top_products || '[]')
        : avatarData.top_products || [],
      product_categories: typeof avatarData.product_categories === 'string'
        ? JSON.parse(avatarData.product_categories || '{}')
        : avatarData.product_categories || {},
    } as any;

    console.log(`✅ Avatar found: ${avatar.name} (Odoo ID: ${avatar.odoo_partner_id})`);

    // 2. Fetch recommendations (active only)
    let recommendations: Recommendation[] = [];
    try {
      const recommendationsResult = await sql`
        SELECT * FROM maestro_recommendations
        WHERE customer_avatar_id = ${avatarData.id}
          AND status IN ('pending', 'in_progress')
        ORDER BY created_at DESC
        LIMIT 10
      `;

      recommendations = recommendationsResult.rows.map(row => ({
        ...row,
        suggested_actions: typeof row.suggested_actions === 'string'
          ? JSON.parse(row.suggested_actions || '[]')
          : row.suggested_actions || [],
        suggested_products: row.suggested_products
          ? (typeof row.suggested_products === 'string' ? JSON.parse(row.suggested_products) : row.suggested_products)
          : null,
      })) as any[];

      // Sort by priority client-side
      const priorityOrder = { urgent: 1, high: 2, medium: 3, low: 4 };
      recommendations.sort((a, b) => {
        const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 5;
        const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 5;
        return aPriority - bPriority;
      });

      console.log(`✅ Found ${recommendations.length} active recommendations`);
    } catch (error: any) {
      // Table might not exist yet
      if (error.code !== '42P01') throw error;
      console.log('⚠️  maestro_recommendations table not found, skipping');
    }

    // 3. Fetch interactions history
    let interactions: Interaction[] = [];
    try {
      console.log(`🔍 [DEBUG] Fetching interactions for customer_avatar_id: ${avatarData.id}`);

      const interactionsResult = await sql`
        SELECT * FROM maestro_interactions
        WHERE customer_avatar_id = ${avatarData.id}
        ORDER BY interaction_date DESC
        LIMIT 100
      `;

      interactions = interactionsResult.rows.map(row => ({
        ...row,
        samples_given: row.samples_given
          ? (typeof row.samples_given === 'string' ? JSON.parse(row.samples_given) : row.samples_given)
          : null,
      })) as any[];

      console.log(`✅ Found ${interactions.length} interactions for ${avatar.name}`);

      // Log delle ultime 3 interazioni per debug
      if (interactions.length > 0) {
        console.log('🔍 [DEBUG] Ultime 3 interazioni:');
        interactions.slice(0, 3).forEach((int, idx) => {
          console.log(`  ${idx + 1}. ${int.interaction_type} - ${int.outcome} - ${new Date(int.interaction_date).toISOString()}`);
          console.log(`     Created: ${new Date(int.created_at).toISOString()}`);
        });
      }
    } catch (error: any) {
      // Table might not exist yet
      if (error.code !== '42P01') throw error;
      console.log('⚠️  maestro_interactions table not found, skipping');
    }

    // 4. Fetch orders from PostgreSQL (fast, no Odoo dependency)
    console.log(`📦 [MAESTRO-API] Fetching orders from PostgreSQL for customer avatar ID ${avatarData.id}...`);

    let recentOrders: any[] = [];
    let allOrdersForTrend: any[] = [];

    try {
      // Calculate date 6 months ago for trend data
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      // Fetch ALL orders from last 6 months from PostgreSQL with items count
      const ordersResult = await sql`
        SELECT
          o.id as order_id,
          o.odoo_order_id as id,
          o.order_name as name,
          o.order_date as date_order,
          o.amount_total,
          o.state,
          COUNT(ol.id) as items_count
        FROM maestro_orders o
        LEFT JOIN maestro_order_lines ol ON ol.maestro_order_id = o.id
        WHERE o.customer_avatar_id = ${avatarData.id}
          AND o.order_date >= ${sixMonthsAgo.toISOString()}
          AND o.state IN ('sale', 'done')
        GROUP BY o.id, o.odoo_order_id, o.order_name, o.order_date, o.amount_total, o.state
        ORDER BY o.order_date DESC
      `;

      allOrdersForTrend = ordersResult.rows.map(row => ({
        id: row.id,
        name: row.name,
        date_order: row.date_order,
        amount_total: parseFloat(row.amount_total),
        state: row.state,
        items_count: parseInt(row.items_count) || 0
      }));

      console.log(`✅ [MAESTRO-API] Fetched ${allOrdersForTrend.length} orders from PostgreSQL (last 6 months)`);

      // Use the most recent 20 orders for the orders list display
      recentOrders = allOrdersForTrend.slice(0, 20);

    } catch (error: any) {
      console.error('⚠️  [MAESTRO-API] Failed to fetch orders from PostgreSQL:', error.message);
      // If PostgreSQL fails, continue with empty orders (should never happen)
    }

    // 5. Calculate top products from order lines (PostgreSQL)
    console.log(`📦 [MAESTRO-API] Fetching top products for customer avatar ID ${avatarData.id}...`);

    let topProducts: any[] = [];
    let productCategories: any = {};

    try {
      // Get top 10 products by revenue from order lines
      const topProductsResult = await sql`
        SELECT
          ol.product_id,
          ol.product_name,
          ol.product_code,
          SUM(ol.quantity) as total_quantity,
          COUNT(DISTINCT o.id) as times_purchased,
          SUM(ol.price_subtotal) as total_revenue
        FROM maestro_order_lines ol
        JOIN maestro_orders o ON o.id = ol.maestro_order_id
        WHERE o.customer_avatar_id = ${avatarData.id}
          AND ol.product_id IS NOT NULL
        GROUP BY ol.product_id, ol.product_name, ol.product_code
        ORDER BY total_revenue DESC
        LIMIT 10
      `;

      topProducts = topProductsResult.rows.map(row => ({
        product_id: row.product_id,
        product_name: row.product_name || 'Prodotto senza nome',
        product_code: row.product_code,
        total_quantity: parseFloat(row.total_quantity),
        times_purchased: parseInt(row.times_purchased),
        total_revenue: parseFloat(row.total_revenue)
      }));

      console.log(`✅ [MAESTRO-API] Found ${topProducts.length} top products`);

      // Calculate product categories spending from order lines
      const categoriesResult = await sql`
        SELECT
          ol.product_category,
          SUM(ol.price_subtotal) as total_spending,
          COUNT(DISTINCT o.id) as orders_count,
          SUM(ol.quantity) as total_quantity
        FROM maestro_order_lines ol
        JOIN maestro_orders o ON o.id = ol.maestro_order_id
        WHERE o.customer_avatar_id = ${avatarData.id}
          AND ol.product_category IS NOT NULL
        GROUP BY ol.product_category
        ORDER BY total_spending DESC
      `;

      productCategories = categoriesResult.rows.reduce((acc, row) => {
        if (row.product_category) {
          acc[row.product_category] = {
            total_spending: parseFloat(row.total_spending),
            orders_count: parseInt(row.orders_count),
            total_quantity: parseFloat(row.total_quantity)
          };
        }
        return acc;
      }, {} as Record<string, any>);

      console.log(`✅ [MAESTRO-API] Found ${Object.keys(productCategories).length} product categories`);

    } catch (error: any) {
      console.error('⚠️  [MAESTRO-API] Failed to fetch top products:', error.message);
      // Fallback to avatar data
      topProducts = avatar.top_products || [];
      productCategories = avatar.product_categories || {};
    }

    // 6. Calculate revenue trend (last 6 months)
    const revenueTrend = allOrdersForTrend.length > 0
      ? calculateRevenueTrend(allOrdersForTrend)
      : calculateRevenueTrendFallback(avatar);

    // 7. Build response
    const response = {
      customer: {
        // Basic info
        id: avatar.id,
        odoo_partner_id: avatar.odoo_partner_id,
        name: avatar.name,
        email: avatar.email,
        phone: avatar.phone,
        city: avatar.city,

        // AI Scores
        health_score: avatar.health_score,
        churn_risk_score: avatar.churn_risk_score,
        upsell_potential_score: avatar.upsell_potential_score,
        engagement_score: avatar.engagement_score,

        // Metrics
        total_revenue: avatar.total_revenue,
        total_orders: avatar.total_orders,
        avg_order_value: avatar.avg_order_value,
        days_since_last_order: avatar.days_since_last_order,
        first_order_date: avatar.first_order_date,
        last_order_date: avatar.last_order_date,
        order_frequency_days: avatar.order_frequency_days,

        // Products (calculated from PostgreSQL order lines)
        top_products: topProducts,
        product_categories: productCategories,

        // Assignment
        assigned_salesperson_id: avatar.assigned_salesperson_id,
        assigned_salesperson_name: avatar.assigned_salesperson_name,

        // Status
        is_active: avatar.is_active,
        last_sync_odoo: avatar.last_sync_odoo,
      },

      recommendations,
      interactions,

      orders: recentOrders.map(order => ({
        id: order.id,
        name: order.name,
        date: order.date_order,
        amount: order.amount_total,
        state: order.state,
        items_count: order.items_count || 0,
      })),

      revenue_trend: revenueTrend,

      metadata: {
        fetched_at: new Date().toISOString(),
        data_source: 'postgresql',
        orders_fetched: allOrdersForTrend.length,
        revenue_trend_source: allOrdersForTrend.length > 0 ? 'postgresql_cache' : 'estimated',
      }
    };

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('❌ [MAESTRO-API] GET /customers/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer details', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Calculate revenue trend by month from orders
 */
function calculateRevenueTrend(orders: OrderFromOdoo[]): Array<{month: string; revenue: number; orders: number}> {
  const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
  const now = new Date();

  console.log(`📊 [REVENUE-TREND] Calculating trend from ${orders.length} orders`);

  // Initialize last 6 months
  const trend: {[key: string]: {month: string; revenue: number; orders: number}} = {};

  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    trend[key] = {
      month: monthNames[date.getMonth()],
      revenue: 0,
      orders: 0
    };
  }

  // Aggregate orders by month
  orders.forEach(order => {
    const orderDate = new Date(order.date_order);
    const key = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;

    if (trend[key]) {
      trend[key].revenue += order.amount_total;
      trend[key].orders += 1;
      console.log(`  ✓ ${order.name}: ${order.date_order} -> ${key} (+CHF ${order.amount_total.toFixed(2)})`);
    } else {
      console.log(`  ⚠️  ${order.name}: ${order.date_order} -> ${key} (outside 6-month window, skipped)`);
    }
  });

  const result = Object.values(trend);
  console.log(`📊 [REVENUE-TREND] Final trend:`, result);

  return result;
}

/**
 * Fallback revenue trend when Odoo is unavailable
 * Uses historical data from customer avatar to estimate monthly distribution
 */
function calculateRevenueTrendFallback(avatar: any): Array<{month: string; revenue: number; orders: number}> {
  console.log(`⚠️  [REVENUE-TREND] Using fallback estimation (Odoo unavailable)`);

  const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
  const now = new Date();

  // Initialize last 6 months
  const trend: Array<{month: string; revenue: number; orders: number}> = [];

  // If we have last_order_date and total_revenue, estimate distribution
  if (avatar.last_order_date && avatar.total_revenue > 0) {
    const lastOrderDate = new Date(avatar.last_order_date);
    const monthsSinceLastOrder = Math.floor(
      (now.getTime() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
    );

    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthIndex = date.getMonth();
      const isLastOrderMonth =
        date.getFullYear() === lastOrderDate.getFullYear() &&
        monthIndex === lastOrderDate.getMonth();

      // Estimate: distribute revenue across recent months based on avg order value
      // If this is the last order month, show actual activity
      let estimatedRevenue = 0;
      let estimatedOrders = 0;

      if (i === 0 && monthsSinceLastOrder === 0) {
        // Current month and had recent order
        estimatedRevenue = avatar.avg_order_value || 0;
        estimatedOrders = 1;
      } else if (isLastOrderMonth) {
        // The month of last order
        estimatedRevenue = avatar.avg_order_value || 0;
        estimatedOrders = 1;
      } else if (i > monthsSinceLastOrder && avatar.order_frequency_days) {
        // Months before last order - estimate based on frequency
        const ordersPerMonth = 30 / (avatar.order_frequency_days || 30);
        estimatedOrders = Math.round(ordersPerMonth);
        estimatedRevenue = estimatedOrders * (avatar.avg_order_value || 0);
      }

      trend.push({
        month: monthNames[monthIndex],
        revenue: estimatedRevenue,
        orders: estimatedOrders
      });
    }
  } else {
    // No data available - return empty trend
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      trend.push({
        month: monthNames[date.getMonth()],
        revenue: 0,
        orders: 0
      });
    }
  }

  return trend;
}
