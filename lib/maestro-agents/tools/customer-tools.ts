/**
 * CUSTOMER INTELLIGENCE TOOLS
 * Tools for Agent 1: Customer Intelligence Agent
 */

import { sql } from '@vercel/postgres';
import type { AgentTool, CustomerProfile, SalesInteraction } from '../types';

// ============================================================================
// TOOL 1.1: get_customer_profile
// ============================================================================

export const getCustomerProfileTool: AgentTool = {
  name: 'get_customer_profile',
  description:
    'Get complete customer profile with behavioral data, AI scores, preferences, and purchase history. Use when you need detailed information about a specific customer.',
  input_schema: {
    type: 'object',
    properties: {
      customer_id: {
        type: 'number',
        description: 'Customer avatar ID (internal database ID)',
      },
      customer_name: {
        type: 'string',
        description: 'Customer name to search for (alternative to customer_id)',
      },
    },
    required: [],
  },
  handler: async (input: { customer_id?: number; customer_name?: string }) => {
    console.log('🔍 get_customer_profile', input);

    let query;
    let params: any[] = [];

    if (input.customer_id) {
      query = sql`
        SELECT * FROM customer_avatars
        WHERE id = ${input.customer_id}
          AND is_active = true
        LIMIT 1
      `;
    } else if (input.customer_name) {
      query = sql`
        SELECT * FROM customer_avatars
        WHERE name ILIKE ${`%${input.customer_name}%`}
          AND is_active = true
        ORDER BY total_revenue DESC
        LIMIT 1
      `;
    } else {
      throw new Error('Either customer_id or customer_name must be provided');
    }

    const result = await query;

    if (result.rows.length === 0) {
      return {
        found: false,
        message: 'Customer not found',
      };
    }

    const row = result.rows[0];

    const profile: CustomerProfile = {
      id: row.id,
      odoo_partner_id: row.odoo_partner_id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      city: row.city,

      first_order_date: row.first_order_date,
      last_order_date: row.last_order_date,
      total_orders: row.total_orders,
      total_revenue: parseFloat(row.total_revenue),
      avg_order_value: parseFloat(row.avg_order_value),
      order_frequency_days: row.order_frequency_days,
      days_since_last_order: row.days_since_last_order,

      top_products: JSON.parse(row.top_products || '[]'),
      product_categories: JSON.parse(row.product_categories || '{}'),

      health_score: row.health_score,
      churn_risk_score: row.churn_risk_score,
      upsell_potential_score: row.upsell_potential_score,
      engagement_score: row.engagement_score,
      loyalty_score: row.loyalty_score,

      personality_type: row.personality_type,
      preferred_contact_method: row.preferred_contact_method,
      best_contact_time: row.best_contact_time,
      communication_style: row.communication_style,

      assigned_salesperson_id: row.assigned_salesperson_id,
      assigned_salesperson_name: row.assigned_salesperson_name,

      created_at: row.created_at,
      updated_at: row.updated_at,
      is_active: row.is_active,
    };

    return {
      found: true,
      profile,
    };
  },
};

// ============================================================================
// TOOL 1.2: get_customer_history
// ============================================================================

export const getCustomerHistoryTool: AgentTool = {
  name: 'get_customer_history',
  description:
    'Get complete history of interactions and orders for a customer. Shows visits, calls, emails, samples given, orders placed, and sentiment analysis.',
  input_schema: {
    type: 'object',
    properties: {
      customer_id: {
        type: 'number',
        description: 'Customer avatar ID',
      },
      days_back: {
        type: 'number',
        description: 'Number of days to look back (default: 90)',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of interactions to return (default: 50)',
      },
    },
    required: ['customer_id'],
  },
  handler: async (input: { customer_id: number; days_back?: number; limit?: number }) => {
    console.log('🔍 get_customer_history', input);

    const daysBack = input.days_back || 90;
    const limit = input.limit || 50;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const result = await sql`
      SELECT * FROM sales_interactions
      WHERE customer_avatar_id = ${input.customer_id}
        AND interaction_date >= ${startDate.toISOString()}
      ORDER BY interaction_date DESC
      LIMIT ${limit}
    `;

    const interactions: SalesInteraction[] = result.rows.map((row) => ({
      id: row.id,
      customer_avatar_id: row.customer_avatar_id,
      odoo_partner_id: row.odoo_partner_id,
      salesperson_id: row.salesperson_id,
      salesperson_name: row.salesperson_name,
      interaction_type: row.interaction_type,
      interaction_date: new Date(row.interaction_date),
      outcome: row.outcome,
      duration_minutes: row.duration_minutes,
      notes: row.notes,
      samples_given: row.samples_given ? JSON.parse(row.samples_given) : null,
      sample_feedback: row.sample_feedback,
      order_generated: row.order_generated,
      order_id: row.order_id,
      order_amount: row.order_amount ? parseFloat(row.order_amount) : null,
      sentiment_score: row.sentiment_score ? parseFloat(row.sentiment_score) : null,
      sentiment_label: row.sentiment_label,
      key_topics: row.key_topics ? JSON.parse(row.key_topics) : null,
      requires_followup: row.requires_followup,
      followup_date: row.followup_date,
      followup_reason: row.followup_reason,
      created_at: new Date(row.created_at),
    }));

    // Calculate summary stats
    const totalInteractions = interactions.length;
    const visits = interactions.filter((i) => i.interaction_type === 'visit').length;
    const calls = interactions.filter((i) => i.interaction_type === 'call').length;
    const emails = interactions.filter((i) => i.interaction_type === 'email').length;
    const ordersGenerated = interactions.filter((i) => i.order_generated).length;
    const revenueGenerated = interactions
      .filter((i) => i.order_amount)
      .reduce((sum, i) => sum + (i.order_amount || 0), 0);
    const avgOrderValue = ordersGenerated > 0 ? revenueGenerated / ordersGenerated : 0;
    const positiveSentiments = interactions.filter(
      (i) => i.sentiment_label === 'positive'
    ).length;
    const positiveSentimentRate =
      totalInteractions > 0 ? (positiveSentiments / totalInteractions) * 100 : 0;

    return {
      customer_id: input.customer_id,
      period_days: daysBack,
      interactions,
      summary: {
        total_interactions: totalInteractions,
        visits,
        calls,
        emails,
        orders_generated: ordersGenerated,
        revenue_generated: revenueGenerated,
        avg_order_value: avgOrderValue,
        positive_sentiment_rate: positiveSentimentRate.toFixed(1),
      },
    };
  },
};

// ============================================================================
// TOOL 1.3: search_customers
// ============================================================================

export const searchCustomersTool: AgentTool = {
  name: 'search_customers',
  description:
    'Search for customers based on various criteria: location, churn risk, revenue, salesperson assignment, etc. Returns a list of matching customers.',
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query (name, city, etc)',
      },
      salesperson_id: {
        type: 'number',
        description: 'Filter by salesperson',
      },
      churn_risk_min: {
        type: 'number',
        description: 'Minimum churn risk score (0-100)',
      },
      health_score_max: {
        type: 'number',
        description: 'Maximum health score (0-100) - lower is worse',
      },
      days_since_order_min: {
        type: 'number',
        description: 'Minimum days since last order',
      },
      city: {
        type: 'string',
        description: 'Filter by city',
      },
      limit: {
        type: 'number',
        description: 'Maximum results (default: 10)',
      },
    },
    required: [],
  },
  handler: async (input: {
    query?: string;
    salesperson_id?: number;
    churn_risk_min?: number;
    health_score_max?: number;
    days_since_order_min?: number;
    city?: string;
    limit?: number;
  }) => {
    console.log('🔍 search_customers', input);

    const limit = input.limit || 10;

    // Build WHERE clauses
    const conditions: string[] = ['is_active = true'];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.query) {
      conditions.push(`name ILIKE $${paramIndex}`);
      params.push(`%${input.query}%`);
      paramIndex++;
    }

    if (input.salesperson_id !== undefined) {
      conditions.push(`assigned_salesperson_id = $${paramIndex}`);
      params.push(input.salesperson_id);
      paramIndex++;
    }

    if (input.churn_risk_min !== undefined) {
      conditions.push(`churn_risk_score >= $${paramIndex}`);
      params.push(input.churn_risk_min);
      paramIndex++;
    }

    if (input.health_score_max !== undefined) {
      conditions.push(`health_score <= $${paramIndex}`);
      params.push(input.health_score_max);
      paramIndex++;
    }

    if (input.days_since_order_min !== undefined) {
      conditions.push(`days_since_last_order >= $${paramIndex}`);
      params.push(input.days_since_order_min);
      paramIndex++;
    }

    if (input.city) {
      conditions.push(`city ILIKE $${paramIndex}`);
      params.push(`%${input.city}%`);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const queryText = `
      SELECT
        id, odoo_partner_id, name, city,
        total_orders, total_revenue, avg_order_value,
        days_since_last_order, last_order_date,
        health_score, churn_risk_score, upsell_potential_score,
        assigned_salesperson_id, assigned_salesperson_name
      FROM customer_avatars
      WHERE ${whereClause}
      ORDER BY churn_risk_score DESC, days_since_last_order DESC
      LIMIT $${paramIndex}
    `;
    params.push(limit);

    const result = await sql.query(queryText, params);

    return {
      found: result.rows.length,
      customers: result.rows.map((row) => ({
        id: row.id,
        odoo_partner_id: row.odoo_partner_id,
        name: row.name,
        city: row.city,
        total_orders: row.total_orders,
        total_revenue: parseFloat(row.total_revenue),
        avg_order_value: parseFloat(row.avg_order_value),
        days_since_last_order: row.days_since_last_order,
        last_order_date: row.last_order_date,
        health_score: row.health_score,
        churn_risk_score: row.churn_risk_score,
        upsell_potential_score: row.upsell_potential_score,
        assigned_salesperson_id: row.assigned_salesperson_id,
        assigned_salesperson_name: row.assigned_salesperson_name,
      })),
    };
  },
};

// ============================================================================
// TOOL 1.4: get_customer_recommendations
// ============================================================================

export const getCustomerRecommendationsTool: AgentTool = {
  name: 'get_customer_recommendations',
  description:
    'Get AI-generated recommendations for a specific customer. Shows pending actions, suggested approaches, and expected outcomes.',
  input_schema: {
    type: 'object',
    properties: {
      customer_id: {
        type: 'number',
        description: 'Customer avatar ID',
      },
      status: {
        type: 'string',
        description: 'Filter by status (pending, in_progress, completed)',
      },
    },
    required: ['customer_id'],
  },
  handler: async (input: { customer_id: number; status?: string }) => {
    console.log('🔍 get_customer_recommendations', input);

    let query;

    if (input.status) {
      query = sql`
        SELECT * FROM maestro_recommendations
        WHERE customer_avatar_id = ${input.customer_id}
          AND status = ${input.status}
        ORDER BY priority DESC, created_at DESC
        LIMIT 10
      `;
    } else {
      query = sql`
        SELECT * FROM maestro_recommendations
        WHERE customer_avatar_id = ${input.customer_id}
        ORDER BY
          CASE status
            WHEN 'pending' THEN 1
            WHEN 'in_progress' THEN 2
            WHEN 'completed' THEN 3
            WHEN 'dismissed' THEN 4
          END,
          priority DESC,
          created_at DESC
        LIMIT 10
      `;
    }

    const result = await query;

    const recommendations = result.rows.map((row) => ({
      id: row.id,
      recommendation_type: row.recommendation_type,
      priority: row.priority,
      urgency_level: row.urgency_level,
      action_suggested: row.action_suggested,
      reasoning: row.reasoning,
      expected_outcome: row.expected_outcome,
      suggested_products: row.suggested_products ? JSON.parse(row.suggested_products) : [],
      suggested_approach: row.suggested_approach,
      talking_points: row.talking_points,
      best_time_to_contact: row.best_time_to_contact,
      optimal_day_of_week: row.optimal_day_of_week,
      status: row.status,
      confidence_score: parseFloat(row.confidence_score),
      success_probability: row.success_probability
        ? parseFloat(row.success_probability)
        : null,
      created_at: row.created_at,
      expires_at: row.expires_at,
    }));

    return {
      customer_id: input.customer_id,
      total_recommendations: recommendations.length,
      recommendations,
    };
  },
};

// ============================================================================
// TOOL 1.5: compare_similar_customers
// ============================================================================

export const compareSimilarCustomersTool: AgentTool = {
  name: 'compare_similar_customers',
  description:
    'Find customers similar to the specified customer based on revenue, order patterns, and product preferences. Useful for benchmarking and identifying best practices.',
  input_schema: {
    type: 'object',
    properties: {
      customer_id: {
        type: 'number',
        description: 'Customer avatar ID to compare against',
      },
      limit: {
        type: 'number',
        description: 'Number of similar customers to return (default: 5)',
      },
    },
    required: ['customer_id'],
  },
  handler: async (input: { customer_id: number; limit?: number }) => {
    console.log('🔍 compare_similar_customers', input);

    const limit = input.limit || 5;

    // First, get the reference customer
    const refResult = await sql`
      SELECT
        total_revenue, avg_order_value, total_orders,
        product_categories, city
      FROM customer_avatars
      WHERE id = ${input.customer_id}
      LIMIT 1
    `;

    if (refResult.rows.length === 0) {
      return {
        found: false,
        message: 'Reference customer not found',
      };
    }

    const ref = refResult.rows[0];
    const refRevenue = parseFloat(ref.total_revenue);
    const refAvgOrder = parseFloat(ref.avg_order_value);

    // Find similar customers (similar revenue and order patterns)
    const similarResult = await sql`
      SELECT
        id, odoo_partner_id, name, city,
        total_orders, total_revenue, avg_order_value,
        health_score, churn_risk_score, upsell_potential_score,
        product_categories,
        assigned_salesperson_name
      FROM customer_avatars
      WHERE id != ${input.customer_id}
        AND is_active = true
        AND total_revenue BETWEEN ${refRevenue * 0.7} AND ${refRevenue * 1.3}
        AND avg_order_value BETWEEN ${refAvgOrder * 0.8} AND ${refAvgOrder * 1.2}
      ORDER BY
        ABS(total_revenue - ${refRevenue}) ASC,
        ABS(avg_order_value - ${refAvgOrder}) ASC
      LIMIT ${limit}
    `;

    return {
      reference_customer_id: input.customer_id,
      reference_stats: {
        total_revenue: refRevenue,
        avg_order_value: refAvgOrder,
        total_orders: ref.total_orders,
        city: ref.city,
      },
      similar_customers: similarResult.rows.map((row) => ({
        id: row.id,
        name: row.name,
        city: row.city,
        total_revenue: parseFloat(row.total_revenue),
        avg_order_value: parseFloat(row.avg_order_value),
        total_orders: row.total_orders,
        health_score: row.health_score,
        churn_risk_score: row.churn_risk_score,
        upsell_potential_score: row.upsell_potential_score,
        product_categories: JSON.parse(row.product_categories || '{}'),
        assigned_salesperson_name: row.assigned_salesperson_name,
      })),
    };
  },
};

// ============================================================================
// TOOL 1.6: get_customer_purchase_history
// ============================================================================

export const getCustomerPurchaseHistoryTool: AgentTool = {
  name: 'get_customer_purchase_history',
  description:
    'Get detailed purchase history with analytics including product diversity, spending trends, category preferences, and purchase patterns.',
  input_schema: {
    type: 'object',
    properties: {
      customer_id: {
        type: 'number',
        description: 'Customer avatar ID',
      },
      days_back: {
        type: 'number',
        description: 'Number of days to look back (default: 365)',
      },
      include_analytics: {
        type: 'boolean',
        description: 'Include detailed analytics (default: true)',
      },
    },
    required: ['customer_id'],
  },
  handler: async (input: { customer_id: number; days_back?: number; include_analytics?: boolean }) => {
    console.log('🔍 get_customer_purchase_history', input);

    const daysBack = input.days_back || 365;
    const includeAnalytics = input.include_analytics !== false;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Get customer profile
    const customerResult = await sql`
      SELECT
        id, name, total_orders, total_revenue,
        avg_order_value, top_products, product_categories
      FROM customer_avatars
      WHERE id = ${input.customer_id}
      LIMIT 1
    `;

    if (customerResult.rows.length === 0) {
      return {
        found: false,
        message: 'Customer not found',
      };
    }

    const customer = customerResult.rows[0];
    const topProducts = JSON.parse(customer.top_products || '[]');
    const productCategories = JSON.parse(customer.product_categories || '{}');

    // Get orders within period
    const ordersResult = await sql`
      SELECT
        si.order_id,
        si.interaction_date as order_date,
        si.order_amount,
        si.notes,
        si.salesperson_name
      FROM sales_interactions si
      WHERE si.customer_avatar_id = ${input.customer_id}
        AND si.order_generated = true
        AND si.interaction_date >= ${startDate.toISOString()}
      ORDER BY si.interaction_date DESC
    `;

    const orders = ordersResult.rows.map(row => ({
      order_id: row.order_id,
      order_date: row.order_date,
      amount: parseFloat(row.order_amount),
      salesperson: row.salesperson_name,
      notes: row.notes,
    }));

    if (!includeAnalytics) {
      return {
        customer_id: input.customer_id,
        customer_name: customer.name,
        period_days: daysBack,
        total_orders: orders.length,
        orders,
      };
    }

    // Calculate analytics
    const totalSpent = orders.reduce((sum, o) => sum + o.amount, 0);
    const avgOrderValue = orders.length > 0 ? totalSpent / orders.length : 0;

    // Calculate purchase frequency
    const sortedOrders = [...orders].sort((a, b) =>
      new Date(a.order_date).getTime() - new Date(b.order_date).getTime()
    );

    let avgDaysBetweenOrders = 0;
    if (sortedOrders.length > 1) {
      const intervals = [];
      for (let i = 1; i < sortedOrders.length; i++) {
        const interval = Math.floor(
          (new Date(sortedOrders[i].order_date).getTime() -
           new Date(sortedOrders[i-1].order_date).getTime()) /
          (1000 * 60 * 60 * 24)
        );
        intervals.push(interval);
      }
      avgDaysBetweenOrders = intervals.reduce((sum, i) => sum + i, 0) / intervals.length;
    }

    // Calculate spending trend (last 3 months vs previous 3 months)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const recentOrders = orders.filter(o => new Date(o.order_date) >= threeMonthsAgo);
    const previousOrders = orders.filter(o =>
      new Date(o.order_date) >= sixMonthsAgo &&
      new Date(o.order_date) < threeMonthsAgo
    );

    const recentTotal = recentOrders.reduce((sum, o) => sum + o.amount, 0);
    const previousTotal = previousOrders.reduce((sum, o) => sum + o.amount, 0);

    let spendingTrend = 'stable';
    let spendingChange = 0;
    if (previousTotal > 0) {
      spendingChange = ((recentTotal - previousTotal) / previousTotal) * 100;
      if (spendingChange > 15) spendingTrend = 'increasing';
      else if (spendingChange < -15) spendingTrend = 'decreasing';
    }

    // Product diversity
    const uniqueProducts = topProducts.length;
    const totalCategories = Object.keys(productCategories).length;

    return {
      customer_id: input.customer_id,
      customer_name: customer.name,
      period_days: daysBack,
      total_orders: orders.length,
      orders,
      analytics: {
        total_spent: Math.round(totalSpent * 100) / 100,
        avg_order_value: Math.round(avgOrderValue * 100) / 100,
        avg_days_between_orders: Math.round(avgDaysBetweenOrders),
        spending_trend: spendingTrend,
        spending_change_pct: Math.round(spendingChange * 10) / 10,
        product_diversity: {
          unique_products: uniqueProducts,
          categories: totalCategories,
          top_products: topProducts.slice(0, 5),
        },
        recent_vs_previous: {
          recent_3mo_orders: recentOrders.length,
          recent_3mo_total: Math.round(recentTotal * 100) / 100,
          previous_3mo_orders: previousOrders.length,
          previous_3mo_total: Math.round(previousTotal * 100) / 100,
        },
      },
    };
  },
};

// ============================================================================
// TOOL 1.7: get_customer_segment_stats
// ============================================================================

export const getCustomerSegmentStatsTool: AgentTool = {
  name: 'get_customer_segment_stats',
  description:
    'Get statistics and benchmarks for a customer segment (by city, revenue tier, personality type, etc). Useful for comparing individual customers against their segment.',
  input_schema: {
    type: 'object',
    properties: {
      segment_type: {
        type: 'string',
        description: 'Type of segment: city, personality_type, revenue_tier (high/medium/low)',
      },
      segment_value: {
        type: 'string',
        description: 'Value to filter by (e.g., "Milano" for city, "high" for revenue_tier)',
      },
    },
    required: ['segment_type', 'segment_value'],
  },
  handler: async (input: { segment_type: string; segment_value: string }) => {
    console.log('🔍 get_customer_segment_stats', input);

    let whereClause = 'is_active = true';
    let params: any[] = [];
    let paramIndex = 1;

    if (input.segment_type === 'city') {
      whereClause += ` AND city ILIKE $${paramIndex}`;
      params.push(`%${input.segment_value}%`);
      paramIndex++;
    } else if (input.segment_type === 'personality_type') {
      whereClause += ` AND personality_type = $${paramIndex}`;
      params.push(input.segment_value);
      paramIndex++;
    } else if (input.segment_type === 'revenue_tier') {
      // Define revenue tiers
      if (input.segment_value === 'high') {
        whereClause += ` AND total_revenue >= 10000`;
      } else if (input.segment_value === 'medium') {
        whereClause += ` AND total_revenue >= 5000 AND total_revenue < 10000`;
      } else if (input.segment_value === 'low') {
        whereClause += ` AND total_revenue < 5000`;
      }
    } else {
      throw new Error('Invalid segment_type. Must be: city, personality_type, or revenue_tier');
    }

    const queryText = `
      SELECT
        COUNT(*) as total_customers,
        AVG(total_revenue) as avg_revenue,
        AVG(total_orders) as avg_orders,
        AVG(avg_order_value) as avg_order_value,
        AVG(health_score) as avg_health_score,
        AVG(churn_risk_score) as avg_churn_risk,
        AVG(upsell_potential_score) as avg_upsell_potential,
        AVG(days_since_last_order) as avg_days_since_order,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_revenue) as median_revenue,
        MAX(total_revenue) as max_revenue,
        MIN(total_revenue) as min_revenue
      FROM customer_avatars
      WHERE ${whereClause}
    `;

    const result = await sql.query(queryText, params);
    const stats = result.rows[0];

    return {
      segment_type: input.segment_type,
      segment_value: input.segment_value,
      total_customers: parseInt(stats.total_customers),
      benchmarks: {
        avg_revenue: stats.avg_revenue ? parseFloat(stats.avg_revenue) : 0,
        median_revenue: stats.median_revenue ? parseFloat(stats.median_revenue) : 0,
        avg_orders: stats.avg_orders ? parseFloat(stats.avg_orders) : 0,
        avg_order_value: stats.avg_order_value ? parseFloat(stats.avg_order_value) : 0,
        avg_health_score: stats.avg_health_score ? parseFloat(stats.avg_health_score) : 0,
        avg_churn_risk: stats.avg_churn_risk ? parseFloat(stats.avg_churn_risk) : 0,
        avg_upsell_potential: stats.avg_upsell_potential ? parseFloat(stats.avg_upsell_potential) : 0,
        avg_days_since_order: stats.avg_days_since_order ? parseFloat(stats.avg_days_since_order) : 0,
      },
      range: {
        min_revenue: stats.min_revenue ? parseFloat(stats.min_revenue) : 0,
        max_revenue: stats.max_revenue ? parseFloat(stats.max_revenue) : 0,
      },
    };
  },
};

// ============================================================================
// TOOL 1.8: search_customers_by_rfm
// ============================================================================

export const searchCustomersByRfmTool: AgentTool = {
  name: 'search_customers_by_rfm',
  description:
    'Search customers by RFM (Recency, Frequency, Monetary) score ranges. Find customers matching specific buying behavior patterns.',
  input_schema: {
    type: 'object',
    properties: {
      recency_max_days: {
        type: 'number',
        description: 'Maximum days since last order (lower = more recent)',
      },
      frequency_min: {
        type: 'number',
        description: 'Minimum number of total orders',
      },
      monetary_min: {
        type: 'number',
        description: 'Minimum total revenue',
      },
      monetary_max: {
        type: 'number',
        description: 'Maximum total revenue (optional)',
      },
      limit: {
        type: 'number',
        description: 'Maximum results (default: 20)',
      },
    },
    required: [],
  },
  handler: async (input: {
    recency_max_days?: number;
    frequency_min?: number;
    monetary_min?: number;
    monetary_max?: number;
    limit?: number;
  }) => {
    console.log('🔍 search_customers_by_rfm', input);

    const limit = input.limit || 20;

    const conditions: string[] = ['is_active = true'];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.recency_max_days !== undefined) {
      conditions.push(`days_since_last_order <= $${paramIndex}`);
      params.push(input.recency_max_days);
      paramIndex++;
    }

    if (input.frequency_min !== undefined) {
      conditions.push(`total_orders >= $${paramIndex}`);
      params.push(input.frequency_min);
      paramIndex++;
    }

    if (input.monetary_min !== undefined) {
      conditions.push(`total_revenue >= $${paramIndex}`);
      params.push(input.monetary_min);
      paramIndex++;
    }

    if (input.monetary_max !== undefined) {
      conditions.push(`total_revenue <= $${paramIndex}`);
      params.push(input.monetary_max);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const queryText = `
      SELECT
        id, odoo_partner_id, name, city,
        total_orders, total_revenue, avg_order_value,
        days_since_last_order, last_order_date,
        health_score, churn_risk_score, upsell_potential_score,
        assigned_salesperson_name
      FROM customer_avatars
      WHERE ${whereClause}
      ORDER BY
        total_revenue DESC,
        days_since_last_order ASC
      LIMIT $${paramIndex}
    `;
    params.push(limit);

    const result = await sql.query(queryText, params);

    // Calculate RFM scores for each customer
    const customers = result.rows.map(row => {
      // Simple RFM scoring (1-5 scale)
      let rScore = 5; // Recency: 5 = recent, 1 = long ago
      if (row.days_since_last_order > 90) rScore = 1;
      else if (row.days_since_last_order > 60) rScore = 2;
      else if (row.days_since_last_order > 30) rScore = 3;
      else if (row.days_since_last_order > 15) rScore = 4;

      let fScore = 1; // Frequency: 5 = many orders, 1 = few
      if (row.total_orders >= 50) fScore = 5;
      else if (row.total_orders >= 20) fScore = 4;
      else if (row.total_orders >= 10) fScore = 3;
      else if (row.total_orders >= 5) fScore = 2;

      let mScore = 1; // Monetary: 5 = high value, 1 = low
      const revenue = parseFloat(row.total_revenue);
      if (revenue >= 20000) mScore = 5;
      else if (revenue >= 10000) mScore = 4;
      else if (revenue >= 5000) mScore = 3;
      else if (revenue >= 2000) mScore = 2;

      // RFM segment
      let segment = 'Other';
      if (rScore >= 4 && fScore >= 4 && mScore >= 4) segment = 'Champions';
      else if (rScore >= 3 && fScore >= 3 && mScore >= 4) segment = 'Loyal Customers';
      else if (rScore >= 4 && fScore <= 2 && mScore >= 3) segment = 'Potential Loyalists';
      else if (rScore >= 4 && fScore <= 2 && mScore <= 2) segment = 'New Customers';
      else if (rScore <= 2 && fScore >= 3 && mScore >= 3) segment = 'At Risk';
      else if (rScore <= 2 && fScore <= 2) segment = 'Hibernating';

      return {
        id: row.id,
        name: row.name,
        city: row.city,
        rfm_scores: {
          recency: rScore,
          frequency: fScore,
          monetary: mScore,
          segment,
        },
        metrics: {
          total_orders: row.total_orders,
          total_revenue: parseFloat(row.total_revenue),
          avg_order_value: parseFloat(row.avg_order_value),
          days_since_last_order: row.days_since_last_order,
          last_order_date: row.last_order_date,
        },
        scores: {
          health_score: row.health_score,
          churn_risk_score: row.churn_risk_score,
          upsell_potential_score: row.upsell_potential_score,
        },
        assigned_salesperson_name: row.assigned_salesperson_name,
      };
    });

    return {
      filters_applied: {
        recency_max_days: input.recency_max_days,
        frequency_min: input.frequency_min,
        monetary_min: input.monetary_min,
        monetary_max: input.monetary_max,
      },
      total_found: customers.length,
      customers,
    };
  },
};

// ============================================================================
// EXPORT ALL TOOLS
// ============================================================================

export const customerTools: AgentTool[] = [
  getCustomerProfileTool,
  getCustomerHistoryTool,
  searchCustomersTool,
  getCustomerRecommendationsTool,
  compareSimilarCustomersTool,
  getCustomerPurchaseHistoryTool,
  getCustomerSegmentStatsTool,
  searchCustomersByRfmTool,
];
