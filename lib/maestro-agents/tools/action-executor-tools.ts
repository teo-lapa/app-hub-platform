/**
 * ACTION EXECUTOR TOOLS
 * Tools for Agent 5: Action Executor Agent
 */

import { sql } from '@vercel/postgres';
import type { AgentTool } from '../types';

// ============================================================================
// TOOL 5.1: record_interaction
// ============================================================================

export const recordInteractionTool: AgentTool = {
  name: 'record_interaction',
  description:
    'Record a new interaction with a customer (visit, call, email). Updates customer scores and tracks outcomes.',
  input_schema: {
    type: 'object',
    properties: {
      customer_id: {
        type: 'number',
        description: 'Customer avatar ID',
      },
      salesperson_id: {
        type: 'number',
        description: 'Salesperson ID',
      },
      interaction_type: {
        type: 'string',
        description: 'Type: visit, call, email, sample, other',
      },
      outcome: {
        type: 'string',
        description: 'Outcome: successful, unsuccessful, neutral, follow_up_needed',
      },
      notes: {
        type: 'string',
        description: 'Notes about the interaction',
      },
      duration_minutes: {
        type: 'number',
        description: 'Duration in minutes',
      },
      order_placed: {
        type: 'boolean',
        description: 'Was an order placed?',
      },
      order_amount: {
        type: 'number',
        description: 'Order amount if order was placed',
      },
      samples_given: {
        type: 'array',
        description: 'Array of samples given: [{product_id, product_name, quantity}]',
      },
      requires_followup: {
        type: 'boolean',
        description: 'Does this require a follow-up?',
      },
      followup_date: {
        type: 'string',
        description: 'Follow-up date in YYYY-MM-DD format',
      },
      followup_reason: {
        type: 'string',
        description: 'Reason for follow-up',
      },
    },
    required: ['customer_id', 'salesperson_id', 'interaction_type', 'outcome'],
  },
  handler: async (input: {
    customer_id: number;
    salesperson_id: number;
    interaction_type: string;
    outcome: string;
    notes?: string;
    duration_minutes?: number;
    order_placed?: boolean;
    order_amount?: number;
    samples_given?: Array<{ product_id: number; product_name: string; quantity: number }>;
    requires_followup?: boolean;
    followup_date?: string;
    followup_reason?: string;
  }) => {
    console.log('🔍 record_interaction', input);

    // Get customer and salesperson info
    const customerResult = await sql`
      SELECT
        id, odoo_partner_id, name,
        assigned_salesperson_id, assigned_salesperson_name
      FROM customer_avatars
      WHERE id = ${input.customer_id}
      LIMIT 1
    `;

    if (customerResult.rows.length === 0) {
      throw new Error('Customer not found');
    }

    const customer = customerResult.rows[0];

    // Insert interaction
    const result = await sql`
      INSERT INTO sales_interactions (
        customer_avatar_id,
        odoo_partner_id,
        salesperson_id,
        salesperson_name,
        interaction_type,
        interaction_date,
        outcome,
        duration_minutes,
        notes,
        samples_given,
        order_generated,
        order_amount,
        requires_followup,
        followup_date,
        followup_reason
      ) VALUES (
        ${input.customer_id},
        ${customer.odoo_partner_id},
        ${input.salesperson_id},
        ${customer.assigned_salesperson_name || 'Unknown'},
        ${input.interaction_type},
        NOW(),
        ${input.outcome},
        ${input.duration_minutes || null},
        ${input.notes || null},
        ${input.samples_given ? JSON.stringify(input.samples_given) : null},
        ${input.order_placed || false},
        ${input.order_amount || null},
        ${input.requires_followup || false},
        ${input.followup_date || null},
        ${input.followup_reason || null}
      )
      RETURNING *
    `;

    const interaction = result.rows[0];

    // Update customer engagement score based on outcome
    if (input.outcome === 'successful' || input.order_placed) {
      await sql`
        UPDATE customer_avatars
        SET
          engagement_score = LEAST(100, engagement_score + 5),
          churn_risk_score = GREATEST(0, churn_risk_score - 10),
          updated_at = NOW()
        WHERE id = ${input.customer_id}
      `;
    }

    return {
      success: true,
      interaction_id: interaction.id,
      customer_id: input.customer_id,
      customer_name: customer.name,
      message: 'Interaction recorded successfully',
      side_effects: {
        customer_scores_updated: input.outcome === 'successful' || input.order_placed,
      },
    };
  },
};

// ============================================================================
// TOOL 5.2: update_recommendation_status
// ============================================================================

export const updateRecommendationStatusTool: AgentTool = {
  name: 'update_recommendation_status',
  description:
    'Update the status of a recommendation (in_progress, completed, dismissed) and record outcomes.',
  input_schema: {
    type: 'object',
    properties: {
      recommendation_id: {
        type: 'number',
        description: 'Recommendation ID',
      },
      status: {
        type: 'string',
        description: 'New status: accepted, in_progress, completed, dismissed',
      },
      outcome: {
        type: 'string',
        description: 'Outcome: order_generated, scheduled_followup, no_interest, not_available',
      },
      outcome_notes: {
        type: 'string',
        description: 'Notes about the outcome',
      },
      actual_order_amount: {
        type: 'number',
        description: 'Actual order amount if order was generated',
      },
    },
    required: ['recommendation_id', 'status'],
  },
  handler: async (input: {
    recommendation_id: number;
    status: string;
    outcome?: string;
    outcome_notes?: string;
    actual_order_amount?: number;
  }) => {
    console.log('🔍 update_recommendation_status', input);

    // Get current recommendation
    const currentResult = await sql`
      SELECT
        id, customer_avatar_id, expected_outcome,
        confidence_score, success_probability
      FROM maestro_recommendations
      WHERE id = ${input.recommendation_id}
      LIMIT 1
    `;

    if (currentResult.rows.length === 0) {
      throw new Error('Recommendation not found');
    }

    const current = currentResult.rows[0];

    // Determine if successful
    const wasSuccessful = input.status === 'completed' && (input.outcome === 'order_generated' || input.actual_order_amount);

    // Update recommendation
    const result = await sql`
      UPDATE maestro_recommendations
      SET
        status = ${input.status},
        accepted_at = CASE WHEN ${input.status} IN ('accepted', 'in_progress', 'completed') AND accepted_at IS NULL THEN NOW() ELSE accepted_at END,
        completed_at = CASE WHEN ${input.status} = 'completed' THEN NOW() ELSE completed_at END,
        dismissed_at = CASE WHEN ${input.status} = 'dismissed' THEN NOW() ELSE dismissed_at END,
        outcome = ${input.outcome || null},
        outcome_notes = ${input.outcome_notes || null},
        actual_order_amount = ${input.actual_order_amount || null},
        was_successful = ${wasSuccessful},
        updated_at = NOW()
      WHERE id = ${input.recommendation_id}
      RETURNING *
    `;

    const updated = result.rows[0];

    // If successful, update customer scores
    if (wasSuccessful) {
      await sql`
        UPDATE customer_avatars
        SET
          health_score = LEAST(100, health_score + 10),
          churn_risk_score = GREATEST(0, churn_risk_score - 15),
          engagement_score = LEAST(100, engagement_score + 10),
          updated_at = NOW()
        WHERE id = ${current.customer_avatar_id}
      `;
    }

    return {
      success: true,
      recommendation_id: input.recommendation_id,
      new_status: input.status,
      was_successful: wasSuccessful,
      message: 'Recommendation status updated',
      side_effects: {
        customer_scores_updated: wasSuccessful,
      },
    };
  },
};

// ============================================================================
// TOOL 5.3: complete_daily_plan
// ============================================================================

export const completeDailyPlanTool: AgentTool = {
  name: 'complete_daily_plan',
  description:
    'Close out a daily action plan with actual results and calculate effectiveness.',
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
      actual_orders: {
        type: 'number',
        description: 'Actual orders generated',
      },
      actual_revenue: {
        type: 'number',
        description: 'Actual revenue generated',
      },
      actual_visits: {
        type: 'number',
        description: 'Actual visits completed',
      },
      actions_completed: {
        type: 'number',
        description: 'Number of planned actions completed',
      },
    },
    required: ['salesperson_id', 'actual_orders', 'actual_revenue', 'actual_visits', 'actions_completed'],
  },
  handler: async (input: {
    salesperson_id: number;
    date?: string;
    actual_orders: number;
    actual_revenue: number;
    actual_visits: number;
    actions_completed: number;
  }) => {
    console.log('🔍 complete_daily_plan', input);

    const date = input.date || new Date().toISOString().split('T')[0];

    // Get plan
    const planResult = await sql`
      SELECT * FROM daily_action_plans
      WHERE salesperson_id = ${input.salesperson_id}
        AND plan_date = ${date}
      LIMIT 1
    `;

    if (planResult.rows.length === 0) {
      throw new Error('Daily plan not found');
    }

    const plan = planResult.rows[0];

    // Calculate completion rate and variance
    const completionRate = plan.total_actions > 0 ? input.actions_completed / plan.total_actions : 0;
    const revenueVariance = input.actual_revenue - parseFloat(plan.estimated_revenue);
    const ordersVariance = input.actual_orders - plan.estimated_orders;

    // Calculate effectiveness score (0-1)
    const revenueScore = parseFloat(plan.estimated_revenue) > 0 ? Math.min(1, input.actual_revenue / parseFloat(plan.estimated_revenue)) : 0;
    const completionScore = completionRate;
    const effectivenessScore = (revenueScore * 0.6) + (completionScore * 0.4);

    // Update plan
    const result = await sql`
      UPDATE daily_action_plans
      SET
        status = 'completed',
        actual_orders = ${input.actual_orders},
        actual_revenue = ${input.actual_revenue},
        actual_visits = ${input.actual_visits},
        actions_completed = ${input.actions_completed},
        completion_rate = ${completionRate},
        plan_effectiveness_score = ${effectivenessScore},
        variance_analysis = ${JSON.stringify({
          revenue_variance: revenueVariance,
          orders_variance: ordersVariance,
          completion_rate: completionRate,
        })},
        completed_at = NOW()
      WHERE id = ${plan.id}
      RETURNING *
    `;

    return {
      success: true,
      plan_id: plan.id,
      date,
      salesperson_id: input.salesperson_id,
      results: {
        completion_rate: (completionRate * 100).toFixed(1) + '%',
        effectiveness_score: (effectivenessScore * 100).toFixed(1) + '%',
        revenue_vs_estimate: revenueVariance >= 0 ? `+€${revenueVariance}` : `-€${Math.abs(revenueVariance)}`,
        orders_vs_estimate: ordersVariance >= 0 ? `+${ordersVariance}` : `${ordersVariance}`,
      },
      message: 'Daily plan completed successfully',
    };
  },
};

// ============================================================================
// TOOL 5.4: quick_log
// ============================================================================

export const quickLogTool: AgentTool = {
  name: 'quick_log',
  description:
    'Quick way to log an interaction from natural language. Parses message like "Visited Bar Centrale, ordered €250".',
  input_schema: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'Natural language message describing the interaction',
      },
      salesperson_id: {
        type: 'number',
        description: 'Salesperson ID',
      },
    },
    required: ['message', 'salesperson_id'],
  },
  handler: async (input: { message: string; salesperson_id: number }) => {
    console.log('🔍 quick_log', input);

    const msg = input.message.toLowerCase();

    // Parse interaction type
    let interactionType = 'other';
    if (msg.includes('visit') || msg.includes('visitato')) {
      interactionType = 'visit';
    } else if (msg.includes('call') || msg.includes('chiamat')) {
      interactionType = 'call';
    } else if (msg.includes('email') || msg.includes('inviato')) {
      interactionType = 'email';
    }

    // Parse customer name (look for capital words or "Bar", "Ristorante", "Trattoria")
    const customerNameMatch = input.message.match(/(Bar|Ristorante|Trattoria|Hotel|Pizzeria)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
    const customerName = customerNameMatch ? customerNameMatch[0] : null;

    if (!customerName) {
      return {
        success: false,
        error: 'Could not parse customer name from message',
        message: 'Please include customer name (e.g., "Bar Centrale", "Ristorante Da Mario")',
      };
    }

    // Find customer
    const customerResult = await sql`
      SELECT id, name FROM customer_avatars
      WHERE name ILIKE ${`%${customerName}%`}
        AND is_active = true
      ORDER BY total_revenue DESC
      LIMIT 1
    `;

    if (customerResult.rows.length === 0) {
      return {
        success: false,
        error: `Customer "${customerName}" not found`,
      };
    }

    const customer = customerResult.rows[0];

    // Parse order amount
    const amountMatch = msg.match(/€?\s*(\d+(?:[.,]\d+)?)/);
    const orderAmount = amountMatch ? parseFloat(amountMatch[1].replace(',', '.')) : null;
    const orderPlaced = orderAmount !== null;

    // Determine outcome
    const outcome = orderPlaced || msg.includes('success') || msg.includes('ordinato') ? 'successful' : 'neutral';

    // Record interaction
    const result = await sql`
      INSERT INTO sales_interactions (
        customer_avatar_id,
        odoo_partner_id,
        salesperson_id,
        salesperson_name,
        interaction_type,
        interaction_date,
        outcome,
        notes,
        order_generated,
        order_amount
      ) VALUES (
        ${customer.id},
        (SELECT odoo_partner_id FROM customer_avatars WHERE id = ${customer.id}),
        ${input.salesperson_id},
        'Quick Log',
        ${interactionType},
        NOW(),
        ${outcome},
        ${input.message},
        ${orderPlaced},
        ${orderAmount}
      )
      RETURNING *
    `;

    return {
      success: true,
      interaction_id: result.rows[0].id,
      parsed: {
        customer_id: customer.id,
        customer_name: customer.name,
        interaction_type: interactionType,
        order_placed: orderPlaced,
        order_amount: orderAmount,
        outcome,
      },
      message: `Interaction logged: ${interactionType} with ${customer.name}` + (orderAmount ? ` (€${orderAmount})` : ''),
    };
  },
};

// ============================================================================
// EXPORT ALL TOOLS
// ============================================================================

export const actionExecutorTools: AgentTool[] = [
  recordInteractionTool,
  updateRecommendationStatusTool,
  completeDailyPlanTool,
  quickLogTool,
];
