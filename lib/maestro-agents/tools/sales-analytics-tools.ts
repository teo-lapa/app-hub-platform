/**
 * SALES ANALYTICS TOOLS
 * Tools for Agent 3: Sales Data Analyst Agent
 */

import { sql } from '@vercel/postgres';
import type { AgentTool, SalespersonPerformance } from '../types';

// ============================================================================
// TOOL 3.1: get_salesperson_performance
// ============================================================================

export const getSalespersonPerformanceTool: AgentTool = {
  name: 'get_salesperson_performance',
  description:
    'Get comprehensive performance metrics for a salesperson including customers, sales, activity, and AI recommendation effectiveness.',
  input_schema: {
    type: 'object',
    properties: {
      salesperson_id: {
        type: 'number',
        description: 'Salesperson ID',
      },
      period_days: {
        type: 'number',
        description: 'Period to analyze in days (default: 30)',
      },
    },
    required: ['salesperson_id'],
  },
  handler: async (input: { salesperson_id: number; period_days?: number }) => {
    console.log('🔍 get_salesperson_performance', input);

    const periodDays = input.period_days || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    // Customer stats
    const customerStats = await sql`
      SELECT
        COUNT(*) as total_assigned,
        COUNT(*) FILTER (WHERE days_since_last_order <= 60) as active_customers,
        COUNT(*) FILTER (WHERE churn_risk_score >= 60) as at_risk_customers,
        COUNT(*) FILTER (WHERE upsell_potential_score >= 60) as high_upsell_potential
      FROM customer_avatars
      WHERE assigned_salesperson_id = ${input.salesperson_id}
        AND is_active = true
    `;

    // Interaction stats
    const activityStats = await sql`
      SELECT
        COUNT(*) as total_interactions,
        COUNT(*) FILTER (WHERE interaction_type = 'visit') as visits,
        COUNT(*) FILTER (WHERE interaction_type = 'call') as calls,
        COUNT(*) FILTER (WHERE interaction_type = 'email') as emails,
        COUNT(*) FILTER (WHERE outcome IN ('success', 'successful')) as successful_interactions,
        COUNT(*) FILTER (WHERE order_generated = true) as orders_generated,
        COALESCE(SUM(order_amount), 0) as revenue_generated
      FROM sales_interactions
      WHERE salesperson_id = ${input.salesperson_id}
        AND interaction_date >= ${startDate.toISOString()}
    `;

    // AI recommendation stats
    const aiStats = await sql`
      SELECT
        COUNT(*) as generated,
        COUNT(*) FILTER (WHERE status IN ('accepted', 'in_progress', 'completed')) as accepted,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE was_successful = true) as successful,
        COALESCE(SUM(actual_order_amount) FILTER (WHERE status = 'completed'), 0) as revenue_from_ai
      FROM maestro_recommendations
      WHERE salesperson_id = ${input.salesperson_id}
        AND created_at >= ${startDate.toISOString()}
    `;

    const customers = customerStats.rows[0];
    const activity = activityStats.rows[0];
    const ai = aiStats.rows[0];

    const totalInteractions = parseInt(activity.total_interactions);
    const successfulInteractions = parseInt(activity.successful_interactions);
    const ordersGenerated = parseInt(activity.orders_generated);
    const revenueGenerated = parseFloat(activity.revenue_generated);

    const performance: SalespersonPerformance = {
      salesperson_id: input.salesperson_id,
      salesperson_name: '', // Will be filled by query or context
      period_days: periodDays,

      customers: {
        total_assigned: parseInt(customers.total_assigned),
        active_customers: parseInt(customers.active_customers),
        at_risk_customers: parseInt(customers.at_risk_customers),
        high_upsell_potential: parseInt(customers.high_upsell_potential),
      },

      sales: {
        total_orders: ordersGenerated,
        total_revenue: revenueGenerated,
        avg_order_value: ordersGenerated > 0 ? revenueGenerated / ordersGenerated : 0,
        orders_vs_last_period_pct: 0, // TODO: Calculate
        revenue_vs_last_period_pct: 0, // TODO: Calculate
      },

      activity: {
        total_interactions: totalInteractions,
        visits: parseInt(activity.visits),
        calls: parseInt(activity.calls),
        emails: parseInt(activity.emails),
        avg_interactions_per_day: totalInteractions / periodDays,
        success_rate: totalInteractions > 0 ? (successfulInteractions / totalInteractions) * 100 : 0,
      },

      ai_recommendations: {
        generated: parseInt(ai.generated),
        accepted: parseInt(ai.accepted),
        completed: parseInt(ai.completed),
        success_rate: parseInt(ai.completed) > 0 ? (parseInt(ai.successful) / parseInt(ai.completed)) * 100 : 0,
        revenue_from_ai_actions: parseFloat(ai.revenue_from_ai),
      },

      top_products_sold: [], // TODO: Add query
    };

    return performance;
  },
};

// ============================================================================
// TOOL 3.2: get_team_leaderboard
// ============================================================================

export const getTeamLeaderboardTool: AgentTool = {
  name: 'get_team_leaderboard',
  description:
    'Get leaderboard ranking of all salespeople by various metrics (revenue, orders, customer satisfaction, etc).',
  input_schema: {
    type: 'object',
    properties: {
      period_days: {
        type: 'number',
        description: 'Period to analyze (default: 30)',
      },
      metric: {
        type: 'string',
        description: 'Metric to rank by: revenue, orders, interactions (default: revenue)',
      },
      limit: {
        type: 'number',
        description: 'Top N salespeople (default: 10)',
      },
    },
    required: [],
  },
  handler: async (input: { period_days?: number; metric?: string; limit?: number }) => {
    console.log('🔍 get_team_leaderboard', input);

    const periodDays = input.period_days || 30;
    const metric = input.metric || 'revenue';
    const limit = input.limit || 10;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    const result = await sql`
      SELECT
        si.salesperson_id,
        si.salesperson_name,
        COUNT(DISTINCT si.customer_avatar_id) as customers_contacted,
        COUNT(*) as total_interactions,
        COUNT(*) FILTER (WHERE si.order_generated = true) as orders_generated,
        COALESCE(SUM(si.order_amount), 0) as total_revenue,
        AVG(si.order_amount) FILTER (WHERE si.order_amount IS NOT NULL) as avg_order_value
      FROM sales_interactions si
      WHERE si.interaction_date >= ${startDate.toISOString()}
      GROUP BY si.salesperson_id, si.salesperson_name
      ORDER BY
        CASE ${metric}
          WHEN 'revenue' THEN COALESCE(SUM(si.order_amount), 0)
          WHEN 'orders' THEN COUNT(*) FILTER (WHERE si.order_generated = true)
          WHEN 'interactions' THEN COUNT(*)
          ELSE COALESCE(SUM(si.order_amount), 0)
        END DESC
      LIMIT ${limit}
    `;

    return {
      period_days: periodDays,
      metric,
      total_salespeople: result.rows.length,
      leaderboard: result.rows.map((row, index) => ({
        rank: index + 1,
        salesperson_id: row.salesperson_id,
        salesperson_name: row.salesperson_name,
        customers_contacted: parseInt(row.customers_contacted),
        total_interactions: parseInt(row.total_interactions),
        orders_generated: parseInt(row.orders_generated),
        total_revenue: parseFloat(row.total_revenue),
        avg_order_value: row.avg_order_value ? parseFloat(row.avg_order_value) : 0,
      })),
    };
  },
};

// ============================================================================
// TOOL 3.3: analyze_conversion_funnel
// ============================================================================

export const analyzeConversionFunnelTool: AgentTool = {
  name: 'analyze_conversion_funnel',
  description:
    'Analyze conversion funnel: visits → orders. Shows drop-off rates and conversion metrics.',
  input_schema: {
    type: 'object',
    properties: {
      salesperson_id: {
        type: 'number',
        description: 'Salesperson ID',
      },
      period_days: {
        type: 'number',
        description: 'Period to analyze (default: 30)',
      },
    },
    required: ['salesperson_id'],
  },
  handler: async (input: { salesperson_id: number; period_days?: number }) => {
    console.log('🔍 analyze_conversion_funnel', input);

    const periodDays = input.period_days || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    const result = await sql`
      SELECT
        COUNT(*) as total_interactions,
        COUNT(*) FILTER (WHERE interaction_type = 'visit') as visits,
        COUNT(*) FILTER (WHERE interaction_type = 'call') as calls,
        COUNT(*) FILTER (WHERE outcome IN ('success', 'successful')) as successful_interactions,
        COUNT(*) FILTER (WHERE order_generated = true) as orders_generated,
        COALESCE(SUM(order_amount), 0) as total_revenue
      FROM sales_interactions
      WHERE salesperson_id = ${input.salesperson_id}
        AND interaction_date >= ${startDate.toISOString()}
    `;

    const row = result.rows[0];
    const totalInteractions = parseInt(row.total_interactions);
    const visits = parseInt(row.visits);
    const calls = parseInt(row.calls);
    const successfulInteractions = parseInt(row.successful_interactions);
    const ordersGenerated = parseInt(row.orders_generated);
    const totalRevenue = parseFloat(row.total_revenue);

    return {
      salesperson_id: input.salesperson_id,
      period_days: periodDays,
      funnel: {
        total_interactions: totalInteractions,
        visits: visits,
        calls: calls,
        successful_interactions: successfulInteractions,
        orders_generated: ordersGenerated,
      },
      conversion_rates: {
        interaction_to_success_rate: totalInteractions > 0 ? (successfulInteractions / totalInteractions) * 100 : 0,
        interaction_to_order_rate: totalInteractions > 0 ? (ordersGenerated / totalInteractions) * 100 : 0,
        visit_to_order_rate: visits > 0 ? (ordersGenerated / visits) * 100 : 0,
        success_to_order_rate: successfulInteractions > 0 ? (ordersGenerated / successfulInteractions) * 100 : 0,
      },
      revenue: {
        total_revenue: totalRevenue,
        avg_revenue_per_order: ordersGenerated > 0 ? totalRevenue / ordersGenerated : 0,
        avg_revenue_per_interaction: totalInteractions > 0 ? totalRevenue / totalInteractions : 0,
      },
    };
  },
};

// ============================================================================
// TOOL 3.4: get_daily_summary
// ============================================================================

export const getDailySummaryTool: AgentTool = {
  name: 'get_daily_summary',
  description:
    'Get daily summary of activity for a salesperson: actions planned vs completed, orders, revenue.',
  input_schema: {
    type: 'object',
    properties: {
      salesperson_id: {
        type: 'number',
        description: 'Salesperson ID',
      },
      date: {
        type: 'string',
        description: 'Date in YYYY-MM-DD format (default: today)',
      },
    },
    required: ['salesperson_id'],
  },
  handler: async (input: { salesperson_id: number; date?: string }) => {
    console.log('🔍 get_daily_summary', input);

    const date = input.date || new Date().toISOString().split('T')[0];

    // Get daily plan if exists
    const planResult = await sql`
      SELECT * FROM daily_action_plans
      WHERE salesperson_id = ${input.salesperson_id}
        AND plan_date = ${date}
      LIMIT 1
    `;

    // Get actual activity for the day
    const activityResult = await sql`
      SELECT
        COUNT(*) as total_interactions,
        COUNT(*) FILTER (WHERE interaction_type = 'visit') as visits_done,
        COUNT(*) FILTER (WHERE interaction_type = 'call') as calls_done,
        COUNT(*) FILTER (WHERE order_generated = true) as orders_generated,
        COALESCE(SUM(order_amount), 0) as revenue_generated
      FROM sales_interactions
      WHERE salesperson_id = ${input.salesperson_id}
        AND DATE(interaction_date) = ${date}
    `;

    const activity = activityResult.rows[0];

    if (planResult.rows.length === 0) {
      return {
        date,
        salesperson_id: input.salesperson_id,
        has_plan: false,
        actual: {
          interactions: parseInt(activity.total_interactions),
          visits_done: parseInt(activity.visits_done),
          calls_done: parseInt(activity.calls_done),
          orders_generated: parseInt(activity.orders_generated),
          revenue_generated: parseFloat(activity.revenue_generated),
        },
      };
    }

    const plan = planResult.rows[0];

    return {
      date,
      salesperson_id: input.salesperson_id,
      has_plan: true,
      plan: {
        total_actions_planned: plan.total_actions,
        high_priority: plan.high_priority_actions,
        medium_priority: plan.medium_priority_actions,
        low_priority: plan.low_priority_actions,
        estimated_revenue: parseFloat(plan.estimated_revenue),
        estimated_visits: plan.estimated_visits,
      },
      actual: {
        actions_completed: plan.actions_completed,
        completion_rate: plan.completion_rate ? parseFloat(plan.completion_rate) * 100 : 0,
        visits_done: parseInt(activity.visits_done),
        calls_done: parseInt(activity.calls_done),
        orders_generated: parseInt(activity.orders_generated),
        revenue_generated: parseFloat(activity.revenue_generated),
      },
      variance: {
        revenue_vs_estimate: parseFloat(activity.revenue_generated) - parseFloat(plan.estimated_revenue),
        orders_vs_estimate: parseInt(activity.orders_generated) - plan.estimated_orders,
      },
    };
  },
};

// ============================================================================
// TOOL 3.5: forecast_revenue
// ============================================================================

export const forecastRevenueTool: AgentTool = {
  name: 'forecast_revenue',
  description:
    'Forecast future revenue for a salesperson based on historical trends and pipeline.',
  input_schema: {
    type: 'object',
    properties: {
      salesperson_id: {
        type: 'number',
        description: 'Salesperson ID',
      },
      forecast_days: {
        type: 'number',
        description: 'Days to forecast ahead (default: 30)',
      },
    },
    required: ['salesperson_id'],
  },
  handler: async (input: { salesperson_id: number; forecast_days?: number }) => {
    console.log('🔍 forecast_revenue', input);

    const forecastDays = input.forecast_days || 30;

    // Get historical revenue (last 90 days)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);

    const historyResult = await sql`
      SELECT
        DATE(interaction_date) as date,
        COUNT(*) FILTER (WHERE order_generated = true) as orders,
        COALESCE(SUM(order_amount), 0) as revenue
      FROM sales_interactions
      WHERE salesperson_id = ${input.salesperson_id}
        AND interaction_date >= ${startDate.toISOString()}
        AND order_generated = true
      GROUP BY DATE(interaction_date)
      ORDER BY date DESC
    `;

    if (historyResult.rows.length === 0) {
      return {
        salesperson_id: input.salesperson_id,
        forecast_days: forecastDays,
        forecast: {
          estimated_revenue: 0,
          confidence: 'low',
          message: 'Not enough historical data to forecast',
        },
      };
    }

    // Simple forecast: average daily revenue * forecast days
    const totalRevenue = historyResult.rows.reduce((sum, row) => sum + parseFloat(row.revenue), 0);
    const avgDailyRevenue = totalRevenue / historyResult.rows.length;
    const estimatedRevenue = avgDailyRevenue * forecastDays;

    // Calculate confidence based on data consistency
    const revenueValues = historyResult.rows.map(row => parseFloat(row.revenue));
    const variance = revenueValues.reduce((sum, val) => sum + Math.pow(val - avgDailyRevenue, 2), 0) / revenueValues.length;
    const stdDev = Math.sqrt(variance);
    const confidenceScore = avgDailyRevenue > 0 ? Math.max(0, 100 - (stdDev / avgDailyRevenue) * 100) : 0;

    return {
      salesperson_id: input.salesperson_id,
      forecast_days: forecastDays,
      historical_data: {
        days_analyzed: historyResult.rows.length,
        total_revenue: totalRevenue,
        avg_daily_revenue: avgDailyRevenue,
      },
      forecast: {
        estimated_revenue: estimatedRevenue,
        confidence_score: confidenceScore,
        confidence_level: confidenceScore > 70 ? 'high' : confidenceScore > 40 ? 'medium' : 'low',
        range_min: estimatedRevenue * 0.8,
        range_max: estimatedRevenue * 1.2,
      },
    };
  },
};

// ============================================================================
// EXPORT ALL TOOLS
// ============================================================================

export const salesAnalyticsTools: AgentTool[] = [
  getSalespersonPerformanceTool,
  getTeamLeaderboardTool,
  analyzeConversionFunnelTool,
  getDailySummaryTool,
  forecastRevenueTool,
];
