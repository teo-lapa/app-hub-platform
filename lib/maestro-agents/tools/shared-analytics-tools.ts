/**
 * SHARED ANALYTICS TOOLS
 * Mathematical and analytical tools used across multiple agents
 * These tools provide foundational capabilities for data analysis, forecasting, and calculations
 */

import type { AgentTool } from '../types';

/**
 * MATH TOOLS
 * Basic mathematical operations, statistics, and calculations
 */
export const MATH_TOOLS: AgentTool[] = [
  {
    name: 'calculate_percentage_change',
    description: 'Calculate percentage change between two values (e.g., revenue growth)',
    input_schema: {
      type: 'object',
      properties: {
        old_value: {
          type: 'number',
          description: 'Previous value',
        },
        new_value: {
          type: 'number',
          description: 'New value',
        },
      },
      required: ['old_value', 'new_value'],
    },
    handler: async (input: { old_value: number; new_value: number }) => {
      const { old_value, new_value } = input;

      if (old_value === 0) {
        return {
          percentage_change: new_value > 0 ? 100 : 0,
          absolute_change: new_value,
          direction: new_value > 0 ? 'increase' : 'no_change',
        };
      }

      const change = ((new_value - old_value) / old_value) * 100;

      return {
        percentage_change: Math.round(change * 100) / 100,
        absolute_change: new_value - old_value,
        direction: change > 0 ? 'increase' : change < 0 ? 'decrease' : 'no_change',
      };
    },
  },
  {
    name: 'calculate_average',
    description: 'Calculate mean (average) of a list of numbers',
    input_schema: {
      type: 'object',
      properties: {
        values: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of numbers to average',
        },
      },
      required: ['values'],
    },
    handler: async (input: { values: number[] }) => {
      const { values } = input;

      if (values.length === 0) {
        return { average: 0, count: 0 };
      }

      const sum = values.reduce((acc, val) => acc + val, 0);
      const average = sum / values.length;

      return {
        average: Math.round(average * 100) / 100,
        sum,
        count: values.length,
        min: Math.min(...values),
        max: Math.max(...values),
      };
    },
  },
  {
    name: 'calculate_standard_deviation',
    description: 'Calculate standard deviation and variance of a dataset',
    input_schema: {
      type: 'object',
      properties: {
        values: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of numbers',
        },
      },
      required: ['values'],
    },
    handler: async (input: { values: number[] }) => {
      const { values } = input;

      if (values.length === 0) {
        return { std_dev: 0, variance: 0, mean: 0 };
      }

      const mean = values.reduce((acc, val) => acc + val, 0) / values.length;
      const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
      const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / values.length;
      const stdDev = Math.sqrt(variance);

      return {
        std_dev: Math.round(stdDev * 100) / 100,
        variance: Math.round(variance * 100) / 100,
        mean: Math.round(mean * 100) / 100,
        coefficient_of_variation: mean !== 0 ? Math.round((stdDev / mean) * 10000) / 100 : 0,
      };
    },
  },
  {
    name: 'calculate_percentile',
    description: 'Calculate percentile value from a dataset (e.g., 90th percentile)',
    input_schema: {
      type: 'object',
      properties: {
        values: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of numbers',
        },
        percentile: {
          type: 'number',
          description: 'Percentile to calculate (0-100)',
        },
      },
      required: ['values', 'percentile'],
    },
    handler: async (input: { values: number[]; percentile: number }) => {
      const { values, percentile } = input;

      if (values.length === 0) {
        return { value: 0, percentile };
      }

      const sorted = [...values].sort((a, b) => a - b);
      const index = Math.ceil((percentile / 100) * sorted.length) - 1;

      return {
        value: sorted[Math.max(0, index)],
        percentile,
        position: index + 1,
        total_count: values.length,
      };
    },
  },
];

/**
 * ANALYTICS TOOLS
 * Data aggregation, grouping, and analytical operations
 */
export const ANALYTICS_TOOLS: AgentTool[] = [
  {
    name: 'calculate_trend',
    description: 'Calculate trend direction and velocity from time series data',
    input_schema: {
      type: 'object',
      properties: {
        values: {
          type: 'array',
          items: { type: 'number' },
          description: 'Time series values in chronological order',
        },
        periods: {
          type: 'number',
          description: 'Number of periods for trend calculation (default: all)',
        },
      },
      required: ['values'],
    },
    handler: async (input: { values: number[]; periods?: number }) => {
      const { values, periods } = input;

      if (values.length < 2) {
        return {
          trend: 'insufficient_data',
          slope: 0,
          direction: 'neutral',
        };
      }

      // Use recent periods if specified
      const data = periods ? values.slice(-periods) : values;

      // Simple linear regression
      const n = data.length;
      const indices = Array.from({ length: n }, (_, i) => i);

      const sumX = indices.reduce((a, b) => a + b, 0);
      const sumY = data.reduce((a, b) => a + b, 0);
      const sumXY = indices.reduce((sum, x, i) => sum + x * data[i], 0);
      const sumXX = indices.reduce((sum, x) => sum + x * x, 0);

      const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;

      // Calculate R-squared
      const meanY = sumY / n;
      const ssTotal = data.reduce((sum, y) => sum + Math.pow(y - meanY, 2), 0);
      const ssResidual = data.reduce((sum, y, i) => {
        const predicted = slope * i + intercept;
        return sum + Math.pow(y - predicted, 2);
      }, 0);
      const rSquared = 1 - (ssResidual / ssTotal);

      return {
        trend: slope > 0.1 ? 'increasing' : slope < -0.1 ? 'decreasing' : 'stable',
        slope: Math.round(slope * 1000) / 1000,
        intercept: Math.round(intercept * 100) / 100,
        r_squared: Math.round(rSquared * 1000) / 1000,
        direction: slope > 0 ? 'upward' : slope < 0 ? 'downward' : 'neutral',
        strength: Math.abs(rSquared) > 0.7 ? 'strong' : Math.abs(rSquared) > 0.4 ? 'moderate' : 'weak',
      };
    },
  },
  {
    name: 'group_by_range',
    description: 'Group numerical values into ranges/buckets for distribution analysis',
    input_schema: {
      type: 'object',
      properties: {
        values: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of numbers to group',
        },
        bucket_size: {
          type: 'number',
          description: 'Size of each bucket/range',
        },
      },
      required: ['values', 'bucket_size'],
    },
    handler: async (input: { values: number[]; bucket_size: number }) => {
      const { values, bucket_size } = input;

      if (values.length === 0) {
        return { buckets: [] };
      }

      const min = Math.min(...values);
      const max = Math.max(...values);
      const buckets: { range: string; min: number; max: number; count: number; percentage: number }[] = [];

      for (let i = min; i <= max; i += bucket_size) {
        const bucketMin = i;
        const bucketMax = i + bucket_size;
        const count = values.filter(v => v >= bucketMin && v < bucketMax).length;

        if (count > 0) {
          buckets.push({
            range: `${bucketMin}-${bucketMax}`,
            min: bucketMin,
            max: bucketMax,
            count,
            percentage: Math.round((count / values.length) * 10000) / 100,
          });
        }
      }

      return { buckets, total_values: values.length };
    },
  },
  {
    name: 'calculate_correlation',
    description: 'Calculate correlation coefficient between two datasets',
    input_schema: {
      type: 'object',
      properties: {
        dataset_x: {
          type: 'array',
          items: { type: 'number' },
          description: 'First dataset',
        },
        dataset_y: {
          type: 'array',
          items: { type: 'number' },
          description: 'Second dataset (must be same length as dataset_x)',
        },
      },
      required: ['dataset_x', 'dataset_y'],
    },
    handler: async (input: { dataset_x: number[]; dataset_y: number[] }) => {
      const { dataset_x, dataset_y } = input;

      if (dataset_x.length !== dataset_y.length || dataset_x.length === 0) {
        return {
          correlation: 0,
          error: 'Datasets must be same length and non-empty',
        };
      }

      const n = dataset_x.length;
      const meanX = dataset_x.reduce((a, b) => a + b, 0) / n;
      const meanY = dataset_y.reduce((a, b) => a + b, 0) / n;

      let numerator = 0;
      let denomX = 0;
      let denomY = 0;

      for (let i = 0; i < n; i++) {
        const diffX = dataset_x[i] - meanX;
        const diffY = dataset_y[i] - meanY;
        numerator += diffX * diffY;
        denomX += diffX * diffX;
        denomY += diffY * diffY;
      }

      const correlation = numerator / Math.sqrt(denomX * denomY);

      return {
        correlation: Math.round(correlation * 1000) / 1000,
        strength: Math.abs(correlation) > 0.7 ? 'strong' : Math.abs(correlation) > 0.4 ? 'moderate' : 'weak',
        direction: correlation > 0 ? 'positive' : correlation < 0 ? 'negative' : 'none',
      };
    },
  },
];

/**
 * FORECASTING TOOLS
 * Prediction, extrapolation, and time series forecasting
 */
export const FORECASTING_TOOLS: AgentTool[] = [
  {
    name: 'simple_moving_average',
    description: 'Calculate simple moving average for smoothing and short-term forecasting',
    input_schema: {
      type: 'object',
      properties: {
        values: {
          type: 'array',
          items: { type: 'number' },
          description: 'Time series values',
        },
        window: {
          type: 'number',
          description: 'Number of periods for moving average (e.g., 3, 7, 30)',
        },
      },
      required: ['values', 'window'],
    },
    handler: async (input: { values: number[]; window: number }) => {
      const { values, window } = input;

      if (values.length < window) {
        return {
          error: 'Not enough data points for specified window',
          required: window,
          available: values.length,
        };
      }

      const movingAverages: number[] = [];

      for (let i = window - 1; i < values.length; i++) {
        const windowValues = values.slice(i - window + 1, i + 1);
        const avg = windowValues.reduce((a, b) => a + b, 0) / window;
        movingAverages.push(Math.round(avg * 100) / 100);
      }

      return {
        moving_averages: movingAverages,
        latest_ma: movingAverages[movingAverages.length - 1],
        window,
        original_count: values.length,
        ma_count: movingAverages.length,
      };
    },
  },
  {
    name: 'exponential_smoothing',
    description: 'Calculate exponential smoothing for weighted forecasting (recent data weighted more)',
    input_schema: {
      type: 'object',
      properties: {
        values: {
          type: 'array',
          items: { type: 'number' },
          description: 'Time series values',
        },
        alpha: {
          type: 'number',
          description: 'Smoothing factor (0-1, default 0.3). Higher = more weight on recent data',
        },
      },
      required: ['values'],
    },
    handler: async (input: { values: number[]; alpha?: number }) => {
      const { values, alpha = 0.3 } = input;

      if (values.length === 0) {
        return { smoothed_values: [], forecast: 0 };
      }

      const smoothed: number[] = [values[0]];

      for (let i = 1; i < values.length; i++) {
        const smoothedValue = alpha * values[i] + (1 - alpha) * smoothed[i - 1];
        smoothed.push(Math.round(smoothedValue * 100) / 100);
      }

      return {
        smoothed_values: smoothed,
        forecast: smoothed[smoothed.length - 1],
        alpha,
        original_count: values.length,
      };
    },
  },
  {
    name: 'linear_forecast',
    description: 'Forecast future values using linear regression',
    input_schema: {
      type: 'object',
      properties: {
        values: {
          type: 'array',
          items: { type: 'number' },
          description: 'Historical time series values',
        },
        periods_ahead: {
          type: 'number',
          description: 'Number of periods to forecast into the future',
        },
      },
      required: ['values', 'periods_ahead'],
    },
    handler: async (input: { values: number[]; periods_ahead: number }) => {
      const { values, periods_ahead } = input;

      if (values.length < 2) {
        return {
          error: 'Need at least 2 historical data points',
          available: values.length,
        };
      }

      // Linear regression
      const n = values.length;
      const indices = Array.from({ length: n }, (_, i) => i);

      const sumX = indices.reduce((a, b) => a + b, 0);
      const sumY = values.reduce((a, b) => a + b, 0);
      const sumXY = indices.reduce((sum, x, i) => sum + x * values[i], 0);
      const sumXX = indices.reduce((sum, x) => sum + x * x, 0);

      const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;

      // Generate forecasts
      const forecasts: { period: number; value: number }[] = [];

      for (let i = 1; i <= periods_ahead; i++) {
        const futureIndex = n + i - 1;
        const forecastValue = slope * futureIndex + intercept;
        forecasts.push({
          period: i,
          value: Math.round(forecastValue * 100) / 100,
        });
      }

      return {
        forecasts,
        slope: Math.round(slope * 1000) / 1000,
        intercept: Math.round(intercept * 100) / 100,
        trend: slope > 0 ? 'increasing' : slope < 0 ? 'decreasing' : 'stable',
        historical_periods: n,
      };
    },
  },
];

/**
 * CHURN TOOLS
 * Customer retention and churn prediction utilities
 */
export const CHURN_TOOLS: AgentTool[] = [
  {
    name: 'calculate_churn_probability',
    description: 'Calculate churn probability based on engagement metrics',
    input_schema: {
      type: 'object',
      properties: {
        days_since_last_order: {
          type: 'number',
          description: 'Days since customer last ordered',
        },
        avg_order_frequency: {
          type: 'number',
          description: 'Average days between orders (historical)',
        },
        engagement_score: {
          type: 'number',
          description: 'Engagement score 0-100 (from interactions, responses, etc.)',
        },
        revenue_trend: {
          type: 'string',
          enum: ['increasing', 'stable', 'decreasing'],
          description: 'Recent revenue trend',
        },
      },
      required: ['days_since_last_order', 'avg_order_frequency'],
    },
    handler: async (input: {
      days_since_last_order: number;
      avg_order_frequency: number;
      engagement_score?: number;
      revenue_trend?: 'increasing' | 'stable' | 'decreasing';
    }) => {
      const {
        days_since_last_order,
        avg_order_frequency,
        engagement_score = 50,
        revenue_trend = 'stable',
      } = input;

      // Calculate base churn score
      let churnScore = 0;

      // Factor 1: Time since last order vs. average frequency
      const expectedOrderRatio = days_since_last_order / avg_order_frequency;
      if (expectedOrderRatio > 2) {
        churnScore += 40; // Very overdue
      } else if (expectedOrderRatio > 1.5) {
        churnScore += 30; // Overdue
      } else if (expectedOrderRatio > 1.2) {
        churnScore += 20; // Slightly overdue
      } else if (expectedOrderRatio > 1) {
        churnScore += 10; // On time
      }

      // Factor 2: Engagement score (inverted)
      churnScore += (100 - engagement_score) * 0.3;

      // Factor 3: Revenue trend
      if (revenue_trend === 'decreasing') {
        churnScore += 20;
      } else if (revenue_trend === 'stable') {
        churnScore += 5;
      }

      // Normalize to 0-100
      churnScore = Math.min(100, Math.max(0, churnScore));

      return {
        churn_probability: Math.round(churnScore),
        risk_level: churnScore > 70 ? 'high' : churnScore > 40 ? 'medium' : 'low',
        days_overdue: Math.max(0, days_since_last_order - avg_order_frequency),
        expected_order_ratio: Math.round(expectedOrderRatio * 100) / 100,
        factors: {
          time_factor: expectedOrderRatio > 1,
          engagement_factor: engagement_score < 50,
          revenue_factor: revenue_trend === 'decreasing',
        },
      };
    },
  },
  {
    name: 'calculate_customer_lifetime_value',
    description: 'Calculate predicted customer lifetime value (CLV)',
    input_schema: {
      type: 'object',
      properties: {
        avg_order_value: {
          type: 'number',
          description: 'Average order value',
        },
        order_frequency_per_year: {
          type: 'number',
          description: 'Number of orders per year',
        },
        avg_customer_lifespan_years: {
          type: 'number',
          description: 'Expected customer lifespan in years (default: 3)',
        },
        profit_margin: {
          type: 'number',
          description: 'Profit margin as percentage (default: 20)',
        },
      },
      required: ['avg_order_value', 'order_frequency_per_year'],
    },
    handler: async (input: {
      avg_order_value: number;
      order_frequency_per_year: number;
      avg_customer_lifespan_years?: number;
      profit_margin?: number;
    }) => {
      const {
        avg_order_value,
        order_frequency_per_year,
        avg_customer_lifespan_years = 3,
        profit_margin = 20,
      } = input;

      const annualValue = avg_order_value * order_frequency_per_year;
      const lifetimeValue = annualValue * avg_customer_lifespan_years;
      const lifetimeProfit = lifetimeValue * (profit_margin / 100);

      return {
        customer_lifetime_value: Math.round(lifetimeValue * 100) / 100,
        lifetime_profit: Math.round(lifetimeProfit * 100) / 100,
        annual_value: Math.round(annualValue * 100) / 100,
        monthly_value: Math.round((annualValue / 12) * 100) / 100,
        total_orders_expected: Math.round(order_frequency_per_year * avg_customer_lifespan_years),
        value_per_order: avg_order_value,
      };
    },
  },
  {
    name: 'calculate_retention_rate',
    description: 'Calculate customer retention rate over time',
    input_schema: {
      type: 'object',
      properties: {
        customers_at_start: {
          type: 'number',
          description: 'Number of customers at start of period',
        },
        customers_at_end: {
          type: 'number',
          description: 'Number of customers at end of period',
        },
        new_customers: {
          type: 'number',
          description: 'New customers acquired during period',
        },
      },
      required: ['customers_at_start', 'customers_at_end', 'new_customers'],
    },
    handler: async (input: {
      customers_at_start: number;
      customers_at_end: number;
      new_customers: number;
    }) => {
      const { customers_at_start, customers_at_end, new_customers } = input;

      const retainedCustomers = customers_at_end - new_customers;
      const retentionRate = (retainedCustomers / customers_at_start) * 100;
      const churnRate = 100 - retentionRate;
      const churnedCustomers = customers_at_start - retainedCustomers;

      return {
        retention_rate: Math.round(retentionRate * 100) / 100,
        churn_rate: Math.round(churnRate * 100) / 100,
        retained_customers: retainedCustomers,
        churned_customers: churnedCustomers,
        growth_rate: Math.round(((customers_at_end - customers_at_start) / customers_at_start) * 10000) / 100,
      };
    },
  },
];

/**
 * Export all tools as a combined array for convenience
 */
export const ALL_ANALYTICS_TOOLS = [
  ...MATH_TOOLS,
  ...ANALYTICS_TOOLS,
  ...FORECASTING_TOOLS,
  ...CHURN_TOOLS,
];
