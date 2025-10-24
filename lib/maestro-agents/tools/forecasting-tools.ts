/**
 * FORECASTING & SEASONALITY TOOLS
 * Tools for sales forecasting and seasonal pattern detection
 */

import { sql } from '@vercel/postgres';
import type { AgentTool } from '../types';

// ============================================================================
// TOOL: forecast_sales
// ============================================================================

/**
 * Sales Forecast Interface
 */
interface SalesForecastInput {
  historical_sales: Array<{
    date: string;
    amount: number;
  }>;
  periods: number;
}

interface ForecastPeriod {
  period: number;
  predicted_amount: number;
  confidence_interval: {
    lower: number;
    upper: number;
  };
}

interface SalesForecastOutput {
  forecast: ForecastPeriod[];
  trend: string;
  methodology: string;
  confidence_score: number;
}

export const forecastSalesTool: AgentTool = {
  name: 'forecast_sales',
  description:
    'Forecast sales for the next N periods using linear regression and moving average analysis. Returns predicted amounts with confidence intervals and trend analysis.',
  input_schema: {
    type: 'object',
    properties: {
      historical_sales: {
        type: 'array',
        description: 'Array of historical sales data with date and amount',
        items: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              description: 'Date in ISO format (YYYY-MM-DD)',
            },
            amount: {
              type: 'number',
              description: 'Sales amount for the period',
            },
          },
        },
      },
      periods: {
        type: 'number',
        description: 'Number of periods to forecast ahead (e.g., 30 for 30 days)',
      },
    },
    required: ['historical_sales', 'periods'],
  },
  handler: async (input: SalesForecastInput): Promise<SalesForecastOutput> => {
    console.log('🔍 forecast_sales', input);

    try {
      const { historical_sales, periods } = input;

      // Validate input
      if (historical_sales.length < 2) {
        throw new Error('Need at least 2 historical data points to forecast');
      }

      if (periods <= 0 || periods > 365) {
        throw new Error('Periods must be between 1 and 365');
      }

      // Sort data by date
      const sortedData = [...historical_sales].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      // Calculate linear regression
      const n = sortedData.length;
      const amounts = sortedData.map((d) => d.amount);
      const indices = Array.from({ length: n }, (_, i) => i);

      // Calculate means
      const meanX = indices.reduce((sum, x) => sum + x, 0) / n;
      const meanY = amounts.reduce((sum, y) => sum + y, 0) / n;

      // Calculate slope and intercept
      let numerator = 0;
      let denominator = 0;

      for (let i = 0; i < n; i++) {
        numerator += (indices[i] - meanX) * (amounts[i] - meanY);
        denominator += Math.pow(indices[i] - meanX, 2);
      }

      const slope = denominator !== 0 ? numerator / denominator : 0;
      const intercept = meanY - slope * meanX;

      // Calculate R-squared for confidence
      const yPredicted = indices.map((x) => slope * x + intercept);
      const ssRes = amounts.reduce((sum, y, i) => sum + Math.pow(y - yPredicted[i], 2), 0);
      const ssTot = amounts.reduce((sum, y) => sum + Math.pow(y - meanY, 2), 0);
      const rSquared = ssTot !== 0 ? 1 - ssRes / ssTot : 0;

      // Calculate standard error for confidence intervals
      const residuals = amounts.map((y, i) => y - yPredicted[i]);
      const variance = residuals.reduce((sum, r) => sum + r * r, 0) / (n - 2);
      const standardError = Math.sqrt(variance);

      // Determine trend
      let trend = 'stable';
      if (slope > meanY * 0.01) {
        trend = 'growing';
      } else if (slope < -meanY * 0.01) {
        trend = 'declining';
      }

      // Calculate moving average for smoothing
      const movingAvgWindow = Math.min(7, Math.floor(n / 3));
      const recentAvg =
        amounts.slice(-movingAvgWindow).reduce((sum, a) => sum + a, 0) / movingAvgWindow;

      // Generate forecasts
      const forecast: ForecastPeriod[] = [];
      const confidenceScore = Math.max(0, Math.min(100, rSquared * 100));

      // Use weighted combination of linear regression and moving average
      const regressionWeight = rSquared;
      const movingAvgWeight = 1 - rSquared;

      for (let i = 1; i <= periods; i++) {
        const futureIndex = n + i - 1;

        // Linear regression prediction
        const regressionPrediction = slope * futureIndex + intercept;

        // Moving average prediction (assumes stable)
        const movingAvgPrediction = recentAvg;

        // Weighted combination
        const prediction =
          regressionPrediction * regressionWeight + movingAvgPrediction * movingAvgWeight;

        // Confidence interval (wider as we forecast further out)
        const futureDistance = i;
        const confidenceMultiplier = 1.96; // 95% confidence interval
        const intervalWidth =
          confidenceMultiplier * standardError * Math.sqrt(1 + futureDistance / n);

        forecast.push({
          period: i,
          predicted_amount: Math.max(0, Math.round(prediction * 100) / 100),
          confidence_interval: {
            lower: Math.max(0, Math.round((prediction - intervalWidth) * 100) / 100),
            upper: Math.max(0, Math.round((prediction + intervalWidth) * 100) / 100),
          },
        });
      }

      return {
        forecast,
        trend,
        methodology: `Linear regression (R²=${(rSquared * 100).toFixed(1)}%) weighted with ${movingAvgWindow}-period moving average`,
        confidence_score: Math.round(confidenceScore),
      };
    } catch (error) {
      console.error('Error in forecast_sales:', error);
      throw new Error(`Failed to forecast sales: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
};

// ============================================================================
// TOOL: detect_seasonality
// ============================================================================

/**
 * Seasonality Detection Interface
 */
interface SeasonalityInput {
  sales_data: Array<{
    month: number;
    amount: number;
  }>;
}

interface SeasonalityOutput {
  has_seasonality: boolean;
  peak_months: number[];
  pattern: string;
  seasonal_indices: Record<number, number>;
  insights: string;
}

export const detectSeasonalityTool: AgentTool = {
  name: 'detect_seasonality',
  description:
    'Detect seasonal patterns in sales data by analyzing monthly variations. Identifies peak months, seasonal indices, and provides actionable insights.',
  input_schema: {
    type: 'object',
    properties: {
      sales_data: {
        type: 'array',
        description: 'Array of monthly sales data with month (1-12) and amount',
        items: {
          type: 'object',
          properties: {
            month: {
              type: 'number',
              description: 'Month number (1-12)',
            },
            amount: {
              type: 'number',
              description: 'Sales amount for the month',
            },
          },
        },
      },
    },
    required: ['sales_data'],
  },
  handler: async (input: SeasonalityInput): Promise<SeasonalityOutput> => {
    console.log('🔍 detect_seasonality', input);

    try {
      const { sales_data } = input;

      // Validate input
      if (sales_data.length < 3) {
        throw new Error('Need at least 3 months of data to detect seasonality');
      }

      // Group data by month (aggregate multiple years)
      const monthlyData: Record<number, number[]> = {};
      for (let i = 1; i <= 12; i++) {
        monthlyData[i] = [];
      }

      sales_data.forEach((data) => {
        if (data.month >= 1 && data.month <= 12) {
          monthlyData[data.month].push(data.amount);
        }
      });

      // Calculate average for each month
      const monthlyAverages: Record<number, number> = {};
      let overallTotal = 0;
      let totalMonthsWithData = 0;

      for (let month = 1; month <= 12; month++) {
        if (monthlyData[month].length > 0) {
          const avg = monthlyData[month].reduce((sum, val) => sum + val, 0) / monthlyData[month].length;
          monthlyAverages[month] = avg;
          overallTotal += avg;
          totalMonthsWithData++;
        }
      }

      const overallAverage = totalMonthsWithData > 0 ? overallTotal / totalMonthsWithData : 0;

      // Calculate seasonal indices (month average / overall average)
      const seasonalIndices: Record<number, number> = {};
      for (let month = 1; month <= 12; month++) {
        if (monthlyAverages[month] !== undefined) {
          seasonalIndices[month] =
            overallAverage > 0
              ? Math.round((monthlyAverages[month] / overallAverage) * 100) / 100
              : 1.0;
        }
      }

      // Detect seasonality based on coefficient of variation
      const monthlyValues = Object.values(monthlyAverages);
      if (monthlyValues.length < 3) {
        return {
          has_seasonality: false,
          peak_months: [],
          pattern: 'insufficient_data',
          seasonal_indices: seasonalIndices,
          insights: 'Insufficient data to determine seasonality. Need more historical months.',
        };
      }

      const mean = monthlyValues.reduce((sum, val) => sum + val, 0) / monthlyValues.length;
      const variance =
        monthlyValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / monthlyValues.length;
      const stdDev = Math.sqrt(variance);
      const coefficientOfVariation = mean > 0 ? (stdDev / mean) * 100 : 0;

      // Seasonality threshold: CV > 15% indicates seasonality
      const hasSeasonality = coefficientOfVariation > 15;

      // Identify peak months (indices > 1.15)
      const peakMonths: number[] = [];
      for (let month = 1; month <= 12; month++) {
        if (seasonalIndices[month] && seasonalIndices[month] > 1.15) {
          peakMonths.push(month);
        }
      }

      // Determine pattern
      let pattern = 'no_clear_pattern';
      if (hasSeasonality) {
        // Check for specific patterns
        const q1 = [1, 2, 3];
        const q2 = [4, 5, 6];
        const q3 = [7, 8, 9];
        const q4 = [10, 11, 12];
        const summer = [6, 7, 8];
        const winter = [12, 1, 2];
        const holiday = [11, 12];

        const q1Peaks = peakMonths.filter((m) => q1.includes(m)).length;
        const q2Peaks = peakMonths.filter((m) => q2.includes(m)).length;
        const q3Peaks = peakMonths.filter((m) => q3.includes(m)).length;
        const q4Peaks = peakMonths.filter((m) => q4.includes(m)).length;
        const summerPeaks = peakMonths.filter((m) => summer.includes(m)).length;
        const winterPeaks = peakMonths.filter((m) => winter.includes(m)).length;
        const holidayPeaks = peakMonths.filter((m) => holiday.includes(m)).length;

        if (holidayPeaks >= 2) {
          pattern = 'holiday_driven';
        } else if (summerPeaks >= 2) {
          pattern = 'summer_peak';
        } else if (winterPeaks >= 2) {
          pattern = 'winter_peak';
        } else if (q4Peaks >= 2) {
          pattern = 'q4_driven';
        } else if (q1Peaks >= 2) {
          pattern = 'q1_driven';
        } else if (peakMonths.length > 0) {
          pattern = 'multi_peak';
        }
      }

      // Generate insights
      const monthNames = [
        '',
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ];

      let insights = '';
      if (!hasSeasonality) {
        insights =
          'No significant seasonal pattern detected. Sales are relatively stable throughout the year. Focus on consistent customer engagement.';
      } else {
        const peakMonthNames = peakMonths.map((m) => monthNames[m]).join(', ');
        insights = `Strong seasonal pattern detected (CV: ${coefficientOfVariation.toFixed(1)}%). Peak months: ${peakMonthNames}. `;

        if (pattern === 'holiday_driven') {
          insights +=
            'Sales spike during holiday season. Prepare inventory and marketing campaigns 2-3 months in advance.';
        } else if (pattern === 'summer_peak') {
          insights +=
            'Summer months show highest sales. Increase sales team activity and promotions from May-August.';
        } else if (pattern === 'winter_peak') {
          insights +=
            'Winter months drive peak sales. Focus resources and inventory planning for Q4-Q1.';
        } else if (pattern === 'q4_driven') {
          insights +=
            'Q4 shows strongest performance. Year-end planning and customer outreach crucial.';
        } else if (pattern === 'q1_driven') {
          insights +=
            'Q1 drives peak sales. New year planning and fresh inventory key to success.';
        } else {
          insights += 'Multiple peak periods throughout year. Maintain flexible inventory and staffing.';
        }
      }

      return {
        has_seasonality: hasSeasonality,
        peak_months: peakMonths,
        pattern,
        seasonal_indices: seasonalIndices,
        insights,
      };
    } catch (error) {
      console.error('Error in detect_seasonality:', error);
      throw new Error(`Failed to detect seasonality: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
};

// ============================================================================
// EXPORT ALL TOOLS
// ============================================================================

export const forecastingTools: AgentTool[] = [
  forecastSalesTool,
  detectSeasonalityTool,
];

/**
 * Execute a forecasting tool call
 */
export async function executeForecastingToolCall(toolName: string, input: any): Promise<any> {
  const tool = forecastingTools.find((t) => t.name === toolName);
  if (!tool) {
    throw new Error(`Tool ${toolName} not found in forecasting tools`);
  }
  return await tool.handler(input);
}
