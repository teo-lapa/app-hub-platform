/**
 * MAESTRO INTELLIGENCE TOOLS
 * Tools for Agent 4: Maestro Intelligence Agent
 */

import { sql } from '@vercel/postgres';
import type { AgentTool } from '../types';

// ============================================================================
// TOOL 4.1: get_daily_action_plan
// ============================================================================

export const getDailyActionPlanTool: AgentTool = {
  name: 'get_daily_action_plan',
  description:
    'Get optimized daily action plan for a salesperson with prioritized customers to contact and suggested actions.',
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
    console.log('🔍 get_daily_action_plan', input);

    const date = input.date || new Date().toISOString().split('T')[0];

    // Get existing plan
    const planResult = await sql`
      SELECT * FROM daily_action_plans
      WHERE salesperson_id = ${input.salesperson_id}
        AND plan_date = ${date}
      LIMIT 1
    `;

    if (planResult.rows.length > 0) {
      const plan = planResult.rows[0];
      return {
        has_existing_plan: true,
        plan: {
          date,
          total_actions: plan.total_actions,
          high_priority: plan.high_priority_actions,
          medium_priority: plan.medium_priority_actions,
          low_priority: plan.low_priority_actions,
          estimated_revenue: parseFloat(plan.estimated_revenue),
          estimated_visits: plan.estimated_visits,
          status: plan.status,
        },
      };
    }

    // Generate new plan from recommendations
    const recsResult = await sql`
      SELECT
        r.*,
        ca.name as customer_name,
        ca.city,
        ca.health_score,
        ca.churn_risk_score
      FROM maestro_recommendations r
      JOIN customer_avatars ca ON r.customer_avatar_id = ca.id
      WHERE r.salesperson_id = ${input.salesperson_id}
        AND r.status = 'pending'
        AND (r.expires_at IS NULL OR r.expires_at > NOW())
      ORDER BY
        CASE r.urgency_level
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        r.priority DESC
      LIMIT 20
    `;

    const recommendations = recsResult.rows;

    const critical = recommendations.filter((r) => r.urgency_level === 'critical');
    const high = recommendations.filter((r) => r.urgency_level === 'high');
    const medium = recommendations.filter((r) => r.urgency_level === 'medium');
    const low = recommendations.filter((r) => r.urgency_level === 'low');

    return {
      has_existing_plan: false,
      date,
      salesperson_id: input.salesperson_id,
      total_actions: recommendations.length,
      critical_actions: critical.map((r) => ({
        customer_id: r.customer_avatar_id,
        customer_name: r.customer_name,
        city: r.city,
        type: r.recommendation_type,
        urgency: r.urgency_level,
        reason: r.reasoning,
        action: r.action_suggested,
        expected_outcome: r.expected_outcome,
        best_time: r.best_time_to_contact,
      })),
      high_priority: high.map((r) => ({
        customer_id: r.customer_avatar_id,
        customer_name: r.customer_name,
        type: r.recommendation_type,
        action: r.action_suggested,
      })),
      medium_priority: medium.map((r) => ({
        customer_id: r.customer_avatar_id,
        customer_name: r.customer_name,
        type: r.recommendation_type,
      })),
      low_priority: low.map((r) => ({
        customer_id: r.customer_avatar_id,
        customer_name: r.customer_name,
      })),
      summary: {
        critical_count: critical.length,
        high_count: high.length,
        medium_count: medium.length,
        low_count: low.length,
        estimated_total_time_hours: recommendations.length * 0.5, // Rough estimate
      },
    };
  },
};

// ============================================================================
// TOOL 4.2: get_learned_patterns
// ============================================================================

export const getLearnedPatternsTool: AgentTool = {
  name: 'get_learned_patterns',
  description:
    'Get patterns and insights learned by the Maestro AI system from historical data and successful actions.',
  input_schema: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        description: 'Filter by category: sales, product, customer_behavior, timing (optional)',
      },
      min_confidence: {
        type: 'number',
        description: 'Minimum confidence score 0-1 (default: 0.6)',
      },
      limit: {
        type: 'number',
        description: 'Maximum patterns to return (default: 10)',
      },
    },
    required: [],
  },
  handler: async (input: { category?: string; min_confidence?: number; limit?: number }) => {
    console.log('🔍 get_learned_patterns', input);

    const minConfidence = input.min_confidence || 0.6;
    const limit = input.limit || 10;

    const conditions: string[] = ['is_active = true', 'validated = true'];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.category) {
      conditions.push(`category = $${paramIndex}`);
      params.push(input.category);
      paramIndex++;
    }

    conditions.push(`confidence >= $${paramIndex}`);
    params.push(minConfidence);
    paramIndex++;

    const whereClause = conditions.join(' AND ');

    const queryText = `
      SELECT * FROM maestro_learning
      WHERE ${whereClause}
      ORDER BY success_rate DESC, confidence DESC, times_applied DESC
      LIMIT $${paramIndex}
    `;
    params.push(limit);

    const result = await sql.query(queryText, params);

    return {
      total_patterns: result.rows.length,
      patterns: result.rows.map((row) => ({
        id: row.id,
        learning_type: row.learning_type,
        category: row.category,
        pattern_name: row.pattern_name,
        pattern_discovered: row.pattern_discovered,
        confidence: parseFloat(row.confidence),
        sample_size: row.sample_size,
        times_applied: row.times_applied,
        success_rate: row.success_rate ? parseFloat(row.success_rate) : null,
        avg_impact_revenue: row.avg_impact_revenue ? parseFloat(row.avg_impact_revenue) : null,
        supporting_data: row.supporting_data ? JSON.parse(row.supporting_data) : {},
        last_validated: row.last_validated,
      })),
    };
  },
};

// ============================================================================
// TOOL 4.3: optimize_contact_timing
// ============================================================================

export const optimizeContactTimingTool: AgentTool = {
  name: 'optimize_contact_timing',
  description:
    'Find optimal timing to contact a customer based on historical successful interactions.',
  input_schema: {
    type: 'object',
    properties: {
      customer_id: {
        type: 'number',
        description: 'Customer avatar ID',
      },
    },
    required: ['customer_id'],
  },
  handler: async (input: { customer_id: number }) => {
    console.log('🔍 optimize_contact_timing', input);

    // Get customer info
    const customerResult = await sql`
      SELECT
        name, best_contact_time, preferred_contact_method
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

    // Analyze historical interactions
    const historyResult = await sql`
      SELECT
        EXTRACT(DOW FROM interaction_date) as day_of_week,
        EXTRACT(HOUR FROM interaction_date) as hour_of_day,
        interaction_type,
        outcome,
        order_generated
      FROM sales_interactions
      WHERE customer_avatar_id = ${input.customer_id}
      ORDER BY interaction_date DESC
      LIMIT 50
    `;

    if (historyResult.rows.length < 3) {
      return {
        customer_id: input.customer_id,
        customer_name: customer.name,
        has_enough_data: false,
        recommendation: {
          preferred_method: customer.preferred_contact_method || 'visit',
          best_time: customer.best_contact_time || 'morning',
          reasoning: 'Based on customer preferences (limited historical data)',
        },
      };
    }

    // Analyze patterns
    const dayOfWeekSuccess: Record<number, number> = {};
    const hourOfDaySuccess: Record<number, number> = {};

    for (const row of historyResult.rows) {
      const dow = parseInt(row.day_of_week);
      const hour = parseInt(row.hour_of_day);
      const success = row.outcome === 'successful' || row.order_generated ? 1 : 0;

      dayOfWeekSuccess[dow] = (dayOfWeekSuccess[dow] || 0) + success;
      hourOfDaySuccess[hour] = (hourOfDaySuccess[hour] || 0) + success;
    }

    // Find best day and hour
    let bestDay = 0;
    let maxDaySuccess = 0;
    for (const [day, count] of Object.entries(dayOfWeekSuccess)) {
      if (count > maxDaySuccess) {
        maxDaySuccess = count;
        bestDay = parseInt(day);
      }
    }

    let bestHour = 0;
    let maxHourSuccess = 0;
    for (const [hour, count] of Object.entries(hourOfDaySuccess)) {
      if (count > maxHourSuccess) {
        maxHourSuccess = count;
        bestHour = parseInt(hour);
      }
    }

    const dayNames = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
    const timeOfDay =
      bestHour < 12 ? 'mattina (prima di pranzo)' : bestHour < 15 ? 'dopo pranzo' : 'pomeriggio';

    return {
      customer_id: input.customer_id,
      customer_name: customer.name,
      has_enough_data: true,
      optimal_timing: {
        best_day_of_week: dayNames[bestDay],
        best_time_of_day: timeOfDay,
        best_hour: bestHour,
        preferred_method: customer.preferred_contact_method || 'visit',
      },
      historical_data: {
        total_interactions: historyResult.rows.length,
        day_of_week_success: dayOfWeekSuccess,
        hour_of_day_success: hourOfDaySuccess,
      },
      reasoning: `Analisi di ${historyResult.rows.length} interazioni passate mostra ${maxDaySuccess} successi il ${dayNames[bestDay]} e ${maxHourSuccess} successi verso le ${bestHour}:00.`,
    };
  },
};

// ============================================================================
// TOOL 4.4: get_recommendation_effectiveness
// ============================================================================

export const getRecommendationEffectivenessTool: AgentTool = {
  name: 'get_recommendation_effectiveness',
  description:
    'Analyze effectiveness of AI recommendations: success rate, revenue generated, patterns of success.',
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
    console.log('🔍 get_recommendation_effectiveness', input);

    const periodDays = input.period_days || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    const result = await sql`
      SELECT
        recommendation_type,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status IN ('accepted', 'in_progress', 'completed')) as accepted,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE was_successful = true) as successful,
        AVG(confidence_score) as avg_confidence,
        COALESCE(SUM(actual_order_amount) FILTER (WHERE status = 'completed'), 0) as total_revenue
      FROM maestro_recommendations
      WHERE salesperson_id = ${input.salesperson_id}
        AND created_at >= ${startDate.toISOString()}
      GROUP BY recommendation_type
      ORDER BY COUNT(*) DESC
    `;

    const byType = result.rows.map((row) => {
      const total = parseInt(row.total);
      const accepted = parseInt(row.accepted);
      const completed = parseInt(row.completed);
      const successful = parseInt(row.successful);

      return {
        type: row.recommendation_type,
        total_generated: total,
        accepted: accepted,
        completed: completed,
        successful: successful,
        acceptance_rate: total > 0 ? (accepted / total) * 100 : 0,
        completion_rate: accepted > 0 ? (completed / accepted) * 100 : 0,
        success_rate: completed > 0 ? (successful / completed) * 100 : 0,
        avg_confidence: row.avg_confidence ? parseFloat(row.avg_confidence) : 0,
        total_revenue: parseFloat(row.total_revenue),
      };
    });

    // Overall stats
    const totalResult = await sql`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status IN ('accepted', 'in_progress', 'completed')) as accepted,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE was_successful = true) as successful,
        COALESCE(SUM(actual_order_amount) FILTER (WHERE status = 'completed'), 0) as total_revenue
      FROM maestro_recommendations
      WHERE salesperson_id = ${input.salesperson_id}
        AND created_at >= ${startDate.toISOString()}
    `;

    const totals = totalResult.rows[0];
    const totalCount = parseInt(totals.total);
    const acceptedCount = parseInt(totals.accepted);
    const completedCount = parseInt(totals.completed);
    const successfulCount = parseInt(totals.successful);

    return {
      salesperson_id: input.salesperson_id,
      period_days: periodDays,
      overall: {
        total_generated: totalCount,
        accepted: acceptedCount,
        completed: completedCount,
        successful: successfulCount,
        acceptance_rate: totalCount > 0 ? (acceptedCount / totalCount) * 100 : 0,
        completion_rate: acceptedCount > 0 ? (completedCount / acceptedCount) * 100 : 0,
        success_rate: completedCount > 0 ? (successfulCount / completedCount) * 100 : 0,
        total_revenue: parseFloat(totals.total_revenue),
        avg_revenue_per_success: successfulCount > 0 ? parseFloat(totals.total_revenue) / successfulCount : 0,
      },
      by_type: byType,
    };
  },
};

// ============================================================================
// EXPORT ALL TOOLS
// ============================================================================

export const maestroIntelligenceTools: AgentTool[] = [
  getDailyActionPlanTool,
  getLearnedPatternsTool,
  optimizeContactTimingTool,
  getRecommendationEffectivenessTool,
];
