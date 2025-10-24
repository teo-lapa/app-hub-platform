/**
 * CHURN ANALYSIS & CLV TOOLS
 * Tools for predicting customer churn and calculating lifetime value
 */

import { sql } from '@vercel/postgres';
import type { AgentTool } from '../types';

// ============================================================================
// TOOL: predict_churn_risk
// ============================================================================

/**
 * Churn Risk Prediction Interface
 */
interface ChurnRiskInput {
  customer_id: number;
  orders: Array<{
    order_date: Date;
    amount: number;
  }>;
  last_interaction_days: number;
}

interface ChurnRiskOutput {
  churn_score: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendation: string;
  factors: {
    recency_score: number;
    frequency_score: number;
    monetary_score: number;
    interaction_gap_score: number;
    order_interval_variance: number;
  };
}

export const predictChurnRiskTool: AgentTool = {
  name: 'predict_churn_risk',
  description:
    'Predict customer churn risk based on order history, recency, frequency, and interaction patterns. Returns a churn score (0-100) with risk level and actionable recommendations.',
  input_schema: {
    type: 'object',
    properties: {
      customer_id: {
        type: 'number',
        description: 'Customer avatar ID',
      },
      orders: {
        type: 'array',
        description: 'Array of customer orders with date and amount',
        items: {
          type: 'object',
          properties: {
            order_date: {
              type: 'string',
              description: 'Order date in ISO format',
            },
            amount: {
              type: 'number',
              description: 'Order amount',
            },
          },
        },
      },
      last_interaction_days: {
        type: 'number',
        description: 'Days since last interaction (visit, call, email)',
      },
    },
    required: ['customer_id', 'orders', 'last_interaction_days'],
  },
  handler: async (input: ChurnRiskInput): Promise<ChurnRiskOutput> => {
    console.log('🔍 predict_churn_risk', input);

    try {
      const { customer_id, orders, last_interaction_days } = input;

      // Validate input
      if (orders.length === 0) {
        return {
          churn_score: 100,
          risk_level: 'HIGH',
          recommendation: 'Customer has no order history. Immediate re-engagement required.',
          factors: {
            recency_score: 100,
            frequency_score: 100,
            monetary_score: 0,
            interaction_gap_score: 100,
            order_interval_variance: 0,
          },
        };
      }

      // Sort orders by date
      const sortedOrders = [...orders].sort(
        (a, b) => new Date(a.order_date).getTime() - new Date(b.order_date).getTime()
      );

      // Calculate recency score (0-100, higher = worse)
      const lastOrderDate = new Date(sortedOrders[sortedOrders.length - 1].order_date);
      const daysSinceLastOrder = Math.floor(
        (Date.now() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Recency scoring: 0-30 days = 0, 30-60 = 25, 60-90 = 50, 90-120 = 75, 120+ = 100
      let recencyScore = 0;
      if (daysSinceLastOrder > 120) recencyScore = 100;
      else if (daysSinceLastOrder > 90) recencyScore = 75;
      else if (daysSinceLastOrder > 60) recencyScore = 50;
      else if (daysSinceLastOrder > 30) recencyScore = 25;

      // Calculate frequency score (0-100, higher = worse)
      const totalOrders = orders.length;
      const customerAgeDays = Math.floor(
        (lastOrderDate.getTime() - new Date(sortedOrders[0].order_date).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      const avgOrderIntervalDays = customerAgeDays > 0 ? customerAgeDays / totalOrders : 0;

      // Frequency scoring: <15 days = 0, 15-30 = 20, 30-60 = 40, 60-90 = 70, 90+ = 100
      let frequencyScore = 0;
      if (avgOrderIntervalDays > 90) frequencyScore = 100;
      else if (avgOrderIntervalDays > 60) frequencyScore = 70;
      else if (avgOrderIntervalDays > 30) frequencyScore = 40;
      else if (avgOrderIntervalDays > 15) frequencyScore = 20;

      // Calculate monetary score (0-100, higher = worse)
      const totalRevenue = orders.reduce((sum, order) => sum + order.amount, 0);
      const avgOrderValue = totalRevenue / totalOrders;

      // Get last 3 orders average vs overall average
      const last3Orders = sortedOrders.slice(-3);
      const last3Avg = last3Orders.reduce((sum, o) => sum + o.amount, 0) / last3Orders.length;
      const monetaryTrend = avgOrderValue > 0 ? (last3Avg / avgOrderValue) : 1;

      // Monetary scoring: increasing = 0, stable = 30, decreasing = 60-100
      let monetaryScore = 0;
      if (monetaryTrend < 0.7) monetaryScore = 100;
      else if (monetaryTrend < 0.85) monetaryScore = 70;
      else if (monetaryTrend < 1.0) monetaryScore = 40;
      else if (monetaryTrend < 1.15) monetaryScore = 20;

      // Calculate interaction gap score (0-100, higher = worse)
      // Days since last interaction vs average order interval
      let interactionGapScore = 0;
      if (avgOrderIntervalDays > 0) {
        const gapRatio = last_interaction_days / avgOrderIntervalDays;
        if (gapRatio > 3) interactionGapScore = 100;
        else if (gapRatio > 2) interactionGapScore = 80;
        else if (gapRatio > 1.5) interactionGapScore = 60;
        else if (gapRatio > 1) interactionGapScore = 30;
      } else {
        // No order history pattern, use absolute days
        if (last_interaction_days > 90) interactionGapScore = 100;
        else if (last_interaction_days > 60) interactionGapScore = 70;
        else if (last_interaction_days > 30) interactionGapScore = 40;
        else if (last_interaction_days > 15) interactionGapScore = 20;
      }

      // Calculate order interval variance (consistency indicator)
      let orderIntervalVariance = 0;
      if (sortedOrders.length > 1) {
        const intervals: number[] = [];
        for (let i = 1; i < sortedOrders.length; i++) {
          const interval = Math.floor(
            (new Date(sortedOrders[i].order_date).getTime() -
              new Date(sortedOrders[i - 1].order_date).getTime()) /
              (1000 * 60 * 60 * 24)
          );
          intervals.push(interval);
        }

        const avgInterval = intervals.reduce((sum, i) => sum + i, 0) / intervals.length;
        const variance = intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length;
        const stdDev = Math.sqrt(variance);
        orderIntervalVariance = avgInterval > 0 ? (stdDev / avgInterval) * 100 : 0;
      }

      // Calculate final churn score (weighted average)
      const churnScore = Math.round(
        recencyScore * 0.35 +
        frequencyScore * 0.25 +
        monetaryScore * 0.20 +
        interactionGapScore * 0.20
      );

      // Determine risk level
      let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
      if (churnScore >= 70) riskLevel = 'HIGH';
      else if (churnScore >= 40) riskLevel = 'MEDIUM';
      else riskLevel = 'LOW';

      // Generate recommendation
      let recommendation = '';
      if (riskLevel === 'HIGH') {
        recommendation = `URGENT: Customer has ${daysSinceLastOrder} days since last order and ${last_interaction_days} days since last contact. Immediate re-engagement required with personalized offer.`;
      } else if (riskLevel === 'MEDIUM') {
        recommendation = `Customer showing early churn signals. Schedule proactive check-in within next 7 days. Consider loyalty incentive or new product introduction.`;
      } else {
        recommendation = `Customer is healthy. Maintain regular contact schedule and continue nurturing relationship.`;
      }

      return {
        churn_score: churnScore,
        risk_level: riskLevel,
        recommendation,
        factors: {
          recency_score: Math.round(recencyScore),
          frequency_score: Math.round(frequencyScore),
          monetary_score: Math.round(monetaryScore),
          interaction_gap_score: Math.round(interactionGapScore),
          order_interval_variance: Math.round(orderIntervalVariance * 100) / 100,
        },
      };
    } catch (error) {
      console.error('Error in predict_churn_risk:', error);
      throw new Error(`Failed to predict churn risk: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
};

// ============================================================================
// TOOL: calculate_customer_lifetime_value
// ============================================================================

/**
 * Customer Lifetime Value Calculation Interface
 */
interface CLVInput {
  orders: Array<{
    order_date: Date;
    amount: number;
  }>;
  customer_age_months: number;
}

interface CLVOutput {
  clv: number;
  avg_order_value: number;
  purchase_frequency: number;
  estimated_lifetime_months: number;
}

export const calculateCustomerLifetimeValueTool: AgentTool = {
  name: 'calculate_customer_lifetime_value',
  description:
    'Calculate Customer Lifetime Value (CLV) based on historical orders and customer relationship age. Returns CLV, average order value, purchase frequency, and estimated lifetime.',
  input_schema: {
    type: 'object',
    properties: {
      orders: {
        type: 'array',
        description: 'Array of customer orders with date and amount',
        items: {
          type: 'object',
          properties: {
            order_date: {
              type: 'string',
              description: 'Order date in ISO format',
            },
            amount: {
              type: 'number',
              description: 'Order amount',
            },
          },
        },
      },
      customer_age_months: {
        type: 'number',
        description: 'Number of months since customer first purchase',
      },
    },
    required: ['orders', 'customer_age_months'],
  },
  handler: async (input: CLVInput): Promise<CLVOutput> => {
    console.log('🔍 calculate_customer_lifetime_value', input);

    try {
      const { orders, customer_age_months } = input;

      // Validate input
      if (orders.length === 0 || customer_age_months <= 0) {
        return {
          clv: 0,
          avg_order_value: 0,
          purchase_frequency: 0,
          estimated_lifetime_months: 0,
        };
      }

      // Calculate average order value
      const totalRevenue = orders.reduce((sum, order) => sum + order.amount, 0);
      const avgOrderValue = totalRevenue / orders.length;

      // Calculate purchase frequency (orders per month)
      const purchaseFrequency = orders.length / customer_age_months;

      // Calculate customer value per month
      const customerValuePerMonth = avgOrderValue * purchaseFrequency;

      // Estimate customer lifetime based on order pattern
      // Using industry standard: 3-5 years for B2B, adjusting based on frequency
      let estimatedLifetimeMonths = 36; // Default: 3 years

      if (purchaseFrequency >= 4) {
        // Very frequent (weekly+): 5 years
        estimatedLifetimeMonths = 60;
      } else if (purchaseFrequency >= 1) {
        // Frequent (monthly): 4 years
        estimatedLifetimeMonths = 48;
      } else if (purchaseFrequency >= 0.25) {
        // Regular (quarterly): 3 years
        estimatedLifetimeMonths = 36;
      } else {
        // Infrequent: 2 years
        estimatedLifetimeMonths = 24;
      }

      // Adjust based on trend
      if (orders.length >= 3) {
        const sortedOrders = [...orders].sort(
          (a, b) => new Date(a.order_date).getTime() - new Date(b.order_date).getTime()
        );

        const firstHalf = sortedOrders.slice(0, Math.floor(sortedOrders.length / 2));
        const secondHalf = sortedOrders.slice(Math.floor(sortedOrders.length / 2));

        const firstHalfAvg = firstHalf.reduce((sum, o) => sum + o.amount, 0) / firstHalf.length;
        const secondHalfAvg = secondHalf.reduce((sum, o) => sum + o.amount, 0) / secondHalf.length;

        if (secondHalfAvg > firstHalfAvg * 1.2) {
          // Growing customer, increase lifetime estimate by 25%
          estimatedLifetimeMonths *= 1.25;
        } else if (secondHalfAvg < firstHalfAvg * 0.8) {
          // Declining customer, decrease lifetime estimate by 25%
          estimatedLifetimeMonths *= 0.75;
        }
      }

      // Calculate CLV
      const clv = customerValuePerMonth * estimatedLifetimeMonths;

      return {
        clv: Math.round(clv * 100) / 100,
        avg_order_value: Math.round(avgOrderValue * 100) / 100,
        purchase_frequency: Math.round(purchaseFrequency * 100) / 100,
        estimated_lifetime_months: Math.round(estimatedLifetimeMonths),
      };
    } catch (error) {
      console.error('Error in calculate_customer_lifetime_value:', error);
      throw new Error(`Failed to calculate CLV: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
};

// ============================================================================
// EXPORT ALL TOOLS
// ============================================================================

export const churnTools: AgentTool[] = [
  predictChurnRiskTool,
  calculateCustomerLifetimeValueTool,
];

/**
 * Execute a churn tool call
 */
export async function executeChurnToolCall(toolName: string, input: any): Promise<any> {
  const tool = churnTools.find((t) => t.name === toolName);
  if (!tool) {
    throw new Error(`Tool ${toolName} not found in churn tools`);
  }
  return await tool.handler(input);
}
