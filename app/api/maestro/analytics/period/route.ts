/**
 * MAESTRO AI - Period-Specific Analytics API
 *
 * GET /api/maestro/analytics/period
 *
 * Queries Odoo directly for period-specific metrics (not lifetime totals)
 * Query params:
 * - period: week | month | quarter | year
 * - salesperson_id: filter by salesperson (optional)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPeriodMetrics, getRevenueTrend, calculateDateRange } from '@/lib/maestro/period-metrics';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = (searchParams.get('period') || 'quarter') as 'week' | 'month' | 'quarter' | 'year';
    const salespersonIdStr = searchParams.get('salesperson_id');
    const salespersonId = salespersonIdStr ? parseInt(salespersonIdStr) : undefined;
    const includeTrend = searchParams.get('include_trend') !== 'false'; // Default: true

    console.log('\n📊 [PERIOD-ANALYTICS] Request:', {
      period,
      salesperson_id: salespersonId || 'ALL',
      include_trend: includeTrend
    });

    // Calculate date range
    const { startDate, endDate } = calculateDateRange(period);

    console.log('📅 [PERIOD-ANALYTICS] Date range:', {
      startDate: new Date(startDate).toLocaleDateString('it-IT'),
      endDate: new Date(endDate).toLocaleDateString('it-IT')
    });

    // Fetch period-specific metrics from Odoo
    const metrics = await getPeriodMetrics(salespersonId, startDate, endDate);

    // Fetch trend data if requested
    let trend = null;
    if (includeTrend) {
      trend = await getRevenueTrend(period, salespersonId);
    }

    console.log('✅ [PERIOD-ANALYTICS] Results:', { ...metrics, trendPoints: trend?.length || 0 });

    return NextResponse.json({
      success: true,
      period,
      salesperson_id: salespersonId,
      date_range: {
        start: startDate,
        end: endDate
      },
      metrics,
      trend
    });

  } catch (error: any) {
    console.error('❌ [PERIOD-ANALYTICS] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'PERIOD_ANALYTICS_FAILED',
          message: error.message || 'Failed to fetch period analytics'
        }
      },
      { status: 500 }
    );
  }
}
