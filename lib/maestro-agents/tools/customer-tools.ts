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
// EXPORT ALL TOOLS
// ============================================================================

export const customerTools: AgentTool[] = [
  getCustomerProfileTool,
  getCustomerHistoryTool,
  searchCustomersTool,
  getCustomerRecommendationsTool,
  compareSimilarCustomersTool,
];
