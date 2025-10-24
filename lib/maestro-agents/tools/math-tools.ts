/**
 * MATHEMATICAL & STATISTICAL TOOLS
 * Advanced mathematical tools for Agent 5: Analytics & Math Agent
 * Provides statistical analysis, forecasting, and correlation analysis
 */

import type { AgentTool } from '../types';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface Statistics {
  mean: number;
  median: number;
  mode: number | number[] | null;
  std_dev: number;
  variance: number;
  min: number;
  max: number;
  range: number;
  percentiles: {
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    p95: number;
  };
  count: number;
  sum: number;
}

interface LinearRegressionResult {
  forecast: number[];
  slope: number;
  intercept: number;
  r_squared: number;
  confidence: 'low' | 'medium' | 'high';
  trend: 'increasing' | 'decreasing' | 'stable';
  equation: string;
}

interface CorrelationResult {
  correlation_coefficient: number;
  strength: 'very_weak' | 'weak' | 'moderate' | 'strong' | 'very_strong';
  direction: 'positive' | 'negative' | 'none';
  r_squared: number;
  interpretation: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate mean (average)
 */
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate median
 */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Calculate mode (most frequent value)
 */
function mode(values: number[]): number | number[] | null {
  if (values.length === 0) return null;

  const frequency: Record<number, number> = {};
  values.forEach((val) => {
    frequency[val] = (frequency[val] || 0) + 1;
  });

  const maxFreq = Math.max(...Object.values(frequency));
  if (maxFreq === 1) return null; // No mode if all values appear once

  const modes = Object.keys(frequency)
    .filter((key) => frequency[Number(key)] === maxFreq)
    .map(Number);

  return modes.length === 1 ? modes[0] : modes;
}

/**
 * Calculate variance
 */
function variance(values: number[]): number {
  if (values.length === 0) return 0;
  const m = mean(values);
  return values.reduce((sum, val) => sum + Math.pow(val - m, 2), 0) / values.length;
}

/**
 * Calculate standard deviation
 */
function stdDev(values: number[]): number {
  return Math.sqrt(variance(values));
}

/**
 * Calculate percentile
 */
function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index % 1;

  if (lower === upper) return sorted[lower];
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Calculate Pearson correlation coefficient
 */
function pearsonCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) {
    throw new Error('Datasets must have the same non-zero length');
  }

  const n = x.length;
  const meanX = mean(x);
  const meanY = mean(y);

  let numerator = 0;
  let sumXSquared = 0;
  let sumYSquared = 0;

  for (let i = 0; i < n; i++) {
    const deltaX = x[i] - meanX;
    const deltaY = y[i] - meanY;
    numerator += deltaX * deltaY;
    sumXSquared += deltaX * deltaX;
    sumYSquared += deltaY * deltaY;
  }

  const denominator = Math.sqrt(sumXSquared * sumYSquared);
  if (denominator === 0) return 0;

  return numerator / denominator;
}

// ============================================================================
// TOOL 5.4: calculate_statistics
// ============================================================================

export const calculateStatisticsTool: AgentTool = {
  name: 'calculate_statistics',
  description:
    'Calculate comprehensive statistical metrics for a dataset. Returns mean, median, mode, standard deviation, variance, min, max, and percentiles (25th, 50th, 75th, 90th, 95th). Essential for data analysis and understanding distributions.',
  input_schema: {
    type: 'object',
    properties: {
      values: {
        type: 'array',
        description: 'Array of numeric values to analyze',
        items: {
          type: 'number',
        },
      },
      decimal_places: {
        type: 'number',
        description: 'Number of decimal places for rounding (default: 2)',
      },
    },
    required: ['values'],
  },
  handler: async (input: {
    values: number[];
    decimal_places?: number;
  }): Promise<Statistics> => {
    console.log('📊 calculate_statistics', { value_count: input.values.length });

    if (!input.values || input.values.length === 0) {
      throw new Error('At least one value is required for statistical analysis');
    }

    const values = input.values;
    const decimalPlaces = input.decimal_places || 2;

    const roundTo = (num: number) => parseFloat(num.toFixed(decimalPlaces));

    const stats: Statistics = {
      mean: roundTo(mean(values)),
      median: roundTo(median(values)),
      mode: mode(values),
      std_dev: roundTo(stdDev(values)),
      variance: roundTo(variance(values)),
      min: roundTo(Math.min(...values)),
      max: roundTo(Math.max(...values)),
      range: roundTo(Math.max(...values) - Math.min(...values)),
      percentiles: {
        p25: roundTo(percentile(values, 25)),
        p50: roundTo(percentile(values, 50)),
        p75: roundTo(percentile(values, 75)),
        p90: roundTo(percentile(values, 90)),
        p95: roundTo(percentile(values, 95)),
      },
      count: values.length,
      sum: roundTo(values.reduce((sum, val) => sum + val, 0)),
    };

    return stats;
  },
};

// ============================================================================
// TOOL 5.5: forecast_linear_regression
// ============================================================================

export const forecastLinearRegressionTool: AgentTool = {
  name: 'forecast_linear_regression',
  description:
    'Perform simple linear regression forecasting on historical time series data. Predicts future values based on historical trends. Returns forecast array, slope, intercept, R-squared (goodness of fit), and trend direction. Best for data with linear trends.',
  input_schema: {
    type: 'object',
    properties: {
      historical_values: {
        type: 'array',
        description: 'Historical data points in chronological order',
        items: {
          type: 'number',
        },
      },
      periods_ahead: {
        type: 'number',
        description: 'Number of periods to forecast into the future',
      },
      decimal_places: {
        type: 'number',
        description: 'Number of decimal places for rounding (default: 2)',
      },
    },
    required: ['historical_values', 'periods_ahead'],
  },
  handler: async (input: {
    historical_values: number[];
    periods_ahead: number;
    decimal_places?: number;
  }): Promise<LinearRegressionResult> => {
    console.log('📈 forecast_linear_regression', {
      historical_count: input.historical_values.length,
      periods_ahead: input.periods_ahead,
    });

    if (!input.historical_values || input.historical_values.length < 2) {
      throw new Error('At least 2 historical data points are required for forecasting');
    }

    if (input.periods_ahead < 1) {
      throw new Error('periods_ahead must be at least 1');
    }

    const values = input.historical_values;
    const n = values.length;
    const decimalPlaces = input.decimal_places || 2;
    const roundTo = (num: number) => parseFloat(num.toFixed(decimalPlaces));

    // Create x values (time indices: 0, 1, 2, ...)
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;

    // Calculate slope (m) and intercept (b) for y = mx + b
    const meanX = mean(x);
    const meanY = mean(y);

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (x[i] - meanX) * (y[i] - meanY);
      denominator += Math.pow(x[i] - meanX, 2);
    }

    const slope = denominator === 0 ? 0 : numerator / denominator;
    const intercept = meanY - slope * meanX;

    // Calculate R-squared (coefficient of determination)
    const predictions = x.map((xi) => slope * xi + intercept);
    const ssRes = y.reduce((sum, yi, i) => sum + Math.pow(yi - predictions[i], 2), 0);
    const ssTot = y.reduce((sum, yi) => sum + Math.pow(yi - meanY, 2), 0);
    const r_squared = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

    // Generate forecast
    const forecast: number[] = [];
    for (let i = 0; i < input.periods_ahead; i++) {
      const futureX = n + i;
      const forecastValue = slope * futureX + intercept;
      forecast.push(roundTo(forecastValue));
    }

    // Determine confidence based on R-squared
    let confidence: 'low' | 'medium' | 'high';
    if (r_squared >= 0.7) confidence = 'high';
    else if (r_squared >= 0.4) confidence = 'medium';
    else confidence = 'low';

    // Determine trend
    let trend: 'increasing' | 'decreasing' | 'stable';
    if (Math.abs(slope) < 0.01) trend = 'stable';
    else if (slope > 0) trend = 'increasing';
    else trend = 'decreasing';

    const equation = `y = ${roundTo(slope)}x + ${roundTo(intercept)}`;

    return {
      forecast,
      slope: roundTo(slope),
      intercept: roundTo(intercept),
      r_squared: roundTo(r_squared),
      confidence,
      trend,
      equation,
    };
  },
};

// ============================================================================
// TOOL 5.6: calculate_correlation
// ============================================================================

export const calculateCorrelationTool: AgentTool = {
  name: 'calculate_correlation',
  description:
    'Calculate Pearson correlation coefficient between two datasets. Measures linear relationship strength and direction. Returns correlation coefficient (-1 to +1), strength classification, R-squared, and interpretation. Perfect for analyzing relationships between variables.',
  input_schema: {
    type: 'object',
    properties: {
      dataset1: {
        type: 'array',
        description: 'First dataset (numeric values)',
        items: {
          type: 'number',
        },
      },
      dataset2: {
        type: 'array',
        description: 'Second dataset (numeric values, must have same length as dataset1)',
        items: {
          type: 'number',
        },
      },
      decimal_places: {
        type: 'number',
        description: 'Number of decimal places for rounding (default: 4)',
      },
    },
    required: ['dataset1', 'dataset2'],
  },
  handler: async (input: {
    dataset1: number[];
    dataset2: number[];
    decimal_places?: number;
  }): Promise<CorrelationResult> => {
    console.log('🔗 calculate_correlation', {
      dataset1_count: input.dataset1.length,
      dataset2_count: input.dataset2.length,
    });

    if (!input.dataset1 || !input.dataset2) {
      throw new Error('Both datasets are required');
    }

    if (input.dataset1.length !== input.dataset2.length) {
      throw new Error('Both datasets must have the same length');
    }

    if (input.dataset1.length < 2) {
      throw new Error('At least 2 data points are required in each dataset');
    }

    const decimalPlaces = input.decimal_places || 4;
    const roundTo = (num: number) => parseFloat(num.toFixed(decimalPlaces));

    // Calculate Pearson correlation coefficient
    const r = pearsonCorrelation(input.dataset1, input.dataset2);
    const correlation_coefficient = roundTo(r);
    const r_squared = roundTo(r * r);

    // Determine strength
    const absR = Math.abs(r);
    let strength: 'very_weak' | 'weak' | 'moderate' | 'strong' | 'very_strong';
    if (absR >= 0.8) strength = 'very_strong';
    else if (absR >= 0.6) strength = 'strong';
    else if (absR >= 0.4) strength = 'moderate';
    else if (absR >= 0.2) strength = 'weak';
    else strength = 'very_weak';

    // Determine direction
    let direction: 'positive' | 'negative' | 'none';
    if (r > 0.1) direction = 'positive';
    else if (r < -0.1) direction = 'negative';
    else direction = 'none';

    // Generate interpretation
    let interpretation: string;
    if (absR >= 0.8) {
      interpretation = `Very strong ${direction} correlation. Variables are highly ${
        direction === 'positive' ? 'directly' : 'inversely'
      } related.`;
    } else if (absR >= 0.6) {
      interpretation = `Strong ${direction} correlation. Variables show a clear ${
        direction === 'positive' ? 'direct' : 'inverse'
      } relationship.`;
    } else if (absR >= 0.4) {
      interpretation = `Moderate ${direction} correlation. Variables have a noticeable ${
        direction === 'positive' ? 'direct' : 'inverse'
      } relationship.`;
    } else if (absR >= 0.2) {
      interpretation = `Weak ${direction} correlation. Variables show slight ${
        direction === 'positive' ? 'direct' : 'inverse'
      } relationship.`;
    } else {
      interpretation = 'Very weak or no correlation. Variables appear to be independent.';
    }

    return {
      correlation_coefficient,
      strength,
      direction,
      r_squared,
      interpretation,
    };
  },
};

// ============================================================================
// EXPORT ALL TOOLS
// ============================================================================

export const MATH_TOOLS: AgentTool[] = [
  calculateStatisticsTool,
  forecastLinearRegressionTool,
  calculateCorrelationTool,
];

/**
 * Execute tool call by name
 */
export async function executeMathToolCall(toolName: string, input: any): Promise<any> {
  const tool = MATH_TOOLS.find((t) => t.name === toolName);
  if (!tool) {
    throw new Error(`Math tool not found: ${toolName}`);
  }
  return await tool.handler(input);
}
