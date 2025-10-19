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
import { createOdooRPCClient } from '@/lib/odoo/rpcClient';
import type { CustomerAvatar, Recommendation, Interaction } from '@/lib/maestro/types';

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
    const odooPartnerId = parseInt(params.id, 10);
    console.log(`📊 [MAESTRO-API] Fetching customer detail for Odoo Partner ID: ${odooPartnerId}`);

    // 1. Fetch customer avatar from DB
    const avatarResult = await sql`
      SELECT * FROM customer_avatars
      WHERE odoo_partner_id = ${odooPartnerId}
    `;

    if (avatarResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    const avatarData = avatarResult.rows[0];

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
      const interactionsResult = await sql`
        SELECT * FROM maestro_interactions
        WHERE customer_avatar_id = ${avatarData.id}
        ORDER BY interaction_date DESC
        LIMIT 20
      `;

      interactions = interactionsResult.rows.map(row => ({
        ...row,
        samples_given: row.samples_given
          ? (typeof row.samples_given === 'string' ? JSON.parse(row.samples_given) : row.samples_given)
          : null,
      })) as any[];

      console.log(`✅ Found ${interactions.length} interactions`);
    } catch (error: any) {
      // Table might not exist yet
      if (error.code !== '42P01') throw error;
      console.log('⚠️  maestro_interactions table not found, skipping');
    }

    // 4. Fetch recent orders from Odoo (with robust error handling)
    let recentOrders: OrderFromOdoo[] = [];
    let odooError: string | null = null;
    let odooWarning: string | null = null;

    try {
      console.log(`🔄 [MAESTRO-API] Fetching orders from Odoo for partner ${avatar.odoo_partner_id}...`);
      const odooClient = createOdooRPCClient();

      // Fetch last 10 orders for this customer
      const orders = await odooClient.searchRead(
        'sale.order',
        [
          ['partner_id', '=', avatar.odoo_partner_id],
          ['state', 'in', ['sale', 'done']] // Only confirmed orders
        ],
        ['id', 'name', 'date_order', 'amount_total', 'state', 'order_line'],
        10,
        'date_order desc'
      );

      recentOrders = orders as OrderFromOdoo[];
      console.log(`✅ [MAESTRO-API] Fetched ${recentOrders.length} orders from Odoo`);

    } catch (error: any) {
      const isSessionError = error.isSessionExpired || error.message?.includes('session') || error.message?.includes('Session');

      if (isSessionError) {
        console.error('❌ [MAESTRO-API] Odoo session error:', error.message);
        odooError = 'Session expired';
        odooWarning = 'Impossibile recuperare ordini da Odoo. Visualizzando solo dati sincronizzati.';
      } else {
        console.error('❌ [MAESTRO-API] Failed to fetch orders from Odoo:', error.message);
        odooError = error.message || 'Unknown error';
        odooWarning = 'Impossibile connettersi a Odoo al momento. Visualizzando solo dati sincronizzati.';
      }

      // Don't fail the whole request - graceful degradation
      // Return empty orders array and show warning to user
    }

    // 5. Calculate revenue trend (last 6 months)
    const revenueTrend = calculateRevenueTrend(recentOrders);

    // 6. Build response
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

        // Products
        top_products: avatar.top_products,
        product_categories: avatar.product_categories,

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
        items_count: Array.isArray(order.order_line) ? order.order_line.length : 0,
      })),

      revenue_trend: revenueTrend,

      metadata: {
        fetched_at: new Date().toISOString(),
        odoo_connection: odooError ? 'error' : 'success',
        odoo_error: odooError,
        odoo_warning: odooWarning,
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
    }
  });

  return Object.values(trend);
}
