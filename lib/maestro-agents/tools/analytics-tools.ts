/**
 * ANALYTICS TOOLS
 * Advanced analytics tools for Agent 5: Analytics & Math Agent
 * Provides RFM analysis, anomaly detection, and growth rate calculations
 */

import type { AgentTool } from '../types';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface Order {
  order_date: Date | string;
  order_amount: number;
  customer_id?: number;
}

interface RFMScore {
  r_score: number; // Recency score (1-5)
  f_score: number; // Frequency score (1-5)
  m_score: number; // Monetary score (1-5)
  rfm_score: number; // Combined RFM score (111-555)
  segment: string; // Customer segment classification
  details: {
    recency_days: number;
    frequency_count: number;
    monetary_value: number;
    percentile_r: number;
    percentile_f: number;
    percentile_m: number;
  };
}

interface Anomaly {
  index: number;
  value: number;
  deviation: number;
  z_score: number;
  is_anomaly: boolean;
  severity: 'low' | 'medium' | 'high';
}

interface GrowthRate {
  growth_rate: number; // Absolute growth
  growth_percentage: number; // Percentage growth
  trend: 'increasing' | 'decreasing' | 'stable';
  change_magnitude: 'significant' | 'moderate' | 'minimal';
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate percentile rank for a value in a dataset
 */
function calculatePercentile(value: number, sortedArray: number[]): number {
  const index = sortedArray.findIndex((v) => v >= value);
  if (index === -1) return 100;
  if (index === 0) return 0;
  return (index / sortedArray.length) * 100;
}

/**
 * Calculate mean (average) of an array
 */
function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate standard deviation
 */
function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = calculateMean(values);
  const squareDiffs = values.map((value) => Math.pow(value - mean, 2));
  const avgSquareDiff = calculateMean(squareDiffs);
  return Math.sqrt(avgSquareDiff);
}

/**
 * Assign RFM segment based on scores
 */
function assignRFMSegment(r: number, f: number, m: number): string {
  // Champions: High R, F, M
  if (r >= 4 && f >= 4 && m >= 4) return 'Champions';

  // Loyal Customers: High F and M, moderate R
  if (f >= 4 && m >= 4 && r >= 2) return 'Loyal Customers';

  // Potential Loyalists: Recent customers with moderate frequency
  if (r >= 4 && f >= 2 && f <= 3) return 'Potential Loyalists';

  // Recent Customers: High R, low F and M
  if (r >= 4 && f <= 2 && m <= 2) return 'Recent Customers';

  // Promising: Recent with moderate-high spend
  if (r >= 3 && m >= 3) return 'Promising';

  // Need Attention: Above average R, F, M
  if (r >= 3 && f >= 3 && m >= 3) return 'Need Attention';

  // About to Sleep: Below average R, above average F and M
  if (r <= 2 && f >= 3 && m >= 3) return 'About to Sleep';

  // At Risk: Low R, high F and M (were valuable)
  if (r <= 2 && f >= 4 && m >= 4) return 'At Risk';

  // Cannot Lose Them: Very low R, very high F and M
  if (r === 1 && f >= 4 && m >= 4) return 'Cannot Lose Them';

  // Hibernating: Low R, F, M
  if (r <= 2 && f <= 2 && m <= 2) return 'Hibernating';

  // Lost: Lowest R, low F and M
  if (r === 1 && f <= 2) return 'Lost';

  // Default
  return 'Need Attention';
}

// ============================================================================
// TOOL 5.1: calculate_rfm_score
// ============================================================================

export const calculateRFMScoreTool: AgentTool = {
  name: 'calculate_rfm_score',
  description:
    'Calculate RFM (Recency, Frequency, Monetary) score from customer orders. Returns detailed RFM scores (1-5 scale), percentile rankings, and customer segment classification (Champions, Loyal, At Risk, Lost, etc). Essential for customer segmentation and targeting strategies.',
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
              description: 'Order date in ISO format or Date object',
            },
            order_amount: {
              type: 'number',
              description: 'Order amount/value',
            },
          },
        },
      },
      reference_date: {
        type: 'string',
        description: 'Reference date for recency calculation (default: today)',
      },
    },
    required: ['orders'],
  },
  handler: async (input: { orders: Order[]; reference_date?: string }): Promise<RFMScore> => {
    console.log('📊 calculate_rfm_score', { order_count: input.orders.length });

    if (!input.orders || input.orders.length === 0) {
      throw new Error('At least one order is required to calculate RFM score');
    }

    // Parse reference date
    const referenceDate = input.reference_date ? new Date(input.reference_date) : new Date();

    // Parse and sort orders by date
    const parsedOrders = input.orders
      .map((order) => ({
        date: new Date(order.order_date),
        amount: order.order_amount,
      }))
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    // Calculate Recency (days since last order)
    const lastOrderDate = parsedOrders[0].date;
    const recencyDays = Math.floor(
      (referenceDate.getTime() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Calculate Frequency (total number of orders)
    const frequency = parsedOrders.length;

    // Calculate Monetary (total or average revenue)
    const monetary = parsedOrders.reduce((sum, order) => sum + order.amount, 0);

    // Create benchmark arrays for scoring (using quintiles)
    // For a single customer, we use industry standard thresholds
    let r_score: number;
    let f_score: number;
    let m_score: number;

    // Recency scoring (lower is better - more recent)
    if (recencyDays <= 30) r_score = 5;
    else if (recencyDays <= 60) r_score = 4;
    else if (recencyDays <= 90) r_score = 3;
    else if (recencyDays <= 180) r_score = 2;
    else r_score = 1;

    // Frequency scoring (higher is better - more orders)
    if (frequency >= 20) f_score = 5;
    else if (frequency >= 10) f_score = 4;
    else if (frequency >= 5) f_score = 3;
    else if (frequency >= 2) f_score = 2;
    else f_score = 1;

    // Monetary scoring (higher is better - more revenue)
    if (monetary >= 10000) m_score = 5;
    else if (monetary >= 5000) m_score = 4;
    else if (monetary >= 2000) m_score = 3;
    else if (monetary >= 500) m_score = 2;
    else m_score = 1;

    // Calculate percentiles (for single customer, these are approximations)
    const percentile_r = ((6 - r_score) / 5) * 100;
    const percentile_f = (f_score / 5) * 100;
    const percentile_m = (m_score / 5) * 100;

    // Combine RFM scores
    const rfm_score = parseInt(`${r_score}${f_score}${m_score}`);

    // Determine customer segment
    const segment = assignRFMSegment(r_score, f_score, m_score);

    return {
      r_score,
      f_score,
      m_score,
      rfm_score,
      segment,
      details: {
        recency_days: recencyDays,
        frequency_count: frequency,
        monetary_value: monetary,
        percentile_r,
        percentile_f,
        percentile_m,
      },
    };
  },
};

// ============================================================================
// TOOL 5.2: detect_anomalies
// ============================================================================

export const detectAnomaliesTool: AgentTool = {
  name: 'detect_anomalies',
  description:
    'Detect anomalies in sales or numeric data using statistical analysis (Z-score method). Identifies outliers and unusual patterns in time series data. Returns anomalies with deviation scores and severity levels.',
  input_schema: {
    type: 'object',
    properties: {
      values: {
        type: 'array',
        description: 'Array of numeric values to analyze (e.g., daily sales)',
        items: {
          type: 'number',
        },
      },
      threshold: {
        type: 'number',
        description: 'Z-score threshold for anomaly detection (default: 2.5, higher = stricter)',
      },
    },
    required: ['values'],
  },
  handler: async (input: {
    values: number[];
    threshold?: number;
  }): Promise<{ anomalies: Anomaly[]; statistics: any }> => {
    console.log('🔍 detect_anomalies', { value_count: input.values.length });

    if (!input.values || input.values.length < 3) {
      throw new Error('At least 3 data points are required for anomaly detection');
    }

    const threshold = input.threshold || 2.5;
    const values = input.values;

    // Calculate statistics
    const mean = calculateMean(values);
    const stdDev = calculateStdDev(values);

    if (stdDev === 0) {
      return {
        anomalies: [],
        statistics: {
          mean,
          std_dev: stdDev,
          threshold,
          message: 'No variance in data - all values are identical',
        },
      };
    }

    // Detect anomalies using Z-score method
    const anomalies: Anomaly[] = [];

    values.forEach((value, index) => {
      const deviation = value - mean;
      const z_score = deviation / stdDev;
      const abs_z_score = Math.abs(z_score);
      const is_anomaly = abs_z_score > threshold;

      // Determine severity
      let severity: 'low' | 'medium' | 'high';
      if (abs_z_score > threshold * 1.5) severity = 'high';
      else if (abs_z_score > threshold * 1.2) severity = 'medium';
      else severity = 'low';

      if (is_anomaly) {
        anomalies.push({
          index,
          value,
          deviation,
          z_score,
          is_anomaly,
          severity,
        });
      }
    });

    // Sort by severity and absolute z-score
    anomalies.sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[b.severity] - severityOrder[a.severity];
      }
      return Math.abs(b.z_score) - Math.abs(a.z_score);
    });

    return {
      anomalies,
      statistics: {
        total_data_points: values.length,
        anomalies_detected: anomalies.length,
        anomaly_rate: ((anomalies.length / values.length) * 100).toFixed(2) + '%',
        mean: parseFloat(mean.toFixed(2)),
        std_dev: parseFloat(stdDev.toFixed(2)),
        threshold,
        min_value: Math.min(...values),
        max_value: Math.max(...values),
      },
    };
  },
};

// ============================================================================
// TOOL 5.3: calculate_growth_rate
// ============================================================================

export const calculateGrowthRateTool: AgentTool = {
  name: 'calculate_growth_rate',
  description:
    'Calculate growth rate between two periods (current vs previous). Returns absolute growth, percentage growth, trend direction, and magnitude classification. Useful for period-over-period analysis.',
  input_schema: {
    type: 'object',
    properties: {
      current_value: {
        type: 'number',
        description: 'Current period value',
      },
      previous_value: {
        type: 'number',
        description: 'Previous period value',
      },
      decimal_places: {
        type: 'number',
        description: 'Number of decimal places for rounding (default: 2)',
      },
    },
    required: ['current_value', 'previous_value'],
  },
  handler: async (input: {
    current_value: number;
    previous_value: number;
    decimal_places?: number;
  }): Promise<GrowthRate> => {
    console.log('📈 calculate_growth_rate', input);

    const current = input.current_value;
    const previous = input.previous_value;
    const decimalPlaces = input.decimal_places || 2;

    // Handle edge cases
    if (previous === 0 && current === 0) {
      return {
        growth_rate: 0,
        growth_percentage: 0,
        trend: 'stable',
        change_magnitude: 'minimal',
      };
    }

    if (previous === 0) {
      return {
        growth_rate: current,
        growth_percentage: 100, // Infinite growth, capped at 100%
        trend: current > 0 ? 'increasing' : 'stable',
        change_magnitude: 'significant',
      };
    }

    // Calculate growth
    const growth_rate = current - previous;
    const growth_percentage = (growth_rate / previous) * 100;

    // Determine trend
    let trend: 'increasing' | 'decreasing' | 'stable';
    if (Math.abs(growth_percentage) < 1) {
      trend = 'stable';
    } else if (growth_percentage > 0) {
      trend = 'increasing';
    } else {
      trend = 'decreasing';
    }

    // Determine magnitude
    let change_magnitude: 'significant' | 'moderate' | 'minimal';
    const abs_growth_pct = Math.abs(growth_percentage);
    if (abs_growth_pct >= 20) {
      change_magnitude = 'significant';
    } else if (abs_growth_pct >= 5) {
      change_magnitude = 'moderate';
    } else {
      change_magnitude = 'minimal';
    }

    return {
      growth_rate: parseFloat(growth_rate.toFixed(decimalPlaces)),
      growth_percentage: parseFloat(growth_percentage.toFixed(decimalPlaces)),
      trend,
      change_magnitude,
    };
  },
};

// ============================================================================
// EXPORT ALL TOOLS
// ============================================================================

export const ANALYTICS_TOOLS: AgentTool[] = [
  calculateRFMScoreTool,
  detectAnomaliesTool,
  calculateGrowthRateTool,
];

/**
 * Execute tool call by name
 */
export async function executeAnalyticsToolCall(toolName: string, input: any): Promise<any> {
  const tool = ANALYTICS_TOOLS.find((t) => t.name === toolName);
  if (!tool) {
    throw new Error(`Analytics tool not found: ${toolName}`);
  }
  return await tool.handler(input);
}
